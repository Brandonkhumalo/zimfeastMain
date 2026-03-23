from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
import uuid


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('Email required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra)


class CustomUser(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ("customer", "Customer"),
        ("restaurant", "Restaurant"),
        ("driver", "Driver"),
        ("admin", "Admin"),
        ("corporate_admin", "Corporate Admin"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=255, blank=True)
    last_name = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=50, blank=True)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='customer')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class Address(models.Model):
    user = models.ForeignKey(CustomUser, related_name='addresses', on_delete=models.CASCADE)
    label = models.CharField(max_length=100, default='home')
    address_text = models.CharField(max_length=255)
    lat = models.FloatField()
    lng = models.FloatField()
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.label}"


class BlacklistedToken(models.Model):
    token = models.CharField(max_length=255, unique=True)
    blacklisted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Blacklisted at {self.blacklisted_at}"


class CorporateAccount(models.Model):
    """A company account that can have multiple employee sub-accounts."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=255)
    admin_user = models.ForeignKey(CustomUser, related_name='corporate_admin', on_delete=models.CASCADE)
    billing_email = models.EmailField()
    billing_address = models.TextField(blank=True)
    monthly_spending_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_month_spending = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    invoice_day = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.company_name


class CorporateEmployee(models.Model):
    """An employee linked to a corporate account with individual spending limits."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    corporate_account = models.ForeignKey(CorporateAccount, related_name='employees', on_delete=models.CASCADE)
    user = models.ForeignKey(CustomUser, related_name='corporate_membership', on_delete=models.CASCADE)
    personal_spending_limit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    current_month_spending = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    requires_approval = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['corporate_account', 'user']

    def __str__(self):
        return f"{self.user.email} @ {self.corporate_account.company_name}"
