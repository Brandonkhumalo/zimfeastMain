from rest_framework import serializers
from .models import (
    CuisineType, Restaurant, RestaurantExternalAPI, MenuItem, CategoryType,
    Branch, RestaurantChain, RestaurantEarning, RestaurantFinanceSummary,
    RestaurantDebt, RestaurantReview,
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
    api_key = serializers.CharField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = RestaurantExternalAPI
        fields = ["id", "category", "api_url", "api_key"]


class MenuItemWriteSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        many=True, queryset=CategoryType.objects.all(), required=False
    )
    item_image = serializers.ImageField(required=False)

    class Meta:
        model = MenuItem
        fields = ["id", "restaurant", "name", "price", "description", "category", "prep_time", "available", "item_image", "created"]
        read_only_fields = ("restaurant", "created")

    def create(self, validated_data):
        categories = validated_data.pop("category", [])
        item = MenuItem.objects.create(**validated_data)
        if categories:
            item.category.set(categories)
        return item

    def update(self, instance, validated_data):
        categories = validated_data.pop("category", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if categories is not None:
            instance.category.set(categories)
        return instance


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
        fields = [
            "id", "name", "phone_number", "description", "full_address",
            "lat", "lng", "minimum_order_price", "est_delivery_time", "cuisines",
            "opening_time", "closing_time",
        ]

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
    branches = serializers.SerializerMethodField()
    chain_name = serializers.SerializerMethodField()
    accepts_direct_payment = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    imageUrl = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            "id", "name", "phone_number", "description", "full_address",
            "lat", "lng", "minimum_order_price", "est_delivery_time",
            "cuisines", "external_apis", "menu_items", "branches",
            "chain", "chain_name", "accepts_direct_payment", "rating", "imageUrl",
            "opening_time", "closing_time", "is_open", "created",
        ]

    def get_branches(self, obj):
        return BranchSerializer(obj.branches.filter(is_active=True), many=True).data

    def get_chain_name(self, obj):
        return obj.chain.name if obj.chain else None

    def get_accepts_direct_payment(self, obj):
        return obj.chain.accepts_direct_payment if obj.chain else False

    def get_imageUrl(self, obj):
        if obj.profile_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_image.url)
            return f"/media/{obj.profile_image}"
        return None

    def get_is_open(self, obj):
        """Return the computed open/closed status from the model property."""
        return obj.is_currently_open

    def get_rating(self, obj):
        # Use the denormalized average_rating field kept up-to-date by reviews.
        # Fall back to 0 if no reviews yet (frontend can decide how to display).
        if obj.average_rating and obj.average_rating > 0:
            return round(obj.average_rating, 1)
        return 0


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "address", "lat", "lng", "phone_number", "is_active", "created"]
        read_only_fields = ("created",)


class RestaurantChainSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantChain
        fields = [
            "id", "name", "description", "website",
            "menu_api_url", "order_webhook_url",
            "accepts_direct_payment", "platform_commission_pct", "created",
        ]
        read_only_fields = ("created",)


class RestaurantEarningSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantEarning
        fields = [
            "id", "restaurant", "order_id", "order_total", "delivery_fee",
            "platform_commission_pct", "platform_fee", "restaurant_earning",
            "paid_direct", "settled", "created",
        ]
        read_only_fields = ("created",)


class RestaurantFinanceSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantFinanceSummary
        fields = [
            "total_revenue", "total_platform_fees", "total_earnings",
            "unsettled_platform_fees", "unsettled_delivery_fees",
            "total_debt", "total_orders", "last_updated",
        ]


class RestaurantDebtSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantDebt
        fields = [
            "id", "restaurant", "order_id", "platform_fee", "delivery_fee",
            "total_owed", "settled", "created",
        ]
        read_only_fields = ("created",)


class RestaurantReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantReview
        fields = ["id", "restaurant", "user_id", "order_id", "rating", "comment", "created"]
        read_only_fields = ("id", "restaurant", "user_id", "created")
