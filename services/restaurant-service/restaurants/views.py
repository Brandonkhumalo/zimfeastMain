import logging
import requests as http_requests
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import cache_page
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from geopy.distance import geodesic

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Restaurant, MenuItem, RestaurantDashboard, CuisineType, CategoryType
from .serializers import (
    RestaurantSerializer, RestaurantCreateSerializer,
    RestaurantExternalAPISerializer, MenuItemSerializer,
)

from shared.redis_publisher import publisher
from shared.geo_utils import haversine_distance, calculate_delivery_fee

logger = logging.getLogger(__name__)
channel_layer = get_channel_layer()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_my_restaurant(request):
    restaurant = get_object_or_404(Restaurant, owner_id=request.user.id)
    return Response(RestaurantSerializer(restaurant).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_restaurant(request):
    serializer = RestaurantCreateSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        restaurant = serializer.save()
        return Response(RestaurantSerializer(restaurant).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_restaurant(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id, owner_id=request.user.id)
    partial = request.method == "PATCH"
    serializer = RestaurantCreateSerializer(restaurant, data=request.data, partial=partial, context={"request": request})
    if serializer.is_valid():
        restaurant = serializer.save()
        return Response(RestaurantSerializer(restaurant).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def create_cuisine(request):
    name = request.data.get('name')
    if not name:
        return Response({"error": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
    if CuisineType.objects.filter(name=name).exists():
        return Response({"error": "Cuisine already exists."}, status=status.HTTP_400_BAD_REQUEST)
    cuisine = CuisineType.objects.create(name=name)
    return Response({"id": cuisine.id, "name": cuisine.name}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_cuisines(request):
    cuisines = CuisineType.objects.all().order_by('id')
    if not cuisines.exists():
        return Response(None, status=status.HTTP_200_OK)
    return Response([{"id": c.id, "name": c.name} for c in cuisines])


@api_view(['POST'])
@permission_classes([AllowAny])
def create_category(request):
    name = request.data.get('name')
    if not name:
        return Response({"error": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
    if CategoryType.objects.filter(name=name).exists():
        return Response({"error": "Category already exists."}, status=status.HTTP_400_BAD_REQUEST)
    category = CategoryType.objects.create(name=name)
    return Response({"id": category.id, "name": category.name}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_categories(request):
    categories = CategoryType.objects.all().order_by('id')
    if not categories.exists():
        return Response(None, status=status.HTTP_200_OK)
    return Response([{"id": c.id, "name": c.name} for c in categories])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_external_api(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id, owner_id=request.user.id)
    serializer = RestaurantExternalAPISerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(restaurant=restaurant)
        out = serializer.data.copy()
        out.pop("api_key", None)
        return Response(out, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def add_menu_item(request):
    restaurant = get_object_or_404(Restaurant, owner_id=request.user.id)
    serializer = MenuItemSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(restaurant=restaurant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_menu_items(request):
    restaurant = get_object_or_404(Restaurant, owner_id=request.user.id)
    menu_items = MenuItem.objects.filter(restaurant=restaurant).order_by("created")
    serializer = MenuItemSerializer(menu_items, many=True)
    return Response(serializer.data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_menu_item(request, menu_id):
    menu_item = get_object_or_404(MenuItem, id=menu_id)
    if str(menu_item.restaurant.owner_id) != str(request.user.id):
        return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    menu_item.delete()
    return Response({"detail": "Menu item deleted."}, status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def get_restaurant_detail(request, restaurant_id):
    rest = get_object_or_404(Restaurant, id=restaurant_id)
    return Response(RestaurantSerializer(rest).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def list_nearby_restaurants(request):
    lat_param = request.query_params.get("lat")
    lng_param = request.query_params.get("lng")
    try:
        user_lat = float(lat_param) if lat_param else None
        user_lng = float(lng_param) if lng_param else None
    except ValueError:
        return Response({"error": "lat and lng must be floats"}, status=400)

    radius_km = float(request.query_params.get("radius_km", 10.0))
    page_size = int(request.query_params.get("page_size", 10))
    page = int(request.query_params.get("page", 1))
    cuisine = request.query_params.get("cuisine", "").strip().lower()

    restaurants = Restaurant.objects.all()
    if cuisine:
        restaurants = restaurants.filter(cuisines__name__iexact=cuisine)

    nearby = []
    if user_lat is not None and user_lng is not None:
        user_point = (user_lat, user_lng)
        for r in restaurants:
            try:
                dist = geodesic(user_point, (r.lat, r.lng)).km
                if dist <= radius_km:
                    nearby.append((dist, r))
            except Exception:
                continue
        nearby.sort(key=lambda x: x[0])
        restaurant_objs = [r for _, r in nearby]
    else:
        restaurant_objs = list(restaurants)
        nearby = [(None, r) for r in restaurant_objs]

    start = (page - 1) * page_size
    paginated = restaurant_objs[start:start + page_size]

    serialized = []
    for r in paginated:
        dist = next((d for d, rest in nearby if rest.id == r.id), None)
        data = RestaurantSerializer(r).data
        data["distance_km"] = round(dist, 3) if dist is not None else None
        serialized.append(data)

    return Response({"count": len(restaurant_objs), "page": page, "page_size": page_size, "results": serialized})


def _call_external_api(api_obj, params=None):
    headers = {}
    if api_obj.api_key:
        headers["Authorization"] = f"Bearer {api_obj.api_key}"
    resp = http_requests.get(api_obj.api_url, params=(params or {}), headers=headers, timeout=8)
    resp.raise_for_status()
    return resp.json()


@api_view(["GET"])
@permission_classes([AllowAny])
def get_categories(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    ext_category = request.query_params.get("ext_category")
    api_entry = None
    if ext_category:
        api_entry = restaurant.external_apis.filter(category__iexact=ext_category).first()
    if not api_entry:
        for alt in ("categories", "menu_categories", "menu_api", "meal_categories"):
            api_entry = restaurant.external_apis.filter(category__iexact=alt).first()
            if api_entry:
                break
    if api_entry:
        try:
            return Response(_call_external_api(api_entry, params=request.query_params))
        except Exception:
            pass
    categories = MenuItem.objects.filter(restaurant=restaurant).values_list("category", flat=True).distinct()
    return Response({"categories": list(categories)})


@api_view(["GET"])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def get_menu_data(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    ext_category = request.query_params.get("ext_category")
    api_entry = None
    if ext_category:
        api_entry = restaurant.external_apis.filter(category__iexact=ext_category).first()
    if not api_entry:
        for alt in ("meal_data", "menu_api", "meals", "items"):
            api_entry = restaurant.external_apis.filter(category__iexact=alt).first()
            if api_entry:
                break
    if api_entry:
        try:
            return Response(_call_external_api(api_entry, params=request.query_params))
        except Exception:
            pass
    items_qs = MenuItem.objects.filter(restaurant=restaurant)
    category_filter = request.query_params.get("category")
    if category_filter:
        items_qs = items_qs.filter(category__iexact=category_filter)
    serializer = MenuItemSerializer(items_qs, many=True, context={"request": request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
@cache_page(60 * 2)
def list_restaurants(request):
    restaurants = Restaurant.objects.all()
    serializer = RestaurantSerializer(restaurants, many=True)
    return Response(serializer.data)


# --- Dashboard / Order status updates ---

def send_dashboard_update(restaurant, dashboard):
    group_name = f"restaurant_{restaurant.id}"
    async_to_sync(channel_layer.group_send)(group_name, {
        "type": "restaurant.dashboard.update",
        "dashboard_data": {
            "today_orders": dashboard.today_orders,
            "today_revenue": float(dashboard.today_revenue),
            "today_average_rating": dashboard.today_average_rating,
            "preparing": dashboard.preparing,
            "pending": dashboard.pending,
            "completed": dashboard.completed,
        },
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_order_preparing(request, order_id):
    """
    Mark order as preparing. Communicates with order service via Redis events.
    """
    restaurant = get_object_or_404(Restaurant, owner_id=request.user.id)
    dashboard, _ = RestaurantDashboard.objects.get_or_create(restaurant=restaurant)

    pending_list = dashboard.pending
    order_data = next((o for o in pending_list if o["order_id"] == str(order_id)), None)
    if not order_data:
        return Response({"detail": "Order not found in pending."}, status=status.HTTP_400_BAD_REQUEST)

    dashboard.pending = [o for o in pending_list if o["order_id"] != str(order_id)]
    dashboard.preparing.append(order_data)
    dashboard.save()

    send_dashboard_update(restaurant, dashboard)

    # Publish events for order service and real-time service
    publisher.publish_order_status(order_id, "preparing")

    # Publish delivery order created for driver matching
    delivery_data = {
        'orderId': str(order_id),
        'restaurantId': str(restaurant.id),
        'restaurantName': restaurant.name,
        'restaurantAddress': restaurant.full_address,
        'restaurantLat': float(restaurant.lat),
        'restaurantLng': float(restaurant.lng),
        'items': order_data.get('items', []),
        'total': order_data.get('total_fee', 0),
    }
    publisher.publish('orders.delivery.created', delivery_data)

    return Response({"detail": "Order marked as preparing.", "status": "preparing"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_order_ready(request, order_id):
    restaurant = get_object_or_404(Restaurant, owner_id=request.user.id)
    dashboard, _ = RestaurantDashboard.objects.get_or_create(restaurant=restaurant)

    preparing_list = dashboard.preparing
    order_data = next((o for o in preparing_list if o["order_id"] == str(order_id)), None)
    if not order_data:
        return Response({"detail": "Order not found in preparing."}, status=status.HTTP_400_BAD_REQUEST)

    dashboard.preparing = [o for o in preparing_list if o["order_id"] != str(order_id)]
    dashboard.completed.append(order_data)
    dashboard.save()

    send_dashboard_update(restaurant, dashboard)
    publisher.publish_order_status(order_id, "ready")

    return Response({"detail": "Order marked as ready.", "status": "ready"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_order_collected(request, order_id):
    restaurant = get_object_or_404(Restaurant, owner_id=request.user.id)
    dashboard, _ = RestaurantDashboard.objects.get_or_create(restaurant=restaurant)

    completed_list = dashboard.completed
    order_data = next((o for o in completed_list if o["order_id"] == str(order_id)), None)
    if order_data:
        dashboard.completed = [o for o in completed_list if o["order_id"] != str(order_id)]
        dashboard.save()

    send_dashboard_update(restaurant, dashboard)
    publisher.publish_order_status(order_id, "collected")

    return Response({"detail": "Order marked as collected.", "status": "collected"})


# Internal endpoint for inter-service communication
@api_view(['GET'])
@permission_classes([AllowAny])
def internal_get_restaurant(request, restaurant_id):
    """Called by other microservices to fetch restaurant details."""
    service_key = request.headers.get('X-Service-Key')
    if not service_key:
        return Response({"detail": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    return Response(RestaurantSerializer(restaurant).data)
