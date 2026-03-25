# ZimFeast - Food Delivery Platform

## Project Overview

ZimFeast is a full-stack food delivery platform for the Zimbabwean market. It connects customers and restaurants through a web app with real-time order tracking. Delivery is handled by TumaGo (third-party delivery partner API) — ZimFeast does not manage drivers directly. Payment processing uses Paynow (Zimbabwe-specific gateway).

## Architecture

**Microservices** - The backend is split into 3 Django services + 2 Go services, orchestrated with Docker Compose behind an Nginx API gateway. Driver delivery is outsourced to TumaGo via their Partner API.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, Radix UI / shadcn |
| Data fetching | TanStack Query (React Query) |
| Backend (Django) | 3 Django 4.2 microservices: auth, restaurant, payment (DRF, Gunicorn/Daphne) |
| Backend (Go) | 2 Go microservices: order, realtime |
| Delivery | TumaGo Partner API (driver assignment, tracking, webhooks) |
| Database | PostgreSQL (1 database per service) |
| Cache/PubSub | Redis 7 |
| Auth | Stateless JWT (shared secret across services) |
| API Gateway | Nginx (routes `/api/*` to correct service) |
| Maps | Google Maps API (frontend + backend) |
| Payments | Paynow (Zimbabwe payment gateway) |
| Containers | Docker + Docker Compose (auto-scaling) |
| Mobile | Android customer app (Kotlin/Java) in `customer-app/` |

## Project Structure

```
backend/                     # Microservices (Docker)
  shared/                    #   Shared Python utilities (JWT auth, Redis pub, geo, service client)
  go-shared/                 #   Shared Go module (for Go services)
  go-shared/tumago/          #   TumaGo Partner API client (delivery requests, webhooks)
  auth-service/              #   User auth, registration, profiles - Django (port 8001)
  restaurant-service/        #   Restaurant profiles, menus, dashboard - Django (port 8002)
  order-service/             #   Order lifecycle + TumaGo integration - Go (port 8003)
  payment-service/           #   Paynow + voucher payments - Django (port 8005)
  realtime-service/          #   WebSocket/real-time (customer-only) - Go (port 3001)
  api-gateway/               #   Nginx reverse proxy config (port 80)
  frontend/                  #   Frontend build Dockerfile
  init-db.sql                #   Creates per-service databases
  docker-compose.yml         #   Full stack orchestration
  .env                       #   All environment variables

webapp/                      # React frontend (self-contained SPA)
  components/                #   Reusable UI components (Cart, Navbar, ui/)
  hooks/                     #   Custom hooks (useAuth, useOrderSocket, useWebSocket)
  lib/                       #   Utilities (queryClient, authUtils, withRoleGuard)
  pages/                     #   Pages organized by role
  shared/                    #   Shared TypeScript utilities
  public/                    #   Static assets
  package.json               #   npm dependencies
  vite.config.ts             #   Vite build config
  tsconfig.json              #   TypeScript config
  index.html                 #   Entry point

customer-app/                # Android customer app (Kotlin)
infra/                       # Terraform AWS infrastructure + scripts
```

## Essential Commands

### Docker (Production - Recommended)
```bash
bash infra/scripts/docker-start.sh                   # Build & start everything
cd backend && docker compose up -d                    # Start all services
cd backend && docker compose logs -f order-service    # Tail logs for a service
bash infra/scripts/docker-scale.sh order-service 5    # Scale order service to 5 replicas
cd backend && docker compose down                     # Stop everything
```

### Local Development (Individual Services)
```bash
# Django services can run independently for development
cd backend/auth-service && python manage.py runserver 8001
cd backend/restaurant-service && python manage.py runserver 8002
cd backend/payment-service && python manage.py runserver 8005

# Go services
cd backend/order-service && go run .        # Port 8003
cd backend/realtime-service && go run .     # Port 3001
```

### Frontend
```bash
cd webapp
npm install              # Install dependencies (first time)
npm run dev              # Start Vite dev server (port 5000)
npm run build            # Production build -> dist/public
npm run check            # TypeScript type checking
```

## Environment Variables

