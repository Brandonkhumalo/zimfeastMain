# ZimFeast

ZimFeast is a multi-client food delivery platform for the Zimbabwe market with:

- React web platform (`webapp`) for customers, restaurants, drivers, corporate users, and admins
- Microservice backend (`backend`) using Django + Go + Redis + PostgreSQL + Nginx
- Native Android customer app (`customer-app`)

This README is the onboarding index. Deep technical docs are split by area.

## Start Here (New Team Members)

1. Read [BackendDocumentation.md](./BackendDocumentation.md)
2. Read [webappDocumentation.md](./webappDocumentation.md)
3. Read [mobileDocumentation.md](./mobileDocumentation.md)
4. Review [deployment.md](./deployment.md) for infrastructure/deployment workflow
5. Review [MVP.md](./MVP.md) for product scope and behavior expectations
6. For the single-service Railway deployment, use [railway/README.md](./railway/README.md)

## Repo Structure

```text
zimfeastMain/
├── backend/              # Microservices, API gateway, infra-facing runtime config
├── webapp/               # React + TypeScript SPA
├── customer-app/         # Android app (Java)
├── infra/                # Terraform infrastructure
├── deployment.md         # Deployment runbook
├── MVP.md                # Product and feature scope
└── README.md             # This file
```

## Fast Local Setup

### Backend stack (recommended)

```bash
cd backend
cp .env.example .env
# fill required secrets and API keys in .env

docker compose up --build
```

Primary local endpoints:

- API Gateway: `http://localhost:80`
- Auth: `http://localhost:8001`
- Restaurant: `http://localhost:8002`
- Order: `http://localhost:8003`
- Payment: `http://localhost:8005`
- Realtime: `http://localhost:3001`

### Webapp

```bash
cd webapp
npm ci
npm run dev
```

- Dev server: `http://localhost:5000`
- Proxies API calls to backend (`/api`, `/socket.io`, `/media`)

### Android app

Open `customer-app` in Android Studio and run `app` (debug build uses `http://10.0.2.2/`).

## Documentation Map

- [BackendDocumentation.md](./BackendDocumentation.md): services, APIs, data flow, pub/sub, local/dev/prod operations
- [webappDocumentation.md](./webappDocumentation.md): routing, state, API layer, sockets, feature modules, contributor workflow
- [mobileDocumentation.md](./mobileDocumentation.md): app architecture, screens, build variants, API integration, release notes

## Notes

- `.tools/` is intentionally ignored and should not be committed.
- If you are onboarding for a specific area, start with the corresponding doc above and then review service/page source directly.
