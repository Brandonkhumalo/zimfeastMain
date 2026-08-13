#!/bin/sh
set -eu

: "${PORT:=8080}"
export PORT

if [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
  if [ -z "${ALLOWED_HOSTS:-}" ]; then
    export ALLOWED_HOSTS="$RAILWAY_PUBLIC_DOMAIN"
  fi

  case ",$ALLOWED_HOSTS," in
    *",$RAILWAY_PUBLIC_DOMAIN,"*) ;;
    *) export ALLOWED_HOSTS="$ALLOWED_HOSTS,$RAILWAY_PUBLIC_DOMAIN" ;;
  esac

  case "${CORS_ALLOWED_ORIGINS:-}" in
    ""|"https://"|"http://")
      export CORS_ALLOWED_ORIGINS="https://$RAILWAY_PUBLIC_DOMAIN"
      ;;
  esac
fi

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen ${PORT};
    server_name _;

    location = /health {
        default_type application/json;
        return 200 '{"status":"starting"}';
    }

    location / {
        default_type application/json;
        return 503 '{"status":"starting"}';
    }
}
EOF

# Railway health checks should confirm the container is alive and listening.
# Start Nginx before dependency waits and migrations so GET /health can return
# 200 while the internal services finish bootstrapping.
/usr/sbin/nginx

stop_bootstrap_nginx() {
  nginx -s quit >/dev/null 2>&1 || true
  i=0
  while [ -f /run/nginx.pid ] && [ "$i" -lt 10 ]; do
    i=$((i + 1))
    sleep 1
  done
}
trap stop_bootstrap_nginx EXIT INT TERM

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
mkdir -p "$MEDIA_ROOT"

: "${REDIS_URL:?Set REDIS_URL from the Railway Redis service}"

until psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null 2>&1; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

# pgcrypto supplies gen_random_uuid(), used by the Go order-service schema.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/go-migrations.sql

until redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; do
  echo "Waiting for Redis..."
  sleep 2
done

(cd /app/auth-service && python manage.py migrate --noinput)
(cd /app/restaurant-service && python manage.py migrate --noinput)
(cd /app/payment-service && python manage.py migrate --noinput)

envsubst '${PORT}' < /app/nginx.conf.template > /etc/nginx/conf.d/default.conf
stop_bootstrap_nginx
trap - EXIT INT TERM
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
