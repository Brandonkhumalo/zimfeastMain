# orders/serializers.py
from rest_framework import serializers
from .models import Order, OrderItem
from restaurants.serializers import MenuItemSerializer
from accounts.serializers import UserSerializer

class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_id = serializers.UUIDField(write_only=True)
    menu_item = MenuItemSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "menu_item_id", "menu_item", "quantity", "price"]

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    restaurant_names = serializers.ListField(child=serializers.CharField(), read_only=True)
    customer = UserSerializer(read_only=True)
    driver = UserSerializer(read_only=True)
    delivery_fee = serializers.FloatField(read_only=True)  # Added delivery fee

    class Meta:
        model = Order
        fields = [
            "id", "customer", "items", "restaurant_names", "total_fee", "tip",
            "driver", "delivery_out_time", "delivery_complete_time", "delivery_fee",
            "status", "restaurant", "method", "created", "each_item_price",
            "restaurant_lat", "restaurant_lng",
            "delivery_lat", "delivery_lng"
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        user = self.context["request"].user
        order = Order.objects.create(**validated_data)

        # Create OrderItems
        for item_data in items_data:
            menu_item_id = item_data.pop("menu_item_id")
            OrderItem.objects.create(order=order,user=user, menu_item_id=menu_item_id, **item_data)

        # Compute restaurant names dynamically
        restaurant_names = list(order.items.values_list("menu_item__restaurant__name", flat=True).distinct())
        order.restaurant_names = restaurant_names
        order.save()
        return order
