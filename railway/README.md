# Railway deployment

This directory supports deploying the webapp and all backend services as one
Railway service. Nginx is the only public process: it serves the React SPA at
`/` and forwards API, WebSocket, and media requests on the same Railway URL.

## What Railway creates vs. what the Dockerfile creates

The Dockerfile creates and starts the frontend, Nginx, auth, restaurant,
orders, payments, and realtime services. It also waits for PostgreSQL and
Redis, enables `postgis` and `pgcrypto`, installs the Go order schema, and runs
all Django migrations automatically on every deploy.

Railway must provide the persistent infrastructure. Do **not** create a local
Postgres or Redis process inside this application service.

## Railway services

Create one Railway project with:

1. This repository service, deployed from the `railway` branch.
2. A **PostGIS** PostgreSQL service, from Railway's PostGIS template. The
   standard PostgreSQL template does not include PostGIS.
3. A Redis service.
4. Optional but strongly recommended: a Railway volume mounted at `/data` for
   uploaded images served under `/media/`.

Generate secrets locally; do not commit a `.env` file. In the Railway
application service, add these required variables:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
SECRET_KEY=<strong-random-value>
JWT_SECRET_KEY=<strong-random-value>
SERVICE_API_KEY=<strong-random-value>
FIELD_ENCRYPTION_KEY=<Fernet-key>
ADMIN_SETUP_TOKEN=<strong-random-value>
DEBUG=False
ALLOWED_HOSTS=zimfeastmain-production.up.railway.app
CORS_ALLOWED_ORIGINS=https://zimfeastmain-production.up.railway.app
PAYNOW_RETURN_URL=https://zimfeastmain-production.up.railway.app/payment-return
PAYNOW_RESULT_URL=https://zimfeastmain-production.up.railway.app/api/payments/callback/
```

Set these as well when their feature is enabled:

| Feature | Variables |
| --- | --- |
| Google Maps | `GOOGLE_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY` |
| Paynow payments | `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY`, `PAYNOW_SANDBOX_URL` when applicable |
| TumaGo delivery | `TUMAGO_API_URL`, `TUMAGO_API_KEY`, `TUMAGO_API_SECRET` |
| Email | `SENDGRID_API_KEY` |
| AI search | `OPENAI_API_KEY` |

`VITE_GOOGLE_MAPS_API_KEY` is embedded into the frontend during the Docker
build. Add or change it before a deployment, then redeploy; changing it at
runtime cannot update an already-built SPA.

You do not need `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`AUTH_DB_NAME`, `RESTAURANT_DB_NAME`, `ORDER_DB_NAME`, or `PAYMENT_DB_NAME` on
Railway: `DATABASE_URL` is the only database connection variable for this
deployment. The health check is `GET /health`.

## Deployment checklist

1. Push the `railway` branch and create a Railway service from it.
2. Add the PostGIS and Redis services, then paste the reference variables shown
   above into the application service.
3. Generate a public domain for the application service; the one URL serves
   both the web UI and backend.
4. Add the `/data` volume if uploads must survive redeployments.
5. Deploy. Startup logs should show migrations completing, then the services
   listening behind Nginx. Open `https://<your-domain>/health` to verify it.
