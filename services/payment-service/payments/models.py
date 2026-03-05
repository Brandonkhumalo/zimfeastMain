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
    PAYMENT_METHODS = (("paynow", "PayNow"), ("voucher", "FeastVoucher"))
    STATUS_CHOICES = (("pending", "Pending"), ("paid", "Paid"), ("failed", "Failed"))

    user_id = models.UUIDField(db_index=True)
    order_id = models.UUIDField(null=True, blank=True, db_index=True)
    reference = models.CharField(max_length=100, unique=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"User {self.user_id} - {self.method} - {self.status} - ${self.amount}"
