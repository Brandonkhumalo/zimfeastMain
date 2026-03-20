"""
Critical path tests for the auth-service.

Tests cover: registration, login, profile fetch, and rate limiting.
Uses Django REST Framework's APITestCase with the custom JWTAuthentication.
"""

from django.test import TestCase, override_settings
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.core.cache import cache

from .models import CustomUser
from .token import JWTAuthentication


# Override throttle rates so we can test rate limiting without waiting.
# The login throttle scope allows 5/min by default; we keep that for the
# rate-limit test and loosen the global anon/user rates so they don't
# interfere with normal test requests.
THROTTLE_OVERRIDE = {
    "anon": "1000/min",
    "user": "1000/min",
    "login": "5/min",
}


def _generate_auth_header(user):
    """Helper: generate a valid Bearer token header for the given user."""
    payload = {
        "user_id": str(user.id),
        "role": user.role,
        "email": user.email,
    }
    token = JWTAuthentication.generate_token(payload)
    return f"Bearer {token}"


@override_settings(
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "accounts.token.JWTAuthentication",
        ),
        "DEFAULT_PERMISSION_CLASSES": (
            "rest_framework.permissions.IsAuthenticated",
        ),
        "DEFAULT_THROTTLE_RATES": THROTTLE_OVERRIDE,
    },
    # Use a local-memory cache for tests so Redis is not required.
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    },
)
class RegistrationTests(APITestCase):
    """Tests for POST /api/accounts/register/"""

    def setUp(self):
        cache.clear()
        self.url = "/api/accounts/register/"
        self.valid_data = {
            "email": "newuser@example.com",
            "password": "StrongP@ss123",
            "first_name": "John",
            "last_name": "Doe",
            "phone_number": "+263771234567",
            "role": "customer",
        }

    def test_register_valid_data_returns_201_with_tokens(self):
        """Registering with valid data should return 201 and both tokens."""
        response = self.client.post(self.url, self.valid_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("accessToken", response.data)
        self.assertIn("refreshToken", response.data)
        # Verify the user was actually created in the database
        self.assertTrue(CustomUser.objects.filter(email="newuser@example.com").exists())

    def test_register_duplicate_email_returns_400(self):
        """Registering with an email that already exists should return 400."""
        # Create the user first
        CustomUser.objects.create_user(
            email="duplicate@example.com",
            password="SomePassword1!",
            role="customer",
        )
        data = self.valid_data.copy()
        data["email"] = "duplicate@example.com"
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # The serializer should report an email uniqueness error
        self.assertIn("email", response.data)


@override_settings(
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "accounts.token.JWTAuthentication",
        ),
        "DEFAULT_PERMISSION_CLASSES": (
            "rest_framework.permissions.IsAuthenticated",
        ),
        "DEFAULT_THROTTLE_RATES": THROTTLE_OVERRIDE,
    },
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    },
)
class LoginTests(APITestCase):
    """Tests for POST /api/accounts/login/"""

    def setUp(self):
        cache.clear()
        self.url = "/api/accounts/login/"
        self.user = CustomUser.objects.create_user(
            email="login@example.com",
            password="ValidPass123!",
            first_name="Jane",
            last_name="Doe",
            phone_number="+263779876543",
            role="customer",
        )

    def test_login_valid_credentials_returns_200_with_tokens_and_role(self):
        """Login with correct email/password should return 200, tokens, and role."""
        response = self.client.post(
            self.url,
            {"email": "login@example.com", "password": "ValidPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("accessToken", response.data)
        self.assertIn("refreshToken", response.data)
        self.assertEqual(response.data["role"], "customer")

    def test_login_invalid_credentials_returns_401(self):
        """Login with wrong password should return 401."""
        response = self.client.post(
            self.url,
            {"email": "login@example.com", "password": "WrongPassword!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)


@override_settings(
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "accounts.token.JWTAuthentication",
        ),
        "DEFAULT_PERMISSION_CLASSES": (
            "rest_framework.permissions.IsAuthenticated",
        ),
        "DEFAULT_THROTTLE_RATES": THROTTLE_OVERRIDE,
    },
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    },
)
class ProfileTests(APITestCase):
    """Tests for GET /api/accounts/profile/"""

    def setUp(self):
        cache.clear()
        self.url = "/api/accounts/profile/"
        self.user = CustomUser.objects.create_user(
            email="profile@example.com",
            password="SecurePass789!",
            first_name="Alice",
            last_name="Smith",
            phone_number="+263771112233",
            role="driver",
        )

    def test_profile_with_valid_token_returns_200_and_user_data(self):
        """GET /profile/ with a valid JWT should return 200 and user data."""
        auth_header = _generate_auth_header(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=auth_header)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "profile@example.com")
        self.assertEqual(response.data["first_name"], "Alice")
        self.assertEqual(response.data["last_name"], "Smith")
        self.assertEqual(response.data["role"], "driver")

    def test_profile_without_token_returns_401(self):
        """GET /profile/ without any Authorization header should return 401."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "accounts.token.JWTAuthentication",
        ),
        "DEFAULT_PERMISSION_CLASSES": (
            "rest_framework.permissions.IsAuthenticated",
        ),
        "DEFAULT_THROTTLE_RATES": {
            "anon": "1000/min",
            "user": "1000/min",
            "login": "5/min",  # Allow exactly 5 requests per minute
        },
    },
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    },
)
class RateLimitTests(APITestCase):
    """Tests for the LoginRateThrottle on the login endpoint.

    The 'login' scope is configured to 5/min. Sending a 6th request
    within the same minute should return 429 Too Many Requests.
    """

    def setUp(self):
        cache.clear()
        self.url = "/api/accounts/login/"
        self.user = CustomUser.objects.create_user(
            email="ratelimit@example.com",
            password="RateLimit123!",
            role="customer",
        )

    def test_login_rate_limit_returns_429_on_6th_attempt(self):
        """Sending 6 rapid login requests should get 429 on the 6th."""
        payload = {"email": "ratelimit@example.com", "password": "wrong"}

        # First 5 requests should NOT be throttled (they will be 401 since
        # the password is wrong, but they should not be 429).
        for i in range(5):
            resp = self.client.post(self.url, payload, format="json")
            self.assertNotEqual(
                resp.status_code,
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Request {i+1} was unexpectedly throttled",
            )

        # The 6th request should be throttled.
        resp = self.client.post(self.url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
