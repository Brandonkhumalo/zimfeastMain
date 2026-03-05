from rest_framework import serializers
from .models import Driver, DriverOrderStatus
from django.conf import settings
import requests


class DriverSerializer(serializers.ModelSerializer):
    address = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Driver
        fields = ["id", "user_id", "license_number", "license_photo", "vehicle_details", "vehicle_photo", "lat", "lng", "address"]

    def create(self, validated_data):
        address = validated_data.pop("address", None)
        lat, lng = None, None

        if address:
            try:
                api_key = settings.GOOGLE_MAPS_API_KEY
                response = requests.get(
                    f"https://maps.googleapis.com/maps/api/geocode/json",
                    params={"address": address, "key": api_key},
                    timeout=10,
                )
                data = response.json()
                if data["status"] == "OK":
                    location = data["results"][0]["geometry"]["location"]
                    lat, lng = location["lat"], location["lng"]
            except Exception:
                pass

        validated_data["lat"] = lat
        validated_data["lng"] = lng

        user_id = self.context["request"].user.id
        return Driver.objects.create(user_id=user_id, **validated_data)


class DriverOrderStatusSerializer(serializers.ModelSerializer):
    driver = DriverSerializer(read_only=True)

    class Meta:
        model = DriverOrderStatus
        fields = ["driver", "order_id", "status", "assigned_at", "completed_at"]
