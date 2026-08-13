"""
Auth Service settings.
Owns: CustomUser, Address, BlacklistedToken
Port: 8001
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Add shared utilities to the path. Railway's combined image uses
# /app/{auth-service,shared}, while per-service Docker images use /app/shared.
for candidate in (BASE_DIR.parent, BASE_DIR):
    shared_dir = candidate / 'shared'
    if shared_dir.is_dir():
        sys.path.insert(0, str(candidate))
        sys.path.insert(0, str(shared_dir))
        break

from shared.base_settings import *

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'accounts',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

AUTH_USER_MODEL = 'accounts.CustomUser'

# Auth service uses its own database
DATABASES = get_db_config('AUTH_DB_NAME')

# Auth service uses the full JWTAuthentication with DB lookup
REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'] = (
    'accounts.token.JWTAuthentication',
)

MEDIA_ROOT = MEDIA_ROOT_OVERRIDE or BASE_DIR / 'media'
STATIC_ROOT = BASE_DIR / 'staticfiles'
