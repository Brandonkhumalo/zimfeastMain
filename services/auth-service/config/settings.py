"""
Auth Service settings.
Owns: CustomUser, Address, BlacklistedToken
Port: 8001
"""
import sys
import os
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'shared'))
from base_settings import *

BASE_DIR = Path(__file__).resolve().parent.parent

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

MEDIA_ROOT = BASE_DIR / 'media'
STATIC_ROOT = BASE_DIR / 'staticfiles'
