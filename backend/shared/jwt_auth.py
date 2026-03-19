"""
Shared JWT authentication for all microservices.
Each service validates JWT tokens independently (stateless auth).
The token contains user_id and is signed with the shared SECRET_KEY.
"""
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
from datetime import datetime, timedelta
import copy


class JWTAuthentication(BaseAuthentication):
    """
    Stateless JWT authentication shared across all microservices.
    Does NOT require database lookup - extracts user info from token payload.
    """

    @staticmethod
    def generate_token(payload):
        expiration = datetime.utcnow() + timedelta(days=14)
        token_payload = copy.deepcopy(payload)
        token_payload['exp'] = int(expiration.timestamp())
        token_payload['type'] = 'access_token'
        token_payload['id'] = payload['user_id']
        return jwt.encode(token_payload, key=settings.SECRET_KEY, algorithm='HS256')

    @staticmethod
    def generate_refresh_token(payload):
        expiration = datetime.utcnow() + timedelta(days=30)
        token_payload = copy.deepcopy(payload)
        token_payload['exp'] = int(expiration.timestamp())
        token_payload['type'] = 'refresh_token'
        token_payload['user_id'] = str(payload['user_id'])
        return jwt.encode(token_payload, key=settings.SECRET_KEY, algorithm='HS256')

    def extract_token(self, request):
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            return auth_header.split(' ')[1]
        return None

    def verify_token(self, payload, token_type='access_token'):
        if 'exp' not in payload:
            raise InvalidTokenError("Token has no expiration")
        exp_timestamp = payload['exp']
        current_timestamp = int(datetime.utcnow().timestamp())
        if current_timestamp > exp_timestamp:
            raise ExpiredSignatureError("Token has expired")
        if payload.get('type') != token_type:
            raise InvalidTokenError(f"Expected token type '{token_type}', got '{payload.get('type')}'")

    def authenticate(self, request):
        token = self.extract_token(request)
        if not token:
            return None

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            self.verify_token(payload, token_type='access_token')

            user_id = payload.get('user_id')
            if not user_id:
                raise AuthenticationFailed("Token missing user ID.")

            # For the auth service, look up the real user.
            # For other services, return a lightweight user proxy.
            User = self._get_user_model()
            if User:
                try:
                    user = User.objects.get(id=user_id)
                    return (user, token)
                except User.DoesNotExist:
                    raise AuthenticationFailed("User not found.")
            else:
                # Return a proxy user object for services without a User model
                user = JWTUser(payload)
                return (user, token)

        except (InvalidTokenError, ExpiredSignatureError, jwt.DecodeError) as e:
            raise AuthenticationFailed(f"Invalid Token: {str(e)}")

    def _get_user_model(self):
        try:
            from django.contrib.auth import get_user_model
            return get_user_model()
        except Exception:
            return None


class JWTUser:
    """
    Lightweight user proxy for services that don't have the User model.
    Carries just enough info from the JWT payload for authorization.
    """
    def __init__(self, payload):
        self.id = payload.get('user_id') or payload.get('id')
        self.pk = self.id
        self.payload = payload
        self.is_authenticated = True
        self.is_active = True
        self.role = payload.get('role', 'customer')
        self.email = payload.get('email', '')
        self.first_name = payload.get('first_name', '')
        self.last_name = payload.get('last_name', '')

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def __str__(self):
        return str(self.id)
