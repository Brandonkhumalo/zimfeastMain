import json
import redis
from django.conf import settings

class RealtimePublisher:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379')
        try:
            self.redis_client = redis.from_url(redis_url)
            self.redis_client.ping()
            self.connected = True
            print("Redis publisher connected")
        except Exception as e:
            print(f"Redis connection failed: {e}")
            self.redis_client = None
            self.connected = False
    
    def publish(self, channel, data):
        if not self.connected or not self.redis_client:
            print(f"Redis not connected, cannot publish to {channel}")
            return False
        
        try:
            message = json.dumps(data)
            self.redis_client.publish(channel, message)
            print(f"Published to {channel}: {data.get('orderId', 'N/A')}")
            return True
        except Exception as e:
            print(f"Failed to publish to {channel}: {e}")
            return False
    
    def publish_delivery_order(self, order):
        data = {
            'orderId': str(order.id),
            'customerId': str(order.customer.id),
            'customerName': order.customer.get_full_name() or order.customer.email,
            'restaurantId': str(order.restaurant.id) if order.restaurant else None,
            'restaurantName': order.restaurant.name if order.restaurant else (
                order.restaurant_names[0] if order.restaurant_names else 'Restaurant'
            ),
            'restaurantLat': float(order.restaurant.lat) if order.restaurant else -17.8252,
            'restaurantLng': float(order.restaurant.lng) if order.restaurant else 31.0335,
            'dropoffLat': float(order.delivery_location.get('lat', -17.8252)),
            'dropoffLng': float(order.delivery_location.get('lng', 31.0335)),
            'dropoffAddress': order.delivery_location.get('address', 'Unknown'),
            'items': order.each_item_price or [],
            'total': float(order.total_fee or 0),
            'tip': float(order.tip or 0),
        }
        return self.publish('orders.delivery.created', data)
    
    def publish_order_status(self, order_id, status):
        data = {
            'orderId': str(order_id),
            'status': status,
        }
        return self.publish('orders.status.changed', data)


publisher = RealtimePublisher()
