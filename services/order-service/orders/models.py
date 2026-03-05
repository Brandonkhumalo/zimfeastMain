from django.db import models
import uuid


class OrderItem(models.Model):
    # References user and menu_item by UUID - no FK to other services
    user_id = models.UUIDField(db_index=True)
    order = models.ForeignKey('Order', on_delete=models.CASCADE, related_name='items', null=True, blank=True)
    menu_item_id = models.UUIDField()
    menu_item_name = models.CharField(max_length=255, blank=True)
    menu_item_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    quantity = models.PositiveIntegerField(default=1)
    added = models.DateTimeField(auto_now_add=True)

    def price(self):
        return self.menu_item_price * self.quantity


class Order(models.Model):
    STATUS_CHOICES = (
        ('pending_payment', 'pending_payment'), ('paid', 'paid'), ('preparing', 'preparing'),
        ('ready', 'ready'), ('collected', 'collected'), ('assigned', 'assigned'),
        ('out_for_delivery', 'out_for_delivery'), ('delivered', 'delivered'), ('cancelled', 'cancelled'),
    )
    METHOD_CHOICES = (('delivery', 'delivery'), ('collection', 'collection'))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # References to other services by UUID
    customer_id = models.UUIDField(db_index=True)
    driver_id = models.UUIDField(null=True, blank=True, db_index=True)
    restaurant_id = models.UUIDField(db_index=True)

    created = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending_payment')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, blank=True, null=True)
    restaurant_names = models.TextField()
    total_fee = models.DecimalField(max_digits=10, decimal_places=2)
    tip = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    each_item_price = models.JSONField(default=list)
    delivery_out_time = models.DateTimeField(null=True, blank=True)
    delivery_complete_time = models.DateTimeField(null=True, blank=True)
    external_order_numbers = models.JSONField(default=dict)
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    # Location data (denormalized for performance)
    restaurant_lat = models.FloatField(blank=True, null=True)
    restaurant_lng = models.FloatField(blank=True, null=True)
    delivery_lat = models.FloatField(blank=True, null=True)
    delivery_lng = models.FloatField(blank=True, null=True)
    delivery_address = models.TextField(blank=True, null=True)

    # Driver info (denormalized)
    driver_name = models.CharField(max_length=255, blank=True, null=True)
    driver_phone = models.CharField(max_length=50, blank=True, null=True)
    driver_vehicle = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'driver_id'], name='order_status_driver_idx'),
            models.Index(fields=['-created'], name='order_created_desc_idx'),
            models.Index(fields=['customer_id', '-created'], name='order_customer_created_idx'),
            models.Index(fields=['restaurant_id', 'status'], name='order_restaurant_status_idx'),
        ]

    def __str__(self):
        return f"Order {self.id}"
