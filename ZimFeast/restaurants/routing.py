from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # WebSocket URL for restaurant dashboard (supports UUID format)
    re_path(r'ws/restaurants/(?P<restaurant_id>[0-9a-f-]+)/dashboard/$', consumers.RestaurantDashboardConsumer.as_asgi()),
]
