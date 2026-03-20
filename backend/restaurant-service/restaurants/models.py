from django.db import models
from django.utils import timezone
import uuid
import os
import base64
import logging
from datetime import datetime, time
import pytz

logger = logging.getLogger(__name__)


class EncryptedCharField(models.CharField):
    """
    A CharField that transparently encrypts values before storing them in the
    database and decrypts them when reading.  Uses Fernet symmetric encryption
    from the `cryptography` library.

    The encryption key is read from the FIELD_ENCRYPTION_KEY environment variable
    (or Django settings.FIELD_ENCRYPTION_KEY).  The key must be a URL-safe
    base64-encoded 32-byte key — generate one with:

        python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

    If no key is configured the field falls back to plaintext storage and logs a
    warning so the application can still start during development.
    """

    _fernet = None  # class-level cache so we don't rebuild it on every call

    @classmethod
    def _get_fernet(cls):
        """Return a cached Fernet instance, or None if no key is available."""
        if cls._fernet is not None:
            return cls._fernet

        from django.conf import settings as django_settings

        key = os.environ.get("FIELD_ENCRYPTION_KEY") or getattr(
            django_settings, "FIELD_ENCRYPTION_KEY", None
        )
        if not key:
            logger.warning(
                "FIELD_ENCRYPTION_KEY is not set — EncryptedCharField will "
                "store values in PLAINTEXT. Set this variable before going to production."
            )
            return None

        try:
            from cryptography.fernet import Fernet

            cls._fernet = Fernet(key.encode() if isinstance(key, str) else key)
            return cls._fernet
        except Exception as exc:
            logger.error("Failed to initialise Fernet cipher: %s", exc)
            return None

    # ── Writing to DB ──────────────────────────────────────────────
    def get_prep_value(self, value):
        """Encrypt the value before it is sent to the database."""
        value = super().get_prep_value(value)
        if value is None or value == "":
            return value
        fernet = self._get_fernet()
        if fernet is None:
            return value  # plaintext fallback
        # Already-encrypted values start with "gAAAAA" (Fernet token prefix).
        # Guard against double-encryption when Django calls get_prep_value
        # multiple times (e.g. during migrations or bulk updates).
        if isinstance(value, str) and value.startswith("gAAAAA"):
            return value
        encrypted = fernet.encrypt(value.encode("utf-8"))
        return encrypted.decode("utf-8")

    # ── Reading from DB ────────────────────────────────────────────
    def from_db_value(self, value, expression, connection):
        """Decrypt the value coming from the database."""
        if value is None or value == "":
            return value
        fernet = self._get_fernet()
        if fernet is None:
            return value  # plaintext fallback
        try:
            decrypted = fernet.decrypt(value.encode("utf-8"))
            return decrypted.decode("utf-8")
        except Exception:
            # Value might be stored in plaintext from before encryption was
            # enabled.  Return as-is rather than crashing.
            return value


class CuisineType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class CategoryType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class RestaurantChain(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to="chain_logos/", null=True, blank=True)
    website = models.URLField(blank=True)
    menu_api_url = models.URLField(blank=True, help_text="Central API URL to sync menus across all branches")
    menu_api_key = EncryptedCharField(max_length=500, blank=True)
    order_webhook_url = models.URLField(blank=True, help_text="Webhook URL to notify chain when orders arrive")
    order_webhook_secret = EncryptedCharField(max_length=500, blank=True)
    accepts_direct_payment = models.BooleanField(default=False, help_text="If true, customers pay the restaurant directly")
    paynow_integration_id = models.CharField(max_length=50, blank=True)
    paynow_integration_key = EncryptedCharField(max_length=500, blank=True)
    platform_commission_pct = models.DecimalField(max_digits=5, decimal_places=2, default=15.00, help_text="Platform commission percentage")
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Restaurant(models.Model):
    # References user by UUID - no FK to auth service
    owner_id = models.UUIDField(db_index=True)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=30, blank=True)
    description = models.TextField(blank=True)
    profile_image = models.ImageField(upload_to="restaurant_profiles/", null=True, blank=True)
    full_address = models.CharField(max_length=500)
    lat = models.FloatField()
    lng = models.FloatField()
    minimum_order_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    est_delivery_time = models.CharField(max_length=50, blank=True)
    cuisines = models.ManyToManyField(CuisineType, blank=True)
    chain = models.ForeignKey(RestaurantChain, related_name="restaurants", on_delete=models.SET_NULL, null=True, blank=True)
    # Denormalized rating fields — updated whenever a new review is submitted
    average_rating = models.FloatField(default=0)
    total_reviews = models.IntegerField(default=0)
    # Operating hours
    opening_time = models.TimeField(null=True, blank=True, help_text="Daily opening time")
    closing_time = models.TimeField(null=True, blank=True, help_text="Daily closing time")
    is_open_override = models.BooleanField(
        null=True, blank=True,
        help_text="Manual override: True=force open, False=force closed, None=use schedule"
    )
    created = models.DateTimeField(auto_now_add=True)

    @property
    def is_currently_open(self):
        """
        Determine if the restaurant is currently open.
        1. If is_open_override is not None, return its value (manual toggle).
        2. If opening_time and closing_time are set, check if the current time
           in Zimbabwe (UTC+2, CAT timezone) falls within operating hours.
        3. If no hours are set, default to open (True).
        """
        # Manual override takes precedence
        if self.is_open_override is not None:
            return self.is_open_override

        # Check schedule-based hours
        if self.opening_time and self.closing_time:
            # Zimbabwe uses Central Africa Time (CAT) = UTC+2
            cat_tz = pytz.timezone("Africa/Harare")
            now = datetime.now(cat_tz).time()

            # Handle normal schedule (e.g., 08:00 - 22:00)
            if self.opening_time <= self.closing_time:
                return self.opening_time <= now <= self.closing_time
            else:
                # Handle overnight schedule (e.g., 22:00 - 04:00)
                return now >= self.opening_time or now <= self.closing_time

        # No hours configured: default to open
        return True

    def __str__(self):
        return self.name


