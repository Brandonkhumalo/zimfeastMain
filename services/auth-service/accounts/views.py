from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from .serializers import UserSerializer
from .token import JWTAuthentication
from .models import BlacklistedToken, CustomUser


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
