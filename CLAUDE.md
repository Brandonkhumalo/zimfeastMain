# ZimFeast - Food Delivery Platform

## Project Overview

ZimFeast is a full-stack food delivery platform for the Zimbabwean market. It connects customers, restaurants, and drivers through a web app with real-time order tracking. Payment processing uses Paynow (Zimbabwe-specific gateway).

## Architecture

**Microservices** - The backend is split into 5 independent Django services + 1 Node.js real-time service, orchestrated with Docker Compose behind an Nginx API gateway.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, Radix UI / shadcn |
| Data fetching | TanStack Query (React Query) |
| Backend | 5 Django 4.2 microservices (DRF, Gunicorn/Daphne) |
| Real-time | Node.js + Socket.IO + Redis Pub/Sub |
| Database | PostgreSQL (1 database per service) |
| Cache/PubSub | Redis 7 |
| Auth | Stateless JWT (shared secret across services) |
| API Gateway | Nginx (routes `/api/*` to correct service) |
| Maps | Google Maps API (frontend + backend) |
| Payments | Paynow (Zimbabwe payment gateway) |
| Containers | Docker + Docker Compose (auto-scaling) |
| Mobile | Android apps (Kotlin/Java) in `driver-app/` and `zimfeast-customer/` |

## Project Structure

```
services/                    # Microservices (Docker)
  shared/                    #   Shared utilities (JWT auth, Redis pub, geo, service client)
  auth-service/              #   User auth, registration, profiles (port 8001)
  restaurant-service/        #   Restaurant profiles, menus, dashboard (port 8002)
  order-service/             #   Order lifecycle (port 8003)
  driver-service/            #   Driver management, location, ratings (port 8004)
  payment-service/           #   Paynow + voucher payments (port 8005)
  realtime-service/          #   Socket.IO Dockerfile (port 3001)
  api-gateway/               #   Nginx reverse proxy config (port 80)
  frontend/                  #   Frontend build Dockerfile
  init-db.sql                #   Creates per-service databases

src/                         # React frontend (SPA)
  components/                #   Reusable UI components (Cart, Navbar, ui/)
  hooks/                     #   Custom hooks (useAuth, useOrderSocket, useWebSocket)
  lib/                       #   Utilities (queryClient, authUtils, withRoleGuard)
  pages/                     #   Pages organized by role

real-time-server/            # Node.js Socket.IO server source
shared/                      # Shared TypeScript utilities
driver-app/                  # Android driver app (Kotlin)
zimfeast-customer/           # Android customer app (Kotlin)

docker-compose.yml           # Full stack orchestration
.env                         # All environment variables
scripts/                     # Docker start/scale scripts
```

## Essential Commands

### Docker (Production - Recommended)
```bash
bash scripts/docker-start.sh           # Build & start everything
docker compose up -d                    # Start all services
docker compose logs -f order-service    # Tail logs for a service
bash scripts/docker-scale.sh order-service 5  # Scale order service to 5 replicas
docker compose down                     # Stop everything
```

### Local Development (Individual Services)
```bash
# Each service can run independently for development
cd services/auth-service && python manage.py runserver 8001
cd services/restaurant-service && python manage.py runserver 8002
cd services/order-service && python manage.py runserver 8003
cd services/driver-service && python manage.py runserver 8004
cd services/payment-service && python manage.py runserver 8005
```

### Frontend
```bash
npm run dev              # Start Vite dev server (port 5000)
npm run build            # Production build -> dist/public
npm run check            # TypeScript type checking
```

### Real-Time Server
```bash
cd real-time-server
npm install
npm start                # Port 3001
```

## Environment Variables

All variables are in [.env](.env). Key sections:
- **Database**: `POSTGRES_*`, per-service `*_DB_NAME`
- **Redis**: `REDIS_URL`
- **APIs**: `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `SENDGRID_API_KEY`
- **Paynow**: `PAYNOW_*`
- **Inter-service**: `*_SERVICE_URL`, `SERVICE_API_KEY`
- **Frontend**: `VITE_*`

## Microservices Architecture

| Service | Port | Owns | Communicates via |
|---------|------|------|-----------------|
| auth-service | 8001 | Users, Addresses, Tokens | JWT tokens (stateless) |
| restaurant-service | 8002 | Restaurants, Menus, Dashboard | Redis pub/sub, WebSocket |
| order-service | 8003 | Orders, OrderItems | Redis pub/sub, REST |
| driver-service | 8004 | Drivers, Finance, Ratings | Redis pub/sub, WebSocket |
| payment-service | 8005 | Payments, Vouchers | REST to order-service |
| realtime-service | 3001 | None (stateless) | Redis sub, Socket.IO |
| api-gateway | 80 | None | Reverse proxy |

### Inter-Service Communication
- **Sync**: REST calls via `shared/service_client.py` with `X-Service-Key` header
- **Async**: Redis pub/sub via `shared/redis_publisher.py`
- **Auth**: Stateless JWT - each service validates tokens independently using `shared/jwt_auth.py`
- **Data refs**: Services reference entities in other services by UUID (no cross-service FKs)

## Key Entry Points

- Frontend routing: [src/App.tsx](src/App.tsx)
- API Gateway config: [services/api-gateway/nginx.conf](services/api-gateway/nginx.conf)
- Docker orchestration: [docker-compose.yml](docker-compose.yml)
- Shared JWT auth: [services/shared/jwt_auth.py](services/shared/jwt_auth.py)
- Shared settings: [services/shared/base_settings.py](services/shared/base_settings.py)
- Real-time server: [real-time-server/src/index.js](real-time-server/src/index.js)

## Additional Documentation

| Document | When to consult |
|----------|----------------|
| [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) | Architecture, auth flow, API conventions, real-time patterns |
| [DOCUMENTATION.md](DOCUMENTATION.md) | Full project documentation and feature specs |
| [LOCAL_SETUP.md](LOCAL_SETUP.md) | Detailed local development setup instructions |

## Quick Reference

- **User roles**: customer, restaurant, driver, admin
- **Order flow**: pending_payment -> paid -> preparing -> ready -> collected -> assigned -> out_for_delivery -> delivered
- **API pattern**: `/api/{service}/{action}/` with trailing slash, JWT Bearer token auth
- **API Gateway**: Nginx on port 80 routes to the correct microservice
- **Scaling**: `docker compose up --scale order-service=5` to scale any service
- **Frontend data**: TanStack Query with query keys matching API paths
- **UI components**: shadcn/ui in `src/components/ui/`
- **Path aliases**: `@/` -> `src/`, `@shared/` -> `shared/`
