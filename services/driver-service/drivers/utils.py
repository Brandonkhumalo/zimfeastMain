from django.conf import settings
from django.core.cache import cache
import googlemaps
import logging

logger = logging.getLogger(__name__)

gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY) if settings.GOOGLE_MAPS_API_KEY else None

GEOCODE_CACHE_TTL = 86400


def get_address_from_coordinates(lat, lng):
    if not lat or not lng or not gmaps:
        return None
    cache_key = f"geocode:{round(lat, 5)}:{round(lng, 5)}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    try:
        results = gmaps.reverse_geocode((lat, lng))
        if results:
            address = results[0].get('formatted_address')
            cache.set(cache_key, address, GEOCODE_CACHE_TTL)
            return address
        return None
    except Exception as e:
        logger.warning("Geocoding error (%s, %s): %s", lat, lng, e)
        return None


def batch_get_addresses(coord_list):
    results = {}
    uncached = []
    for lat, lng in coord_list:
        if not lat or not lng:
            results[(lat, lng)] = None
            continue
        cache_key = f"geocode:{round(lat, 5)}:{round(lng, 5)}"
        cached = cache.get(cache_key)
        if cached is not None:
            results[(lat, lng)] = cached
        else:
            uncached.append((lat, lng))
    for lat, lng in uncached:
        results[(lat, lng)] = get_address_from_coordinates(lat, lng)
    return results
