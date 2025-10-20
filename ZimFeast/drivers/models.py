from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model
import uuid
from django.utils import timezone

User = get_user_model()

class Driver(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    license_number = models.CharField(max_length=50)
    license_photo = models.ImageField(upload_to="drivers/license_photos/")
    vehicle_details = models.JSONField()
    vehicle_photo = models.ImageField(upload_to="drivers/vehicle_photos/")
    is_online = models.BooleanField(default=False)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.email} - {'Online' if self.is_online else 'Offline'}"

class DriverReject(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE)
    order_id = models.CharField(max_length=100)
    reason = models.CharField(max_length=255, blank=True)
    rejected_at = models.DateTimeField(auto_now_add=True)

class DriverOrderStatus(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name="current_order")
    order = models.OneToOneField("orders.Order", on_delete=models.CASCADE, related_name="assigned_driver_status")
    status = models.CharField(max_length=50, choices=[
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("delivering", "Delivering"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled")
    ], default="pending")
    assigned_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.driver.user.email} - {self.status}"

class DriverFinance(models.Model):
    driver = models.ForeignKey("Driver", on_delete=models.CASCADE, related_name="finances")
    date = models.DateField(default=timezone.localdate)
    today_deliveries = models.IntegerField(default=0)
    today_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    rating_sum = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    rating_count = models.IntegerField(default=0)
    hours_online = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    last_updated = models.DateTimeField(auto_now=True)

    @property
    def average_rating(self):
        return self.rating_sum / self.rating_count if self.rating_count > 0 else 0

    def reset_if_new_day(self):
        today = timezone.localdate()
        if self.date != today:
            self.date = today
            self.today_deliveries = 0
            self.today_earnings = 0
            self.rating_sum = 0
            self.rating_count = 0
            self.hours_online = 0
            self.save()
    
class DriverRating(models.Model):
    driver = models.ForeignKey("Driver", on_delete=models.CASCADE, related_name="ratings")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)  # who gave the rating
    rating = models.DecimalField(max_digits=3, decimal_places=2)  # e.g., 4.5
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.driver.user.email} - {self.rating}"