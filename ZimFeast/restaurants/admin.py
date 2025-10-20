from django.contrib import admin
from .models import CuisineType, Restaurant, RestaurantExternalAPI, MenuItem

@admin.register(CuisineType)
class CuisineTypeAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)

@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner", "phone_number", "lat", "lng", "minimum_order_price")
    search_fields = ("name", "owner__email", "phone_number", "full_address")
    list_filter = ("cuisines",)

@admin.register(RestaurantExternalAPI)
class RestaurantExternalAPIAdmin(admin.ModelAdmin):
    list_display = ("id", "restaurant", "category", "api_url")
    search_fields = ("restaurant__name", "category", "api_url")

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ("id", "restaurant", "name", "price", "get_categories", "available")
    search_fields = ("name", "restaurant__name", "category__name")
    list_filter = ("available", "category")

    # Custom method to display ManyToMany field
    def get_categories(self, obj):
        return ", ".join([cat.name for cat in obj.category.all()])
    get_categories.short_description = 'Categories'
