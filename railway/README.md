# Railway deployment

This directory supports deploying the webapp and all backend services as one
Railway service. Nginx is the only public process: it serves the React SPA at
`/` and forwards API, WebSocket, and media requests on the same Railway URL.

## Railway services

Create one Railway project with:

1. This repository service, deployed from the `railway` branch.
2. A **PostGIS** PostgreSQL service, from Railway's PostGIS template. The
   standard PostgreSQL template does not include PostGIS.
3. A Redis service.

In the application service, add these variables:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
SECRET_KEY=<strong-random-value>
JWT_SECRET_KEY=<strong-random-value>
SERVICE_API_KEY=<strong-random-value>
FIELD_ENCRYPTION_KEY=<Fernet-key>
DEBUG=False
ALLOWED_HOSTS=${{RAILWAY_PUBLIC_DOMAIN}}
CORS_ALLOWED_ORIGINS=https://${{RAILWAY_PUBLIC_DOMAIN}}
PAYNOW_RETURN_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}/payment-return
PAYNOW_RESULT_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}/api/payments/callback/
```

Also add the existing Google Maps, Paynow, TumaGo, SendGrid, and OpenAI values
from `backend/.env.example` where applicable. Set
`VITE_GOOGLE_MAPS_API_KEY` in Railway before deployment if maps are required;
the Dockerfile explicitly exposes it to Vite at build time.

Add a Railway volume mounted at `/data` to retain files uploaded to `/media/`.
The health check is `GET /health`.
