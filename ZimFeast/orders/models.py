from django.db import models
from django.conf import settings
import uuid

class OrderItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart_items')
    order = models.ForeignKey('Order', on_delete=models.CASCADE, related_name='items', null=True, blank=True)
    menu_item = models.ForeignKey('restaurants.MenuItem', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    added = models.DateTimeField(auto_now_add=True)

    def price(self):
        return self.menu_item.price * self.quantity

class Order(models.Model):
    STATUS_CHOICES = (
        ('pending_payment','pending_payment'), ('paid','paid'), ('preparing','preparing'), ('ready','ready'),
        ('collected','collected'), ('assigned','assigned'), ('out_for_delivery','out_for_delivery'), 
        ('delivered','delivered'), ('cancelled','cancelled')
    )
    METHOD_CHOICES = (
        ('delivery', 'delivery'),
        ('collection', 'collection')
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='customer_orders')
    created = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending_payment')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, blank=True, null=True)
    restaurant_names = models.TextField()  # comma separated
    total_fee = models.DecimalField(max_digits=10, decimal_places=2)
    tip = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,null=True, blank=True, related_name="driver_orders")
    restaurant = models.ForeignKey("restaurants.Restaurant", on_delete=models.CASCADE, related_name="orders")
    each_item_price = models.JSONField(default=list)
    delivery_out_time = models.DateTimeField(null=True, blank=True)
    delivery_complete_time = models.DateTimeField(null=True, blank=True)
    external_order_numbers = models.JSONField(default=dict)
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    # restaurant location
    restaurant_lat = models.FloatField(blank=True, null=True)
    restaurant_lng = models.FloatField(blank=True, null=True)
    # delivery location (optional, only for delivery)
    delivery_lat = models.FloatField(blank=True, null=True)
    delivery_lng = models.FloatField(blank=True, null=True)

    def __str__(self):
        return f"Order {self.id} - {self.customer.email}"