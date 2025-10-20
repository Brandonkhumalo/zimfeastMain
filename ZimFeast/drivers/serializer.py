from rest_framework import serializers
from .models import Driver, DriverOrderStatus
from accounts.serializers import UserSerializer
from django.conf import settings
import requests

class DriverSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    address = serializers.CharField(write_only=True)  # User inputs this

    class Meta:
        model = Driver
        fields = ["id", "user", "license_number", "license_photo", "vehicle_details", "vehicle_photo", "lat", "lng", "address",]

    def create(self, validated_data):
        address = validated_data.pop("address", None)
        lat, lng = None, None

        if address:
            try:
                api_key = settings.GOOGLE_MAPS_API_KEY
                response = requests.get(
                    f"https://maps.googleapis.com/maps/api/geocode/json?address={address}&key={api_key}"
                )
                data = response.json()
                if data["status"] == "OK":
                    location = data["results"][0]["geometry"]["location"]
                    lat, lng = location["lat"], location["lng"]
            except Exception as e:
                print("Geocoding failed:", e)

        validated_data["lat"] = lat
        validated_data["lng"] = lng

        user = self.context["request"].user
        return Driver.objects.create(user=user, **validated_data)
        
class DriverOrderStatusSerializer(serializers.ModelSerializer):
    driver = DriverSerializer(read_only=True)
    order_id = serializers.IntegerField(source="order.id", read_only=True)

    class Meta:
        model = DriverOrderStatus
        fields = ["driver", "order_id", "status", "assigned_at", "completed_at"]