# drivers/utils.py
from django.conf import settings
from drivers.models import Driver
from orders.models import Order
import googlemaps

gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)

def assign_driver(order):
    """
    Assign the nearest available driver to a given order.
    Criteria:
    - Driver is online
    - Driver has no active orders (not delivering)
    - Nearest to the restaurant(s) location
    Returns the Driver object or None if no driver is available.
    """
    restaurant_coords = (order.delivery_address_lat, order.delivery_address_lng)

    # Get all drivers who are online and not currently delivering an order
    active_order_driver_ids = Order.objects.filter(status__in=["pending", "accepted", "out_for_delivery"]).values_list("driver_id", flat=True)
    available_drivers = Driver.objects.filter(is_online=True).exclude(id__in=active_order_driver_ids)

    if not available_drivers.exists():
        return None

    nearest_driver = None
    shortest_distance = float('inf')

    for driver in available_drivers:
        driver_coords = (driver.lat, driver.lng)
        # Calculate driving distance using Google Maps Distance Matrix API
        distance_result = gmaps.distance_matrix(origins=[driver_coords],
                                                destinations=[restaurant_coords],
                                                mode="driving")
        try:
            distance_meters = distance_result["rows"][0]["elements"][0]["distance"]["value"]
        except (KeyError, IndexError):
            continue

        if distance_meters < shortest_distance:
            shortest_distance = distance_meters
            nearest_driver = driver

    return nearest_driver

#send order to driver
