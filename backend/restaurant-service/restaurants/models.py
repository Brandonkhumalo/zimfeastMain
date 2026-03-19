from django.db import models
from django.utils import timezone
import uuid


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
    menu_api_key = models.CharField(max_length=255, blank=True)
    order_webhook_url = models.URLField(blank=True, help_text="Webhook URL to notify chain when orders arrive")
    order_webhook_secret = models.CharField(max_length=255, blank=True)
    accepts_direct_payment = models.BooleanField(default=False, help_text="If true, customers pay the restaurant directly")
    paynow_integration_id = models.CharField(max_length=50, blank=True)
    paynow_integration_key = models.CharField(max_length=255, blank=True)
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
    created = models.DateTimeField(auto_now_add=True)

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
    preparing = models.JSONField(default=list)
    pending = models.JSONField(default=list)
    completed = models.JSONField(default=list)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dashboard - {self.restaurant.name}"


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
