import logging
from django.conf import settings
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = getattr(settings, "SENDGRID_API_KEY", None)
sendgrid_client = None

if SENDGRID_API_KEY:
    sendgrid_client = SendGridAPIClient(api_key=SENDGRID_API_KEY)
else:
    logger.warning("SENDGRID_API_KEY not set - email functionality will be disabled")


def send_order_receipt(to_email: str, subject: str, html_content: str, text_content: str = None, from_email: str = "noreply@zimfeast.co.zw") -> bool:
    """
    Send an email using SendGrid.
    Returns True if sent successfully, False otherwise.
    """
    if not sendgrid_client:
        logger.warning("Email service not configured - skipping email send")
        return False

    try:
        mail = Mail(
            from_email=Email(from_email),
            to_emails=To(to_email),
            subject=subject,
            html_content=Content("text/html", html_content)
        )
        if text_content:
            mail.add_content(Content("text/plain", text_content))

        response = sendgrid_client.send(mail)
        if 200 <= response.status_code < 300:
            logger.info("Email sent successfully to %s", to_email)
            return True
        else:
            logger.error("Failed to send email. Status code: %s, Body: %s", response.status_code, response.body)
            return False

    except Exception as e:
        logger.exception("SendGrid email error: %s", e)
        return False


def generate_order_receipt_html(order: dict, restaurant: dict, receipt: dict) -> str:
    """
    Generate HTML receipt for an order.
    `order` is a dict with items, totals, delivery info.
    `restaurant` is a dict with restaurant info.
    `receipt` can include confirmationNumber, estimated times.
    """
    items = order.get("items", receipt.get("orderDetails", {}).get("items", []))
    items_html = "".join([
        f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">{item['name']}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align:center;">{item['quantity']}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align:right;">{order['currency']} {item['price']}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align:right;">{order['currency']} {float(item['price']) * int(item['quantity']):.2f}</td>
        </tr>
        """
        for item in items
    ])

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #2563eb; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; background: #f9f9f9; }}
        .receipt-box {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th {{ background: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; }}
        .total-row {{ font-weight: bold; background: #f9f9f9; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 14px; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🍽️ ZimFeast Order Receipt</h1>
          <p>Thank you for your order!</p>
        </div>
        
        <div class="content">
          <div class="receipt-box">
            <h2>Order Details</h2>
            <p><strong>Order ID:</strong> #{order['id'][-8:].upper()}</p>
            <p><strong>Restaurant:</strong> {restaurant.get('name')}</p>
            <p><strong>External Order ID:</strong> {order.get('externalOrderId', 'N/A')}</p>
            <p><strong>Confirmation Number:</strong> {receipt.get('confirmationNumber', order['id'][-6:].upper())}</p>
            <p><strong>Order Date:</strong> {order.get('createdAt')}</p>
            <p><strong>Delivery Address:</strong> {order.get('deliveryAddress')}</p>
            <p><strong>Phone:</strong> {order.get('customerPhone')}</p>
          </div>

          <div class="receipt-box">
            <h3>Items Ordered</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Price</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                {items_html}
                <tr class="total-row">
                  <td colspan="3" style="text-align:right;">Subtotal:</td>
                  <td style="text-align:right;">{order['currency']} {order['subtotal']}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="3" style="text-align:right;">Delivery Fee:</td>
                  <td style="text-align:right;">{order['currency']} {order['deliveryFee']}</td>
                </tr>
                <tr class="total-row" style="font-size:18px; background:#e5e7eb;">
                  <td colspan="3" style="text-align:right;">Total:</td>
                  <td style="text-align:right;">{order['currency']} {order['total']}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for choosing ZimFeast!</p>
          <p>Track your order in the app or contact the restaurant directly if needed.</p>
        </div>
      </div>
    </body>
    </html>
    """


def send_order_receipt(customer_email: str, order: dict, restaurant: dict, receipt: dict) -> bool:
    """
    Generates the receipt HTML and sends email to customer.
    """
    html_content = generate_order_receipt_html(order, restaurant, receipt)
    text_content = f"""
Order Confirmation

Order ID: #{order['id'][-8:].upper()}
Restaurant: {restaurant.get('name')}
Total: {order['currency']} {order['total']}
Delivery Address: {order.get('deliveryAddress')}

Thank you for your order with ZimFeast!
Track your order in the app for real-time updates.
    """.strip()

    return send_order_receipt(
        to_email=customer_email,
        subject=f"Order Confirmation - {restaurant.get('name')} - Order #{order['id'][-8:].upper()}",
        html_content=html_content,
        text_content=text_content
    )
