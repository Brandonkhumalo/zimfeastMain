import uuid
import logging
import requests as http_requests
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

logger = logging.getLogger(__name__)


def _get_restaurant_payment_config(restaurant_id):
    """Fetch restaurant's chain payment config from restaurant service."""
    try:
        data = service_request('restaurant', 'GET', f'/api/restaurants/internal/restaurant/{restaurant_id}/')
        config = data.get('payment_config')
        if config:
            return {
                'accepts_direct_payment': config.get('accepts_direct_payment', False),
                'paynow_integration_id': config.get('paynow_integration_id', ''),
                'paynow_integration_key': config.get('paynow_integration_key', ''),
                'platform_commission_pct': Decimal(config.get('platform_commission_pct', '15.00')),
            }
        return {
            'accepts_direct_payment': False,
            'paynow_integration_id': '',
            'paynow_integration_key': '',
            'platform_commission_pct': Decimal('15.00'),
        }
    except Exception:
        return None


def _notify_restaurant_webhook(webhook_url, webhook_secret, order_data):
    """Send order notification to restaurant's webhook endpoint."""
    if not webhook_url:
        return
    try:
        headers = {'Content-Type': 'application/json'}
        if webhook_secret:
            headers['X-Webhook-Secret'] = webhook_secret
        http_requests.post(webhook_url, json=order_data, headers=headers, timeout=10)
    except Exception as e:
        logger.warning(f"Webhook notification failed: {e}")


