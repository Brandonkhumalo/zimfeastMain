# One Railway service: Nginx serves the React SPA and proxies requests to the
# backend processes running in this same container.
FROM node:20-bookworm-slim AS frontend-build

WORKDIR /build/webapp
COPY webapp/package.json webapp/package-lock.json ./
RUN npm ci
COPY webapp/ ./

ARG VITE_GOOGLE_MAPS_API_KEY=""
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
RUN npm run build

FROM golang:1.22-alpine AS order-build

WORKDIR /build
COPY backend/go-shared ./go-shared
COPY backend/order-service ./order-service
WORKDIR /build/order-service
RUN go mod download && CGO_ENABLED=0 go build -o /order-server .

FROM golang:1.22-alpine AS realtime-build

WORKDIR /build
COPY backend/go-shared ./go-shared
COPY backend/realtime-service ./realtime-service
WORKDIR /build/realtime-service
RUN go mod download && CGO_ENABLED=0 go build -o /realtime-server .

FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings \
    PORT=8080

WORKDIR /app

# nginx is the public listener. supervisor owns nginx plus all five backend
# processes; PostgreSQL and Redis are Railway managed services.
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx supervisor gettext-base postgresql-client libpq5 libgdal32 libgeos-c1v5 \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY backend/auth-service/requirements.txt /tmp/auth-requirements.txt
COPY backend/restaurant-service/requirements.txt /tmp/restaurant-requirements.txt
COPY backend/payment-service/requirements.txt /tmp/payment-requirements.txt
RUN pip install --no-cache-dir \
    -r /tmp/auth-requirements.txt \
    -r /tmp/restaurant-requirements.txt \
    -r /tmp/payment-requirements.txt \
    && rm /tmp/*-requirements.txt

COPY backend/shared ./shared
COPY backend/auth-service ./auth-service
COPY backend/restaurant-service ./restaurant-service
COPY backend/payment-service ./payment-service
COPY --from=order-build /order-server /usr/local/bin/order-server
COPY --from=realtime-build /realtime-server /usr/local/bin/realtime-server
COPY --from=frontend-build /build/webapp/dist/public ./frontend

COPY railway/nginx.conf.template /app/nginx.conf.template
COPY railway/supervisord.conf /etc/supervisor/conf.d/zimfeast.conf
COPY railway/start.sh /app/start.sh
COPY backend/go-migrations.sql /app/go-migrations.sql
RUN sed -i '/^\\connect /d' /app/go-migrations.sql \
    && chmod +x /app/start.sh \
    && mkdir -p /data/media

EXPOSE 8080

CMD ["/app/start.sh"]