class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(Restaurant, related_name="branches", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=500)
    lat = models.FloatField()
    lng = models.FloatField()
    phone_number = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["restaurant", "is_active"])]

    def __str__(self):
        return f"{self.restaurant.name} - {self.name}"


class RestaurantExternalAPI(models.Model):
    restaurant = models.ForeignKey(Restaurant, related_name="external_apis", on_delete=models.CASCADE)
    category = models.CharField(max_length=100)
    api_url = models.URLField()
    api_key = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ("restaurant", "category")

    def __str__(self):
        return f"{self.restaurant.name} - {self.category}"


class MenuItem(models.Model):
    restaurant = models.ForeignKey(Restaurant, related_name="menu_items", on_delete=models.CASCADE)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    description = models.TextField(blank=True)
    category = models.ManyToManyField(CategoryType, blank=True)
    prep_time = models.IntegerField(null=True, blank=True, help_text="Preparation time in minutes")
    available = models.BooleanField(default=True)
    item_image = models.ImageField(upload_to="menu_items/")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["restaurant", "name"])]

    def __str__(self):
        return f"{self.restaurant.name} - {self.name}"


class RestaurantDashboard(models.Model):
    restaurant = models.OneToOneField(Restaurant, related_name="dashboard", on_delete=models.CASCADE)
    today_orders = models.IntegerField(default=0)
    today_revenue = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    today_average_rating = models.FloatField(default=3.0)
    # DEPRECATED: These JSONField columns are kept for backward compatibility.
    # New code should use the DashboardOrder model (related_name="orders") instead.
    preparing = models.JSONField(default=list, help_text="DEPRECATED: Use DashboardOrder with status='preparing' instead")
    pending = models.JSONField(default=list, help_text="DEPRECATED: Use DashboardOrder with status='pending' instead")
    completed = models.JSONField(default=list, help_text="DEPRECATED: Use DashboardOrder with status='completed' instead")
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dashboard - {self.restaurant.name}"


class DashboardOrder(models.Model):
    """
    Normalized model for dashboard orders. Replaces the unqueryable JSONField
    columns (preparing, pending, completed) on RestaurantDashboard.
    Each row represents a single order snapshot tied to a dashboard and status.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dashboard = models.ForeignKey(RestaurantDashboard, related_name="orders", on_delete=models.CASCADE)
    order_id = models.UUIDField(db_index=True)
    status = models.CharField(max_length=20, choices=[
        ("pending", "Pending"),
        ("preparing", "Preparing"),
        ("completed", "Completed"),
    ])
    order_data = models.JSONField(default=dict)  # Stores the order snapshot
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["dashboard", "status"]),
            models.Index(fields=["-created"]),
        ]

    def __str__(self):
        return f"DashboardOrder {self.order_id} - {self.status}"


class RestaurantEarning(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(Restaurant, related_name="earnings", on_delete=models.CASCADE)
    order_id = models.UUIDField(db_index=True)
    order_total = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    platform_commission_pct = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2)
    restaurant_earning = models.DecimalField(max_digits=10, decimal_places=2)
    paid_direct = models.BooleanField(default=False, help_text="True if customer paid restaurant directly")
    settled = models.BooleanField(default=False, help_text="True if platform has settled with restaurant")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["restaurant", "settled"]),
            models.Index(fields=["-created"]),
        ]

    def __str__(self):
        return f"{self.restaurant.name} - Order {self.order_id} - ${self.restaurant_earning}"


class RestaurantFinanceSummary(models.Model):
    restaurant = models.OneToOneField(Restaurant, related_name="finance_summary", on_delete=models.CASCADE)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_platform_fees = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unsettled_platform_fees = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Accumulated fees restaurant owes platform")
    unsettled_delivery_fees = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Delivery fees restaurant owes platform from direct payments")
    total_debt = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Total amount restaurant owes platform (fees + delivery)")
    total_orders = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Finance - {self.restaurant.name} - Debt: ${self.total_debt}"


class RestaurantDebt(models.Model):
    """Tracks what a restaurant/franchise location owes us for direct-payment orders."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(Restaurant, related_name="debts", on_delete=models.CASCADE)
    order_id = models.UUIDField(db_index=True)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, help_text="Commission we charge")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, help_text="Delivery fee owed to us")
    total_owed = models.DecimalField(max_digits=10, decimal_places=2, help_text="platform_fee + delivery_fee")
    settled = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["restaurant", "settled"]),
            models.Index(fields=["-created"]),
        ]

    def __str__(self):
        return f"{self.restaurant.name} - Order {self.order_id} - Owes ${self.total_owed}"


class RestaurantReview(models.Model):
    """
    Customer review for a restaurant, tied to a specific order.
    Each order can only have one review (enforced by unique order_id).
    When a review is created the restaurant's denormalized average_rating
    and total_reviews fields are recalculated.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(Restaurant, related_name="reviews", on_delete=models.CASCADE)
    user_id = models.UUIDField(db_index=True)
    order_id = models.UUIDField(db_index=True, unique=True)  # One review per order
    rating = models.IntegerField()  # 1-5 stars
    comment = models.TextField(blank=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["restaurant", "-created"])]

    def __str__(self):
        return f"Review {self.id} - {self.restaurant.name} - {self.rating} stars"
