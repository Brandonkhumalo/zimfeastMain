import logging
import requests
from django.shortcuts import get_object_or_404
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import (
    api_view,
    permission_classes,
    parser_classes,
)
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from geopy.distance import geodesic

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import (
    Restaurant,
    MenuItem,
    RestaurantDashboard,
    CuisineType,
    CategoryType,
)
from .serializers import (
    RestaurantSerializer,
    RestaurantCreateSerializer,
    RestaurantExternalAPISerializer,
    MenuItemSerializer 
)

from .pagination import NearbyRestaurantCursorPagination

logger = logging.getLogger(__name__)
channel_layer = get_channel_layer()

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
    restaurant = get_object_or_404(Restaurant, id=restaurant_id, owner=request.user)
    partial = request.method == "PATCH"
    serializer = RestaurantCreateSerializer(
        restaurant, data=request.data, partial=partial, context={"request": request}
    )
    if serializer.is_valid():
        restaurant = serializer.save()
        return Response(RestaurantSerializer(restaurant).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Create a new cuisine
@api_view(['POST'])
@permission_classes([AllowAny])
def create_cuisine(request):
    """
    Creates a new cuisine.
    Expects JSON body: {"name": "Italian"}
    """
    name = request.data.get('name')
    if not name:
        return Response({"error": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Check if cuisine already exists
    if CuisineType.objects.filter(name=name).exists():
        return Response({"error": "Cuisine already exists."}, status=status.HTTP_400_BAD_REQUEST)

    cuisine = CuisineType.objects.create(name=name)
    return Response({"id": cuisine.id, "name": cuisine.name}, status=status.HTTP_201_CREATED)

# List all cuisines
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_cuisines(request):
    """
    Returns all cuisines with their IDs, or None if no cuisines exist.
    """
    cuisines = CuisineType.objects.all().order_by('id')
    if not cuisines.exists():
        return Response(None, status=status.HTTP_200_OK)  # Return None if empty

    data = [{"id": c.id, "name": c.name} for c in cuisines]
    return Response(data, status=status.HTTP_200_OK)

# Create a new category
@api_view(['POST'])
@permission_classes([AllowAny])
def create_category(request):
    """
    Creates a new cuisine.
    Expects JSON body: {"name": "Italian"}
    """
    name = request.data.get('name')
    if not name:
        return Response({"error": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Check if cuisine already exists
    if CategoryType.objects.filter(name=name).exists():
        return Response({"error": "Cuisine already exists."}, status=status.HTTP_400_BAD_REQUEST)

    category = CategoryType.objects.create(name=name)
    return Response({"id": category.id, "name": category.name}, status=status.HTTP_201_CREATED)

# List all cuisines
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_categories(request):
    """
    Returns all cuisines with their IDs, or None if no cuisines exist.
    """
    category = CategoryType.objects.all().order_by('id')
    if not category.exists():
        return Response(None, status=status.HTTP_200_OK)  # Return None if empty

    data = [{"id": c.id, "name": c.name} for c in category]
    return Response(data, status=status.HTTP_200_OK)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_external_api(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id, owner=request.user)
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
    # Get the restaurant belonging to the authenticated user
    restaurant = get_object_or_404(Restaurant, owner=request.user)

    serializer = MenuItemSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(restaurant=restaurant)  # attach restaurant automatically
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_menu_items(request):
    """
    Get all menu items for the restaurant belonging to the logged-in user.
    """
    # Get the restaurant for the logged-in user
    restaurant = get_object_or_404(Restaurant, owner=request.user)

    # Get all menu items for this restaurant
    menu_items = MenuItem.objects.filter(restaurant=restaurant).order_by("created")

    # Serialize the menu items
    serializer = MenuItemSerializer(menu_items, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import MenuItem, Restaurant

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_menu_item(request, menu_id):
    """
    Delete a menu item. Only the restaurant owner can delete their own menu items.
    URL: /api/restaurants/menu/<menu_id>/delete/
    """
    # Get the menu item or return 404
    menu_item = get_object_or_404(MenuItem, id=menu_id)
    
    # Check if the authenticated user owns the restaurant
    if menu_item.restaurant.owner != request.user:
        return Response({"detail": "You do not have permission to delete this menu item."}, status=status.HTTP_403_FORBIDDEN)
    
    menu_item.delete()
    return Response({"detail": "Menu item deleted successfully."}, status=status.HTTP_204_NO_CONTENT)

@api_view(["GET"])
@permission_classes([AllowAny])
def get_restaurant_detail(request, restaurant_id):
    rest = get_object_or_404(Restaurant, id=restaurant_id)
    return Response(RestaurantSerializer(rest).data)

@api_view(["GET"])
@permission_classes([AllowAny])
def list_nearby_restaurants(request):
    # Parse optional lat/lng
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

    # Optional cuisine filter
    cuisine = request.query_params.get("cuisine", "").strip().lower()

    # Start queryset
    restaurants = Restaurant.objects.all()
    if cuisine:
        restaurants = restaurants.filter(cuisines__name__iexact=cuisine)

    nearby = []

    if user_lat is not None and user_lng is not None:
        user_point = (user_lat, user_lng)
        for r in restaurants:
            try:
                r_point = (r.lat, r.lng)
                dist = geodesic(user_point, r_point).km
                if dist <= radius_km:
                    nearby.append((dist, r))
            except Exception:
                continue
        # Sort by distance
        nearby.sort(key=lambda x: x[0])
        restaurant_objs = [r for _, r in nearby]
    else:
        # No lat/lng → skip distance filtering
        restaurant_objs = list(restaurants)
        nearby = [(None, r) for r in restaurant_objs]

    # Manual pagination
    start = (page - 1) * page_size
    end = start + page_size
    paginated_restaurants = restaurant_objs[start:end]

    # Serialize
    serialized = []
    for r in paginated_restaurants:
        dist = next((d for d, rest in nearby if rest.id == r.id), None)
        data = RestaurantSerializer(r).data
        data["distance_km"] = round(dist, 3) if dist is not None else None
        serialized.append(data)

    return Response({
        "count": len(restaurant_objs),
        "page": page,
        "page_size": page_size,
        "results": serialized
    })

def _call_external_api(api_obj, params=None):
    headers = {}
    if api_obj.api_key:
        headers["Authorization"] = f"Bearer {api_obj.api_key}"
    try:
        resp = requests.get(api_obj.api_url, params=(params or {}), headers=headers, timeout=8)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        logger.warning("External API call failed (%s): %s", api_obj.api_url, str(e))
        raise

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
            data = _call_external_api(api_entry, params=request.query_params)
            return Response(data)
        except Exception:
            pass

    categories = MenuItem.objects.filter(restaurant=restaurant).values_list("category", flat=True).distinct()
    return Response({"categories": list(categories)})

@api_view(["GET"])
@permission_classes([AllowAny])
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
            data = _call_external_api(api_entry, params=request.query_params)
            return Response(data)
        except Exception:
            logger.warning("External menu API failed for restaurant %s - falling back to DB", restaurant.id)

    items_qs = MenuItem.objects.filter(restaurant=restaurant)
    category_filter = request.query_params.get("category")
    if category_filter:
        items_qs = items_qs.filter(category__iexact=category_filter)
    serializer = MenuItemSerializer(items_qs, many=True, context={"request": request})
    return Response(serializer.data)

# -------------------------------
# Order status updates for dashboard
# -------------------------------

def send_dashboard_update(restaurant, dashboard):
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

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_order_preparing(request, order_id):
    from orders.models import Order
    order = get_object_or_404(Order, id=order_id)
    restaurant = get_object_or_404(Restaurant, owner=request.user)
    dashboard, _ = RestaurantDashboard.objects.get_or_create(restaurant=restaurant)

    pending_list = dashboard.pending
    order_data = next((o for o in pending_list if o["order_id"] == str(order.id)), None)
    if not order_data:
        return Response({"detail": "Order not found in pending."}, status=status.HTTP_400_BAD_REQUEST)

    dashboard.pending = [o for o in pending_list if o["order_id"] != str(order.id)]
    dashboard.preparing.append(order_data)
    dashboard.save()

    order.status = "preparing"
    order.save()

    send_dashboard_update(restaurant, dashboard)
    return Response({"detail": "Order marked as preparing.", "status": "preparing"}, status=status.HTTP_200_OK)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_order_ready(request, order_id):
    from orders.models import Order
    order = get_object_or_404(Order, id=order_id)
    restaurant = get_object_or_404(Restaurant, owner=request.user)
    dashboard, _ = RestaurantDashboard.objects.get_or_create(restaurant=restaurant)

    preparing_list = dashboard.preparing
    order_data = next((o for o in preparing_list if o["order_id"] == str(order.id)), None)
    if not order_data:
        return Response({"detail": "Order not found in preparing."}, status=status.HTTP_400_BAD_REQUEST)

    dashboard.preparing = [o for o in preparing_list if o["order_id"] != str(order.id)]
    dashboard.completed.append(order_data)
    dashboard.save()

    order.status = "ready"
    order.save()

    send_dashboard_update(restaurant, dashboard)
    return Response({"detail": "Order marked as ready for collection.", "status": "ready"}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])  # or AllowAny if public
def list_restaurants(request):
    restaurants = Restaurant.objects.all()
    serializer = RestaurantSerializer(restaurants, many=True)
    return Response(serializer.data)