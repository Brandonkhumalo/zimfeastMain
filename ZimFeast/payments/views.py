import uuid
import requests
from decimal import Decimal
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Payment, FeastVoucher
from restaurants.utils import process_restaurant_orders
from drivers.utils import assign_driver
from .receipt_email import send_order_receipt
from .paynow_utils import paynow, create_paynow_payment
from orders.models import Order

# Example PayNow URLs
PAYNOW_SANDBOX_URL = settings.PAYNOW_SANDBOX_URL
PAYNOW_RETURN_URL = settings.PAYNOW_RETURN_URL
PAYNOW_RESULT_URL = settings.PAYNOW_RESULT_URL


def generate_paynow_payload(reference, amount, email):
    return {
        "resulturl": PAYNOW_RESULT_URL,
        "returnurl": PAYNOW_RETURN_URL,
        "id": settings.PAYNOW_INTEGRATION_ID,
        "reference": reference,
        "amount": str(amount),
        "additionalinfo": "",
        "authemail": email,
        "status": "Message",
    }


# ------------------------------------------------------------------------------
# MAIN PAYMENT CREATION ENDPOINT
# ------------------------------------------------------------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment(request):
    user = request.user
    order_id = request.data.get("order_id")
    method = request.data.get("method", "paynow")  # 'paynow' or 'voucher'
    phone = request.data.get("phone")

    # --- Validate UUID ---
    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        return Response({"error": "Invalid order ID"}, status=status.HTTP_400_BAD_REQUEST)

    # --- Get Order instance ---
    try:
        order = Order.objects.get(id=order_uuid, customer=user)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    total_amount = Decimal(order.total_fee or 0) + Decimal(order.tip or 0)

    # --- Create a payment reference ---
    reference = f"PMT_{uuid.uuid4().hex[:10]}"

    # --- Create Payment record in DB ---
    payment = Payment.objects.create(
        user=user,
        order=order,
        reference=reference,
        amount=total_amount,
        method=method,
        status="pending"
    )

    # --- 1️⃣ Voucher payment ---
    if method == "voucher":
        voucher, _ = FeastVoucher.objects.get_or_create(user=user)
        if voucher.balance >= total_amount:
            voucher.balance -= total_amount
            voucher.save()
            payment.status = "paid"
            payment.save()
            order.status = "paid"
            order.save()
            return Response({"status": "paid_with_voucher"})
        else:
            remaining = total_amount - voucher.balance
            voucher.balance = 0
            voucher.save()
            payment.amount = remaining
            payment.method = "paynow"
            payment.save()

            payment_response = create_paynow_payment(order, user.email)
            if payment_response.success:
                payment.reference = payment_response.poll_url
                payment.save()
                order.reference = payment_response.poll_url
                order.save()
                return Response({
                    "status": "partial",
                    "paynow_url": payment_response.redirect_url
                })
            return Response({"error": "Failed to initiate PayNow for remaining amount"}, status=400)

    # --- 2️⃣ PayNow Web ---
    if method == "paynow" and not phone:
        response = create_paynow_payment(order, user.email)
        print(f"PayNow Response: success={response.success}, type={type(response)}")
        print(f"PayNow Response attrs: {vars(response) if hasattr(response, '__dict__') else dir(response)}")
        if response.success:
            payment.reference = response.poll_url
            payment.save()
            order.reference = response.poll_url
            order.save()
            return Response({"paynow_url": response.redirect_url})
        error_msg = getattr(response, 'error', '') or getattr(response, 'errors', '') or getattr(response, 'data', '') or "Unknown error"
        print(f"PayNow Web Error: {error_msg}")
        return Response({"error": f"PayNow failed: {error_msg}"}, status=400)

    # --- 3️⃣ PayNow Mobile ---
    if method == "paynow" and phone:
        response = paynow.send_mobile(
            f"Order_{order.id}",
            phone,
            float(total_amount),
            f"Order #{order.id}",
            email=user.email
        )
        if response.success:
            payment.reference = response.poll_url
            payment.save()
            order.reference = response.poll_url
            order.save()
            return Response({
                "paynow_url": response.redirect_url,
                "instructions": "Please check your phone to approve the transaction.",
                "reference": response.poll_url
            })
        return Response({"success": False, "message": "Failed to initiate mobile payment."})

    return Response({"error": "Invalid payment method"}, status=400)


