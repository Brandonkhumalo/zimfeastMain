from django.db import models
from django.utils import timezone
import uuid


class Driver(models.Model):
    # References user by UUID - no FK to auth service
    user_id = models.UUIDField(unique=True, db_index=True)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    license_number = models.CharField(max_length=50)
    license_photo = models.ImageField(upload_to="drivers/license_photos/")
    vehicle_details = models.JSONField()
    vehicle_photo = models.ImageField(upload_to="drivers/vehicle_photos/")
    is_online = models.BooleanField(default=False, db_index=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"Driver {self.user_id} - {'Online' if self.is_online else 'Offline'}"


class DriverReject(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE)
    order_id = models.CharField(max_length=100)
    reason = models.CharField(max_length=255, blank=True)
    rejected_at = models.DateTimeField(auto_now_add=True)


class DriverOrderStatus(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name="current_order")
    order_id = models.UUIDField(db_index=True)
    status = models.CharField(max_length=50, choices=[
        ("pending", "Pending"), ("accepted", "Accepted"),
        ("delivering", "Delivering"), ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ], default="pending")
    assigned_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['driver', 'status'], name='dos_driver_status_idx'),
            models.Index(fields=['-completed_at'], name='dos_completed_desc_idx'),
        ]


class DriverFinance(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name="finances")
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
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name="ratings")
    user_id = models.UUIDField()  # Who gave the rating
    rating = models.DecimalField(max_digits=3, decimal_places=2)
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
