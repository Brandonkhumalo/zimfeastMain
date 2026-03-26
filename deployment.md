# ZimFeast — Deployment Guide

Three-phase deployment: start cheap on a single EC2, scale to ECS with auto-scaling — **zero application code changes** between phases.

**AWS Region:** `af-south-1` (Cape Town) — lowest latency to Zimbabwe.

---

## Table of Contents

1. [Phase 1 — Launch (single EC2)](#phase-1--launch-0-to-500-users)
2. [Phase 2 — Growth (ECS + ALB)](#phase-2--growth-500-to-5000-users)
3. [Phase 3 — Scale (auto-scaling + DB split)](#phase-3--scale-5000-users)
4. [Change Summary](#change-summary-across-phases)
5. [Credentials Reference](#credentials-reference)

---

## Prerequisites (All Phases)

- AWS account with `af-south-1` enabled (opt-in region — go to **Account Settings → Regions** to enable)
- Domain: `zimfeast.com` (registered, DNS accessible)
- Google Maps API key (from Google Cloud Console)
- Paynow integration credentials (from paynow.co.zw merchant dashboard)
- TumaGo Partner API key + secret (from TumaGo partner dashboard)
- GitHub repo access
- SendGrid API key (from sendgrid.com)

> **Important:** Every credential you create during deployment must be saved in `backend/.env`. See the [Credentials Reference](#credentials-reference) at the bottom for the full mapping of where to get each credential and which `.env` variable it goes into.

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
| Key pair | Create one (download the `.pem` file and save it securely — you need this for SSH and CI/CD) or proceed without (if using browser SSH only) |
| Storage | 25 GB gp3 |

3. **Network Settings** — VPC and Security Group:

   **Which VPC to use:** Use the **Default VPC**. Every AWS region comes with a Default VPC already created. You do NOT need to create a new VPC for Phase 1.
   - In the "Network settings" section, click **Edit**
   - **VPC**: select the one labeled `default` (there's usually only one)
   - **Subnet**: select `No preference` (AWS picks an availability zone for you)
   - **Auto-assign public IP**: `Enable`

   **Security Group:** Select **Create security group** and name it `zimfeast-ec2-sg`. Add these inbound rules:

   | Type | Port | Source | Purpose |
   |------|------|--------|---------|
   | SSH | 22 | 0.0.0.0/0 | EC2 Instance Connect / SSH access |
   | HTTP | 80 | 0.0.0.0/0 | Nginx gateway (web + API traffic) |
   | HTTPS | 443 | 0.0.0.0/0 | TLS termination (Let's Encrypt) |

   > The Default VPC already has an internet gateway and route table configured, so your instance will have internet access out of the box. RDS and ElastiCache will go in this same VPC so they can talk to EC2 on the private network.

4. Click **Launch Instance**

5. **Allocate an Elastic IP:**
   - Go to **EC2 → Elastic IPs** → **Allocate Elastic IP address** → **Allocate**
   - Select the new IP → **Actions → Associate Elastic IP address**
   - Choose your `zimfeast-backend` instance → **Associate**
   - **Save this IP** — it's your server's permanent public address and goes into Route 53 DNS records later

6. **Note the Security Group ID:**
   - Go to **EC2 → Instances** → click `zimfeast-backend` → scroll to **Security** tab
   - Copy the **Security group ID** (e.g., `sg-0abc123def456`) — you need this when creating RDS and ElastiCache security groups so they only accept connections from your EC2

### Step 2: Create RDS PostgreSQL (PostGIS)

1. Go to **AWS Console → RDS → Create database**
2. Configure:

| Setting | Value |
|---------|-------|
| Creation method | Standard create |
| Engine | PostgreSQL 16 |
| Template | **Free tier** (gives you 12 months free on db.t3.micro) |
| DB instance class | db.t3.micro |
| Storage | 20 GB gp3 |
| DB instance identifier | `zimfeast-db` |
| Master username | `zimfeast` |
| Master password | Generate a strong password — **save this immediately, you need it for `.env` → `POSTGRES_PASSWORD`** |
| Public access | **No** (only EC2 connects to it, not the internet) |
| VPC | **Default VPC** (same VPC as your EC2 instance — this is critical) |
| Backup retention | 7 days |

3. **Security Group for RDS:**
   - In the "Connectivity" section, under "VPC security group", select **Create new**
   - Name it `zimfeast-rds-sg`
   - After the database is created, go to **EC2 → Security Groups** → find `zimfeast-rds-sg` → **Edit inbound rules**:

   | Type | Port | Source | Purpose |
   |------|------|--------|---------|
   | PostgreSQL | 5432 | **Custom** → paste your EC2 security group ID (`sg-0abc123...`) | Only allow EC2 to connect to the database |

   > Do NOT use `0.0.0.0/0` as the source — that would expose your database to the entire internet. By using the EC2 security group ID as the source, only your EC2 instance can reach the database.

4. Wait 5-10 minutes for the database to be created
5. Go to **RDS → Databases → zimfeast-db** and copy the **Endpoint** (e.g., `zimfeast-db.xxxxx.af-south-1.rds.amazonaws.com`) — this goes into `.env` → `POSTGRES_HOST`

### Step 3: Create ElastiCache Redis

1. Go to **AWS Console → ElastiCache → Create cache**
2. Configure:

| Setting | Value |
|---------|-------|
| Cluster engine | Redis |
| Node type | cache.t3.micro |
| Number of replicas | 0 |
| Name | `zimfeast-redis` |
| Subnet group | **Default** (same VPC as EC2 and RDS) |

3. **Security Group for ElastiCache:**
   - In the "Security" section, select **Create new** security group or manage after creation
   - Name it `zimfeast-redis-sg`
   - Go to **EC2 → Security Groups** → find `zimfeast-redis-sg` → **Edit inbound rules**:

   | Type | Port | Source | Purpose |
   |------|------|--------|---------|
   | Custom TCP | 6379 | **Custom** → paste your EC2 security group ID (`sg-0abc123...`) | Only allow EC2 to connect to Redis |

   > Same principle as RDS — never use `0.0.0.0/0`. Only your EC2 instance needs Redis access.

4. Copy the **Primary Endpoint** (e.g., `zimfeast-redis.xxxxx.af-south-1.cache.amazonaws.com`) — this goes into `.env` → `REDIS_URL` as `redis://<endpoint>:6379`

> **VPC Summary:** At this point you have 3 resources all in the **Default VPC**: EC2, RDS, and ElastiCache. They communicate over the private network using security group rules. Only EC2 is exposed to the internet (ports 80/443). RDS and ElastiCache are private.

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

Fill in the `.env` (see [Credentials Reference](#credentials-reference) for where to get each value):

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

---

## Credentials Reference

Every credential you create during setup must go into `backend/.env`. This table maps each credential to where you obtain it and which `.env` variable(s) it maps to.

### Credentials You Generate Yourself

These are secrets you generate locally. Run the commands on your machine or on the EC2 instance.

| `.env` Variable | How to Generate | Notes |
|-----------------|----------------|-------|
| `SECRET_KEY` | `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` | Django secret key. Must be unique, never reuse. |
| `JWT_SECRET_KEY` | `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` | Shared JWT signing key. Generate a **different** value from SECRET_KEY. |
| `SERVICE_API_KEY` | `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` | Used for inter-service REST calls (X-Service-Key header). |
| `FIELD_ENCRYPTION_KEY` | `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | Encrypts sensitive DB fields (e.g., Paynow keys in restaurant-service). |
| `ADMIN_SETUP_TOKEN` | `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` | One-time token to create the first admin user. Can be changed after first use. |

### Credentials from AWS (created during deployment)

| `.env` Variable | Where to Find | Created in Step |
|-----------------|--------------|-----------------|
| `POSTGRES_PASSWORD` | You set this when creating RDS | Step 2 (RDS) |
| `POSTGRES_HOST` | RDS → Databases → `zimfeast-db` → **Endpoint** | Step 2 (RDS) |
| `REDIS_URL` | ElastiCache → `zimfeast-redis` → **Primary Endpoint** → use as `redis://<endpoint>:6379` | Step 3 (ElastiCache) |
| `AWS_ACCESS_KEY_ID` | IAM → Users → Create user → Security credentials → Create access key | Step 14 (CI/CD) |
| `AWS_SECRET_ACCESS_KEY` | Same as above — **save immediately, shown only once** | Step 14 (CI/CD) |

### Credentials from Third-Party Services

| `.env` Variable | Where to Get It | Sign Up URL |
|-----------------|----------------|-------------|
| `GOOGLE_API_KEY` | Google Cloud Console → APIs & Services → Credentials → Create API Key. Enable "Maps JavaScript API", "Geocoding API", "Directions API". | console.cloud.google.com |
| `VITE_GOOGLE_MAPS_API_KEY` | **Same value** as `GOOGLE_API_KEY` (used by the frontend build) | — |
| `SENDGRID_API_KEY` | SendGrid → Settings → API Keys → Create API Key (Full Access) | sendgrid.com |
| `PAYNOW_INTEGRATION_ID` | Paynow merchant dashboard → Integration Settings → Integration ID | paynow.co.zw |
| `PAYNOW_INTEGRATION_KEY` | Paynow merchant dashboard → Integration Settings → Integration Key | paynow.co.zw |
| `TUMAGO_API_KEY` | TumaGo partner dashboard → API Settings → API Key | Contact TumaGo |
| `TUMAGO_API_SECRET` | TumaGo partner dashboard → API Settings → API Secret | Contact TumaGo |

### Variables That Change Between Dev and Production

| `.env` Variable | Local Dev Value | Production Value |
|-----------------|----------------|-----------------|
| `DEBUG` | `True` | `False` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,0.0.0.0` | `zimfeast.com,www.zimfeast.com` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5000,http://localhost:3000` | `https://zimfeast.com,https://www.zimfeast.com` |
| `POSTGRES_HOST` | `postgres` (Docker container name) | RDS endpoint (e.g., `zimfeast-db.xxxxx.af-south-1.rds.amazonaws.com`) |
| `REDIS_URL` | `redis://redis:6379` (Docker container) | `redis://<elasticache-endpoint>:6379` |
| `PAYNOW_RETURN_URL` | `http://localhost/payment-return` | `https://zimfeast.com/payment-return` |
| `PAYNOW_RESULT_URL` | `http://localhost/api/payments/callback/` | `https://zimfeast.com/api/payments/callback/` |

### Security Group Summary

All resources live in the **Default VPC**. Here's what each security group allows:

| Security Group | Attached To | Inbound Rules |
|---------------|-------------|---------------|
| `zimfeast-ec2-sg` | EC2 instance | SSH (22) from `0.0.0.0/0`, HTTP (80) from `0.0.0.0/0`, HTTPS (443) from `0.0.0.0/0` |
| `zimfeast-rds-sg` | RDS database | PostgreSQL (5432) from `zimfeast-ec2-sg` only |
| `zimfeast-redis-sg` | ElastiCache | TCP (6379) from `zimfeast-ec2-sg` only |

> **Rule of thumb:** Only EC2 faces the internet. RDS and ElastiCache are private — they only accept traffic from EC2's security group. Never open database/cache ports to `0.0.0.0/0`.
