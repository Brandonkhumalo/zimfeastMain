"""
Shared geographic utilities used by order, driver, and restaurant services.
"""
from math import radians, sin, cos, sqrt, atan2

DELIVERY_RATE_PER_KM = 0.35
MIN_DELIVERY_FEE = 1.50


def haversine_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two coordinates using Haversine formula."""
    if not all([lat1, lng1, lat2, lng2]):
        return 0
    R = 6371  # Earth's radius in km
    lat1_r, lng1_r = radians(lat1), radians(lng1)
    lat2_r, lng2_r = radians(lat2), radians(lng2)
    dlat = lat2_r - lat1_r
    dlng = lng2_r - lng1_r
    a = sin(dlat/2)**2 + cos(lat1_r) * cos(lat2_r) * sin(dlng/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c


def calculate_delivery_fee(restaurant_lat, restaurant_lng, delivery_lat, delivery_lng):
    """Calculate delivery fee at $0.35 per km with minimum fee."""
    distance = haversine_distance(restaurant_lat, restaurant_lng, delivery_lat, delivery_lng)
    fee = distance * DELIVERY_RATE_PER_KM
    return round(max(MIN_DELIVERY_FEE, fee), 2)
