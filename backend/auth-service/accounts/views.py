import os
import logging
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import AnonRateThrottle
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from django.db import connection
from django.conf import settings

from .serializers import UserSerializer, AddressSerializer
from .token import JWTAuthentication
from .models import BlacklistedToken, CustomUser, Address
from shared.service_client import service_request

logger = logging.getLogger(__name__)


class LoginRateThrottle(AnonRateThrottle):
    """Stricter rate limit for login/register endpoints to prevent brute force."""
    scope = 'login'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def register_user(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        payload = {
            "user_id": str(user.id),
            "role": user.role,
            "email": user.email,
        }
        access_token = JWTAuthentication.generate_token(payload=payload)
        refresh_token = JWTAuthentication.generate_refresh_token(payload=payload)

        # If user provided a referral code, notify payment-service to track it
        referral_code = request.data.get("referral_code", "").strip()
        if referral_code:
            try:
                service_request('payment', 'POST', '/api/payments/referral/track/', json={
                    "user_id": str(user.id),
                    "referral_code": referral_code,
                })
            except Exception as e:
                # Don't block registration if referral tracking fails
                logger.warning(f"Failed to track referral code for user {user.id}: {e}")

        return Response({
            'accessToken': access_token,
            'refreshToken': refresh_token,
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_user(request):
    email = request.data.get("email")
    password = request.data.get("password")
    user = authenticate(email=email, password=password)

    if user:
        payload = {
            "user_id": str(user.id),
            "role": user.role,
            "email": user.email,
        }
        access_token = JWTAuthentication.generate_token(payload=payload)
        refresh_token = JWTAuthentication.generate_refresh_token(payload=payload)
        return Response({
            'accessToken': access_token,
            'refreshToken': refresh_token,
            'role': user.role,
        })
    return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"detail": "Authorization header missing"}, status=status.HTTP_400_BAD_REQUEST)
    token = auth_header.split(" ")[1]
    BlacklistedToken.objects.create(token=token)
    return Response({"detail": "Logged out successfully"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def refresh_token_view(request):
    """
    Accepts a refresh token and returns new access + refresh tokens.
    The old refresh token is blacklisted to enforce single-use rotation.
    """
    refresh_token = request.data.get("refreshToken")
    if not refresh_token:
        return Response(
            {"detail": "refreshToken is required"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Decode the JWT without verifying expiration first so we can give
    # a clear error for non-refresh tokens even if they're expired.
    try:
        payload = jwt.decode(
            refresh_token, settings.SECRET_KEY, algorithms=["HS256"]
        )
    except ExpiredSignatureError:
        return Response(
            {"detail": "Refresh token has expired"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    except (InvalidTokenError, jwt.DecodeError):
        return Response(
            {"detail": "Invalid refresh token"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Validate that this is actually a refresh token
    if payload.get("type") != "refresh_token":
        return Response(
            {"detail": "Token is not a refresh token"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Check if the token has been blacklisted (e.g. after logout or previous rotation)
    if BlacklistedToken.objects.filter(token=refresh_token).exists():
        return Response(
            {"detail": "Refresh token has been revoked"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Fetch the user referenced in the token
    user_id = payload.get("user_id")
    if not user_id:
        return Response(
            {"detail": "Invalid token payload"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        user = CustomUser.objects.get(id=user_id, is_active=True)
    except CustomUser.DoesNotExist:
        return Response(
            {"detail": "User not found or inactive"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Blacklist the old refresh token so it cannot be reused (token rotation)
    BlacklistedToken.objects.get_or_create(token=refresh_token)

    # Generate fresh tokens
    new_payload = {
        "user_id": str(user.id),
        "role": user.role,
        "email": user.email,
    }
    new_access_token = JWTAuthentication.generate_token(payload=new_payload)
    new_refresh_token = JWTAuthentication.generate_refresh_token(payload=new_payload)

    return Response({
        "accessToken": new_access_token,
        "refreshToken": new_refresh_token,
    })


# Internal endpoint for inter-service user lookups
@api_view(['GET'])
@permission_classes([AllowAny])
def internal_get_user(request, user_id):
    """Called by other microservices to fetch user details."""
    service_key = request.headers.get('X-Service-Key')
    if not service_key:
        return Response({"detail": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

    user = get_object_or_404(CustomUser, id=user_id)
    serializer = UserSerializer(user)
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_addresses(request):
    if request.method == 'GET':
        addresses = Address.objects.filter(user=request.user).order_by('-created')
        return Response(AddressSerializer(addresses, many=True).data)

    serializer = AddressSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def address_detail(request, address_id):
    address = get_object_or_404(Address, id=address_id, user=request.user)

    if request.method == 'DELETE':
        address.delete()
        return Response({"detail": "Address deleted."}, status=status.HTTP_204_NO_CONTENT)

    serializer = AddressSerializer(address, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── Admin Endpoints ────────────────────────────────────────────────


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def admin_login(request):
    email = request.data.get("email")
    password = request.data.get("password")
    user = authenticate(email=email, password=password)

    if not user:
        return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

    if user.role != "admin":
        return Response({"detail": "Admin access only"}, status=status.HTTP_403_FORBIDDEN)

    payload = {
        "user_id": str(user.id),
        "role": user.role,
        "email": user.email,
    }
    access_token = JWTAuthentication.generate_token(payload=payload)
    refresh_token = JWTAuthentication.generate_refresh_token(payload=payload)
    return Response({
        'accessToken': access_token,
        'refreshToken': refresh_token,
        'role': user.role,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_register(request):
    # Determine whether registration is allowed:
    # 1) No admin users exist yet (bootstrap) AND a valid ADMIN_SETUP_TOKEN is provided, OR
    # 2) Request carries a valid admin JWT token
    admin_count = CustomUser.objects.filter(role="admin").count()
    is_bootstrap = admin_count == 0

    if is_bootstrap:
        # Bootstrap path: require ADMIN_SETUP_TOKEN from environment
        expected_setup_token = os.environ.get("ADMIN_SETUP_TOKEN")
        if not expected_setup_token:
            return Response(
                {
                    "detail": "Admin bootstrap is disabled. "
                    "Set the ADMIN_SETUP_TOKEN environment variable on the server to enable first-admin registration."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        provided_setup_token = request.data.get("setup_token", "")
        if provided_setup_token != expected_setup_token:
            return Response(
                {"detail": "Invalid setup token"},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Setup token matches — allow bootstrap registration to proceed
    else:
        # Non-bootstrap path: require a valid admin JWT
        is_authenticated_admin = False
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                if payload.get("role") == "admin" and payload.get("type") == "access_token":
                    # Verify the admin user still exists and is active
                    admin_user = CustomUser.objects.filter(
                        id=payload.get("user_id"), role="admin", is_active=True
                    ).first()
                    if admin_user and not BlacklistedToken.objects.filter(token=token).exists():
                        is_authenticated_admin = True
            except (jwt.InvalidTokenError, jwt.ExpiredSignatureError, jwt.DecodeError):
                pass

        if not is_authenticated_admin:
            return Response(
                {"detail": "Admin registration requires an existing admin token"},
                status=status.HTTP_403_FORBIDDEN,
            )

    email = request.data.get("email")
    password = request.data.get("password")
    first_name = request.data.get("first_name", "")
    last_name = request.data.get("last_name", "")

    if not email or not password:
        return Response({"detail": "Email and password are required"}, status=status.HTTP_400_BAD_REQUEST)

    if CustomUser.objects.filter(email=email).exists():
        return Response({"detail": "A user with this email already exists"}, status=status.HTTP_400_BAD_REQUEST)

    user = CustomUser.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role="admin",
        is_staff=True,
    )

    payload = {
        "user_id": str(user.id),
        "role": user.role,
        "email": user.email,
    }
    access_token = JWTAuthentication.generate_token(payload=payload)
    refresh_token = JWTAuthentication.generate_refresh_token(payload=payload)
    return Response({
        'accessToken': access_token,
        'refreshToken': refresh_token,
        'user': UserSerializer(user).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_list_users(request):
    if request.user.role != "admin":
        return Response({"detail": "Admin access only"}, status=status.HTTP_403_FORBIDDEN)

    admin_users = CustomUser.objects.filter(role="admin").order_by("-date_joined" if hasattr(CustomUser, "date_joined") else "-id")
    serializer = UserSerializer(admin_users, many=True)
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_user(request, user_id):
    if request.user.role != "admin":
        return Response({"detail": "Admin access only"}, status=status.HTTP_403_FORBIDDEN)

    if str(request.user.id) == str(user_id):
        return Response({"detail": "Cannot delete yourself"}, status=status.HTTP_400_BAD_REQUEST)

    user = get_object_or_404(CustomUser, id=user_id, role="admin")
    user.delete()
    return Response({"detail": "Admin user deleted successfully"}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_user_stats(request):
    role_counts = CustomUser.objects.values("role").annotate(count=Count("id"))
    stats = {"customers": 0, "restaurants": 0, "drivers": 0, "admins": 0, "total": 0}
    role_key_map = {
        "customer": "customers",
        "restaurant": "restaurants",
        "driver": "drivers",
        "admin": "admins",
    }
    total = 0
    for entry in role_counts:
        key = role_key_map.get(entry["role"])
        if key:
            stats[key] = entry["count"]
        total += entry["count"]
    stats["total"] = total
    return Response(stats)


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_all_users(request):
    """
    GET /api/accounts/admin/all-users/
    List ALL users with optional filters: role, q (search email/name),
    is_active, page, page_size.
    """
    params = request.query_params
    page = int(params.get("page", 1))
    page_size = int(params.get("page_size", 20))
    if page_size > 100:
        page_size = 100

    users = CustomUser.objects.all()

    # Filter by role
    role = params.get("role")
    if role:
        users = users.filter(role=role)

    # Filter by is_active
    is_active = params.get("is_active")
    if is_active is not None:
        users = users.filter(is_active=is_active.lower() in ("true", "1"))

    # Text search on email, first_name, last_name
    q = params.get("q", "").strip()
    if q:
        users = users.filter(
            Q(email__icontains=q) |
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q)
        )

    users = users.order_by("-id")
    total = users.count()
    start = (page - 1) * page_size
    paginated = users[start:start + page_size]

    results = []
    for u in paginated:
        results.append({
            "id": str(u.id),
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "role": u.role,
            "is_active": u.is_active,
            "phone_number": u.phone_number,
            "date_joined": u.date_joined.isoformat() if hasattr(u, "date_joined") and u.date_joined else None,
        })

    return Response({
        "results": results,
        "total": total,
        "page": page,
        "page_size": page_size,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_user_detail(request, user_id):
    """
    GET /api/accounts/admin/user/{user_id}/detail/
    Full user detail including profile, address count, and role-specific info.
    """
    user = get_object_or_404(CustomUser, id=user_id)
    address_count = Address.objects.filter(user=user).count()

    data = {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "phone_number": user.phone_number,
        "address_count": address_count,
    }

    # Add date_joined if available (AbstractBaseUser may not have it)
    if hasattr(user, "date_joined") and user.date_joined:
        data["date_joined"] = user.date_joined.isoformat()

    # Role-specific info: fetch from other services
    if user.role == "restaurant":
        try:
            restaurant_data = service_request(
                'restaurant', 'GET',
                f'/api/restaurants/internal/restaurant/{user.id}/'
            )
            data["restaurant"] = {
                "id": restaurant_data.get("id"),
                "name": restaurant_data.get("name"),
                "is_currently_open": restaurant_data.get("is_currently_open"),
                "average_rating": restaurant_data.get("average_rating"),
            }
        except Exception:
            data["restaurant"] = None

    return Response(data)


@api_view(['PATCH'])
@permission_classes([AllowAny])
def admin_suspend_user(request, user_id):
    """
    PATCH /api/accounts/admin/user/{user_id}/suspend/
    Suspend or unsuspend a user by toggling is_active.
    Body: {"is_active": false, "reason": "..."}
    """
    user = get_object_or_404(CustomUser, id=user_id)

    is_active = request.data.get("is_active")
    reason = request.data.get("reason", "")

    if is_active is None:
        return Response(
            {"detail": "is_active field is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    user.is_active = bool(is_active)
    user.save(update_fields=["is_active"])

    action = "activated" if user.is_active else "suspended"
    logger.info(f"Admin {action} user {user.id} ({user.email}). Reason: {reason}")

    return Response({
        "id": str(user.id),
        "email": user.email,
        "is_active": user.is_active,
        "action": action,
        "reason": reason,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Enhanced health check with DB connection status."""
    db_status = "ok"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception as e:
        db_status = f"error: {str(e)}"

    overall = "ok" if db_status == "ok" else "degraded"

    return Response({
        "status": overall,
        "service": "auth-service",
        "database": db_status,
    })
