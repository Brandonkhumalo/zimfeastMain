"""
Critical path tests for the payment-service.

Tests cover: Paynow callback idempotency, paid status processing,
voucher balance check, and callback with invalid reference.

Uses Django REST Framework's APITestCase. External service calls
(Redis publisher, service_request) are mocked so tests run without
infrastructure dependencies.
"""

import uuid
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.core.cache import cache

from .models import Payment, FeastVoucher


# --------------------------------------------------------------------------
# Helper: create a minimal Payment record for callback tests
# --------------------------------------------------------------------------
def _create_payment(**overrides):
    """Create a Payment with sensible defaults, overridden by kwargs."""
    defaults = {
        "user_id": uuid.uuid4(),
        "order_id": uuid.uuid4(),
        "restaurant_id": uuid.uuid4(),
        "reference": f"PMT_{uuid.uuid4().hex[:10]}",
        "amount": Decimal("25.00"),
        "paynow_amount": Decimal("25.00"),
        "voucher_amount": Decimal("0.00"),
        "method": "paynow",
        "status": "pending",
        "platform_fee": Decimal("3.75"),
        "restaurant_amount": Decimal("21.25"),
        "processed_at": None,
    }
    defaults.update(overrides)
    return Payment.objects.create(**defaults)


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    },
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "shared.jwt_auth.JWTAuthentication",
        ),
        "DEFAULT_PERMISSION_CLASSES": (
            "rest_framework.permissions.IsAuthenticated",
        ),
        "DEFAULT_THROTTLE_RATES": {
            "anon": "1000/min",
            "user": "1000/min",
        },
    },
)
class PaynowCallbackIdempotencyTests(APITestCase):
    """Tests for the _process_payment_callback logic via paynow_result."""

    def setUp(self):
        cache.clear()
        self.url = "/api/payments/result/"

    @patch("payments.views.publisher")
    @patch("payments.views.service_request")
    def test_callback_idempotency_second_call_returns_already_processed(
        self, mock_service_request, mock_publisher
    ):
        """Processing the same reference twice should return 'already_processed'
        on the second call, proving the idempotency guard works."""
        mock_publisher.publish_order_status = MagicMock()
        mock_publisher.publish = MagicMock()

        payment = _create_payment(reference="REF_IDEMPOTENT_001")

        # First callback -- should process successfully
        resp1 = self.client.post(
            self.url,
            {"reference": "REF_IDEMPOTENT_001", "status": "Paid"},
            format="json",
        )
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        self.assertEqual(resp1.data["status"], "ok")

        # Second callback with the same reference -- idempotent guard
        resp2 = self.client.post(
            self.url,
            {"reference": "REF_IDEMPOTENT_001", "status": "Paid"},
            format="json",
        )
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.data["status"], "already_processed")

    @patch("payments.views.publisher")
    @patch("payments.views.service_request")
    def test_callback_paid_sets_processed_at(
        self, mock_service_request, mock_publisher
    ):
        """When the callback status is 'paid', payment.processed_at should be
        set to a non-null datetime."""
        mock_publisher.publish_order_status = MagicMock()
        mock_publisher.publish = MagicMock()

        payment = _create_payment(reference="REF_PAID_002")

        resp = self.client.post(
            self.url,
            {"reference": "REF_PAID_002", "status": "Paid"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        payment.refresh_from_db()
        self.assertIsNotNone(payment.processed_at)
        self.assertEqual(payment.status, "paid")

    @patch("payments.views.publisher")
    @patch("payments.views.service_request")
    def test_callback_with_non_paid_status_does_not_set_processed_at(
        self, mock_service_request, mock_publisher
    ):
        """A callback with a status other than 'paid' (e.g. 'failed') should
        update the status but NOT set processed_at."""
        mock_publisher.publish_order_status = MagicMock()
        mock_publisher.publish = MagicMock()

        payment = _create_payment(reference="REF_FAILED_003")

        resp = self.client.post(
            self.url,
            {"reference": "REF_FAILED_003", "status": "Failed"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        payment.refresh_from_db()
        self.assertIsNone(payment.processed_at)
        self.assertEqual(payment.status, "failed")

    def test_callback_with_invalid_reference_returns_404(self):
        """A callback referencing a non-existent payment should return 404."""
        resp = self.client.post(
            self.url,
            {"reference": "NON_EXISTENT_REF", "status": "Paid"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_callback_missing_fields_returns_400(self):
        """A callback without reference or status should return 400."""
        resp = self.client.post(self.url, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    },
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "shared.jwt_auth.JWTAuthentication",
        ),
        "DEFAULT_PERMISSION_CLASSES": (
            "rest_framework.permissions.IsAuthenticated",
        ),
        "DEFAULT_THROTTLE_RATES": {
            "anon": "1000/min",
            "user": "1000/min",
        },
    },
)
class VoucherBalanceTests(APITestCase):
    """Tests for GET /api/payments/feast/voucher/balance/"""

    def setUp(self):
        cache.clear()
        self.url = "/api/payments/feast/voucher/balance/"
        self.user_id = uuid.uuid4()

    def _make_auth_header(self):
        """Generate a JWT token for the test user.

        Since the payment service uses shared.jwt_auth.JWTAuthentication
        and there is no real User model in this service, we mock the
        authentication to inject a fake user object.
        """
        # We patch authentication at the view level for this test.
        pass

    @patch("shared.jwt_auth.JWTAuthentication.authenticate")
    def test_voucher_balance_with_existing_voucher(self, mock_auth):
        """If a voucher exists for the user, return its balance."""
        # Create a mock user object
        mock_user = MagicMock()
        mock_user.id = self.user_id
        mock_user.is_authenticated = True
        mock_auth.return_value = (mock_user, "fake-token")

        # Create a voucher with some balance
        FeastVoucher.objects.create(user_id=self.user_id, balance=Decimal("150.00"))

        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["balance"], "150.00")

    @patch("shared.jwt_auth.JWTAuthentication.authenticate")
    def test_voucher_balance_with_no_voucher(self, mock_auth):
        """If no voucher exists for the user, return balance of 0.00."""
        mock_user = MagicMock()
        mock_user.id = self.user_id
        mock_user.is_authenticated = True
        mock_auth.return_value = (mock_user, "fake-token")

        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["balance"], "0.00")

    @patch("shared.jwt_auth.JWTAuthentication.authenticate")
    def test_voucher_balance_sums_multiple_vouchers(self, mock_auth):
        """If multiple voucher records exist (edge case), balance should be
        the sum of all records for the user."""
        mock_user = MagicMock()
        mock_user.id = self.user_id
        mock_user.is_authenticated = True
        mock_auth.return_value = (mock_user, "fake-token")

        FeastVoucher.objects.create(user_id=self.user_id, balance=Decimal("50.00"))
        FeastVoucher.objects.create(user_id=self.user_id, balance=Decimal("75.00"))

        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["balance"], "125.00")


class FeastVoucherModelTests(TestCase):
    """Unit tests for the FeastVoucher model methods."""

    def test_deposit_increases_balance(self):
        voucher = FeastVoucher.objects.create(
            user_id=uuid.uuid4(), balance=Decimal("100.00")
        )
        voucher.deposit(50)
        voucher.refresh_from_db()
        self.assertEqual(voucher.balance, Decimal("150.00"))

    def test_withdraw_decreases_balance(self):
        voucher = FeastVoucher.objects.create(
            user_id=uuid.uuid4(), balance=Decimal("100.00")
        )
        voucher.withdraw(30)
        voucher.refresh_from_db()
        self.assertEqual(voucher.balance, Decimal("70.00"))

    def test_withdraw_insufficient_balance_raises_error(self):
        voucher = FeastVoucher.objects.create(
            user_id=uuid.uuid4(), balance=Decimal("10.00")
        )
        with self.assertRaises(ValueError):
            voucher.withdraw(50)
