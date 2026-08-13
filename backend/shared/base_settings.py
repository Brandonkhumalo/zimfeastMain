"""
Base Django settings shared across all microservices.
Each service imports this and overrides what it needs.
"""
import os
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from corsheaders.defaults import default_headers

# Shared secret key for JWT validation across all services
SECRET_KEY = os.environ.get('SECRET_KEY', os.environ.get('JWT_SECRET_KEY', 'change-me'))

DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = [
    host.strip() for host in os.environ.get(
        'ALLOWED_HOSTS', 'localhost,127.0.0.1,0.0.0.0,zimfeast.com,www.zimfeast.com,api.zimfeast.com'
    ).split(',') if host.strip()
]

CORS_ALLOW_ALL_ORIGINS = DEBUG


def _parse_cors_allowed_origins(value):
    """Ignore empty Railway template expansions such as "https://"."""
    origins = []
    for origin in value.split(','):
        origin = origin.strip()
        parsed = urlparse(origin)
        if origin and parsed.scheme in ('http', 'https') and parsed.netloc:
            origins.append(origin)
    return origins


CORS_ALLOWED_ORIGINS = _parse_cors_allowed_origins(os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'https://zimfeast.com,https://www.zimfeast.com'
))
CORS_ALLOW_HEADERS = list(default_headers) + ['Authorization']

# Shared middleware
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Third-party API keys
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_API_KEY', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')

# Paynow settings
PAYNOW_SANDBOX_URL = os.environ.get('PAYNOW_SANDBOX_URL', '')
PAYNOW_RETURN_URL = os.environ.get('PAYNOW_RETURN_URL', '')
PAYNOW_RESULT_URL = os.environ.get('PAYNOW_RESULT_URL', '')
PAYNOW_INTEGRATION_ID = os.environ.get('PAYNOW_INTEGRATION_ID', '')
PAYNOW_INTEGRATION_KEY = os.environ.get('PAYNOW_INTEGRATION_KEY', '')

# Redis
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
        'TIMEOUT': 300,
        'KEY_PREFIX': 'zimfeast',
    }
}

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'shared.jwt_auth.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.CursorPagination',
    'PAGE_SIZE': 10,
    'CURSOR_PAGINATION_ORDERING': '-id',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/min',
        'user': '60/min',
        'login': '5/min',
    },
}

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'

# Media storage: S3 in production, local filesystem in dev
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', '')
if AWS_STORAGE_BUCKET_NAME:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'af-south-1')
    AWS_S3_CUSTOM_DOMAIN = os.environ.get('MEDIA_URL', '').strip('/').replace('https://', '').replace('http://', '')
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_FILE_OVERWRITE = False
    MEDIA_URL = os.environ.get('MEDIA_URL', f'https://{AWS_S3_CUSTOM_DOMAIN}/')
else:
    MEDIA_URL = '/media/'

# A Railway volume can be mounted at /data so uploaded media survives deploys.
# Keeping the default preserves the existing local Docker behavior.
MEDIA_ROOT_OVERRIDE = os.environ.get('MEDIA_ROOT', '')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


def get_db_config(db_name_env):
    """Generate PostgreSQL database config from environment variables."""
    # Railway provides a single DATABASE_URL.  The monolith container uses that
    # one database for all services, while local Docker Compose can continue to
    # use the per-service database variables below.
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        parsed = urlparse(database_url)
        config = {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': unquote(parsed.path.lstrip('/')),
            'USER': unquote(parsed.username or ''),
            'PASSWORD': unquote(parsed.password or ''),
            'HOST': parsed.hostname or 'localhost',
            'PORT': str(parsed.port or 5432),
        }
        sslmode = parse_qs(parsed.query).get('sslmode', [None])[0]
        if sslmode:
            config['OPTIONS'] = {'sslmode': sslmode}
        return {'default': config}

    return {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get(db_name_env, 'zimfeast'),
            'USER': os.environ.get('POSTGRES_USER', 'zimfeast'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'zimfeast'),
            'HOST': os.environ.get('POSTGRES_HOST', 'postgres'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }
