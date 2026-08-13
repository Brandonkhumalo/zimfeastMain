#!/bin/sh
set -eu

: "${PORT:=8080}"
export PORT

# Railway's PostgreSQL service exposes DATABASE_URL. Using one database is
# intentional: the services use separate tables and migration app labels.
if [ -z "${DATABASE_URL:-}" ]; then
  : "${POSTGRES_HOST:?Set DATABASE_URL or POSTGRES_HOST}"
  : "${POSTGRES_USER:?Set DATABASE_URL or POSTGRES_USER}"
  : "${POSTGRES_PASSWORD:?Set DATABASE_URL or POSTGRES_PASSWORD}"
  DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-railway}"
  export DATABASE_URL
fi

export AUTH_SERVICE_URL="${AUTH_SERVICE_URL:-http://127.0.0.1:8001}"
export RESTAURANT_SERVICE_URL="${RESTAURANT_SERVICE_URL:-http://127.0.0.1:8002}"
export ORDER_SERVICE_URL="${ORDER_SERVICE_URL:-http://127.0.0.1:8003}"
export PAYMENT_SERVICE_URL="${PAYMENT_SERVICE_URL:-http://127.0.0.1:8005}"
export MEDIA_ROOT="${MEDIA_ROOT:-/data/media}"

until psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null 2>&1; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

# PostGIS is required by restaurant locations and the order-distance columns.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/go-migrations.sql

(cd /app/auth-service && python manage.py migrate --noinput)
(cd /app/restaurant-service && python manage.py migrate --noinput)
(cd /app/payment-service && python manage.py migrate --noinput)

envsubst '${PORT}' < /app/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