def _create_direct_paynow_payment(restaurant_config, order_id, amount, user_email):
    """Create a PayNow payment using the restaurant's own integration credentials."""
    from paynow import Paynow
    direct_paynow = Paynow(
        integration_id=restaurant_config['paynow_integration_id'],
        integration_key=restaurant_config['paynow_integration_key'],
        return_url=settings.PAYNOW_RETURN_URL,
        result_url=settings.PAYNOW_RESULT_URL,
    )
    payment = direct_paynow.create_payment(f"Order_{order_id}", user_email)
    payment.add(f"Order #{order_id}", float(amount))
    return direct_paynow.send(payment)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment(request):
    user_id = request.user.id
    user_email = getattr(request.user, 'email', '')
    order_id = request.data.get("order_id")
    method = request.data.get("method", "paynow")
    phone = request.data.get("phone")
    use_voucher = request.data.get("use_voucher", False)

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
    delivery_fee = Decimal(str(order_data.get('delivery_fee', 0)))
    total_amount = total_fee + tip
    restaurant_id = order_data.get('restaurant_id')

    # Get restaurant payment config
    restaurant_config = _get_restaurant_payment_config(restaurant_id)
    is_direct_payment = restaurant_config and restaurant_config.get('accepts_direct_payment', False)

    # Calculate platform fee
    commission_pct = restaurant_config['platform_commission_pct'] if restaurant_config else Decimal('15.00')
    food_total = total_fee - delivery_fee
    platform_fee = round(food_total * commission_pct / 100, 2)
    restaurant_amount = food_total - platform_fee

    reference = f"PMT_{uuid.uuid4().hex[:10]}"

    # === DIRECT PAYMENT: restaurant collects payment directly ===
    if is_direct_payment:
        # Voucher NOT allowed for direct payments
        if method == "voucher" or use_voucher:
            return Response(
                {"error": "Voucher payment is not available for this restaurant. Only card payment via PayNow is accepted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment = Payment.objects.create(
            user_id=user_id, order_id=order_uuid,
            restaurant_id=restaurant_id,
            reference=reference, amount=total_amount,
            paynow_amount=total_amount, voucher_amount=Decimal('0'),
            method="direct", status="pending",
            paid_direct=True,
            platform_fee=platform_fee,
            restaurant_amount=restaurant_amount,
        )

        # Use restaurant's own PayNow credentials
        if phone:
            # Mobile payment to restaurant's PayNow
            from paynow import Paynow
            direct_paynow = Paynow(
                integration_id=restaurant_config['paynow_integration_id'],
                integration_key=restaurant_config['paynow_integration_key'],
                return_url=settings.PAYNOW_RETURN_URL,
                result_url=settings.PAYNOW_RESULT_URL,
            )
            response = direct_paynow.send_mobile(
                f"Order_{order_id}", phone, float(total_amount),
                f"Order #{order_id}", email=user_email,
            )
            if response.success:
                payment.reference = response.poll_url
                payment.save()
                return Response({
                    "paynow_url": response.redirect_url,
                    "instructions": "Check your phone to approve. Payment goes directly to the restaurant.",
                    "reference": response.poll_url,
                    "direct_payment": True,
                })
            return Response({"error": "Mobile payment failed"}, status=400)
        else:
            # Web payment to restaurant's PayNow
            response = _create_direct_paynow_payment(restaurant_config, order_id, total_amount, user_email)
            if response.success:
                payment.reference = response.poll_url
                payment.save()
                return Response({
                    "paynow_url": response.redirect_url,
                    "direct_payment": True,
                })
            return Response({"error": "PayNow failed"}, status=400)

    # === NON-DIRECT PAYMENT: payment comes to us ===

    # Handle voucher-only payment
    if method == "voucher" and not use_voucher:
        # Pure voucher payment attempt
        voucher, _ = FeastVoucher.objects.get_or_create(user_id=user_id)
        if voucher.balance >= total_amount:
            payment = Payment.objects.create(
                user_id=user_id, order_id=order_uuid,
                restaurant_id=restaurant_id,
                reference=reference, amount=total_amount,
                paynow_amount=Decimal('0'), voucher_amount=total_amount,
                method="voucher", status="paid",
                platform_fee=platform_fee,
                restaurant_amount=restaurant_amount,
            )
            voucher.balance -= total_amount
            voucher.save()
            _update_order_status(order_id, "paid", auth_token)
            _record_earning(restaurant_id, order_id, total_fee, delivery_fee, False)
            return Response({"status": "paid_with_voucher"})
        else:
            # Insufficient voucher balance - inform user to combine with PayNow
            return Response({
                "error": "Insufficient voucher balance",
                "voucher_balance": str(voucher.balance),
                "total_amount": str(total_amount),
                "shortfall": str(total_amount - voucher.balance),
                "hint": "Use combined voucher + PayNow payment by selecting PayNow and enabling 'Use Voucher Balance'."
            }, status=status.HTTP_400_BAD_REQUEST)

    # Handle combined voucher + PayNow payment
    voucher_deducted = Decimal('0')
    paynow_charge = total_amount

    if use_voucher and method == "paynow":
        voucher, _ = FeastVoucher.objects.get_or_create(user_id=user_id)
        if voucher.balance > 0:
            voucher_deducted = min(voucher.balance, total_amount)
            paynow_charge = total_amount - voucher_deducted
            voucher.balance -= voucher_deducted
            voucher.save()

        # If voucher covers everything, no PayNow needed
        if paynow_charge <= 0:
            payment = Payment.objects.create(
                user_id=user_id, order_id=order_uuid,
                restaurant_id=restaurant_id,
                reference=reference, amount=total_amount,
                paynow_amount=Decimal('0'), voucher_amount=voucher_deducted,
                method="voucher", status="paid",
                platform_fee=platform_fee,
                restaurant_amount=restaurant_amount,
            )
            _update_order_status(order_id, "paid", auth_token)
            _record_earning(restaurant_id, order_id, total_fee, delivery_fee, False)
            return Response({"status": "paid_with_voucher", "voucher_used": str(voucher_deducted)})

    # Determine method label for combined payments
    payment_method = "voucher_paynow" if voucher_deducted > 0 else "paynow"

    payment = Payment.objects.create(
        user_id=user_id, order_id=order_uuid,
        restaurant_id=restaurant_id,
        reference=reference, amount=total_amount,
        paynow_amount=paynow_charge, voucher_amount=voucher_deducted,
        method=payment_method, status="pending",
        platform_fee=platform_fee,
        restaurant_amount=restaurant_amount,
    )

    # PayNow Web
    if not phone:
        response = create_paynow_payment(order_id, float(paynow_charge), user_email)
        if response.success:
            payment.reference = response.poll_url
            payment.save()
            resp_data = {"paynow_url": response.redirect_url}
            if voucher_deducted > 0:
                resp_data["voucher_used"] = str(voucher_deducted)
                resp_data["paynow_amount"] = str(paynow_charge)
                resp_data["status"] = "partial_voucher"
            return Response(resp_data)
        # Refund voucher if PayNow fails
        if voucher_deducted > 0:
            voucher, _ = FeastVoucher.objects.get_or_create(user_id=user_id)
            voucher.balance += voucher_deducted
            voucher.save()
        return Response({"error": "PayNow failed"}, status=400)

    # PayNow Mobile
    response = paynow.send_mobile(
        f"Order_{order_id}", phone, float(paynow_charge),
        f"Order #{order_id}", email=user_email,
    )
    if response.success:
        payment.reference = response.poll_url
        payment.save()
        resp_data = {
            "paynow_url": response.redirect_url,
            "instructions": "Check your phone to approve.",
            "reference": response.poll_url,
        }
        if voucher_deducted > 0:
            resp_data["voucher_used"] = str(voucher_deducted)
            resp_data["paynow_amount"] = str(paynow_charge)
        return Response(resp_data)
    # Refund voucher if mobile payment fails
    if voucher_deducted > 0:
        voucher, _ = FeastVoucher.objects.get_or_create(user_id=user_id)
        voucher.balance += voucher_deducted
        voucher.save()
    return Response({"error": "Mobile payment failed"}, status=400)


def _update_order_status(order_id, new_status, auth_token=None):
    """Update order status via order service."""
    try:
        service_request('order', 'PATCH', f'/api/orders/order/{order_id}/status/',
                        json={"status": new_status}, auth_token=auth_token)
    except Exception:
        publisher.publish_order_status(order_id, new_status)


def _record_earning(restaurant_id, order_id, total_fee, delivery_fee, paid_direct):
    """Record earning via restaurant service."""
    try:
        publisher.publish('payments.order.completed', {
            'restaurant_id': str(restaurant_id),
            'order_id': str(order_id),
            'order_total': str(total_fee),
            'delivery_fee': str(delivery_fee),
            'paid_direct': paid_direct,
        })
    except Exception as e:
        logger.warning(f"Failed to publish earning event: {e}")


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
        _record_earning(
            payment.restaurant_id, payment.order_id,
            payment.amount, Decimal('0'), payment.paid_direct,
        )

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
        _record_earning(
            payment.restaurant_id, payment.order_id,
            payment.amount, Decimal('0'), payment.paid_direct,
        )

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
        return Response({"paynow_url": response.redirect_url, "reference": response.poll_url})
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


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "ok"})
