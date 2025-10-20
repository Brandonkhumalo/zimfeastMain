from django.db import models
from django.conf import settings
from decimal import Decimal
from orders.models import Order  # adjust import based on your project

class FeastVoucher(models.Model):
    """
    Represents the user's e-wallet. 
    Users can deposit multiple times and use it for multiple payments.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feast_vouchers")
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def deposit(self, amount: Decimal):
        self.balance += amount
        self.save()

    def withdraw(self, amount: Decimal):
        if amount > self.balance:
            raise ValueError("Insufficient voucher balance")
        self.balance -= amount
        self.save()

    def __str__(self):
        return f"{self.user.email} - Balance: ${self.balance}"


class Payment(models.Model):
    PAYMENT_METHODS = (
        ("paynow", "PayNow"),
        ("voucher", "FeastVoucher"),
    )

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("failed", "Failed"),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments")
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="payments", null=True, blank=True)
    reference = models.CharField(max_length=100, unique=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.method} - {self.status} - ${self.amount}"
