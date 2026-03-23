import logging
import requests as http_requests
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import cache_page
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from math import cos, radians
from geopy.distance import geodesic

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from django.db import connection
from django.db.models import Avg, Q, Count

from .models import (
    Restaurant, MenuItem, RestaurantDashboard, CuisineType, CategoryType,
    Branch, RestaurantEarning, RestaurantFinanceSummary, RestaurantDebt,
    RestaurantReview, Banner,
)
from .serializers import (
    RestaurantSerializer, RestaurantCreateSerializer,
    RestaurantExternalAPISerializer, MenuItemSerializer, MenuItemWriteSerializer,
    BranchSerializer, RestaurantEarningSerializer, RestaurantFinanceSummarySerializer,
    RestaurantDebtSerializer, RestaurantReviewSerializer,
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
        return Response({"detail": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
    if CuisineType.objects.filter(name=name).exists():
        return Response({"detail": "Cuisine already exists."}, status=status.HTTP_400_BAD_REQUEST)
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
        return Response({"detail": "Name is required."}, status=status.HTTP_400_BAD_REQUEST)
    if CategoryType.objects.filter(name=name).exists():
        return Response({"detail": "Category already exists."}, status=status.HTTP_400_BAD_REQUEST)
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
    serializer = MenuItemWriteSerializer(data=request.data)
    if serializer.is_valid():
        item = serializer.save(restaurant=restaurant)
        return Response(MenuItemSerializer(item, context={"request": request}).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def update_menu_item(request, menu_id):
    menu_item = get_object_or_404(MenuItem, id=menu_id)
    if str(menu_item.restaurant.owner_id) != str(request.user.id):
        return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    partial = request.method == "PATCH"
    serializer = MenuItemWriteSerializer(menu_item, data=request.data, partial=partial)
    if serializer.is_valid():
        item = serializer.save()
        return Response(MenuItemSerializer(item, context={"request": request}).data)
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
        return Response({"detail": "lat and lng must be floats"}, status=400)

    radius_km = float(request.query_params.get("radius_km", 10.0))
    page_size = int(request.query_params.get("page_size", 10))
    page = int(request.query_params.get("page", 1))
    cuisine = request.query_params.get("cuisine", "").strip().lower()

    restaurants = Restaurant.objects.all()
    if cuisine:
        restaurants = restaurants.filter(cuisines__name__iexact=cuisine)

    nearby = []
    if user_lat is not None and user_lng is not None:
        # Approximate bounding box pre-filter (1 degree ~ 111km)
        lat_delta = radius_km / 111.0
        lng_delta = radius_km / (111.0 * cos(radians(user_lat)))
        restaurants = restaurants.filter(
            lat__gte=user_lat - lat_delta,
            lat__lte=user_lat + lat_delta,
            lng__gte=user_lng - lng_delta,
            lng__lte=user_lng + lng_delta,
        )

        # Precise geodesic distance on the pre-filtered set
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
    data = RestaurantSerializer(restaurant).data
    # Include payment config from chain
    chain = restaurant.chain
    data['payment_config'] = {
        'accepts_direct_payment': chain.accepts_direct_payment if chain else False,
        'paynow_integration_id': chain.paynow_integration_id if chain else '',
        'paynow_integration_key': chain.paynow_integration_key if chain else '',
        'platform_commission_pct': str(chain.platform_commission_pct) if chain else '15.00',
    }
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_restaurant_payment_info(request, restaurant_id):
    """Return whether a restaurant accepts direct payment (for checkout UI)."""
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    chain = restaurant.chain
    accepts_direct = chain.accepts_direct_payment if chain else False
    return Response({
        'accepts_direct_payment': accepts_direct,
        'restaurant_id': str(restaurant.id),
        'restaurant_name': restaurant.name,
    })


# --- Branch management ---

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def manage_branches(request, restaurant_id):
    restaurant = get_object_or_404(Restaurant, id=restaurant_id, owner_id=request.user.id)

    if request.method == "GET":
        branches = Branch.objects.filter(restaurant=restaurant).order_by("created")
        return Response(BranchSerializer(branches, many=True).data)

    serializer = BranchSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(restaurant=restaurant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def branch_detail(request, branch_id):
    branch = get_object_or_404(Branch, id=branch_id)
    if str(branch.restaurant.owner_id) != str(request.user.id):
        return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "DELETE":
        branch.delete()
        return Response({"detail": "Branch deleted."}, status=status.HTTP_204_NO_CONTENT)

    serializer = BranchSerializer(branch, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# --- Restaurant Finance ---

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def restaurant_finance(request):
    restaurant = get_object_or_404(Restaurant, owner_id=request.user.id)
    summary, _ = RestaurantFinanceSummary.objects.get_or_create(restaurant=restaurant)
    earnings = RestaurantEarning.objects.filter(restaurant=restaurant).order_by("-created")[:50]
    unsettled_debts = RestaurantDebt.objects.filter(restaurant=restaurant, settled=False).order_by("-created")[:50]
    return Response({
        "summary": RestaurantFinanceSummarySerializer(summary).data,
        "recent_earnings": RestaurantEarningSerializer(earnings, many=True).data,
        "unsettled_debts": RestaurantDebtSerializer(unsettled_debts, many=True).data,
    })


def record_order_earning(restaurant, order_id, order_total, delivery_fee, paid_direct=False):
    """Record an earning entry for a completed order and update the finance summary."""
    from decimal import Decimal
    commission_pct = restaurant.chain.platform_commission_pct if restaurant.chain else Decimal('15.00')
    food_total = order_total - delivery_fee
    platform_fee = round(food_total * commission_pct / 100, 2)
    restaurant_earning = food_total - platform_fee

    RestaurantEarning.objects.create(
        restaurant=restaurant,
        order_id=order_id,
        order_total=order_total,
        delivery_fee=delivery_fee,
        platform_commission_pct=commission_pct,
        platform_fee=platform_fee,
        restaurant_earning=restaurant_earning,
        paid_direct=paid_direct,
    )

    summary, _ = RestaurantFinanceSummary.objects.get_or_create(restaurant=restaurant)
    summary.total_revenue += order_total
    summary.total_platform_fees += platform_fee
    summary.total_earnings += restaurant_earning
    summary.total_orders += 1

    if paid_direct:
        # Restaurant collected the full payment directly, so they owe us:
        # platform commission fee + delivery fee (since customer paid everything to restaurant)
        summary.unsettled_platform_fees += platform_fee
        summary.unsettled_delivery_fees += delivery_fee
        total_owed = platform_fee + delivery_fee
        summary.total_debt += total_owed

        # Create individual debt record for this order
        RestaurantDebt.objects.create(
            restaurant=restaurant,
            order_id=order_id,
            platform_fee=platform_fee,
            delivery_fee=delivery_fee,
            total_owed=total_owed,
        )

    summary.save()

    # Update dashboard today_revenue
    dashboard, _ = RestaurantDashboard.objects.get_or_create(restaurant=restaurant)
    dashboard.today_revenue += restaurant_earning
    dashboard.today_orders += 1
    dashboard.save()


## --- Toggle Open/Closed ---

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_restaurant_open(request):
    """
    POST /api/restaurants/toggle-open/
    Toggle a restaurant's open/closed status via is_open_override.

    Body (optional):
        { "is_open": true|false|null }
    - true  = force open
    - false = force closed
    - null  = revert to schedule-based hours

    If no body is provided, the override flips:
        None -> False (close), True -> False, False -> True
    """
    restaurant = get_object_or_404(Restaurant, owner_id=request.user.id)

    requested = request.data.get("is_open", "__absent__")

    if requested == "__absent__":
        # Cycle: None -> False, True -> False, False -> True
        if restaurant.is_open_override is None or restaurant.is_open_override is True:
            restaurant.is_open_override = False
        else:
            restaurant.is_open_override = True
    elif requested is None:
        # Explicitly revert to schedule
        restaurant.is_open_override = None
    else:
        restaurant.is_open_override = bool(requested)

    restaurant.save(update_fields=["is_open_override"])

    return Response({
        "is_open": restaurant.is_currently_open,
        "is_open_override": restaurant.is_open_override,
        "detail": "Restaurant status updated.",
    })


## --- Restaurant Reviews ---

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_restaurant_review(request, restaurant_id):
    """
    POST /api/restaurants/<restaurant_id>/review/
    Create a review for a restaurant. One review per order enforced by
    the unique constraint on order_id.
    Expects JSON: { "order_id": "...", "rating": 1-5, "comment": "optional" }
    """
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)

    serializer = RestaurantReviewSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    rating_value = serializer.validated_data.get("rating")
    if rating_value is None or rating_value < 1 or rating_value > 5:
        return Response(
            {"detail": "Rating must be between 1 and 5."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    order_id = serializer.validated_data.get("order_id")
    if RestaurantReview.objects.filter(order_id=order_id).exists():
        return Response(
            {"detail": "You have already reviewed this order."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Save the review
    review = serializer.save(restaurant=restaurant, user_id=request.user.id)

    # Recalculate denormalized average_rating and total_reviews on Restaurant
    agg = RestaurantReview.objects.filter(restaurant=restaurant).aggregate(
        avg=Avg("rating")
    )
    restaurant.total_reviews = RestaurantReview.objects.filter(restaurant=restaurant).count()
    restaurant.average_rating = round(agg["avg"] or 0, 2)
    restaurant.save(update_fields=["average_rating", "total_reviews"])

    return Response(RestaurantReviewSerializer(review).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([AllowAny])
def list_restaurant_reviews(request, restaurant_id):
    """
    GET /api/restaurants/<restaurant_id>/reviews/
    Public endpoint — lists reviews for a restaurant, newest first, with
    simple offset pagination via ?page=1&page_size=10 query params.
    """
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)
    page_size = int(request.query_params.get("page_size", 10))
    page = int(request.query_params.get("page", 1))

    reviews = RestaurantReview.objects.filter(restaurant=restaurant).order_by("-created")
    total = reviews.count()

    start = (page - 1) * page_size
    paginated = reviews[start:start + page_size]

    return Response({
        "count": total,
        "page": page,
        "page_size": page_size,
        "average_rating": round(restaurant.average_rating, 1),
        "total_reviews": restaurant.total_reviews,
        "results": RestaurantReviewSerializer(paginated, many=True).data,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Enhanced health check with DB connection status."""
    db_status = "ok"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception as e:
        db_status = f"error: {str(e)}"

    overall = "ok" if db_status == "ok" else "degraded"

    return Response({
        "status": overall,
        "service": "restaurant-service",
        "database": db_status,
    })


# ─── Admin Endpoints ────────────────────────────────────────────────


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_list_restaurants(request):
    """
    GET /api/restaurants/admin/list/
    All restaurants with admin info: id, name, owner_id, is_currently_open,
    average_rating, total_reviews, order count from dashboard, created date.
    Supports q search, is_open filter, and pagination.
    """
    params = request.query_params
    page = int(params.get("page", 1))
    page_size = int(params.get("page_size", 20))
    if page_size > 100:
        page_size = 100

    restaurants = Restaurant.objects.all()

    # Text search on name
    q = params.get("q", "").strip()
    if q:
        restaurants = restaurants.filter(name__icontains=q)

    # Filter by open status
    is_open = params.get("is_open")
    if is_open is not None:
        # We cannot filter by the property directly in the queryset,
        # so we filter in Python after fetching. For performance, we
        # limit to a reasonable set and then apply the property filter.
        pass  # Applied after fetching below

    restaurants = restaurants.order_by("-created")
    total_unfiltered = restaurants.count()

    # Fetch all for property-based filtering if needed
    if is_open is not None:
        is_open_bool = is_open.lower() in ("true", "1")
        all_restaurants = list(restaurants)
        filtered = [r for r in all_restaurants if r.is_currently_open == is_open_bool]
        total = len(filtered)
        start = (page - 1) * page_size
        paginated = filtered[start:start + page_size]
    else:
        total = total_unfiltered
        start = (page - 1) * page_size
        paginated = restaurants[start:start + page_size]

    results = []
    for r in paginated:
        # Get dashboard order count if available
        dashboard_orders = 0
        try:
            dashboard = RestaurantDashboard.objects.get(restaurant=r)
            dashboard_orders = dashboard.today_orders
        except RestaurantDashboard.DoesNotExist:
            pass

        results.append({
            "id": str(r.id),
            "name": r.name,
            "owner_id": str(r.owner_id),
            "is_currently_open": r.is_currently_open,
            "is_open_override": r.is_open_override,
            "average_rating": r.average_rating,
            "total_reviews": r.total_reviews,
            "today_orders": dashboard_orders,
            "phone_number": r.phone_number,
            "full_address": r.full_address,
            "created": r.created.isoformat() if r.created else None,
        })

    return Response({
        "results": results,
        "total": total,
        "page": page,
        "page_size": page_size,
    })


@api_view(['PATCH'])
@permission_classes([AllowAny])
def admin_suspend_restaurant(request, restaurant_id):
    """
    PATCH /api/restaurants/admin/{restaurant_id}/suspend/
    Suspend or unsuspend a restaurant by setting is_open_override = False
    and recording a note.
    Body: {"suspended": true/false, "reason": "..."}
    """
    restaurant = get_object_or_404(Restaurant, id=restaurant_id)

    suspended = request.data.get("suspended", True)
    reason = request.data.get("reason", "")

    if suspended:
        restaurant.is_open_override = False
    else:
        # Unsuspend: revert to schedule-based hours
        restaurant.is_open_override = None

    restaurant.save(update_fields=["is_open_override"])

    action = "suspended" if suspended else "unsuspended"
    logger.info(
        f"Admin {action} restaurant {restaurant.id} ({restaurant.name}). Reason: {reason}"
    )

    return Response({
        "id": str(restaurant.id),
        "name": restaurant.name,
        "is_currently_open": restaurant.is_currently_open,
        "is_open_override": restaurant.is_open_override,
        "action": action,
        "reason": reason,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_all_reviews(request):
    """
    GET /api/restaurants/admin/reviews/
    All reviews across all restaurants, paginated, sortable by rating and date.
    Includes restaurant name and user_id.
    """
    params = request.query_params
    page = int(params.get("page", 1))
    page_size = int(params.get("page_size", 20))
    if page_size > 100:
        page_size = 100

    sort_by = params.get("sort_by", "date")  # "date" or "rating"
    sort_order = params.get("sort_order", "desc")  # "asc" or "desc"

    reviews = RestaurantReview.objects.select_related("restaurant").all()

    # Filter by minimum rating
    min_rating = params.get("min_rating")
    if min_rating:
        reviews = reviews.filter(rating__gte=int(min_rating))

    max_rating = params.get("max_rating")
    if max_rating:
        reviews = reviews.filter(rating__lte=int(max_rating))

    # Sorting
    if sort_by == "rating":
        order_field = "rating" if sort_order == "asc" else "-rating"
    else:
        order_field = "created" if sort_order == "asc" else "-created"

    reviews = reviews.order_by(order_field)
    total = reviews.count()

    start = (page - 1) * page_size
    paginated = reviews[start:start + page_size]

    results = []
    for review in paginated:
        results.append({
            "id": str(review.id),
            "restaurant_id": str(review.restaurant_id),
            "restaurant_name": review.restaurant.name,
            "user_id": str(review.user_id),
            "order_id": str(review.order_id),
            "rating": review.rating,
            "comment": review.comment,
            "created": review.created.isoformat() if review.created else None,
        })

    return Response({
        "results": results,
        "total": total,
        "page": page,
        "page_size": page_size,
    })


# ──── Banner / Campaign Management ────


@api_view(["GET"])
@permission_classes([AllowAny])
def active_banners(request):
    """GET /api/restaurants/banners/active/ — Public: returns currently active banners."""
    from django.utils import timezone as tz
    now = tz.now()
    banners = Banner.objects.filter(is_active=True, start_date__lte=now, end_date__gte=now).order_by("-priority", "-created")
    results = []
    for b in banners:
        results.append({
            "id": str(b.id),
            "title": b.title,
            "description": b.description,
            "image": b.image.url if b.image else None,
            "link_url": b.link_url,
            "campaign_type": b.campaign_type,
            "target_audience": b.target_audience,
            "free_delivery_threshold": float(b.free_delivery_threshold) if b.free_delivery_threshold else None,
            "start_date": b.start_date.isoformat(),
            "end_date": b.end_date.isoformat(),
            "priority": b.priority,
        })
    return Response(results)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def admin_banners(request):
    """
    GET  /api/restaurants/admin/banners/ — List all banners (admin).
    POST /api/restaurants/admin/banners/ — Create a new banner.
    """
    if request.method == "GET":
        banners = Banner.objects.all().order_by("-created")
        results = []
        for b in banners:
            results.append({
                "id": str(b.id),
                "title": b.title,
                "description": b.description,
                "image": b.image.url if b.image else None,
                "link_url": b.link_url,
                "campaign_type": b.campaign_type,
                "target_audience": b.target_audience,
                "free_delivery_threshold": float(b.free_delivery_threshold) if b.free_delivery_threshold else None,
                "start_date": b.start_date.isoformat(),
                "end_date": b.end_date.isoformat(),
                "is_active": b.is_active,
                "priority": b.priority,
                "created": b.created.isoformat(),
            })
        return Response(results)

    # POST — Create banner
    data = request.data
    banner = Banner.objects.create(
        title=data.get("title", ""),
        description=data.get("description", ""),
        image=request.FILES.get("image"),
        link_url=data.get("link_url", ""),
        campaign_type=data.get("campaign_type", "info"),
        target_audience=data.get("target_audience", "all"),
        free_delivery_threshold=data.get("free_delivery_threshold") or None,
        start_date=data.get("start_date"),
        end_date=data.get("end_date"),
        is_active=str(data.get("is_active", "true")).lower() in ("true", "1", "yes"),
        priority=int(data.get("priority", 0)),
    )
    return Response({
        "id": str(banner.id),
        "title": banner.title,
        "status": "created",
    }, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def admin_banner_detail(request, banner_id):
    """
    PATCH  /api/restaurants/admin/banners/<id>/ — Update a banner.
    DELETE /api/restaurants/admin/banners/<id>/ — Deactivate a banner.
    """
    banner = get_object_or_404(Banner, id=banner_id)

    if request.method == "DELETE":
        banner.is_active = False
        banner.save()
        return Response({"status": "deactivated"})

    # PATCH
    data = request.data
    for field in ["title", "description", "link_url", "campaign_type", "target_audience"]:
        if field in data:
            setattr(banner, field, data[field])
    if "free_delivery_threshold" in data:
        banner.free_delivery_threshold = data["free_delivery_threshold"] or None
    if "start_date" in data:
        banner.start_date = data["start_date"]
    if "end_date" in data:
        banner.end_date = data["end_date"]
    if "is_active" in data:
        banner.is_active = str(data["is_active"]).lower() in ("true", "1", "yes")
    if "priority" in data:
        banner.priority = int(data["priority"])
    if "image" in request.FILES:
        banner.image = request.FILES["image"]
    banner.save()

    return Response({"id": str(banner.id), "status": "updated"})
