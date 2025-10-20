import logging
import requests
from collections import defaultdict

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from restaurants.models import Restaurant, RestaurantDashboard

logger = logging.getLogger(__name__)

channel_layer = get_channel_layer()  # WebSocket layer

def process_restaurant_orders(order):
    """
    Called before assigning driver.1
    order: Order object (already saved)
    
    For each restaurant involved:
        - If restaurant has `place_order` API -> call it
        - Else -> update internal dashboard
    Returns: dict mapping restaurant_id -> order_number (only for those with API)
    """
    # Group items by restaurant
    items_by_restaurant = defaultdict(list)
    for item in order.items.all():  # assumes OrderItem model with menu_item FK
        items_by_restaurant[item.menu_item.restaurant_id].append(item)

    restaurant_order_numbers = {}  # store returned order numbers for restaurants with API

    for rest_id, items in items_by_restaurant.items():
        restaurant = Restaurant.objects.get(id=rest_id)
        api_entry = restaurant.external_apis.filter(category__iexact="place_order").first()

        if api_entry:
            # Prepare payload for this restaurant
            payload = {
                "order_id": order.id,
                "customer_id": order.customer.id,
                "items": [
                    {
                        "menu_item_id": item.menu_item.id,
                        "quantity": item.quantity,
                        "price": float(item.price),
                    } for item in items
                ],
                "delivery_address": {
                    "lat": order.delivery_lat,
                    "lng": order.delivery_lng,
                },
                "total_fee": float(order.total_fee),
                "tip": float(order.tip or 0),
            }

            headers = {}
            if api_entry.api_key:
                headers["Authorization"] = f"Bearer {api_entry.api_key}"

            try:
                response = requests.post(api_entry.api_url, json=payload, headers=headers, timeout=10)
                response.raise_for_status()
                data = response.json()
                # expect external API returns {"order_number": "..."}
                order_number = data.get("order_number")
                if order_number:
                    restaurant_order_numbers[rest_id] = order_number
            except Exception as e:
                logger.warning(f"Place_order API failed for restaurant {restaurant.id}: {e}")
                # fallback to internal dashboard below

        if rest_id not in restaurant_order_numbers:
            # No API -> update internal dashboard
            update_restaurant_dashboard(restaurant, items, order)

    return restaurant_order_numbers

def update_restaurant_dashboard(restaurant, items, order):
    """
    Update internal restaurant dashboard model:
    - Today's orders
    - Revenue
    - Average rating (hardcoded 3 for now)
    - Live orders: pending -> preparing -> completed
    """
    dashboard, _ = RestaurantDashboard.objects.get_or_create(restaurant=restaurant)

    # Update metrics
    dashboard.today_orders += 1
    dashboard.today_revenue += sum(float(item.price) * item.quantity for item in items)
    dashboard.today_average_rating = 3  # hardcoded for now

    # Add order to pending list
    order_data = {
        "order_id": order.id,
        "items": [{"name": item.menu_item.name, "quantity": item.quantity} for item in items],
        "total_fee": float(order.total_fee),
    }
    dashboard.pending.append(order_data)

    dashboard.save()

    # Send live update via websocket
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    group_name = f"restaurant_{restaurant.id}"
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "restaurant.dashboard.update",
            "dashboard_data": {
                "today_orders": dashboard.today_orders,
                "today_revenue": float(dashboard.today_revenue),
                "today_average_rating": dashboard.today_average_rating,
                "preparing": dashboard.preparing,
                "pending": dashboard.pending,
                "completed": dashboard.completed,
            },
        },
    )
