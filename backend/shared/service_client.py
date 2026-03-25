"""
HTTP client for inter-service communication.
Services call each other via REST with a shared SERVICE_API_KEY.
"""
import os
import requests
import logging

logger = logging.getLogger(__name__)

SERVICE_API_KEY = os.environ.get('SERVICE_API_KEY', '')

SERVICE_URLS = {
    'auth': os.environ.get('AUTH_SERVICE_URL', 'http://auth-service:8001'),
    'restaurant': os.environ.get('RESTAURANT_SERVICE_URL', 'http://restaurant-service:8002'),
    'order': os.environ.get('ORDER_SERVICE_URL', 'http://order-service:8003'),
    'payment': os.environ.get('PAYMENT_SERVICE_URL', 'http://payment-service:8005'),
}


def service_request(service_name, method, path, **kwargs):
    """
    Make an authenticated HTTP request to another microservice.
    """
    base_url = SERVICE_URLS.get(service_name)
    if not base_url:
        raise ValueError(f"Unknown service: {service_name}")

    url = f"{base_url}{path}"
    headers = kwargs.pop('headers', {})
    headers['X-Service-Key'] = SERVICE_API_KEY

    # Forward the user's JWT token if provided
    if 'auth_token' in kwargs:
        headers['Authorization'] = f"Bearer {kwargs.pop('auth_token')}"

    try:
        response = requests.request(method, url, headers=headers, timeout=10, **kwargs)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Service call failed: {method} {url} - {e}")
        raise


def get_user(user_id, auth_token=None):
    """Fetch user details from auth service."""
    return service_request('auth', 'GET', f'/api/internal/user/{user_id}/', auth_token=auth_token)


def get_restaurant(restaurant_id, auth_token=None):
    """Fetch restaurant details from restaurant service."""
    return service_request('restaurant', 'GET', f'/api/internal/restaurant/{restaurant_id}/', auth_token=auth_token)