# ------------------------------------------------------------------------------
# PAYNOW CALLBACK ENDPOINT (Legacy)
# ------------------------------------------------------------------------------
@api_view(["POST"])
def paynow_callback(request):
    """
    Legacy callback endpoint called by PayNow to update payment status.
    """
    reference = request.data.get("reference")
    status_pay = request.data.get("status")  # "Paid" or "Failed"

    payment = get_object_or_404(Payment, reference=reference)
    payment.status = status_pay.lower()
    payment.save()

    restaurant_order_numbers = {}
    driver = None

    # Update order status if paid
    if status_pay.lower() == "paid" and payment.order:
        order = payment.order
        order.status = "paid"
        order.save()

        restaurant_order_numbers = process_restaurant_orders(order)
        driver = assign_driver(order, restaurant_order_numbers)

        try:
            send_order_receipt(
                customer_email=order.customer.email,
                customer_name=order.customer.get_full_name(),
                order=order,
                restaurants=order.restaurant_names,
                receipt={}
            )
            print("✅ Receipt sent successfully to customer")
        except Exception as e:
            print(f"⚠️ Failed to send receipt: {e}")

    return Response({
        "status": "ok",
        "assigned_driver": driver.id if driver else None,
        "restaurant_order_numbers": restaurant_order_numbers
    })


# ------------------------------------------------------------------------------
# PAYNOW AUTOMATED RESULT ENDPOINT
# ------------------------------------------------------------------------------
@api_view(["POST"])
def paynow_result(request):
    """
    Official PayNow RESULT URL endpoint.
    PayNow sends a POST here when a payment completes or fails.
    """
    print("📩 PayNow Result Callback:", request.data)

    reference = request.data.get("reference")
    status_pay = request.data.get("status")

    if not reference or not status_pay:
        return Response({"error": "Invalid callback payload"}, status=400)

    payment = get_object_or_404(Payment, reference=reference)
    payment.status = status_pay.lower()
    payment.save()

    driver = None
    restaurant_order_numbers = {}

    if status_pay.lower() == "paid" and getattr(payment, "order", None):
        order = payment.order
        order.status = "paid"
        order.save()

        # Process restaurants and assign driver
        restaurant_order_numbers = process_restaurant_orders(order)
        driver = assign_driver(order, restaurant_order_numbers)

        # Send email receipt
        try:
            send_order_receipt(
                customer_email=order.customer.email,
                customer_name=order.customer.get_full_name(),
                order=order,
                restaurants=order.restaurant_names,
                receipt={}
            )
            print(f"✅ Payment confirmed for {order.id}. Receipt sent.")
        except Exception as e:
            print(f"⚠️ Error sending receipt: {e}")

    return Response({
        "status": "payment_confirmed" if status_pay.lower() == "paid" else "payment_failed",
        "reference": reference,
        "assigned_driver": driver.id if driver else None,
        "restaurant_order_numbers": restaurant_order_numbers
    })


# ------------------------------------------------------------------------------
# VOUCHER DEPOSIT
# ------------------------------------------------------------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def deposit_voucher(request):
    user = request.user
    amount = Decimal(request.data.get("amount", "0"))
    if amount <= 0:
        return Response({"error": "Invalid amount"}, status=400)

    # Create PayNow payment for voucher top-up
    payment = paynow.create_payment(f"VoucherTopup_{user.id}", user.email)
    payment.add("Voucher Deposit", float(amount))
    response = paynow.send(payment)

    if response.success:
        # Always return paynow_url for frontend WebView
        return Response({
            "paynow_url": response.redirect_url,
            "reference": response.pollurl
        })
    return Response({"error": "Failed to initiate voucher top-up"}, status=400)

# ------------------------------------------------------------------------------
# MANUAL STATUS CHECK
# ------------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def paynow_status(request, reference):
    """
    Manual check for a PayNow transaction’s current status.
    """
    response = paynow.check_transaction_status(reference)
    return Response(response)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def feast_voucher_balance(request):
    """
    Returns the authenticated user's Feast Voucher balance.
    """
    try:
        # Get the latest FeastVoucher for the user (or sum all balances)
        vouchers = FeastVoucher.objects.filter(user=request.user)
        total_balance = sum(v.balance for v in vouchers) if vouchers.exists() else Decimal("0.00")

        return Response({"balance": str(total_balance)}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)