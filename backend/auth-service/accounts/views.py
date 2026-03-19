from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.db.models import Count
from .serializers import UserSerializer, AddressSerializer
from .token import JWTAuthentication
from .models import BlacklistedToken, CustomUser, Address

import jwt
from django.conf import settings


@api_view(['POST'])
@permission_classes([AllowAny])
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
        return Response({
            'accessToken': access_token,
            'refreshToken': refresh_token,
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
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
    return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


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
def admin_login(request):
    email = request.data.get("email")
    password = request.data.get("password")
    user = authenticate(email=email, password=password)

    if not user:
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

    if user.role != "admin":
        return Response({"error": "Admin access only"}, status=status.HTTP_403_FORBIDDEN)

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
    # 1) No admin users exist yet (bootstrap), OR
    # 2) Request carries a valid admin JWT token
    admin_count = CustomUser.objects.filter(role="admin").count()
    is_bootstrap = admin_count == 0

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

    if not is_bootstrap and not is_authenticated_admin:
        return Response(
            {"error": "Admin registration requires an existing admin token or must be the first admin"},
            status=status.HTTP_403_FORBIDDEN,
        )

    email = request.data.get("email")
    password = request.data.get("password")
    first_name = request.data.get("first_name", "")
    last_name = request.data.get("last_name", "")

    if not email or not password:
        return Response({"error": "Email and password are required"}, status=status.HTTP_400_BAD_REQUEST)

    if CustomUser.objects.filter(email=email).exists():
        return Response({"error": "A user with this email already exists"}, status=status.HTTP_400_BAD_REQUEST)

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
        return Response({"error": "Admin access only"}, status=status.HTTP_403_FORBIDDEN)

    admin_users = CustomUser.objects.filter(role="admin").order_by("-date_joined" if hasattr(CustomUser, "date_joined") else "-id")
    serializer = UserSerializer(admin_users, many=True)
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_user(request, user_id):
    if request.user.role != "admin":
        return Response({"error": "Admin access only"}, status=status.HTTP_403_FORBIDDEN)

    if str(request.user.id) == str(user_id):
        return Response({"error": "Cannot delete yourself"}, status=status.HTTP_400_BAD_REQUEST)

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
def health_check(request):
    return Response({"status": "ok"})
