from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Driver, DriverOrderStatus
from .serializer import DriverSerializer
from drivers.utils import assign_driver
from .models import DriverFinance, DriverRating
import requests
from django.conf import settings
from django.utils import timezone
from rest_framework.pagination import CursorPagination

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_driver_profile(request):
    serializer = DriverSerializer(data=request.data, context={'request': request})

    if serializer.is_valid():
        serializer.save()  # ✅ remove user=request.user here
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def toggle_driver_status(request):
    try:
        driver = request.user.driver_profile
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=404)

    driver.is_online = not driver.is_online
    driver.save()
    return Response({"is_online": driver.is_online})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_order(request, pk):
    try:
        driver = Driver.objects.get(user=request.user)
        order = driver.orders.get(pk=pk)
    except:
        return Response({"error": "Order not found or unauthorized"}, status=404)
    order.status = "rejected"
    order.save()
    return Response({"message": "Order rejected"})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_driver_status(request):
    try:
        driver = request.user.driver_profile
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=404)

    return Response({"is_online": driver.is_online})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_driver_location(request):
    try:
        driver = request.user.driver_profile
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=404)

    driver.lat = request.data.get("lat")
    driver.lng = request.data.get("lng")
    driver.save()
    return Response({"lat": driver.lat, "lng": driver.lng})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_order(request, order_id):
    try:
        driver = request.user.driver_profile
        driver_order = DriverOrderStatus.objects.get(driver=driver, order_id=order_id)
    except DriverOrderStatus.DoesNotExist:
        return Response({"error": "No such order assigned"}, status=404)

    driver_order.status = "cancelled"
    driver_order.save()
    # Optionally reassign the order to another nearest driver
    order = driver_order.order
    assign_driver(order)
    return Response({"message": "Order cancelled and reassigned"})

GOOGLE_MAPS_API_KEY = settings.GOOGLE_MAPS_API_KEY  # put your key in .env and settings.py

def get_address_from_coordinates(lat, lng):
    """Use Google Maps API to convert coordinates into a human-readable address."""
    try:
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={GOOGLE_MAPS_API_KEY}"
        response = requests.get(url)
        data = response.json()
        if data["status"] == "OK" and len(data["results"]) > 0:
            return data["results"][0]["formatted_address"]
        return None
    except Exception as e:
        print("Error decoding coordinates:", e)
        return None

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def driver_active_orders(request):
    """
    Return all active orders for the authenticated driver with status accepted or delivering.
    """
    try:
        driver_profile = request.user.driver_profile
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=404)

    driver_orders_qs = (
        DriverOrderStatus.objects.filter(
            driver=driver_profile,
            status__in=["accepted", "delivering"]
        )
        .select_related("order", "order__customer")
    )

    data = []
    for dos in driver_orders_qs:
        order = dos.order

        # Try decoding address from lat/lng
        decoded_address = None
        if order.lat and order.lng:
            decoded_address = get_address_from_coordinates(order.lat, order.lng)

        data.append({
            "id": str(order.id),
            "status": dos.status,
            "fee": float(order.delivery_fee),
            "location": decoded_address
                        or getattr(order, "delivery_address", None)
                        or getattr(order.customer, "address", None)
        })

    return Response(data)

class DriverOrderCursorPagination(CursorPagination):
    page_size = 5
    ordering = "-completed_at"  # Show most recent completed/cancelled orders first

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def driver_completed_cancelled_orders(request):
    """
    Returns all driver orders with status 'completed' or 'cancelled' (5 per page, cursor pagination).
    """
    try:
        driver_profile = request.user.driver_profile
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=status.HTTP_404_NOT_FOUND)

    # Get queryset of completed and cancelled orders
    driver_orders_qs = (
        DriverOrderStatus.objects.filter(
            driver=driver_profile,
            status__in=["completed", "cancelled"]
        )
        .select_related("order", "order__customer")
        .order_by("-completed_at")  # needed for cursor pagination
    )

    paginator = DriverOrderCursorPagination()
    paginated_qs = paginator.paginate_queryset(driver_orders_qs, request)

    data = []
    for dos in paginated_qs:
        order = dos.order
        decoded_address = None
        if order.lat and order.lng:
            decoded_address = get_address_from_coordinates(order.lat, order.lng)

        data.append({
            "id": str(order.id),
            "status": dos.status,
            "fee": float(order.delivery_fee),
            "location": decoded_address
                        or getattr(order, "delivery_address", None)
                        or getattr(order.customer, "address", None),
            "completed_at": dos.completed_at.isoformat() if dos.completed_at else None,
        })

    return paginator.get_paginated_response(data)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def driver_finance_view(request):
    try:
        driver = request.user.driver_profile
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=status.HTTP_404_NOT_FOUND)

    # Get or create today's finance record
    finance, created = DriverFinance.objects.get_or_create(driver=driver, date=timezone.localdate())
    
    # Reset if it is a new day
    finance.reset_if_new_day()

    if request.method == "POST":
        data = request.data
        rating = float(data.get("rating", 0))
        deliveries = int(data.get("today_deliveries", 0))
        earnings = float(data.get("today_earnings", 0))
        hours_online = float(data.get("hours_online", 0))

        # Update finance
        if rating > 0:
            finance.rating_sum += rating
            finance.rating_count += 1
        finance.today_deliveries += deliveries
        finance.today_earnings += earnings
        finance.hours_online += hours_online
        finance.save()

        return Response({"message": "Finance updated", "finance": {
            "today_deliveries": finance.today_deliveries,
            "today_earnings": float(finance.today_earnings),
            "average_rating": float(finance.average_rating),
            "hours_online": float(finance.hours_online)
        }}, status=status.HTTP_200_OK)

    # GET request
    return Response({
        "today_deliveries": finance.today_deliveries,
        "today_earnings": float(finance.today_earnings),
        "average_rating": float(finance.average_rating),
        "hours_online": float(finance.hours_online)
    })

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_driver_rating(request, driver_id):
    """
    Submit a rating for a driver.
    """
    try:
        driver = Driver.objects.get(id=driver_id)
    except Driver.DoesNotExist:
        return Response({"error": "Driver not found"}, status=status.HTTP_404_NOT_FOUND)

    rating_value = float(request.data.get("rating", 0))
    comment = request.data.get("comment", "")

    if rating_value <= 0 or rating_value > 5:
        return Response({"error": "Rating must be between 1 and 5"}, status=status.HTTP_400_BAD_REQUEST)

    # Save the rating
    rating_obj = DriverRating.objects.create(
        driver=driver,
        user=request.user,
        rating=rating_value,
        comment=comment
    )

    # Update today's finance
    finance, created = DriverFinance.objects.get_or_create(driver=driver, date=timezone.localdate())
    finance.reset_if_new_day()
    finance.rating_sum += rating_value
    finance.rating_count += 1
    finance.save()

    return Response({
        "message": "Rating submitted",
        "rating": float(rating_obj.rating),
        "today_average_rating": float(finance.average_rating)
    }, status=status.HTTP_201_CREATED)