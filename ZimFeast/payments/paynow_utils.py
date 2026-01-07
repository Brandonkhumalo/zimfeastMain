from paynow import Paynow
from django.conf import settings

paynow = Paynow(
    integration_id=settings.PAYNOW_INTEGRATION_ID,
    integration_key=settings.PAYNOW_INTEGRATION_KEY,
    return_url=settings.PAYNOW_RETURN_URL,
    result_url=settings.PAYNOW_RESULT_URL
)

def create_paynow_payment(order, user_email):
    payment = paynow.create_payment(f"Order_{order.id}", user_email)
    payment.add(f"Order #{order.id}", float(order.total_fee))
    return paynow.send(payment)
