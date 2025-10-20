from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # WebSocket URL for restaurant dashboard
    re_path(r'ws/restaurants/(?P<restaurant_id>\d+)/dashboard/$', consumers.RestaurantDashboardConsumer.as_asgi()),
]
