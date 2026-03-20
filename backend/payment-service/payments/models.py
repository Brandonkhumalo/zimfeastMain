from django.db import models
from django.utils import timezone
from decimal import Decimal
import uuid
import string
import random


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
    processed_at = models.DateTimeField(null=True, blank=True, help_text="When the payment callback was successfully processed")

    def __str__(self):
        return f"User {self.user_id} - {self.method} - {self.status} - ${self.amount}"


class PromoCode(models.Model):
    """Admin-created discount codes. Separate from referral credits."""
    DISCOUNT_TYPE_CHOICES = (
        ("percentage", "Percentage"),
        ("fixed", "Fixed Amount"),
    )

    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES)
    discount_value = models.DecimalField(max_digits=8, decimal_places=2)
    min_order_amount = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal('0.00'),
        help_text="Minimum order amount required to use this promo code"
    )
    max_uses = models.IntegerField(default=0, help_text="0 = unlimited")
    times_used = models.IntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self, order_amount=None):
        """Check if this promo code can currently be used."""
        if not self.is_active:
            return False, "This promo code is no longer active."
        if self.expires_at and timezone.now() > self.expires_at:
            return False, "This promo code has expired."
        if self.max_uses > 0 and self.times_used >= self.max_uses:
            return False, "This promo code has reached its usage limit."
        if order_amount is not None and Decimal(str(order_amount)) < self.min_order_amount:
            return False, f"Minimum order amount of ${self.min_order_amount} required."
        return True, "Valid"

    def calculate_discount(self, order_amount):
        """Calculate the discount amount for a given order total."""
        order_amount = Decimal(str(order_amount))
        if self.discount_type == "percentage":
            discount = round(order_amount * self.discount_value / 100, 2)
        else:
            discount = self.discount_value
        # Discount cannot exceed the order amount
        return min(discount, order_amount)

    def __str__(self):
        return f"{self.code} - {self.discount_type} {self.discount_value}"


class ReferralCode(models.Model):
    """Each user gets a unique referral code. Auto-generated on first request."""
    user_id = models.UUIDField(unique=True, db_index=True)
    code = models.CharField(max_length=20, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def generate_code():
        """Generate a unique 8-character referral code like 'ZF-ABCD12'."""
        chars = string.ascii_uppercase + string.digits
        while True:
            code = "ZF-" + "".join(random.choices(chars, k=6))
            if not ReferralCode.objects.filter(code=code).exists():
                return code

    def __str__(self):
        return f"User {self.user_id} - {self.code}"


class ReferralCredit(models.Model):
    """
    Tracks referral credits earned by users.
    Created when a referred user's first $20+ order is paid.
    The referrer gets a 15% discount credit they can use on one future order.
    """
    referrer_id = models.UUIDField(db_index=True)  # User who gets the credit
    referred_id = models.UUIDField(db_index=True)   # User who was referred
    order_id = models.UUIDField(db_index=True)       # The qualifying order
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('15.00'))
    is_used = models.BooleanField(default=False)
    used_on_order_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        status = "used" if self.is_used else "available"
        return f"Referrer {self.referrer_id} - {self.discount_pct}% ({status})"


class PromoUsage(models.Model):
    """Tracks which user used which promo code on which order. One use per user per promo."""
    user_id = models.UUIDField(db_index=True)
    promo = models.ForeignKey(PromoCode, on_delete=models.CASCADE, related_name='usages')
    order_id = models.UUIDField()
    discount_applied = models.DecimalField(max_digits=8, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user_id", "promo")  # One use per user per promo

    def __str__(self):
        return f"User {self.user_id} used {self.promo.code} - ${self.discount_applied}"


class ReferralTracking(models.Model):
    """
    Tracks which user was referred by which referral code.
    Created at registration time when a user provides a referral code.
    """
    user_id = models.UUIDField(unique=True, db_index=True)  # The new user who was referred
    referrer_id = models.UUIDField(db_index=True)  # The user who referred them
    referral_code = models.CharField(max_length=20)
    is_qualified = models.BooleanField(
        default=False,
        help_text="True once the referred user completes a $20+ order"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"User {self.user_id} referred by {self.referrer_id}"
