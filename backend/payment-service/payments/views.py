import uuid
import logging
import requests as http_requests
from decimal import Decimal
from datetime import timedelta
from django.conf import settings
from django.db import transaction, connection
from django.db.models import Sum, Count, Avg, Q, F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import (
    Payment, FeastVoucher, PromoCode, ReferralCode,
    ReferralCredit, PromoUsage, ReferralTracking,
)
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
    promo_code = request.data.get("promo_code", "").strip().upper()
    use_referral_credit = request.data.get("use_referral_credit", False)

    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        return Response({"detail": "Invalid order ID"}, status=status.HTTP_400_BAD_REQUEST)

    # Get order details from order service
    auth_token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        order_data = service_request('order', 'GET', f'/api/orders/order/{order_id}/', auth_token=auth_token)
    except Exception:
        return Response({"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    total_fee = Decimal(str(order_data.get('total_fee', 0)))
    tip = Decimal(str(order_data.get('tip', 0)))
    delivery_fee = Decimal(str(order_data.get('delivery_fee', 0)))
    total_amount = total_fee + tip
    restaurant_id = order_data.get('restaurant_id')

    # ─── Apply Promo Code Discount ────────────────────────────────────
    promo_discount = Decimal('0')
    applied_promo = None
    if promo_code:
        try:
            promo = PromoCode.objects.get(code=promo_code)
        except PromoCode.DoesNotExist:
            return Response({"detail": "Invalid promo code."}, status=status.HTTP_400_BAD_REQUEST)

        if PromoUsage.objects.filter(user_id=user_id, promo=promo).exists():
            return Response({"detail": "You have already used this promo code."}, status=status.HTTP_400_BAD_REQUEST)

        is_valid, message = promo.is_valid(order_amount=total_amount)
        if not is_valid:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        promo_discount = promo.calculate_discount(total_amount)
        applied_promo = promo

    # ─── Apply Referral Credit Discount ───────────────────────────────
    referral_discount = Decimal('0')
    applied_credit = None
    if use_referral_credit:
        # Cannot stack promo code and referral credit at the same time
        # (business rule: max 1 referral credit per order, promo separate)
        credit = ReferralCredit.objects.filter(
            referrer_id=user_id, is_used=False
        ).order_by('created_at').first()

        if credit:
            # Apply referral discount on the amount AFTER promo discount
            amount_after_promo = total_amount - promo_discount
            referral_discount = round(amount_after_promo * credit.discount_pct / 100, 2)
            applied_credit = credit

    # Calculate final amount after discounts
    total_discount = promo_discount + referral_discount
    total_amount_after_discount = max(total_amount - total_discount, Decimal('0'))

    # Get restaurant payment config
    restaurant_config = _get_restaurant_payment_config(restaurant_id)
    is_direct_payment = restaurant_config and restaurant_config.get('accepts_direct_payment', False)

    # Calculate platform fee
    commission_pct = restaurant_config['platform_commission_pct'] if restaurant_config else Decimal('15.00')
    food_total = total_fee - delivery_fee
    platform_fee = round(food_total * commission_pct / 100, 2)
    restaurant_amount = food_total - platform_fee

    reference = f"PMT_{uuid.uuid4().hex[:10]}"

    # Helper: record promo and referral usage after successful payment creation
    def _record_discount_usage(payment_obj):
        """Record promo usage and referral credit usage after payment is created."""
        if applied_promo:
            PromoUsage.objects.create(
                user_id=user_id,
                promo=applied_promo,
                order_id=order_uuid,
                discount_applied=promo_discount,
            )
            applied_promo.times_used += 1
            applied_promo.save()
        if applied_credit:
            applied_credit.is_used = True
            applied_credit.used_on_order_id = order_uuid
            applied_credit.save()

    # Build discount info for response
    def _discount_response_fields():
        """Return extra fields to include in payment response when discounts are applied."""
        fields = {}
        if total_discount > 0:
            fields["original_amount"] = str(total_amount)
            fields["discount_amount"] = str(total_discount)
            fields["final_amount"] = str(total_amount_after_discount)
        if promo_discount > 0:
            fields["promo_discount"] = str(promo_discount)
            fields["promo_code"] = promo_code
        if referral_discount > 0:
            fields["referral_discount"] = str(referral_discount)
        return fields

    # Use discounted amount for actual payment
    pay_amount = total_amount_after_discount

    # === DIRECT PAYMENT: restaurant collects payment directly ===
    if is_direct_payment:
        # Voucher NOT allowed for direct payments
        if method == "voucher" or use_voucher:
            return Response(
                {"detail": "Voucher payment is not available for this restaurant. Only card payment via PayNow is accepted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment = Payment.objects.create(
            user_id=user_id, order_id=order_uuid,
            restaurant_id=restaurant_id,
            reference=reference, amount=total_amount,
            paynow_amount=pay_amount, voucher_amount=Decimal('0'),
            method="direct", status="pending",
            paid_direct=True,
            platform_fee=platform_fee,
            restaurant_amount=restaurant_amount,
        )
        _record_discount_usage(payment)

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
                f"Order_{order_id}", phone, float(pay_amount),
                f"Order #{order_id}", email=user_email,
            )
            if response.success:
                payment.reference = response.poll_url
                payment.save()
                resp = {
                    "paynow_url": response.redirect_url,
                    "instructions": "Check your phone to approve. Payment goes directly to the restaurant.",
                    "reference": response.poll_url,
                    "direct_payment": True,
                }
                resp.update(_discount_response_fields())
                return Response(resp)
            return Response({"detail": "Mobile payment failed"}, status=400)
        else:
            # Web payment to restaurant's PayNow
            response = _create_direct_paynow_payment(restaurant_config, order_id, pay_amount, user_email)
            if response.success:
                payment.reference = response.poll_url
                payment.save()
                resp = {
                    "paynow_url": response.redirect_url,
                    "direct_payment": True,
                }
                resp.update(_discount_response_fields())
                return Response(resp)
            return Response({"detail": "PayNow failed"}, status=400)

    # === NON-DIRECT PAYMENT: payment comes to us ===

    # Handle voucher-only payment
    if method == "voucher" and not use_voucher:
        # Pure voucher payment attempt
        voucher, _ = FeastVoucher.objects.get_or_create(user_id=user_id)
        if voucher.balance >= pay_amount:
            payment = Payment.objects.create(
                user_id=user_id, order_id=order_uuid,
                restaurant_id=restaurant_id,
                reference=reference, amount=total_amount,
                paynow_amount=Decimal('0'), voucher_amount=pay_amount,
                method="voucher", status="paid",
                platform_fee=platform_fee,
                restaurant_amount=restaurant_amount,
            )
            voucher.balance -= pay_amount
            voucher.save()
            _record_discount_usage(payment)
            _update_order_status(order_id, "paid", auth_token)
            _record_earning(restaurant_id, order_id, total_fee, delivery_fee, False)
            resp = {"status": "paid_with_voucher"}
            resp.update(_discount_response_fields())
            return Response(resp)
        else:
            # Insufficient voucher balance - inform user to combine with PayNow
            return Response({
                "detail": "Insufficient voucher balance",
                "voucher_balance": str(voucher.balance),
                "total_amount": str(pay_amount),
                "shortfall": str(pay_amount - voucher.balance),
                "hint": "Use combined voucher + PayNow payment by selecting PayNow and enabling 'Use Voucher Balance'."
            }, status=status.HTTP_400_BAD_REQUEST)

    # Handle combined voucher + PayNow payment
    voucher_deducted = Decimal('0')
    paynow_charge = pay_amount

    if use_voucher and method == "paynow":
        voucher, _ = FeastVoucher.objects.get_or_create(user_id=user_id)
        if voucher.balance > 0:
            voucher_deducted = min(voucher.balance, pay_amount)
            paynow_charge = pay_amount - voucher_deducted
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
            _record_discount_usage(payment)
            _update_order_status(order_id, "paid", auth_token)
            _record_earning(restaurant_id, order_id, total_fee, delivery_fee, False)
            resp = {"status": "paid_with_voucher", "voucher_used": str(voucher_deducted)}
            resp.update(_discount_response_fields())
            return Response(resp)

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
    _record_discount_usage(payment)

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
            resp_data.update(_discount_response_fields())
            return Response(resp_data)
        # Refund voucher if PayNow fails
        if voucher_deducted > 0:
            voucher, _ = FeastVoucher.objects.get_or_create(user_id=user_id)
            voucher.balance += voucher_deducted
            voucher.save()
        return Response({"detail": "PayNow failed"}, status=400)

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
        resp_data.update(_discount_response_fields())
        return Response(resp_data)
    # Refund voucher if mobile payment fails
    if voucher_deducted > 0:
        voucher, _ = FeastVoucher.objects.get_or_create(user_id=user_id)
        voucher.balance += voucher_deducted
        voucher.save()
    return Response({"detail": "Mobile payment failed"}, status=400)


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


def _check_and_create_referral_credit(payment):
    """
    After a payment is marked 'paid', check if the user was referred
    and if this is their first paid order with total >= $20.
    If so, create a ReferralCredit for the referrer.
    """
    user_id = payment.user_id

    # Check if user was referred
    try:
        tracking = ReferralTracking.objects.get(user_id=user_id)
    except ReferralTracking.DoesNotExist:
        return  # User was not referred, nothing to do

    # Already qualified? Don't create duplicate credits
    if tracking.is_qualified:
        return

    # Check if order total >= $20 (the qualifying threshold)
    qualifying_amount = Decimal('20.00')
    if payment.amount < qualifying_amount:
        return

    # Check this is the user's first paid order
    paid_count = Payment.objects.filter(
        user_id=user_id, status='paid'
    ).count()
    # If count is 1, this is the first paid order (the one we just processed)
    if paid_count > 1:
        return  # Not first order

    # Create the referral credit for the referrer
    ReferralCredit.objects.create(
        referrer_id=tracking.referrer_id,
        referred_id=user_id,
        order_id=payment.order_id,
        discount_pct=Decimal('15.00'),
    )

    # Mark tracking as qualified
    tracking.is_qualified = True
    tracking.save()

    logger.info(
        f"Referral credit created: referrer={tracking.referrer_id}, "
        f"referred={user_id}, order={payment.order_id}"
    )


def _process_payment_callback(reference, status_pay):
    """Shared logic for both paynow_result and paynow_callback.
    Uses SELECT FOR UPDATE inside a transaction to prevent race conditions
    and checks processed_at for idempotency."""
    with transaction.atomic():
        try:
            payment = Payment.objects.select_for_update().get(reference=reference)
        except Payment.DoesNotExist:
            return Response({"detail": "Payment not found"}, status=404)

        # Idempotency: if already processed, return early
        if payment.processed_at is not None:
            return Response({"status": "already_processed"})

        payment.status = status_pay.lower()
        if status_pay.lower() == "paid":
            payment.processed_at = timezone.now()
        payment.save()

    # Side effects run outside the transaction so we don't hold the lock
    if status_pay.lower() == "paid" and payment.order_id:
        try:
            _update_order_status(str(payment.order_id), "paid")
        except Exception as e:
            logger.error(f"Failed to update order status for {payment.order_id}: {e}")

        try:
            publisher.publish_order_status(payment.order_id, "paid")
        except Exception as e:
            logger.error(f"Failed to publish order status for {payment.order_id}: {e}")

        try:
            _record_earning(
                payment.restaurant_id, payment.order_id,
                payment.amount, Decimal('0'), payment.paid_direct,
            )
        except Exception as e:
            logger.error(f"Failed to record earning for {payment.order_id}: {e}")

        # ─── Referral Credit: check if this qualifies ─────────────────
        try:
            _check_and_create_referral_credit(payment)
        except Exception as e:
            logger.error(f"Failed to check referral credit for {payment.order_id}: {e}")

    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([])  # No throttling — server-to-server callback from Paynow
def paynow_result(request):
    reference = request.data.get("reference")
    status_pay = request.data.get("status")
    if not reference or not status_pay:
        return Response({"detail": "Invalid callback"}, status=400)
    return _process_payment_callback(reference, status_pay)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([])  # No throttling — server-to-server callback from Paynow
def paynow_callback(request):
    reference = request.data.get("reference")
    status_pay = request.data.get("status")
    if not reference or not status_pay:
        return Response({"detail": "Invalid callback"}, status=400)
    return _process_payment_callback(reference, status_pay)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def deposit_voucher(request):
    user_id = request.user.id
    user_email = getattr(request.user, 'email', '')
    amount = Decimal(request.data.get("amount", "0"))
    if amount <= 0:
        return Response({"detail": "Invalid amount"}, status=400)

    payment = paynow.create_payment(f"VoucherTopup_{user_id}", user_email)
    payment.add("Voucher Deposit", float(amount))
    response = paynow.send(payment)
    if response.success:
        return Response({"paynow_url": response.redirect_url, "reference": response.poll_url})
    return Response({"detail": "Failed to initiate voucher top-up"}, status=400)


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


# ─── Promo Code Endpoints ──────────────────────────────────────────────


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_promo(request):
    """
    POST /api/payments/promo/validate/
    Body: {"code": "SAVE20", "order_amount": 50.00}
    Returns discount info or error.
    """
    code = request.data.get("code", "").strip().upper()
    order_amount = request.data.get("order_amount")

    if not code:
        return Response({"detail": "Promo code is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        promo = PromoCode.objects.get(code=code)
    except PromoCode.DoesNotExist:
        return Response({"detail": "Invalid promo code."}, status=status.HTTP_404_NOT_FOUND)

    # Check if user already used this promo
    if PromoUsage.objects.filter(user_id=request.user.id, promo=promo).exists():
        return Response({"detail": "You have already used this promo code."}, status=status.HTTP_400_BAD_REQUEST)

    # Validate the promo code
    is_valid, message = promo.is_valid(order_amount=order_amount)
    if not is_valid:
        return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

    # Calculate discount
    discount = promo.calculate_discount(order_amount) if order_amount else None

    return Response({
        "code": promo.code,
        "discount_type": promo.discount_type,
        "discount_value": str(promo.discount_value),
        "discount_amount": str(discount) if discount else None,
        "min_order_amount": str(promo.min_order_amount),
        "message": f"Promo code applied! {'{}% off'.format(promo.discount_value) if promo.discount_type == 'percentage' else '${} off'.format(promo.discount_value)}",
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_promo(request):
    """
    POST /api/payments/promo/create/
    Admin-only endpoint to create promo codes.
    Body: {"code": "SAVE20", "discount_type": "percentage", "discount_value": 20, ...}
    """
    # Check admin role from JWT
    user_role = getattr(request.user, 'role', None)
    if user_role != 'admin':
        return Response({"detail": "Admin access only."}, status=status.HTTP_403_FORBIDDEN)

    code = request.data.get("code", "").strip().upper()
    discount_type = request.data.get("discount_type")
    discount_value = request.data.get("discount_value")

    if not code or not discount_type or discount_value is None:
        return Response(
            {"detail": "code, discount_type, and discount_value are required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if PromoCode.objects.filter(code=code).exists():
        return Response({"detail": "A promo code with this code already exists."}, status=status.HTTP_400_BAD_REQUEST)

    promo = PromoCode.objects.create(
        code=code,
        discount_type=discount_type,
        discount_value=Decimal(str(discount_value)),
        min_order_amount=Decimal(str(request.data.get("min_order_amount", 0))),
        max_uses=int(request.data.get("max_uses", 0)),
        expires_at=request.data.get("expires_at"),
        is_active=request.data.get("is_active", True),
    )

    return Response({
        "id": promo.id,
        "code": promo.code,
        "discount_type": promo.discount_type,
        "discount_value": str(promo.discount_value),
        "min_order_amount": str(promo.min_order_amount),
        "max_uses": promo.max_uses,
        "is_active": promo.is_active,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_list_promos(request):
    """
    GET /api/payments/promo/list/
    Admin-only endpoint to list all promo codes.
    """
    user_role = getattr(request.user, 'role', None)
    if user_role != 'admin':
        return Response({"detail": "Admin access only."}, status=status.HTTP_403_FORBIDDEN)

    promos = PromoCode.objects.all().order_by('-created_at')
    data = []
    for p in promos:
        data.append({
            "id": p.id,
            "code": p.code,
            "discount_type": p.discount_type,
            "discount_value": str(p.discount_value),
            "min_order_amount": str(p.min_order_amount),
            "max_uses": p.max_uses,
            "times_used": p.times_used,
            "expires_at": p.expires_at.isoformat() if p.expires_at else None,
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat(),
        })
    return Response(data)


# ─── Referral Code Endpoints ────────────────────────────────────────────


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_referral_code(request):
    """
    GET /api/payments/referral/code/
    Returns user's referral code. Auto-generates one if none exists.
    """
    user_id = request.user.id

    referral, created = ReferralCode.objects.get_or_create(
        user_id=user_id,
        defaults={'code': ReferralCode.generate_code()}
    )

    return Response({
        "code": referral.code,
        "share_link": f"https://zimfeast.co.zw/register?ref={referral.code}",
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_referral_credits(request):
    """
    GET /api/payments/referral/credits/
    Returns user's available referral credits count and details.
    """
    user_id = request.user.id

    available = ReferralCredit.objects.filter(referrer_id=user_id, is_used=False)
    used = ReferralCredit.objects.filter(referrer_id=user_id, is_used=True)

    return Response({
        "available_credits": available.count(),
        "used_credits": used.count(),
        "total_credits": available.count() + used.count(),
        "discount_pct": "15.00",
        "credits": [
            {
                "id": c.id,
                "referred_id": str(c.referred_id),
                "discount_pct": str(c.discount_pct),
                "is_used": c.is_used,
                "used_on_order_id": str(c.used_on_order_id) if c.used_on_order_id else None,
                "created_at": c.created_at.isoformat(),
            }
            for c in available
        ],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def apply_referral_credit(request):
    """
    POST /api/payments/referral/apply/
    Body: {"order_id": "...", "order_amount": 50.00}
    Marks one referral credit as used for the given order.
    Returns the discount percentage and discount amount.
    Max 1 referral credit per order.
    """
    user_id = request.user.id
    order_id = request.data.get("order_id")
    order_amount = request.data.get("order_amount")

    if not order_id or order_amount is None:
        return Response(
            {"detail": "order_id and order_amount are required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        return Response({"detail": "Invalid order ID."}, status=status.HTTP_400_BAD_REQUEST)

    # Check that no referral credit is already applied to this order
    if ReferralCredit.objects.filter(used_on_order_id=order_uuid, is_used=True).exists():
        return Response(
            {"detail": "A referral credit is already applied to this order."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get the oldest unused credit (FIFO)
    credit = ReferralCredit.objects.filter(
        referrer_id=user_id, is_used=False
    ).order_by('created_at').first()

    if not credit:
        return Response(
            {"detail": "No referral credits available."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Calculate the discount
    order_amount_dec = Decimal(str(order_amount))
    discount_amount = round(order_amount_dec * credit.discount_pct / 100, 2)

    # Mark credit as used
    credit.is_used = True
    credit.used_on_order_id = order_uuid
    credit.save()

    return Response({
        "discount_pct": str(credit.discount_pct),
        "discount_amount": str(discount_amount),
        "remaining_credits": ReferralCredit.objects.filter(referrer_id=user_id, is_used=False).count(),
        "message": f"{credit.discount_pct}% referral discount applied!",
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def track_referral(request):
    """
    POST /api/payments/referral/track/
    Called from auth-service (or directly) after a new user registers with a referral code.
    Body: {"user_id": "...", "referral_code": "ZF-ABCD12"}
    """
    # Accept both service key and authenticated user calls
    service_key = request.headers.get('X-Service-Key')
    user_id = request.data.get("user_id")
    referral_code = request.data.get("referral_code", "").strip().upper()

    if not user_id or not referral_code:
        return Response(
            {"detail": "user_id and referral_code are required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Look up the referral code to find the referrer
    try:
        referral = ReferralCode.objects.get(code=referral_code)
    except ReferralCode.DoesNotExist:
        return Response({"detail": "Invalid referral code."}, status=status.HTTP_404_NOT_FOUND)

    # Don't allow self-referral
    if str(referral.user_id) == str(user_id):
        return Response({"detail": "Cannot use your own referral code."}, status=status.HTTP_400_BAD_REQUEST)

    # Don't create duplicate tracking records
    if ReferralTracking.objects.filter(user_id=user_id).exists():
        return Response({"detail": "Referral already tracked for this user."}, status=status.HTTP_200_OK)

    ReferralTracking.objects.create(
        user_id=user_id,
        referrer_id=referral.user_id,
        referral_code=referral_code,
    )

    return Response({"detail": "Referral tracked successfully."}, status=status.HTTP_201_CREATED)


# ─── Admin Finance Endpoints ──────────────────────────────────────────


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_finance_summary(request):
    """
    GET /api/payments/admin/finance-summary/
    Financial overview: total revenue across different time periods,
    revenue by payment method, failed payment count, total platform fees,
    and average order value.
    """
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    paid_payments = Payment.objects.filter(status="paid")

    # Total revenue by time period
    all_time = paid_payments.aggregate(
        total=Sum("amount"), count=Count("id")
    )
    this_month = paid_payments.filter(created_at__gte=month_start).aggregate(
        total=Sum("amount"), count=Count("id")
    )
    this_week = paid_payments.filter(created_at__gte=week_start).aggregate(
        total=Sum("amount"), count=Count("id")
    )
    today = paid_payments.filter(created_at__gte=today_start).aggregate(
        total=Sum("amount"), count=Count("id")
    )

    # Revenue by payment method
    method_breakdown = {}
    method_rows = (
        paid_payments.values("method")
        .annotate(total=Sum("amount"), count=Count("id"))
    )
    for row in method_rows:
        method_breakdown[row["method"]] = {
            "total": str(row["total"] or Decimal("0")),
            "count": row["count"],
        }

    # Failed payments count (status=failed or pending older than 1 hour)
    failed_count = Payment.objects.filter(
        Q(status="failed") |
        Q(status="pending", created_at__lt=now - timedelta(hours=1))
    ).count()

    # Total platform fees collected
    total_platform_fees = paid_payments.aggregate(
        total=Sum("platform_fee")
    )["total"] or Decimal("0")

    # Average order value
    avg_order_value = paid_payments.aggregate(
        avg=Avg("amount")
    )["avg"] or Decimal("0")

    return Response({
        "revenue": {
            "all_time": str(all_time["total"] or Decimal("0")),
            "this_month": str(this_month["total"] or Decimal("0")),
            "this_week": str(this_week["total"] or Decimal("0")),
            "today": str(today["total"] or Decimal("0")),
        },
        "order_counts": {
            "all_time": all_time["count"],
            "this_month": this_month["count"],
            "this_week": this_week["count"],
            "today": today["count"],
        },
        "revenue_by_method": method_breakdown,
        "failed_payments_count": failed_count,
        "total_platform_fees": str(total_platform_fees),
        "avg_order_value": str(round(avg_order_value, 2)),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_failed_payments(request):
    """
    GET /api/payments/admin/failed-payments/
    List payments that failed or are stuck (pending > 1 hour).
    Supports pagination via page and page_size query params.
    """
    now = timezone.now()
    page = int(request.query_params.get("page", 1))
    page_size = int(request.query_params.get("page_size", 20))
    if page_size > 100:
        page_size = 100

    stuck_payments = Payment.objects.filter(
        Q(status="failed") |
        Q(status="pending", created_at__lt=now - timedelta(hours=1))
    ).order_by("-created_at")

    total = stuck_payments.count()
    start = (page - 1) * page_size
    paginated = stuck_payments[start:start + page_size]

    results = []
    for p in paginated:
        results.append({
            "id": p.id,
            "order_id": str(p.order_id) if p.order_id else None,
            "user_id": str(p.user_id),
            "restaurant_id": str(p.restaurant_id) if p.restaurant_id else None,
            "amount": str(p.amount),
            "method": p.method,
            "status": p.status,
            "reference": p.reference,
            "created_at": p.created_at.isoformat(),
            "hours_stuck": round((now - p.created_at).total_seconds() / 3600, 1),
        })

    return Response({
        "results": results,
        "total": total,
        "page": page,
        "page_size": page_size,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_settlements(request):
    """
    GET /api/payments/admin/settlements/
    Restaurant settlement data: list all restaurants with unsettled amounts
    grouped by restaurant_id from paid payments.
    """
    # Aggregate unsettled platform fees and restaurant amounts per restaurant
    settlement_data = (
        Payment.objects.filter(status="paid")
        .exclude(restaurant_id__isnull=True)
        .values("restaurant_id")
        .annotate(
            total_revenue=Sum("amount"),
            total_platform_fees=Sum("platform_fee"),
            total_restaurant_amount=Sum("restaurant_amount"),
            order_count=Count("id"),
        )
        .order_by("-total_revenue")
    )

    # Calculate totals
    total_platform_owed = Decimal("0")
    total_restaurant_owed = Decimal("0")
    restaurants = []

    for row in settlement_data:
        platform_fee = row["total_platform_fees"] or Decimal("0")
        restaurant_amount = row["total_restaurant_amount"] or Decimal("0")
        total_platform_owed += platform_fee
        total_restaurant_owed += restaurant_amount

        restaurants.append({
            "restaurant_id": str(row["restaurant_id"]),
            "total_revenue": str(row["total_revenue"] or Decimal("0")),
            "total_platform_fees": str(platform_fee),
            "total_restaurant_amount": str(restaurant_amount),
            "order_count": row["order_count"],
        })

    return Response({
        "restaurants": restaurants,
        "totals": {
            "total_platform_owed": str(total_platform_owed),
            "total_restaurant_owed": str(total_restaurant_owed),
        },
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_refund(request):
    """
    POST /api/payments/admin/refund/
    Issue a refund as FeastVoucher credit.
    Body: {"user_id": "...", "order_id": "...", "amount": "...", "reason": "..."}
    """
    user_id = request.data.get("user_id")
    order_id = request.data.get("order_id")
    amount = request.data.get("amount")
    reason = request.data.get("reason", "")

    if not user_id or not amount:
        return Response(
            {"detail": "user_id and amount are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        refund_amount = Decimal(str(amount))
    except Exception:
        return Response(
            {"detail": "Invalid amount"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if refund_amount <= 0:
        return Response(
            {"detail": "Amount must be positive"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get or create the user's FeastVoucher wallet
    voucher, created = FeastVoucher.objects.get_or_create(user_id=user_id)

    # Credit the voucher
    voucher.balance += refund_amount
    voucher.save()

    logger.info(
        f"Admin refund: user={user_id}, order={order_id}, "
        f"amount={refund_amount}, reason={reason}, "
        f"new_balance={voucher.balance}"
    )

    return Response({
        "user_id": str(user_id),
        "order_id": str(order_id) if order_id else None,
        "refund_amount": str(refund_amount),
        "new_voucher_balance": str(voucher.balance),
        "reason": reason,
        "detail": f"Refund of ${refund_amount} credited to user's FeastVoucher.",
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_health_check(request):
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
        "service": "payment-service",
        "database": db_status,
    })
