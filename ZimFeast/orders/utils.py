from geopy.distance import distance as geo_distance
from geopy.distance import geodesic
from math import radians, sin, cos, sqrt, atan2

# Delivery rate: $0.35 per kilometer
DELIVERY_RATE_PER_KM = 0.35
MIN_DELIVERY_FEE = 1.50

def calculate_distance_kms(point_a, point_b):
    """
    Calculate distance in kilometers between two points using geopy.
    point_a and point_b should be tuples: (latitude, longitude)
    Example:
        point_a = (restaurant.latitude, restaurant.longitude)
        point_b = (order.delivery_address_lat, order.delivery_address_lng)
    Returns distance in km as float.
    """
    return geodesic(point_a, point_b).km

def calculate_distance_km(a_lat, a_lng, b_lat, b_lng):
    return geo_distance((a_lat,a_lng),(b_lat,b_lng)).km

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
    """
    Calculate delivery fee at $0.35 per km with minimum fee.
    """
    distance = haversine_distance(restaurant_lat, restaurant_lng, delivery_lat, delivery_lng)
    fee = distance * DELIVERY_RATE_PER_KM
    return round(max(MIN_DELIVERY_FEE, fee), 2)

def calculate_multi_restaurant_delivery_fee(restaurants, delivery_lat, delivery_lng, driver_lat=None, driver_lng=None):
    """
    Calculate delivery fee for multi-restaurant orders.
    Formula: (distance between restaurants * rate) + (last restaurant to delivery * rate)
    
    Args:
        restaurants: List of dicts with 'lat' and 'lng' keys, ordered by pickup sequence
        delivery_lat, delivery_lng: Customer delivery coordinates
        driver_lat, driver_lng: Optional driver location for optimizing pickup order
    
    Returns:
        dict with total_fee, total_distance, and optimized pickup_order
    """
    if not restaurants:
        return {'total_fee': 0, 'total_distance': 0, 'pickup_order': []}
    
    # If driver location provided, optimize pickup order
    if driver_lat is not None and driver_lng is not None:
        restaurants = optimize_pickup_order(restaurants, driver_lat, driver_lng, delivery_lat, delivery_lng)
    
    if len(restaurants) == 1:
        distance = haversine_distance(
            restaurants[0]['lat'], restaurants[0]['lng'],
            delivery_lat, delivery_lng
        )
        return {
            'total_fee': round(max(MIN_DELIVERY_FEE, distance * DELIVERY_RATE_PER_KM), 2),
            'total_distance': round(distance, 2),
            'pickup_order': restaurants
        }
    
    total_distance = 0
    
    # Calculate distances between consecutive restaurants
    for i in range(len(restaurants) - 1):
        total_distance += haversine_distance(
            restaurants[i]['lat'], restaurants[i]['lng'],
            restaurants[i + 1]['lat'], restaurants[i + 1]['lng']
        )
    
    # Add distance from last restaurant to delivery address
    last_restaurant = restaurants[-1]
    total_distance += haversine_distance(
        last_restaurant['lat'], last_restaurant['lng'],
        delivery_lat, delivery_lng
    )
    
    return {
        'total_fee': round(max(MIN_DELIVERY_FEE, total_distance * DELIVERY_RATE_PER_KM), 2),
        'total_distance': round(total_distance, 2),
        'pickup_order': restaurants
    }

def optimize_pickup_order(restaurants, driver_lat, driver_lng, delivery_lat, delivery_lng):
    """
    Optimize restaurant pickup order based on driver location.
    The restaurant closest to driver is picked up first, and the restaurant
    closest to the delivery address is picked up last.
    
    Uses a nearest-neighbor approach for the middle restaurants.
    """
    if len(restaurants) <= 1:
        return restaurants
    
    # Find the restaurant closest to delivery address (should be picked up last)
    restaurants_with_delivery_dist = []
    for r in restaurants:
        dist_to_delivery = haversine_distance(r['lat'], r['lng'], delivery_lat, delivery_lng)
        restaurants_with_delivery_dist.append({**r, '_delivery_dist': dist_to_delivery})
    
    # The one closest to delivery should be last
    restaurants_with_delivery_dist.sort(key=lambda x: x['_delivery_dist'])
    last_restaurant = restaurants_with_delivery_dist[0]  # Closest to delivery = last pickup
    remaining = restaurants_with_delivery_dist[1:]
    
    if not remaining:
        return [last_restaurant]
    
    # Find the restaurant closest to driver (should be first)
    for r in remaining:
        r['_driver_dist'] = haversine_distance(driver_lat, driver_lng, r['lat'], r['lng'])
    
    remaining.sort(key=lambda x: x['_driver_dist'])
    first_restaurant = remaining[0]
    middle = remaining[1:]
    
    # For middle restaurants, use nearest-neighbor from first
    ordered = [first_restaurant]
    current = first_restaurant
    
    while middle:
        # Find nearest to current
        for r in middle:
            r['_dist_from_current'] = haversine_distance(current['lat'], current['lng'], r['lat'], r['lng'])
        middle.sort(key=lambda x: x['_dist_from_current'])
        next_stop = middle.pop(0)
        ordered.append(next_stop)
        current = next_stop
    
    # Add last restaurant (closest to delivery)
    ordered.append(last_restaurant)
    
    # Clean up temporary keys
    for r in ordered:
        r.pop('_delivery_dist', None)
        r.pop('_driver_dist', None)
        r.pop('_dist_from_current', None)
    
    return ordered

def validate_restaurant_group(restaurants):
    # restaurants: iterable of restaurant objects with lat,lng
    coords = [(r.lat, r.lng) for r in restaurants]
    for i in range(len(coords)):
        for j in range(i+1, len(coords)):
            if calculate_distance_km(coords[i][0],coords[i][1],coords[j][0],coords[j][1]) > 5:
                return False
    return True