All variables are in [backend/.env](backend/.env). Key sections:
- **Database**: `POSTGRES_*`, per-service `*_DB_NAME`
- **Redis**: `REDIS_URL`
- **APIs**: `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `SENDGRID_API_KEY`
- **Paynow**: `PAYNOW_*`
- **TumaGo**: `TUMAGO_API_URL`, `TUMAGO_API_KEY`, `TUMAGO_API_SECRET`
- **Inter-service**: `*_SERVICE_URL`, `SERVICE_API_KEY`
- **Frontend**: `VITE_*`

## Microservices Architecture

| Service | Port | Language | Owns | Communicates via |
|---------|------|----------|------|-----------------|
| auth-service | 8001 | Django | Users, Addresses, Tokens | JWT tokens (stateless) |
| restaurant-service | 8002 | Django | Restaurants, Menus, Dashboard | Redis pub/sub, WebSocket |
| order-service | 8003 | Go | Orders, OrderItems, TumaGo webhooks | Redis pub/sub, REST, TumaGo API |
| payment-service | 8005 | Django | Payments, Vouchers | REST to order-service |
| realtime-service | 3001 | Go | None (stateless, customer-only) | Redis sub, WebSocket |
| api-gateway | 80 | Nginx | None | Reverse proxy |

### Inter-Service Communication
- **Sync (Django)**: REST calls via `backend/shared/service_client.py` with `X-Service-Key` header
- **Sync (Go)**: REST calls via `backend/go-shared/` with `X-Service-Key` header
- **Async**: Redis pub/sub (Django via `backend/shared/redis_publisher.py`, Go via `backend/go-shared/`)
- **Auth**: Stateless JWT - each service validates tokens independently (Django: `backend/shared/jwt_auth.py`, Go: `backend/go-shared/`)
- **Data refs**: Services reference entities in other services by UUID (no cross-service FKs)
- **TumaGo**: order-service calls TumaGo Partner API via `backend/go-shared/tumago/client.go`; TumaGo sends webhooks to `POST /api/webhooks/tumago/` (HMAC-SHA256 signed)

## Key Entry Points

- Frontend routing: [webapp/App.tsx](webapp/App.tsx)
- API Gateway config: [backend/api-gateway/nginx.conf](backend/api-gateway/nginx.conf)
- Docker orchestration: [backend/docker-compose.yml](backend/docker-compose.yml)
- Shared JWT auth (Django): [backend/shared/jwt_auth.py](backend/shared/jwt_auth.py)
- Shared settings (Django): [backend/shared/base_settings.py](backend/shared/base_settings.py)
- Go shared module: [backend/go-shared/](backend/go-shared/)
- TumaGo API client: [backend/go-shared/tumago/client.go](backend/go-shared/tumago/client.go)
- TumaGo webhook handler: [backend/order-service/internal/handlers/webhook.go](backend/order-service/internal/handlers/webhook.go)
- Real-time service: [backend/realtime-service/](backend/realtime-service/)

## Additional Documentation

| Document | When to consult |
|----------|----------------|
| [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) | Architecture, auth flow, API conventions, real-time patterns |
| [DOCUMENTATION.md](DOCUMENTATION.md) | Full project documentation and feature specs |
| [deployment.md](deployment.md) | AWS deployment guide (phased scaling, Terraform, CI/CD) |

## Quick Reference

- **User roles**: customer, restaurant, driver, admin
- **Order flow**: pending_payment -> paid -> preparing -> ready -> awaiting_driver -> assigned -> out_for_delivery -> delivered
- **Delivery flow**: When order hits `ready`, order-service calls TumaGo API → `awaiting_driver`. All subsequent transitions (`assigned`, `out_for_delivery`, `delivered`) are driven by TumaGo webhooks.
- **API pattern**: `/api/{service}/{action}/` with trailing slash, JWT Bearer token auth
- **API Gateway**: Nginx on port 80 routes to the correct microservice
- **Scaling**: `cd backend && docker compose up --scale order-service=5` to scale any service
- **Frontend data**: TanStack Query with query keys matching API paths
- **UI components**: shadcn/ui in `webapp/components/ui/`
- **Path aliases**: `@/` -> `webapp/`, `@shared/` -> `shared/`
