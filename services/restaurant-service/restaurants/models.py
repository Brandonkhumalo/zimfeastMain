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
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


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
