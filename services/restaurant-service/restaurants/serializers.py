from rest_framework import serializers
from .models import CuisineType, Restaurant, RestaurantExternalAPI, MenuItem, CategoryType


class CuisineTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuisineType
        fields = ["id", "name"]


class CategoryTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoryType
        fields = ["id", "name"]


class RestaurantExternalAPISerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = RestaurantExternalAPI
        fields = ["id", "category", "api_url", "api_key"]


class MenuItemSerializer(serializers.ModelSerializer):
    available = serializers.BooleanField()
    item_image = serializers.SerializerMethodField()
    category = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")

    class Meta:
        model = MenuItem
        fields = ["id", "restaurant", "name", "price", "description", "category", "prep_time", "available", "item_image", "created"]
        read_only_fields = ("restaurant", "created")

    def get_item_image(self, obj):
        if obj.item_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.item_image.url)
            return obj.item_image.url
        return None


class RestaurantCreateSerializer(serializers.ModelSerializer):
    cuisines = serializers.PrimaryKeyRelatedField(many=True, queryset=CuisineType.objects.all(), required=False)

    class Meta:
        model = Restaurant
        fields = ["id", "name", "phone_number", "description", "full_address", "lat", "lng", "minimum_order_price", "est_delivery_time", "cuisines"]

    def create(self, validated_data):
        cuisines = validated_data.pop("cuisines", [])
        owner_id = self.context["request"].user.id
        restaurant = Restaurant.objects.create(owner_id=owner_id, **validated_data)
        if cuisines:
            restaurant.cuisines.set(cuisines)
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
    imageUrl = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            "id", "name", "phone_number", "description", "full_address",
            "lat", "lng", "minimum_order_price", "est_delivery_time",
            "cuisines", "external_apis", "menu_items", "rating", "imageUrl", "created",
        ]

    def get_imageUrl(self, obj):
        if obj.profile_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_image.url)
            return f"/media/{obj.profile_image}"
        return None

    def get_rating(self, obj):
        try:
            return obj.dashboard.today_average_rating
        except Exception:
            return 4.5
