# Backend Documentation

This document is the backend onboarding guide for new engineers working on ZimFeast.

## 1. Backend at a Glance

ZimFeast backend is a polyglot microservice architecture:

- Django auth service (`auth-service`, port `8001`)
- Django restaurant service (`restaurant-service`, port `8002`)
- Go order service (`order-service`, port `8003`)
- Django payment service (`payment-service`, port `8005`)
- Go realtime service (`realtime-service`, port `3001`)
- Nginx API gateway (`api-gateway`, port `80`)
- Shared Redis + Postgres

All client traffic should hit the API gateway first.

## 2. Directory Layout

```text
backend/
├── api-gateway/                # Nginx reverse proxy
├── auth-service/               # Django auth/accounts/corporate
├── restaurant-service/         # Django restaurants/menu/reviews/banners
├── order-service/              # Go order lifecycle + TumaGo webhook ingestion
├── payment-service/            # Django payments/promo/referrals/finance
├── realtime-service/           # Go Socket.IO server + Redis subscribers
├── go-shared/                  # Shared Go packages (auth, config, ETA, pubsub)
├── shared/                     # Shared Python packages (jwt, redis, service client)
├── docker-compose.yml
├── .env.example
├── init-db.sql                 # DB bootstrap
└── go-migrations.sql           # Go service DB schema helper
```

## 3. Runtime Topology

### Ingress

`api-gateway/nginx.conf` routes:

- `/api/accounts/*` -> auth-service
- `/api/restaurants/*` -> restaurant-service
- `/api/orders/*` -> order-service
- `/api/payments/*` -> payment-service
- `/api/webhooks/tumago/*` -> order-service
- `/ws/restaurant/*` -> restaurant-service (Django Channels)
- `/socket.io/*` -> realtime-service
- `/media/*` -> shared media volume
- `/` -> built webapp static files

### Data Stores

- PostgreSQL (`postgis/postgis:16-3.4-alpine`)
- Redis (`redis:7-alpine`, AOF enabled)

Per-service databases:

- `zimfeast_auth`
- `zimfeast_restaurants`
- `zimfeast_orders`
- `zimfeast_payments`

## 4. Core Service Responsibilities

### 4.1 Auth Service (`auth-service`)

Key features:

- Registration/login/logout/refresh
- User profile and address book
- Admin user management
- Corporate account management
- Internal user lookup for other services

Main endpoints (prefix `/api/accounts/`):

- `POST register/`
- `POST login/`
- `POST refresh/`
- `GET profile/`
- `POST logout/`
- `GET/POST addresses/`
- `PATCH/DELETE addresses/<id>/`
- `GET internal/user/<user_id>/`
- `POST admin/login/`
- `POST admin/register/`
- `GET admin/users/`
- `GET admin/stats/`
- `GET corporate/`
- `GET/POST corporate/employees/`

### 4.2 Restaurant Service (`restaurant-service`)

Key features:

- Restaurant creation/update
- Menu/category/cuisine management
- Nearby search
- Reviews
- Branch management
- Banner/campaign admin APIs
- Restaurant finance
- Restaurant dashboard WebSocket

Main endpoints (prefix `/api/restaurants/`):

- `GET health/`
- `POST create/`
- `GET my-restaurant/`
- `GET nearby/`
- `GET get/all/`
- `GET menu/`
- `POST add/menu-items/`
- `PATCH menu/<menu_id>/update/`
- `DELETE menu/<menu_id>/delete/`
- `GET admin/list/`
- `GET admin/reviews/`
- `GET banners/active/`
- `GET/POST admin/banners/`
- `PATCH admin/<restaurant_id>/suspend/`

WebSocket route:

- `/ws/restaurant/<restaurant_id>/dashboard/`

### 4.3 Order Service (`order-service`)

Key features:

- Order creation/list/cancel/update
- Admin order analytics/search/live stats
- Scheduled order dispatcher
- TumaGo webhook processing
- Delivery photo upload/retrieval
- Redis publication for realtime updates

Main endpoints:

- `GET /api/orders/health/`
- `GET /api/orders/all/orders/`
- `GET /api/orders/order/{id}/`
- `PATCH /api/orders/order/{id}/status/`
- `POST /api/orders/order/{id}/delivery-photo/`
- `GET /api/orders/order/{id}/delivery-photo/`
- `GET /api/orders/admin/analytics/`
- `GET /api/orders/admin/search/`
- `PATCH /api/orders/admin/order/{id}/override-status/`
- `POST /api/webhooks/tumago/`

