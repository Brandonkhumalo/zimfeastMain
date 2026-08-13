"""
Restaurant Service settings.
Owns: Restaurant, MenuItem, CuisineType, CategoryType, RestaurantDashboard, RestaurantExternalAPI
Port: 8002
"""
import sys
import os
from pathlib import Path

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
    'django.contrib.gis',
    'rest_framework',
    'channels',
    'corsheaders',
    'restaurants',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = get_db_config('RESTAURANT_DB_NAME')
# Override engine to PostGIS for spatial queries (ST_DWithin, KNN, geography columns)
DATABASES['default']['ENGINE'] = 'django.contrib.gis.db.backends.postgis'

# WebSocket channels for restaurant dashboard live updates
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [REDIS_URL]},
    },
}

MEDIA_ROOT = MEDIA_ROOT_OVERRIDE or BASE_DIR / 'media'
STATIC_ROOT = BASE_DIR / 'staticfiles'
