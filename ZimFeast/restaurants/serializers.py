from rest_framework import serializers
from .models import (
    CuisineType,
    Restaurant,
    RestaurantExternalAPI,
    MenuItem,
    CategoryType,
)

class CuisineTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuisineType
        fields = ["id", "name"]

class CategoryTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoryType
        fields = ["id", "name"]


class RestaurantExternalAPISerializer(serializers.ModelSerializer):
    # keep api_key writeable but do not expose it in responses by default if you want:
    api_key = serializers.CharField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = RestaurantExternalAPI
        fields = ["id", "category", "api_url", "api_key"]


class MenuItemSerializer(serializers.ModelSerializer):
    available = serializers.BooleanField()

    category = serializers.SlugRelatedField(
        many=True, read_only=True, slug_field="name"
    )

    class Meta:
        model = MenuItem
        fields = ["id","restaurant","name","price","description","category","prep_time","available","item_image","created",]
        read_only_fields = ("restaurant", "created")


class RestaurantCreateSerializer(serializers.ModelSerializer):
    # Accept cuisine ids for creation/updating
    cuisines = serializers.PrimaryKeyRelatedField(
        many=True, queryset=CuisineType.objects.all(), required=False
    )

    class Meta:
        model = Restaurant
        fields = ["id","name","phone_number","description","full_address","lat","lng","minimum_order_price","est_delivery_time","cuisines",]

    def create(self, validated_data):
        cuisines = validated_data.pop("cuisines", [])
        owner = self.context["request"].user
        restaurant = Restaurant.objects.create(owner=owner, **validated_data)
        if cuisines:
            restaurant.cuisines.set(cuisines)
        
        print(validated_data)
        return restaurant

    def update(self, instance, validated_data):
        cuisines = validated_data.pop("cuisines", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if cuisines is not None:
            instance.cuisines.set(cuisines)
        return instance


class RestaurantSerializer(serializers.ModelSerializer):
    cuisines = CuisineTypeSerializer(many=True, read_only=True)
    external_apis = RestaurantExternalAPISerializer(many=True, read_only=True)
    menu_items = MenuItemSerializer(many=True, read_only=True)
    rating = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            "id",
            "name",
            "phone_number",
            "description",
            "full_address",
            "lat",
            "lng",
            "minimum_order_price",
            "est_delivery_time",
            "cuisines",
            "external_apis",
            "menu_items",
            "rating",
            "created",
        ]
    
    def get_rating(self, obj):
        """Get rating from restaurant dashboard, default to 4.5"""
        try:
            return obj.dashboard.today_average_rating
        except:
            return 4.5