Authenticated endpoints:

- `POST /api/orders/create/`
- `GET /api/orders/list/`
- `POST /api/orders/cancel/{id}/`

### 4.4 Payment Service (`payment-service`)

Key features:

- Paynow payment creation + callbacks
- Voucher balance/deposit
- Promo code validation/admin
- Referral code/credits
- Admin finance reporting/refunds
- Fraud heuristics via shared Redis utilities

Main endpoints (prefix `/api/payments/`):

- `POST create/payment/`
- `POST callback/`
- `GET status/<reference>/`
- `GET feast/voucher/balance/`
- `POST promo/validate/`
- `POST promo/create/`
- `GET promo/list/`
- `GET referral/code/`
- `GET referral/credits/`
- `POST referral/track/`
- `GET admin/finance-summary/`
- `GET admin/failed-payments/`
- `GET admin/settlements/`
- `POST admin/refund/`

### 4.5 Realtime Service (`realtime-service`)

Key features:

- Socket.IO namespace `/customers`
- Room-based order subscriptions (`order:<id>`)
- Driver location/status broadcasting
- ETA calculation (Google API via shared ETA package)
- Redis crash-recovery of active orders

Socket events consumed:

- `customer:join`
- `order:subscribe`
- `order:unsubscribe`
- `order:get_eta`

Socket events emitted:

- `order:status`
- `driver:location`
- `order:eta`
- `order:completed`

## 5. Inter-Service Communication

### HTTP (sync)

- Python services use `backend/shared/service_client.py`
- Service-to-service API key via `X-Service-Key`

### Redis Pub/Sub (async)

Important channels:

- `orders.status.changed`
- `orders.driver.location`
- `orders.fraud.flagged`

Flow example:

1. TumaGo sends webhook -> Order Service
2. Order Service updates DB + publishes status/location to Redis
3. Realtime Service subscribes and pushes to Socket.IO rooms
4. Webapp/mobile clients receive live updates

## 6. Local Development

## 6.1 Prerequisites

- Docker + Docker Compose
- Optional: Python 3.11 and Go 1.22 if running services without Docker

## 6.2 Boot

```bash
cd backend
cp .env.example .env
# Fill real values in .env

docker compose up --build
```

Check health:

- `http://localhost/health`
- `http://localhost/api/accounts/health/`
- `http://localhost/api/restaurants/health/`
- `http://localhost/api/orders/health/`
- `http://localhost/api/payments/health/`
- `http://localhost/socket.io/` (handshake route)

## 6.3 Useful Commands

```bash
# Start in background
cd backend && docker compose up -d --build

# View logs
cd backend && docker compose logs -f order-service

# Restart one service
cd backend && docker compose restart payment-service

# Tear down
cd backend && docker compose down
```

## 7. Shared Libraries

### Python shared (`backend/shared`)

- `jwt_auth.py`: JWT validation logic
- `service_client.py`: HTTP service calls
- `redis_publisher.py`: Redis publish helpers
- `fraud.py`: payment/referral fraud heuristics
- `geo_utils.py`: geo/distance helpers

### Go shared (`backend/go-shared`)

- `auth/`: JWT middleware
- `config/`: env + DB URL config
- `eta/`: ETA calculator abstraction
- `redispub/`: Redis publish/subscribe helpers
- `geo/`: geo distance helpers
- `tumago/`: TumaGo API client

## 8. Deployment

Current CI/CD workflow:

- GitHub Actions: `.github/workflows/deploy.yml`
- Trigger: push to `main` touching `backend/**`, `webapp/**`, or workflow file
- Steps:
1. Build Docker images via `docker compose build`
2. Tag/push to AWS ECR
3. SSH into EC2 and `docker compose pull && docker compose up -d`

See `deployment.md` for full infra/deployment details.

## 9. Known Constraints and Gaps

- There is no dedicated `driver-service` code in this repo currently, even though some webapp code references `/api/drivers/*` endpoints.
- Backend is mixed-language (Django + Go), so debugging can span multiple runtimes.
- Local behavior can differ from production if `.env` values are incomplete.

## 10. First Week Backend Onboarding Checklist

1. Boot full stack with Docker and verify all health endpoints.
2. Trace one full order from create -> payment -> status update -> realtime event.
3. Read `order-service/main.go` and `realtime-service/main.go` together.
4. Read one Django service end-to-end (`urls.py` -> `views.py` -> `models.py`).
5. Add a small endpoint in a non-critical area and run it through gateway.
6. Review `deployment.md` and CI deploy workflow.
