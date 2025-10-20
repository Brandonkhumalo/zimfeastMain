from geopy.distance import distance as geo_distance
from geopy.distance import geodesic

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

def validate_restaurant_group(restaurants):
    # restaurants: iterable of restaurant objects with lat,lng
    coords = [(r.lat, r.lng) for r in restaurants]
    for i in range(len(coords)):
        for j in range(i+1, len(coords)):
            if calculate_distance_km(coords[i][0],coords[i][1],coords[j][0],coords[j][1]) > 5:
                return False
    return True