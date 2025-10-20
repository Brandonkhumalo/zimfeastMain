from django.db import models
from django.conf import settings
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

class Restaurant(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="restaurants",
        on_delete=models.CASCADE
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=30, blank=True)
    description = models.TextField(blank=True)
    profile_image = models.ImageField(upload_to="restaurant_profiles/", null=True, blank=True)
    full_address = models.CharField(max_length=500)  # full textual address saved from frontend
    lat = models.FloatField()
    lng = models.FloatField()
    minimum_order_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    est_delivery_time = models.CharField(max_length=50, blank=True)  # e.g. "30-45 mins"
    cuisines = models.ManyToManyField(CuisineType, blank=True)
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class RestaurantExternalAPI(models.Model):
    """
    Stores external APIs provided by the restaurant.
    category: arbitrary identifier used by the frontend/backend to decide which API to call,
              e.g. 'menu_api', 'meal_data', 'categories', etc.
    """
    restaurant = models.ForeignKey(
        Restaurant,
        related_name="external_apis",
        on_delete=models.CASCADE
    )
    category = models.CharField(max_length=100)
    api_url = models.URLField()
    api_key = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ("restaurant", "category")

    def __str__(self):
        return f"{self.restaurant.name} - {self.category}"

class MenuItem(models.Model):
    restaurant = models.ForeignKey(
        Restaurant,
        related_name="menu_items",
        on_delete=models.CASCADE
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=8, decimal_places=2)  # USD
    description = models.TextField(blank=True)
    category = models.ManyToManyField(CategoryType, blank=True)  # category is a string (e.g., Pizza, Burgers)
    prep_time = models.IntegerField(null=True, blank=True, help_text="Preparation time in minutes")
    available = models.BooleanField(default=True)
    item_image = models.ImageField(upload_to="menu_items/")  # Mandatory field - enforced by frontend
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["restaurant", "name"]),
        ]

    def __str__(self):
        return f"{self.restaurant.name} - {self.name}"

class RestaurantDashboard(models.Model):
    restaurant = models.OneToOneField(
        "Restaurant", related_name="dashboard", on_delete=models.CASCADE
    )
    today_orders = models.IntegerField(default=0)
    today_revenue = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    today_average_rating = models.FloatField(default=3.0)  # default 3
    preparing = models.JSONField(default=list)  # list of order IDs/items
    pending = models.JSONField(default=list)    # list of order IDs/items
    completed = models.JSONField(default=list)  # list of order IDs/items
    last_updated = models.DateTimeField(auto_now=True)

    def reset_today_if_needed(self):
        """
        Optionally implement daily reset if needed
        """
        today = timezone.now().date()
        if getattr(self, "_last_reset", None) != today:
            self.today_orders = 0
            self.today_revenue = 0
            self.preparing = []
            self.pending = []
            self.completed = []
            self._last_reset = today
            self.save()

    def __str__(self):
        return f"Dashboard - {self.restaurant.name}"