from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.pagination import CursorPagination
from django.db import transaction
from django.utils import timezone
from .models import Order
from .serializers import OrderSerializer

from shared.redis_publisher import publisher
from shared.geo_utils import calculate_delivery_fee

import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_order(request):
    serializer = OrderSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        with transaction.atomic():
            order = serializer.save(customer_id=request.user.id)
            if order.method == "delivery" and order.delivery_lat and order.delivery_lng:
                order.delivery_fee = calculate_delivery_fee(
                    order.restaurant_lat, order.restaurant_lng,
                    order.delivery_lat, order.delivery_lng
                )
            else:
                order.delivery_fee = 0
            order.total_fee = order.total_fee + order.delivery_fee
            order.save()
        return Response({"order": OrderSerializer(order).data}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrderCursorPagination(CursorPagination):
    page_size = 50
    ordering = '-created'


class OrderListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = OrderCursorPagination

    def get_queryset(self):
        user = self.request.user
        user_id = str(user.id)
        role = getattr(user, 'role', user.payload.get('role', 'customer') if hasattr(user, 'payload') else 'customer')

        if role == "customer":
            return Order.objects.filter(customer_id=user_id).order_by('-created')
        elif role == "driver":
            return Order.objects.filter(driver_id=user_id).order_by('-created')
        elif role == "restaurant":
            return Order.objects.filter(restaurant_id=user_id).exclude(
                status__in=['pending_payment', 'created']
            ).order_by('-created')
        return Order.objects.none()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_order(request, pk):
    try:
        order = Order.objects.get(pk=pk, customer_id=request.user.id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)
    if order.status in ["pending_payment", "paid"]:
        order.status = "cancelled"
        order.save()
        publisher.publish_order_status(order.id, "cancelled")
        return Response({"message": "Order cancelled"})
    return Response({"error": "Cannot cancel this order"}, status=400)


class AllOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [AllowAny]
    pagination_class = OrderCursorPagination

    def get_queryset(self):
        return Order.objects.all().order_by('-created')


@api_view(['GET'])
@permission_classes([AllowAny])
def get_order(request, pk):
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(OrderSerializer(order).data)


@api_view(['POST'])
@permission_classes([AllowAny])  # Called by real-time server
def assign_driver(request, pk):
    driver_id = request.data.get('driver_id')
    driver_name = request.data.get('driver_name', '')
    driver_phone = request.data.get('driver_phone', '')
    driver_vehicle = request.data.get('driver_vehicle', '')

    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(pk=pk)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status == 'assigned' and order.driver_id is not None:
            return Response({"detail": "Order already assigned."}, status=status.HTTP_409_CONFLICT)

        order.driver_id = driver_id
        order.driver_name = driver_name
        order.driver_phone = driver_phone
        order.driver_vehicle = driver_vehicle
        order.status = 'assigned'
        order.save()

    publisher.publish_order_status(order.id, 'assigned')
    return Response({"detail": "Driver assigned.", "status": "assigned"})


@api_view(['PATCH'])
@permission_classes([AllowAny])  # Called by real-time server
def update_order_status(request, pk):
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    valid_statuses = ['assigned', 'out_for_delivery', 'delivered', 'cancelled', 'preparing', 'ready', 'collected', 'paid']

    if new_status not in valid_statuses:
        return Response({"detail": f"Invalid status."}, status=status.HTTP_400_BAD_REQUEST)

    order.status = new_status
    if new_status == 'out_for_delivery':
        order.delivery_out_time = timezone.now()
    elif new_status == 'delivered':
        order.delivery_complete_time = timezone.now()
    order.save()

    publisher.publish_order_status(order.id, new_status)
    return Response({"detail": f"Status updated to {new_status}.", "status": new_status})
