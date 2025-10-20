import uuid
from decimal import Decimal
from ZimFeast.settings import PAYNOW_INTEGRATION_ID, PAYNOW_INTEGRATION_KEY, PAYNOW_RETURN_URL, PAYNOW_RESULT_URL
from paynow import Paynow

# Initialize PayNow from settings
paynow = Paynow(
    integration_id=PAYNOW_INTEGRATION_ID,
    integration_key=PAYNOW_INTEGRATION_KEY,
    return_url=PAYNOW_RETURN_URL,
    result_url=PAYNOW_RESULT_URL
)

# Example dummy order object
class DummyOrder:
    def __init__(self, total):
        self.id = uuid.uuid4()  # random order ID
        self.total = Decimal(total)

# Create a manual payment
def create_manual_payment(order_total):
    order = DummyOrder(order_total)
    random_email = "brandonkhumz40@gmail.com"  # can be any email

    # Create the payment object
    payment = paynow.create_payment(f"Order_{order.id}", random_email)
    payment.add(f"Order #{order.id}", float(order.total))

    # Send to PayNow (sandbox/live depends on your integration keys)
    response = paynow.send(payment)

    if response.success:
        print("✅ Payment created successfully!")
        print("PayNow URL (redirect user here):", response.redirect_url)
        print("Reference / Poll URL (track payment):", response.poll_url)
    else:
        print("❌ Failed to create payment:", response.error)

    return response

# Example usage
if __name__ == "__main__":
    create_manual_payment(150.75)
