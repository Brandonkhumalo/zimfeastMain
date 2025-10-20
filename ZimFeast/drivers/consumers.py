import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Driver

class DriverLocationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.driver_id = self.scope['url_route']['kwargs']['driver_id']
        self.group_name = f"driver_{self.driver_id}"

        # Join driver group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave driver group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Receive message from frontend with lat/lng
    async def receive(self, text_data):
        data = json.loads(text_data)
        lat = data.get("lat")
        lng = data.get("lng")

        if lat is not None and lng is not None:
            await self.update_driver_location(self.driver_id, lat, lng)

            # Broadcast new location to all connected clients (e.g., customer apps)
            await self.channel_layer.group_send(
                f"driver_location_updates",
                {
                    "type": "driver.location.update",
                    "driver_id": self.driver_id,
                    "lat": lat,
                    "lng": lng,
                }
            )

    @database_sync_to_async
    def update_driver_location(self, driver_id, lat, lng):
        try:
            driver = Driver.objects.get(id=driver_id)
            driver.lat = lat
            driver.lng = lng
            driver.save()
        except Driver.DoesNotExist:
            pass

    # Handler for sending driver location updates
    async def driver_location_update(self, event):
        await self.send(text_data=json.dumps({
            "driver_id": event["driver_id"],
            "lat": event["lat"],
            "lng": event["lng"],
        }))
