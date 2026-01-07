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
            "driver", "driver_name", "driver_phone", "driver_vehicle",
            "delivery_out_time", "delivery_complete_time", "delivery_fee",
            "status", "restaurant", "method", "created", "each_item_price",
            "restaurant_lat", "restaurant_lng",
            "delivery_lat", "delivery_lng", "delivery_address"
        ]

    def create(self, validated_data):
        from restaurants.models import MenuItem
        items_data = validated_data.pop("items")
        user = self.context["request"].user
        order = Order.objects.create(**validated_data)

        # Create OrderItems and build each_item_price with actual item names
        each_item_price = []
        for item_data in items_data:
            menu_item_id = item_data.pop("menu_item_id")
            quantity = item_data.get("quantity", 1)
            
            # Get the actual menu item to include its name and price
            try:
                menu_item = MenuItem.objects.get(id=menu_item_id)
                each_item_price.append({
                    "name": menu_item.name,
                    "quantity": quantity,
                    "price": str(menu_item.price)
                })
            except MenuItem.DoesNotExist:
                each_item_price.append({
                    "name": "Unknown Item",
                    "quantity": quantity,
                    "price": "0.00"
                })
            
            OrderItem.objects.create(order=order, user=user, menu_item_id=menu_item_id, **item_data)

        # Store each_item_price with item details (name, quantity, price)
        order.each_item_price = each_item_price
        
        # Compute restaurant names dynamically
        restaurant_names = list(order.items.values_list("menu_item__restaurant__name", flat=True).distinct())
        order.restaurant_names = restaurant_names
        order.save()
        return order
