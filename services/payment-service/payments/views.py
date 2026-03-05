import uuid
from decimal import Decimal
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Payment, FeastVoucher
from .paynow_utils import paynow, create_paynow_payment
from shared.redis_publisher import publisher
from shared.service_client import service_request


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment(request):
    user_id = request.user.id
    user_email = getattr(request.user, 'email', '')
    order_id = request.data.get("order_id")
    method = request.data.get("method", "paynow")
    phone = request.data.get("phone")

    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        return Response({"error": "Invalid order ID"}, status=status.HTTP_400_BAD_REQUEST)

    # Get order details from order service
    auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        order_data = service_request('order', 'GET', f'/api/orders/order/{order_id}/', auth_token=auth_token)
    except Exception:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    total_fee = Decimal(str(order_data.get('total_fee', 0)))
    tip = Decimal(str(order_data.get('tip', 0)))
    total_amount = total_fee + tip

    reference = f"PMT_{uuid.uuid4().hex[:10]}"

    payment = Payment.objects.create(
        user_id=user_id, order_id=order_uuid,
        reference=reference, amount=total_amount,
        method=method, status="pending",
    )

    # Voucher payment
    if method == "voucher":
        voucher, _ = FeastVoucher.objects.get_or_create(user_id=user_id)
        if voucher.balance >= total_amount:
            voucher.balance -= total_amount
            voucher.save()
            payment.status = "paid"
            payment.save()
            # Update order status via order service
            _update_order_status(order_id, "paid", auth_token)
            return Response({"status": "paid_with_voucher"})
        else:
            remaining = total_amount - voucher.balance
            voucher.balance = 0
            voucher.save()
            payment.amount = remaining
            payment.method = "paynow"
            payment.save()
            response = create_paynow_payment(order_id, float(remaining), user_email)
            if response.success:
                payment.reference = response.poll_url
                payment.save()
                return Response({"status": "partial", "paynow_url": response.redirect_url})
            return Response({"error": "Failed to initiate PayNow"}, status=400)

    # PayNow Web
    if method == "paynow" and not phone:
        response = create_paynow_payment(order_id, float(total_amount), user_email)
        if response.success:
            payment.reference = response.poll_url
            payment.save()
            return Response({"paynow_url": response.redirect_url})
        return Response({"error": "PayNow failed"}, status=400)

    # PayNow Mobile
    if method == "paynow" and phone:
        response = paynow.send_mobile(
            f"Order_{order_id}", phone, float(total_amount),
            f"Order #{order_id}", email=user_email,
        )
        if response.success:
            payment.reference = response.poll_url
            payment.save()
            return Response({
                "paynow_url": response.redirect_url,
                "instructions": "Check your phone to approve.",
                "reference": response.poll_url,
            })
        return Response({"error": "Mobile payment failed"}, status=400)

    return Response({"error": "Invalid payment method"}, status=400)


def _update_order_status(order_id, new_status, auth_token=None):
    """Update order status via order service."""
    try:
        service_request('order', 'PATCH', f'/api/orders/order/{order_id}/status/',
                        json={"status": new_status}, auth_token=auth_token)
    except Exception:
        # Fallback: publish via Redis
        publisher.publish_order_status(order_id, new_status)


@api_view(["POST"])
@permission_classes([AllowAny])
def paynow_result(request):
    reference = request.data.get("reference")
    status_pay = request.data.get("status")
    if not reference or not status_pay:
        return Response({"error": "Invalid callback"}, status=400)

    payment = get_object_or_404(Payment, reference=reference)
    payment.status = status_pay.lower()
    payment.save()

    if status_pay.lower() == "paid" and payment.order_id:
        _update_order_status(str(payment.order_id), "paid")
        publisher.publish_order_status(payment.order_id, "paid")

    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([AllowAny])
def paynow_callback(request):
    reference = request.data.get("reference")
    status_pay = request.data.get("status")
    payment = get_object_or_404(Payment, reference=reference)
    payment.status = status_pay.lower()
    payment.save()

    if status_pay.lower() == "paid" and payment.order_id:
        _update_order_status(str(payment.order_id), "paid")

    return Response({"status": "ok"})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def deposit_voucher(request):
    user_id = request.user.id
    user_email = getattr(request.user, 'email', '')
    amount = Decimal(request.data.get("amount", "0"))
    if amount <= 0:
        return Response({"error": "Invalid amount"}, status=400)

    payment = paynow.create_payment(f"VoucherTopup_{user_id}", user_email)
    payment.add("Voucher Deposit", float(amount))
    response = paynow.send(payment)
    if response.success:
        return Response({"paynow_url": response.redirect_url, "reference": response.pollurl})
    return Response({"error": "Failed to initiate voucher top-up"}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def paynow_status(request, reference):
    response = paynow.check_transaction_status(reference)
    return Response(response)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def feast_voucher_balance(request):
    vouchers = FeastVoucher.objects.filter(user_id=request.user.id)
    total_balance = sum(v.balance for v in vouchers) if vouchers.exists() else Decimal("0.00")
    return Response({"balance": str(total_balance)})
