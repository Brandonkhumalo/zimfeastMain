"""
Shared Redis pub/sub publisher for inter-service event communication.
"""
import json
import os
import redis


class RealtimePublisher:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
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
            return True
        except Exception as e:
            print(f"Failed to publish to {channel}: {e}")
            return False

    def publish_order_status(self, order_id, status):
        return self.publish('orders.status.changed', {
            'orderId': str(order_id),
            'status': status,
        })


publisher = RealtimePublisher()
