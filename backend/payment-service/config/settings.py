"""
Payment Service settings.
Owns: Payment, FeastVoucher
Port: 8005
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Add shared utilities to the path. Railway's combined image uses
# /app/{payment-service,shared}, while per-service Docker images use /app/shared.
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
    'payments',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = get_db_config('PAYMENT_DB_NAME')

STATIC_ROOT = BASE_DIR / 'staticfiles'
