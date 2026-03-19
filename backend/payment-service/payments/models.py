from django.db import models
from decimal import Decimal
import uuid


class FeastVoucher(models.Model):
    """User's e-wallet. References user by UUID."""
    user_id = models.UUIDField(db_index=True)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def deposit(self, amount):
        self.balance += Decimal(str(amount))
        self.save()

    def withdraw(self, amount):
        amount = Decimal(str(amount))
        if amount > self.balance:
            raise ValueError("Insufficient voucher balance")
        self.balance -= amount
        self.save()

    def __str__(self):
        return f"User {self.user_id} - Balance: ${self.balance}"


class Payment(models.Model):
    PAYMENT_METHODS = (
        ("paynow", "PayNow"),
        ("voucher", "FeastVoucher"),
        ("voucher_paynow", "Voucher + PayNow"),
        ("direct", "Direct to Restaurant"),
    )
    STATUS_CHOICES = (("pending", "Pending"), ("paid", "Paid"), ("failed", "Failed"))

    user_id = models.UUIDField(db_index=True)
    order_id = models.UUIDField(null=True, blank=True, db_index=True)
    restaurant_id = models.UUIDField(null=True, blank=True, db_index=True)
    reference = models.CharField(max_length=100, unique=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Total order amount")
    paynow_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Amount paid via PayNow")
    voucher_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Amount paid from voucher")
    method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    paid_direct = models.BooleanField(default=False, help_text="True if paid directly to restaurant's Paynow")
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    restaurant_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"User {self.user_id} - {self.method} - {self.status} - ${self.amount}"
