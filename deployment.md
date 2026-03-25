# ZimFeast — Deployment Guide

Three-phase deployment: start cheap on a single EC2, scale to ECS with auto-scaling — **zero application code changes** between phases.

**AWS Region:** `af-south-1` (Cape Town) — lowest latency to Zimbabwe.

---

## Table of Contents

1. [Phase 1 — Launch (single EC2)](#phase-1--launch-0-to-500-users)
2. [Phase 2 — Growth (ECS + ALB)](#phase-2--growth-500-to-5000-users)
3. [Phase 3 — Scale (auto-scaling + DB split)](#phase-3--scale-5000-users)
4. [Change Summary](#change-summary-across-phases)

---

## Prerequisites (All Phases)

- AWS account with `af-south-1` enabled (opt-in region)
- Domain: `zimfeast.com` (registered, DNS accessible)
- Google Maps API key
- Paynow integration credentials (Zimbabwe payment gateway)
- TumaGo Partner API key + secret (delivery partner)
- GitHub repo access
- SendGrid API key (email)

---

## Architecture Overview

ZimFeast runs **7 containers** behind an Nginx gateway. The frontend (React SPA) and all backend APIs are served from `zimfeast.com`:

| Container | Language | Port | Role |
|-----------|----------|------|------|
| api-gateway | Nginx | 80 | Reverse proxy, serves frontend |
| auth-service | Django | 8001 | Users, JWT tokens |
| restaurant-service | Django | 8002 | Restaurants, menus, search (PostGIS) |
| order-service | Go | 8003 | Orders, TumaGo webhooks, fraud detection |
| payment-service | Django | 8005 | Paynow payments, vouchers |
| realtime-service | Go | 3001 | WebSocket (customer order tracking) |
| frontend | Node (build only) | — | React SPA build artifact |

**Database:** PostgreSQL 16 with PostGIS (4 databases: auth, restaurants, orders, payments)
**Cache/PubSub:** Redis 7
**Delivery:** TumaGo Partner API (no driver service — ZimFeast does not manage drivers)

---

## Phase 1 — Launch (0 to ~500 users)

Single EC2 instance + managed RDS (PostGIS) + ElastiCache. ~$35-50/month.

```
        Internet
           │
     ┌─────▼─────┐
     │  Elastic   │
     │    IP      │
     └─────┬─────┘
           │
  ┌────────▼────────────────────────────────────────┐
  │  EC2 t3.small  (2 vCPU, 2GB RAM)               │
  │  docker-compose.yml                              │
  │                                                  │
  │  Nginx Gateway ─┬─ auth-service (Django)        │
  │  + React SPA    ├─ restaurant-service (Django)  │
  │                 ├─ order-service (Go)            │
  │                 ├─ payment-service (Django)      │
  │                 └─ realtime-service (Go)         │
  └──────┬──────────────┬────────────────────────────┘
         │              │
  ┌──────▼──────┐ ┌─────▼──────┐
  │RDS PostGIS  │ │ElastiCache │
  │db.t3.micro  │ │t3.micro    │
  │ 4 databases │ │ Redis 7    │
  └─────────────┘ └────────────┘
```

### Step 1: Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `zimfeast-backend` |
| AMI | Ubuntu 24.04 LTS |
| Instance type | t3.small (2 vCPU, 2GB RAM) |
| Key pair | Create one or proceed without (if using browser SSH) |
| Storage | 25 GB gp3 |

3. **Network Settings** → Default VPC, add security group rules:

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | 0.0.0.0/0 | EC2 Instance Connect |
| HTTP | 80 | 0.0.0.0/0 | Nginx gateway |
| HTTPS | 443 | 0.0.0.0/0 | TLS termination |

4. Click **Launch Instance**
5. Go to **Elastic IPs** → **Allocate** → **Associate** to this instance
6. Note the **Security Group ID** (e.g., `sg-0abc123`) — needed for RDS and ElastiCache

### Step 2: Create RDS PostgreSQL (PostGIS)

1. Go to **AWS Console → RDS → Create database**
2. Configure:

| Setting | Value |
|---------|-------|
| Engine | PostgreSQL 16 |
| Template | Free tier |
| DB instance class | db.t3.micro |
| Storage | 20 GB gp3 |
| DB instance identifier | `zimfeast-db` |
| Master username | `zimfeast` |
| Master password | (generate a strong password, save it) |
| Public access | No |
| VPC | Default VPC (**same as EC2**) |
| VPC security group | Create new → allow port **5432** from EC2 security group |
| Backup retention | 7 days |

3. Wait 5-10 minutes, copy the **Endpoint** (e.g., `zimfeast-db.xxxxx.af-south-1.rds.amazonaws.com`)

### Step 3: Create ElastiCache Redis

1. Go to **AWS Console → ElastiCache → Create cache**
2. Configure:

| Setting | Value |
|---------|-------|
| Cluster engine | Redis |
| Node type | cache.t3.micro |
| Number of replicas | 0 |
| Name | `zimfeast-redis` |
| Subnet group | Default |
| Security group | Create new → allow port **6379** from EC2 security group |

3. Copy the **Primary Endpoint** (e.g., `zimfeast-redis.xxxxx.af-south-1.cache.amazonaws.com`)

### Step 4: Create ECR Repositories

Go to **AWS Console → CloudShell** and run:

```bash
for svc in api-gateway auth-service restaurant-service order-service payment-service realtime-service frontend; do
  aws ecr create-repository --repository-name zimfeast-$svc --region af-south-1
done
```

Copy the registry URI (e.g., `123456789.dkr.ecr.af-south-1.amazonaws.com`)

### Step 5: Connect to EC2

**Option A — Browser SSH (no key pair needed):**

1. Go to **EC2 → Instances** → select `zimfeast-backend`
2. Click **Connect** → **EC2 Instance Connect** → **Connect**

**Option B — Terminal SSH:**

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>
```

### Step 6: Install Docker and AWS CLI

```bash
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER && newgrp docker
sudo apt-get update && sudo apt-get install -y awscli postgresql-client
aws configure  # Enter: Access Key, Secret Key, region af-south-1, output json
```

### Step 7: Set Up Databases

```bash
psql -h <RDS_ENDPOINT> -U zimfeast -d postgres
```

```sql
-- Create per-service databases
CREATE DATABASE zimfeast_auth;
CREATE DATABASE zimfeast_restaurants;
CREATE DATABASE zimfeast_orders;
CREATE DATABASE zimfeast_payments;

-- Enable PostGIS on databases that need spatial queries
\c zimfeast_restaurants
CREATE EXTENSION IF NOT EXISTS postgis;

\c zimfeast_orders
CREATE EXTENSION IF NOT EXISTS postgis;

\q
```

### Step 8: Clone and Configure

```bash
git clone https://github.com/your-org/zimfeastMain.git
cd zimfeastMain/backend

cp .env.example .env
nano .env
```

Fill in the `.env`:

```env
# Production settings
DEBUG=False
SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(50))">
JWT_SECRET_KEY=<generate: same command, different value>
ALLOWED_HOSTS=zimfeast.com,www.zimfeast.com
CORS_ALLOWED_ORIGINS=https://zimfeast.com,https://www.zimfeast.com
DOMAIN=zimfeast.com

# Database (RDS endpoint)
POSTGRES_USER=zimfeast
POSTGRES_PASSWORD=<your-rds-password>
POSTGRES_HOST=<RDS_ENDPOINT>
POSTGRES_PORT=5432
AUTH_DB_NAME=zimfeast_auth
RESTAURANT_DB_NAME=zimfeast_restaurants
ORDER_DB_NAME=zimfeast_orders
PAYMENT_DB_NAME=zimfeast_payments

# Redis (ElastiCache endpoint)
REDIS_URL=redis://<ELASTICACHE_ENDPOINT>:6379

# APIs
GOOGLE_API_KEY=<your-google-maps-key>
VITE_GOOGLE_MAPS_API_KEY=<same-google-maps-key>
SENDGRID_API_KEY=<your-sendgrid-key>

# Paynow (Zimbabwe payments)
PAYNOW_RETURN_URL=https://zimfeast.com/payment-return
PAYNOW_RESULT_URL=https://zimfeast.com/api/payments/callback/
PAYNOW_INTEGRATION_ID=<your-paynow-id>
PAYNOW_INTEGRATION_KEY=<your-paynow-key>

# TumaGo (delivery partner)
TUMAGO_API_URL=https://tumago.co.zw/api/v1
TUMAGO_API_KEY=<your-tumago-key>
TUMAGO_API_SECRET=<your-tumago-secret>

# Inter-service (internal Docker network — no change needed)
AUTH_SERVICE_URL=http://auth-service:8001
RESTAURANT_SERVICE_URL=http://restaurant-service:8002
ORDER_SERVICE_URL=http://order-service:8003
PAYMENT_SERVICE_URL=http://payment-service:8005
REALTIME_SERVICE_URL=http://realtime-service:3001
SERVICE_API_KEY=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(32))">

# Encryption
FIELD_ENCRYPTION_KEY=<generate: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
ADMIN_SETUP_TOKEN=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(32))">
```

### Step 9: Build and Deploy

```bash
cd ~/zimfeastMain/backend
source .env

# Login to ECR
ECR_REGISTRY=<your-ecr-registry>
aws ecr get-login-password --region af-south-1 | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build all services
docker compose build

# Tag and push to ECR
for svc in api-gateway auth-service restaurant-service order-service payment-service realtime-service frontend; do
  docker tag backend-$svc:latest $ECR_REGISTRY/zimfeast-$svc:latest
  docker push $ECR_REGISTRY/zimfeast-$svc:latest
done
```

### Step 10: Run Migrations and Start

```bash
# Run Django migrations
docker compose up migrate-auth migrate-restaurant migrate-payment

# Run Go service migrations (order-service schema)
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d zimfeast_orders -f go-migrations.sql

# Start everything
docker compose up -d
```

### Step 11: Verify

```bash
# Check all services
docker compose ps

# Health check
curl http://localhost/health

# Check specific service logs
docker compose logs -f order-service
```

Expected output from `ps`:

```
NAME                 STATUS
api-gateway          Up
auth-service         Up (healthy)   x2
restaurant-service   Up (healthy)   x2
order-service        Up (healthy)   x3
payment-service      Up (healthy)   x2
realtime-service     Up (healthy)   x2
```

### Step 12: Configure Domain (Route 53)

1. Go to **Route 53 → Hosted zones → Create hosted zone** for `zimfeast.com`
2. Add DNS records:

| Type | Name | Value |
|------|------|-------|
| A | zimfeast.com | Your Elastic IP |
| A | www.zimfeast.com | Your Elastic IP |

3. Update your domain registrar's nameservers to Route 53's NS records

### Step 13: Set Up HTTPS (Let's Encrypt)

SSH into EC2:

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d zimfeast.com -d www.zimfeast.com --email your@email.com --agree-tos
```

Then update Nginx to serve HTTPS. Add to `api-gateway/nginx.conf`:

```nginx
server {
    listen 443 ssl;
    server_name zimfeast.com www.zimfeast.com;

    ssl_certificate /etc/letsencrypt/live/zimfeast.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zimfeast.com/privkey.pem;

    # ... same location blocks as port 80 ...
}

server {
    listen 80;
    server_name zimfeast.com www.zimfeast.com;
    return 301 https://$host$request_uri;
}
```

Mount the cert directory into the api-gateway container in `docker-compose.yml`:

```yaml
  api-gateway:
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

Restart: `docker compose restart api-gateway`

Cert auto-renews via systemd timer. Test: `sudo certbot renew --dry-run`

### Step 14: Set Up CI/CD (GitHub Actions)

Add these GitHub secrets (**Settings → Secrets → Actions**):

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | Your IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Your IAM secret key |
| `ECR_REGISTRY` | `123456789.dkr.ecr.af-south-1.amazonaws.com` |
| `EC2_HOST` | Your Elastic IP |
| `EC2_SSH_KEY` | Contents of your `.pem` file |

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to EC2
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: af-south-1

      - name: Login to ECR
        run: aws ecr get-login-password | docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}

      - name: Build and push
        run: |
          cd backend && docker compose build
          for svc in api-gateway auth-service restaurant-service order-service payment-service realtime-service frontend; do
            docker tag backend-$svc:latest ${{ secrets.ECR_REGISTRY }}/zimfeast-$svc:latest
            docker push ${{ secrets.ECR_REGISTRY }}/zimfeast-$svc:latest
          done

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ~/zimfeastMain/backend
            aws ecr get-login-password --region af-south-1 | docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}
            docker compose pull
            docker compose up -d --remove-orphans
```

Now every push to `main` automatically builds, pushes, and deploys.

### Step 15: Configure Android App

The release build in `customer-app/app/build.gradle` is already configured:

```groovy
buildConfigField "String", "BASE_URL", "\"https://zimfeast.com/\""
buildConfigField "String", "SOCKET_URL", "\"https://zimfeast.com\""
```

Build the release APK:

```bash
cd customer-app && ./gradlew assembleRelease
```

### Phase 1 Common Commands

```bash
cd ~/zimfeastMain/backend

docker compose logs -f                          # All logs
docker compose logs order-service               # Specific service
docker compose ps                               # Service status
docker compose restart auth-service             # Restart one service
docker compose down                             # Stop everything
docker compose up -d                            # Start everything
docker compose run --rm migrate-auth            # Re-run migrations
docker stats --no-stream                        # Memory/CPU usage
```

### Phase 1 Monthly Cost

| Service | Cost |
|---------|------|
| EC2 t3.small | ~$15 |
| RDS db.t3.micro (free tier yr 1) | $0 → $13 |
| ElastiCache cache.t3.micro | ~$13 |
| Elastic IP | $0 (while associated) |
| ECR + Route 53 | ~$2 |
| **Total** | **~$30-43/mo** |

### Phase 1 Troubleshooting

**Services keep restarting:**
```bash
docker compose logs <service-name>
```

**Can't connect to RDS:**
- Check EC2 and RDS are in the same VPC
- Check RDS security group allows port 5432 from EC2's security group

**Can't connect to ElastiCache:**
- Must be in same VPC as EC2
- Security group must allow port 6379

**Out of memory:**
```bash
docker stats --no-stream
free -h
# If needed, upgrade to t3.medium (~$30/mo)
```

**WebSocket not connecting from mobile app:**
- Security group allows port 443
- `CORS_ALLOWED_ORIGINS` includes `https://zimfeast.com`
- SSL cert is valid and not expired

---

## Phase 2 — Growth (~500 to ~5,000 users)

**When to move:** EC2 CPU consistently above 70%, or response times increasing.

Move from docker-compose on EC2 → **ECS with EC2 launch type** behind an **ALB** with SSL.

```
         Internet
            │
      ┌─────▼─────┐
      │    ALB     │  ← SSL termination (ACM cert)
      │            │  ← zimfeast.com → target groups
      └─────┬──────┘
            │
   ┌────────┼────────────────────────────────────┐
   │   ECS Cluster (EC2 launch type)             │
   │   2x t3.small instances                     │
   │                                              │
   │   api-gateway:        2 tasks               │
   │   auth-service:       2 tasks               │
   │   restaurant-service: 2 tasks               │
   │   order-service:      2 tasks               │
   │   payment-service:    2 tasks               │
   │   realtime-service:   2 tasks               │
   └──────┬──────────────┬───────────────────────┘
          │              │
   ┌──────▼──────┐ ┌─────▼──────┐
   │RDS PostGIS  │ │ElastiCache │
   │db.t3.small  │ │t3.small    │
   │(Multi-AZ)   │ │            │
   │ 4 databases │ └────────────┘
   └─────────────┘
```

### Step 1: Create an ALB

1. Go to **EC2 → Load Balancers → Create → Application Load Balancer**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `zimfeast-alb` |
| Scheme | Internet-facing |
| Listeners | HTTP:80, HTTPS:443 |
| Availability Zones | Select at least 2 |

3. **SSL Certificate:** Use **AWS Certificate Manager** → Request a free public cert for `zimfeast.com` and `*.zimfeast.com`
4. Create a **target group** for the api-gateway container (port 80)
5. HTTP:80 listener → redirect all to HTTPS:443
6. Update Route 53: change A records for `zimfeast.com` and `www.zimfeast.com` to ALB DNS (use Alias record)

### Step 2: Create ECS Cluster

1. Go to **ECS → Create Cluster**
2. Select **EC2 Linux + Networking**

| Setting | Value |
|---------|-------|
| Cluster name | `zimfeast` |
| Instance type | t3.small |
| Number of instances | 2 |
| Key pair | Same as Phase 1 |

### Step 3: Create ECS Task Definitions

Create one task definition per service. Each uses the same Docker image from ECR:

| Service | Image | Port | Memory | CPU |
|---------|-------|------|--------|-----|
| api-gateway | `zimfeast-api-gateway:latest` | 80 | 128 MB | 256 |
| auth-service | `zimfeast-auth-service:latest` | 8001 | 512 MB | 512 |
| restaurant-service | `zimfeast-restaurant-service:latest` | 8002 | 512 MB | 512 |
| order-service | `zimfeast-order-service:latest` | 8003 | 128 MB | 256 |
| payment-service | `zimfeast-payment-service:latest` | 8005 | 512 MB | 512 |
| realtime-service | `zimfeast-realtime-service:latest` | 3001 | 256 MB | 256 |

Environment variables are the same as Phase 1's `.env`. For secrets, use **AWS Secrets Manager** and reference with `valueFrom`.

### Step 4: Enable Service Discovery

1. Go to **Cloud Map** → Create private namespace `zimfeast.local`
2. For each ECS service, enable service discovery so containers find each other by name

3. Update service URL environment variables in task definitions:
   ```
   AUTH_SERVICE_URL=http://auth-service.zimfeast.local:8001
   RESTAURANT_SERVICE_URL=http://restaurant-service.zimfeast.local:8002
   ORDER_SERVICE_URL=http://order-service.zimfeast.local:8003
   PAYMENT_SERVICE_URL=http://payment-service.zimfeast.local:8005
   ```

### Step 5: Create ECS Services

| Service | Desired count | Load balancer |
|---------|--------------|---------------|
| api-gateway | 2 | Yes — ALB target group |
| auth-service | 2 | No (internal, via gateway) |
| restaurant-service | 2 | No (internal) |
| order-service | 2 | No (internal) |
| payment-service | 2 | No (internal) |
| realtime-service | 2 | No (internal) |

The ALB only talks to api-gateway. The gateway routes to internal services via service discovery.

### Step 6: Upgrade RDS and ElastiCache

```bash
aws rds modify-db-instance \
  --db-instance-identifier zimfeast-db \
  --db-instance-class db.t3.small \
  --multi-az \
  --apply-immediately

aws elasticache modify-cache-cluster \
  --cache-cluster-id zimfeast-redis \
  --cache-node-type cache.t3.small \
  --apply-immediately
```

### Step 7: Update CI/CD

Replace the SSH deploy step in `.github/workflows/deploy.yml` with:

```yaml
      - name: Deploy to ECS
        run: |
          for svc in api-gateway auth-service restaurant-service order-service payment-service realtime-service; do
            aws ecs update-service --cluster zimfeast --service zimfeast-$svc --force-new-deployment --region af-south-1
          done
```

**This is the ONLY change to CI/CD.** Build-and-push stays identical.

### Step 8: Decommission Phase 1

1. Verify all endpoints work through the ALB
2. Test WebSocket connections via `wss://zimfeast.com/socket.io/`
3. Test Paynow callbacks reach `https://zimfeast.com/api/payments/callback/`
4. Test TumaGo webhooks reach `https://zimfeast.com/api/webhooks/tumago/`
5. Terminate the Phase 1 EC2 instance
6. Release the Elastic IP

### Phase 2 What Changed

| Component | Phase 1 | Phase 2 | Code change? |
|-----------|---------|---------|--------------|
| Compute | 1 EC2 + docker-compose | ECS cluster + task defs | **No** — same Docker images |
| Load balancer | None (direct IP) | ALB with ACM SSL | **No** |
| SSL | Let's Encrypt on EC2 | ACM (managed by AWS) | **No** |
| DB | RDS micro | RDS small, Multi-AZ | **No** — same connection strings |
| Redis | ElastiCache micro | ElastiCache small | **No** |
| Service discovery | Docker network | Cloud Map | **Env var update only** |
| CI/CD | SSH + docker compose pull | `aws ecs update-service` | **1 step replaced** |

### Phase 2 Monthly Cost

| Service | Cost |
|---------|------|
| EC2 2x t3.small (ECS) | ~$30 |
| ALB | ~$18 |
| RDS db.t3.small (Multi-AZ) | ~$26 |
| ElastiCache t3.small | ~$25 |
| ACM + Route 53 + ECR | ~$3 |
| **Total** | **~$102/mo** |

---

## Phase 3 — Scale (~5,000+ users)

**When to move:** Traffic spikes, ECS tasks hitting CPU limits, need automatic scaling.

### Step 1: Enable ECS Service Auto Scaling

Register each service as a scalable target and add CPU-based scaling:

```bash
for svc in api-gateway auth-service restaurant-service order-service payment-service realtime-service; do
  aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id service/zimfeast/zimfeast-$svc \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 2 --max-capacity 10

  aws application-autoscaling put-scaling-policy \
    --service-namespace ecs \
    --resource-id service/zimfeast/zimfeast-$svc \
    --scalable-dimension ecs:service:DesiredCount \
    --policy-name ${svc}-cpu-scaling \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration '{
      "TargetValue": 70.0,
      "PredefinedMetricSpecification": {
        "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
      },
      "ScaleInCooldown": 300,
      "ScaleOutCooldown": 60
    }'
done
```

Recommended scaling limits:

| Service | Min | Max | Why |
|---------|-----|-----|-----|
| api-gateway | 2 | 6 | Handles all inbound traffic |
| auth-service | 2 | 6 | Login spikes at mealtimes |
| restaurant-service | 2 | 8 | Search + menu browsing is heavy |
| order-service | 2 | 10 | Highest throughput: orders + TumaGo webhooks |
| payment-service | 2 | 6 | Payment callbacks are bursty |
| realtime-service | 2 | 10 | WebSocket connections scale linearly |

### Step 2: EC2 Auto Scaling Group for ECS

So ECS has room to place new tasks when it scales out:

1. **EC2 → Launch Templates → Create**
   - AMI: ECS-optimized Amazon Linux 2
   - Instance type: t3.small
   - User data: `#!/bin/bash\necho ECS_CLUSTER=zimfeast >> /etc/ecs/ecs.config`

2. **EC2 → Auto Scaling Groups → Create**

| Setting | Value |
|---------|-------|
| Launch template | The one you created |
| Min capacity | 2 |
| Max capacity | 8 |
| Target tracking | Average CPU 70% |

3. **ECS → Cluster → Capacity Providers** → link the ASG

### Step 3: Split the Database (when needed)

When one database's queries start impacting others:

```
 BEFORE (Phase 1-2):                    AFTER (Phase 3):

 ┌─────────────────────┐    ┌──────────────────┐  ┌──────────────────┐
 │  1 RDS Instance      │    │  RDS Instance 1   │  │  RDS Instance 2   │
 │                      │    │  zimfeast_auth    │  │  zimfeast_orders  │
 │  zimfeast_auth       │    │  zimfeast_payments│  │  (PostGIS)        │
 │  zimfeast_restaurants│ →  │  (db.t3.small)    │  │  (db.t3.small)    │
 │  zimfeast_orders     │    └──────────────────┘  └──────────────────┘
 │  zimfeast_payments   │    ┌──────────────────┐
 └─────────────────────┘    │  RDS Instance 3   │
                             │  zimfeast_        │
                             │  restaurants      │
                             │  (PostGIS)        │
                             │  (db.t3.small)    │
                             └──────────────────┘
```

**How to split (zero code changes):**

1. Create a **snapshot** of the current RDS instance
2. **Restore** snapshot to new RDS instances
3. On each new instance, **drop the databases it doesn't own**:
   ```sql
   -- On zimfeast-db-orders: keep only zimfeast_orders
   DROP DATABASE zimfeast_auth;
   DROP DATABASE zimfeast_restaurants;
   DROP DATABASE zimfeast_payments;
   ```
4. On the original, **drop the databases that moved**:
   ```sql
   DROP DATABASE zimfeast_orders;
   DROP DATABASE zimfeast_restaurants;
   ```
5. **Update `POSTGRES_HOST`** in the affected ECS task definitions to point to the new RDS endpoint
6. **Redeploy** affected services:
   ```bash
   aws ecs update-service --cluster zimfeast --service zimfeast-order-service --force-new-deployment
   aws ecs update-service --cluster zimfeast --service zimfeast-restaurant-service --force-new-deployment
   ```

No code changes — each service already connects to its own named database. The only change is the host in the environment variable.

### Phase 3 Architecture

```
              Internet
                 │
           ┌─────▼─────┐
           │    ALB     │  ← ACM cert, HTTP→HTTPS redirect
           └─────┬──────┘
                 │
  ┌──────────────┼────────────────────────────────────┐
  │  ECS Cluster + EC2 Auto Scaling Group             │
  │  (2-8 instances, auto-managed)                    │
  │                                                    │
  │  api-gateway:         2-6 tasks  (auto-scaled)    │
  │  auth-service:        2-6 tasks  (auto-scaled)    │
  │  restaurant-service:  2-8 tasks  (auto-scaled)    │
  │  order-service:       2-10 tasks (auto-scaled)    │
  │  payment-service:     2-6 tasks  (auto-scaled)    │
  │  realtime-service:    2-10 tasks (auto-scaled)    │
  └───────┬──────────┬──────────┬─────────────────────┘
          │          │          │
   ┌──────▼───┐ ┌───▼────┐ ┌──▼──────────┐
   │RDS       │ │RDS     │ │ElastiCache  │
   │auth +    │ │orders  │ │Redis cluster│
   │payments  │ │(t3.sm) │ │(2 nodes)    │
   │(t3.sm)   │ └────────┘ └─────────────┘
   └──────────┘
         │
   ┌─────▼────┐
   │RDS       │
   │restaurants│
   │(PostGIS  │
   │ t3.sm)   │
   └──────────┘
```

### Phase 3 Monthly Cost

| Service | Cost |
|---------|------|
| EC2 2-8x t3.small (ECS ASG) | ~$30-120 |
| ALB | ~$25 |
| RDS 3x db.t3.small | ~$78 |
| ElastiCache t3.small (2 nodes) | ~$50 |
| ECR + Route 53 + data transfer | ~$10 |
| **Total** | **~$193-303/mo** |

---

## Change Summary Across Phases

| | Phase 1 → Phase 2 | Phase 2 → Phase 3 |
|---|---|---|
| **Docker images** | No change | No change |
| **Application code** | No change | No change |
| **Database schema** | No change | No change |
| **Connection strings** | Service discovery update | Update `POSTGRES_HOST` per service (split DB) |
| **CI/CD** | Replace SSH step with `ecs update-service` | No change |
| **Infrastructure** | Create ECS cluster + ALB + task defs | Add auto-scaling policies + split RDS |

**Zero application code changes across all three phases.**

---

## URL Routing Reference

All traffic goes through `zimfeast.com`. The Nginx api-gateway routes:

| URL Pattern | Service | Purpose |
|-------------|---------|---------|
| `zimfeast.com/` | Nginx (static) | React SPA frontend |
| `zimfeast.com/assets/*` | Nginx (static) | Frontend JS, CSS (1yr cache) |
| `zimfeast.com/media/*` | Nginx (static) | Uploaded images (7d cache) |
| `zimfeast.com/api/accounts/*` | auth-service | Login, register, JWT tokens |
| `zimfeast.com/api/restaurants/*` | restaurant-service | Menus, search, reviews |
| `zimfeast.com/api/orders/*` | order-service | Create/track orders |
| `zimfeast.com/api/payments/*` | payment-service | Paynow, vouchers, promos |
| `zimfeast.com/api/webhooks/tumago/` | order-service | TumaGo delivery webhooks |
| `zimfeast.com/socket.io/*` | realtime-service | WebSocket (customer tracking) |
| `zimfeast.com/ws/restaurant/*` | restaurant-service | WebSocket (restaurant dashboard) |
