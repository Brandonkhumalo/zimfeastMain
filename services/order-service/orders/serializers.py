from rest_framework import serializers
from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_id = serializers.UUIDField()
    menu_item_name = serializers.CharField(required=False)
    menu_item_price = serializers.DecimalField(max_digits=8, decimal_places=2, required=False)
    price = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "menu_item_id", "menu_item_name", "menu_item_price", "quantity", "price"]

    def get_price(self, obj):
        return float(obj.price())


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    delivery_fee = serializers.FloatField(read_only=True)
    restaurant_names = serializers.CharField(required=False, default="")

    class Meta:
        model = Order
        fields = [
            "id", "customer_id", "items", "restaurant_names", "total_fee", "tip",
            "driver_id", "driver_name", "driver_phone", "driver_vehicle",
            "delivery_out_time", "delivery_complete_time", "delivery_fee",
            "status", "restaurant_id", "method", "created", "each_item_price",
            "restaurant_lat", "restaurant_lng",
            "delivery_lat", "delivery_lng", "delivery_address",
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        user_id = self.context["request"].user.id
        order = Order.objects.create(**validated_data)

        each_item_price = []
        for item_data in items_data:
            name = item_data.get("menu_item_name", "Item")
            price = item_data.get("menu_item_price", 0)
            quantity = item_data.get("quantity", 1)

            each_item_price.append({
                "name": name,
                "quantity": quantity,
                "price": str(price),
            })

            OrderItem.objects.create(
                order=order,
                user_id=user_id,
                menu_item_id=item_data["menu_item_id"],
                menu_item_name=name,
                menu_item_price=price,
                quantity=quantity,
            )

        order.each_item_price = each_item_price
        order.save()
        return order
