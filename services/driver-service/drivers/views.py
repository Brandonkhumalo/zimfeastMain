from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import CursorPagination
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import Driver, DriverOrderStatus, DriverFinance, DriverRating
from .serializers import DriverSerializer
from .utils import get_address_from_coordinates, batch_get_addresses


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_driver_profile(request):
    serializer = DriverSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def toggle_driver_status(request):
    try:
        driver = Driver.objects.get(user_id=request.user.id)
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=404)
    driver.is_online = not driver.is_online
    driver.save()
    return Response({"is_online": driver.is_online})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_order(request, pk):
    try:
        driver = Driver.objects.get(user_id=request.user.id)
    except Driver.DoesNotExist:
        return Response({"error": "Driver not found"}, status=404)
    # Just record the rejection
    from .models import DriverReject
    DriverReject.objects.create(driver=driver, order_id=pk, reason=request.data.get('reason', ''))
    return Response({"message": "Order rejected"})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_driver_status(request):
    try:
        driver = Driver.objects.get(user_id=request.user.id)
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=404)
    return Response({"is_online": driver.is_online})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_driver_location(request):
    try:
        driver = Driver.objects.get(user_id=request.user.id)
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
        driver = Driver.objects.get(user_id=request.user.id)
        driver_order = DriverOrderStatus.objects.get(driver=driver, order_id=order_id)
    except (Driver.DoesNotExist, DriverOrderStatus.DoesNotExist):
        return Response({"error": "No such order assigned"}, status=404)
    driver_order.status = "cancelled"
    driver_order.save()
    return Response({"message": "Order cancelled"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def driver_active_orders(request):
    try:
        driver = Driver.objects.get(user_id=request.user.id)
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=404)

    driver_orders_qs = DriverOrderStatus.objects.filter(
        driver=driver, status__in=["accepted", "delivering"]
    )

    orders_list = list(driver_orders_qs)
    data = []
    for dos in orders_list:
        data.append({
            "id": str(dos.order_id),
            "status": dos.status,
        })
    return Response(data)


class DriverOrderCursorPagination(CursorPagination):
    page_size = 5
    ordering = "-completed_at"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def driver_completed_cancelled_orders(request):
    try:
        driver = Driver.objects.get(user_id=request.user.id)
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=status.HTTP_404_NOT_FOUND)

    driver_orders_qs = DriverOrderStatus.objects.filter(
        driver=driver, status__in=["completed", "cancelled"]
    ).order_by("-completed_at")

    paginator = DriverOrderCursorPagination()
    paginated_qs = paginator.paginate_queryset(driver_orders_qs, request)

    data = []
    for dos in paginated_qs:
        data.append({
            "id": str(dos.order_id),
            "status": dos.status,
            "completed_at": dos.completed_at.isoformat() if dos.completed_at else None,
        })
    return paginator.get_paginated_response(data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def driver_finance_view(request):
    try:
        driver = Driver.objects.get(user_id=request.user.id)
    except Driver.DoesNotExist:
        return Response({"error": "Driver profile not found"}, status=status.HTTP_404_NOT_FOUND)

    finance, _ = DriverFinance.objects.get_or_create(driver=driver, date=timezone.localdate())
    finance.reset_if_new_day()

    if request.method == "POST":
        data = request.data
        updates = {}
        rating = float(data.get("rating", 0))
        if rating > 0:
            updates['rating_sum'] = F('rating_sum') + rating
            updates['rating_count'] = F('rating_count') + 1
        deliveries = int(data.get("today_deliveries", 0))
        if deliveries > 0:
            updates['today_deliveries'] = F('today_deliveries') + deliveries
        earnings = float(data.get("today_earnings", 0))
        if earnings > 0:
            updates['today_earnings'] = F('today_earnings') + earnings
        hours_online = float(data.get("hours_online", 0))
        if hours_online > 0:
            updates['hours_online'] = F('hours_online') + hours_online

        if updates:
            DriverFinance.objects.filter(pk=finance.pk).update(**updates)
            finance.refresh_from_db()

        return Response({
            "message": "Finance updated",
            "finance": {
                "today_deliveries": finance.today_deliveries,
                "today_earnings": float(finance.today_earnings),
                "average_rating": float(finance.average_rating),
                "hours_online": float(finance.hours_online),
            }
        })

    return Response({
        "today_deliveries": finance.today_deliveries,
        "today_earnings": float(finance.today_earnings),
        "average_rating": float(finance.average_rating),
        "hours_online": float(finance.hours_online),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_driver_rating(request, driver_id):
    try:
        driver = Driver.objects.get(id=driver_id)
    except Driver.DoesNotExist:
        return Response({"error": "Driver not found"}, status=status.HTTP_404_NOT_FOUND)

    rating_value = float(request.data.get("rating", 0))
    comment = request.data.get("comment", "")

    if rating_value <= 0 or rating_value > 5:
        return Response({"error": "Rating must be between 1 and 5"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        DriverRating.objects.create(
            driver=driver, user_id=request.user.id,
            rating=rating_value, comment=comment,
        )
        finance, _ = DriverFinance.objects.get_or_create(driver=driver, date=timezone.localdate())
        finance.reset_if_new_day()
        DriverFinance.objects.filter(pk=finance.pk).update(
            rating_sum=F('rating_sum') + rating_value,
            rating_count=F('rating_count') + 1,
        )
        finance.refresh_from_db()

    return Response({
        "message": "Rating submitted",
        "rating": rating_value,
        "today_average_rating": float(finance.average_rating),
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "ok"})
