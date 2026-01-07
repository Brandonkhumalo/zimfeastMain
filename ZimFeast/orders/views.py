from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import Order
from .serializers import OrderSerializer
from rest_framework import generics

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_order(request):
    serializer = OrderSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        order = serializer.save(customer=request.user)

        # Calculate delivery fee only if method is delivery
        if order.method == "delivery" and order.delivery_lat and order.delivery_lng:
            '''
            # Example: compute distance-based fee
            distance = calculate_distance_kms(
                (order.restaurant_lat, order.restaurant_lng),
                (order.delivery_lat, order.delivery_lng)
            )
            order.delivery_fee = round(distance * 0.35, 2)
            '''
            order.delivery_fee = 5  # placeholder fee
        else:
            order.delivery_fee = 0

        # Add delivery fee to total_fee
        order.total_fee = order.total_fee + order.delivery_fee
        order.save()

        return Response({
            "order": OrderSerializer(order).data,
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrderListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Optional: DRF default pagination is enough

    def get_queryset(self):
        user = self.request.user
        if user.role == "customer":
            return Order.objects.filter(customer=user)
        elif user.role == "driver":
            return Order.objects.filter(driver=user)
        elif user.role == "restaurant":
            # Only show paid orders to restaurants (exclude unpaid orders)
            return Order.objects.filter(
                restaurant__owner=user
            ).exclude(status__in=['pending_payment', 'created'])
        return Order.objects.none()

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_order(request, pk):
    try:
        order = Order.objects.get(pk=pk, customer=request.user)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)
    if order.status in ["pending", "accepted"]:
        order.status = "cancelled"
        order.save()
        return Response({"message": "Order cancelled"})
    return Response({"error": "Cannot cancel this order"}, status=400)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_all_orders(request):
    """
    Returns all orders in the system.
    """
    orders = Order.objects.all().order_by('-created')  # latest first
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_order(request, pk):
    """
    Returns a single order by primary key (id).
    """
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

    serializer = OrderSerializer(order)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])  # Called by real-time server
def assign_driver(request, pk):
    """
    Assigns a driver to an order. Called by the real-time server.
    """
    from accounts.models import User
    from realtime.redis_publisher import publisher
    
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
    
    driver_id = request.data.get('driver_id')
    driver_name = request.data.get('driver_name', '')
    driver_phone = request.data.get('driver_phone', '')
    driver_vehicle = request.data.get('driver_vehicle', '')
    
    # Try to find the driver user
    try:
        driver = User.objects.get(id=driver_id)
        order.driver = driver
    except (User.DoesNotExist, ValueError):
        pass  # Driver might be from external system
    
    order.driver_name = driver_name
    order.driver_phone = driver_phone
    order.driver_vehicle = driver_vehicle
    order.status = 'assigned'
    order.save()
    
    # Publish status update
    publisher.publish_order_status(order.id, 'assigned')
    
    return Response({"detail": "Driver assigned.", "status": "assigned"})


@api_view(['PATCH'])
@permission_classes([AllowAny])  # Called by real-time server
def update_order_status(request, pk):
    """
    Updates order status. Called by the real-time server.
    """
    from realtime.redis_publisher import publisher
    from django.utils import timezone
    
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
    
    new_status = request.data.get('status')
    valid_statuses = ['assigned', 'out_for_delivery', 'delivered', 'cancelled']
    
    if new_status not in valid_statuses:
        return Response({"detail": f"Invalid status. Must be one of: {valid_statuses}"}, status=status.HTTP_400_BAD_REQUEST)
    
    order.status = new_status
    
    if new_status == 'out_for_delivery':
        order.delivery_out_time = timezone.now()
    elif new_status == 'delivered':
        order.delivery_complete_time = timezone.now()
    
    order.save()
    
    # Publish status update
    publisher.publish_order_status(order.id, new_status)
    
    return Response({"detail": f"Status updated to {new_status}.", "status": new_status})