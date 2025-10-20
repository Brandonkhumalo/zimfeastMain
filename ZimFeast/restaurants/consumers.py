import json
from channels.generic.websocket import AsyncWebsocketConsumer

class RestaurantDashboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.restaurant_id = self.scope['url_route']['kwargs']['restaurant_id']
        self.group_name = f"restaurant_{self.restaurant_id}"

        # Join group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Receive message from group
    async def restaurant_dashboard_update(self, event):
        await self.send(text_data=json.dumps(event["dashboard_data"]))
