"""
Restaurant Service settings.
Owns: Restaurant, MenuItem, CuisineType, CategoryType, RestaurantDashboard, RestaurantExternalAPI
Port: 8002
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Add shared utilities to the path. Railway's combined image uses
# /app/{restaurant-service,shared}, while per-service Docker images use /app/shared.
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
    'channels',
    'corsheaders',
    'restaurants',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = get_db_config('RESTAURANT_DB_NAME')

# WebSocket channels for restaurant dashboard live updates
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [REDIS_URL]},
    },
}

MEDIA_ROOT = MEDIA_ROOT_OVERRIDE or BASE_DIR / 'media'
STATIC_ROOT = BASE_DIR / 'staticfiles'
