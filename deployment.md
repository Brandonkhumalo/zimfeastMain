# Deploy ZimFeast to AWS

Complete step-by-step guide to deploy ZimFeast on AWS using Terraform (infrastructure) and GitHub Actions (CI/CD). Designed for zero downtime deployments and easy scaling.

---

## Cost Summary

| Phase | When | Monthly Cost |
|-------|------|-------------|
| **Phase 1 (Launch)** | 0–500 orders/day | ~$110–130/month ($0 RDS if free tier) |
| **Phase 2 (Growing)** | 500–2,000 orders/day | ~$150–250/month |
| **Phase 3 (Scale)** | 2,000+ orders/day | ~$300+/month |

**Scaling requires zero code changes** — just update `terraform.tfvars` and run `terraform apply`.

---

## Architecture

```
                   Internet
                      |
               [CloudFront CDN]
              /        |        \
         S3 Bucket   ALB      S3 Bucket
         (Frontend)   |       (Media/Uploads)
                      |
         +-----------+-----------+
         |           |           |
    [Auth ECS]  [Restaurant] [Order ECS*]
    [Driver ECS*] [Payment ECS] [Realtime ECS*]
         |           |           |
    [RDS PostgreSQL]        [ElastiCache Redis]
    (5 databases)            (Pub/Sub + Cache)

    * = Go service (order, driver, realtime)
    All others are Django (Python) services
```

**What Terraform creates:**
- VPC with public + private subnets across 2 availability zones
- ECS Fargate cluster with auto-scaling and rolling deployments (zero downtime)
- RDS PostgreSQL with auto-scaling storage (20–100 GB)
- ElastiCache Redis for caching and real-time pub/sub
- Application Load Balancer with path-based routing
- CloudFront CDN for frontend and media files
- S3 buckets for frontend hosting and media uploads
- S3 VPC Gateway Endpoint (free, reduces data transfer costs)
- Route 53 DNS with SSL certificates (ACM)
- ECR repositories for Docker images
- IAM roles with least-privilege permissions

**Zero downtime guarantee:**
- ECS rolling deployments: new tasks start before old ones stop (`deployment_minimum_healthy_percent = 50`, `deployment_maximum_percent = 200`)
- ALB health checks: traffic only routes to healthy containers
- GitHub Actions CI/CD: push to `main` auto-deploys with zero downtime

---

## Scaling Guide (Change 1 Variable, Run 1 Command)

### Phase 1 → Phase 2 (Growing Traffic)

Edit `infra/terraform.tfvars`:
```hcl
# Upgrade database
db_instance_class = "db.t4g.small"   # was "db.t4g.micro"
db_multi_az       = true              # was false — adds failover replica

# Scale high-traffic services
# Override in terraform.tfvars or adjust defaults in variables.tf
```

```bash
cd infra && terraform apply
```

### Phase 2 → Phase 3 (High Scale)

Edit `infra/terraform.tfvars`:
```hcl
# Upgrade database again
db_instance_class = "db.t4g.medium"  # was "db.t4g.small"
```

To scale individual services, use the AWS CLI:
```bash
# Scale order service to 5 containers
aws ecs update-service --cluster zimfeast-cluster --service order --desired-count 5

# Auto-scaling handles this automatically based on CPU (target: 70%)
# But you can adjust max_count in variables.tf if needed
```

### Beyond Phase 3 (Enterprise)

When you need database auto-scaling beyond fixed instance sizes, migrate to Aurora Serverless v2:
1. Take an RDS snapshot
2. Restore as Aurora Serverless v2 cluster
3. Update Terraform to use Aurora resources
4. Update ECS environment variables with new endpoint

---

## Prerequisites

1. **AWS Account** with billing enabled
2. **AWS CLI** installed and configured: `aws configure`
3. **Terraform** installed (v1.5+): https://developer.hashicorp.com/terraform/install
4. **Docker** installed (for building images locally)
5. **GitHub repository** with the code pushed

---

## Step 1: Install AWS CLI & Terraform

**AWS CLI:**
```bash
# Windows (download MSI installer)
# https://awscli.amazonaws.com/AWSCLIV2.msi

# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install
```

**Terraform:**
```bash
# Windows (download from HashiCorp or use choco)
choco install terraform

# macOS
brew tap hashicorp/tap && brew install hashicorp/tap/terraform

# Linux
sudo apt-get update && sudo apt-get install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

Verify:
```bash
aws --version
terraform --version
```

---

## Step 2: Configure AWS CLI

```bash
aws configure
```

Enter:
- **Access Key ID**: From your AWS IAM user
- **Secret Access Key**: From your AWS IAM user
- **Default region**: `af-south-1`
- **Default output format**: `json`

To create an IAM user (if you don't have one):
1. Go to AWS Console -> IAM -> Users -> Create User
2. Attach the **AdministratorAccess** policy (for initial setup)
3. Create access keys under Security Credentials tab

---

## Step 3: Enable Cape Town Region (af-south-1)

AWS Cape Town is an opt-in region and must be manually enabled:

1. Go to **AWS Console** -> **Account** (top-right menu) -> **AWS Regions**
2. Find **Africa (Cape Town) af-south-1**
3. Click **Enable**
4. Wait 2-5 minutes for activation

Verify:
```bash
aws ec2 describe-regions --filters "Name=region-name,Values=af-south-1" --query "Regions[0].OptInStatus"
# Should return "opted-in"
```

---

## Step 4: Create Terraform State Bucket

Terraform needs an S3 bucket to store its state file:

```bash
aws s3 mb s3://zimfeast-terraform-state --region af-south-1

aws s3api put-bucket-versioning \
  --bucket zimfeast-terraform-state \
  --versioning-configuration Status=Enabled
```

---

## Step 5: Configure Terraform Variables

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your real values:

```hcl
aws_region = "af-south-1"
domain     = "zimfeast.com"

# Database
db_username       = "zimfeast"
db_password       = "YourStrongPasswordHere123!"
db_instance_class = "db.t4g.micro"   # Free tier eligible for 12 months
db_multi_az       = false             # Set true in Phase 2

# Django secrets - generate random strings (see below)
django_secret_key = "your-random-50-char-string"
jwt_secret_key    = "another-random-50-char-string"
service_api_key   = "inter-service-random-key"

# API Keys
google_api_key           = "AIzaSy..."
vite_google_maps_api_key = "AIzaSy..."
openai_api_key           = ""
sendgrid_api_key         = "SG...."

# Paynow
paynow_integration_id  = "22041"
paynow_integration_key = "your-paynow-key"
```

Generate random secret keys:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

> **IMPORTANT:** `terraform.tfvars` is in `.gitignore` and will never be committed to Git. It stays on your local machine only.

---

## Step 6: Deploy Infrastructure with Terraform

```bash
cd infra

# Initialize Terraform (downloads providers)
terraform init

# Preview what will be created
terraform plan

# Deploy everything (takes 10-15 minutes on first run)
terraform apply
```

Type `yes` when prompted. When complete, Terraform outputs:

| Output | Description |
|--------|-------------|
| `nameservers` | 4 NS records to set at your domain registrar |
| `ecr_urls` | ECR repository URLs for Docker images |
| `cloudfront_domain` | Your CloudFront CDN URL |
| `rds_endpoint` | Database connection endpoint |
| `redis_endpoint` | Redis cache endpoint |

Save these outputs! You can also retrieve them later with `terraform output`.

---

## Step 7: Point Domain to AWS (Route 53)

1. Copy the **4 nameservers** from the Terraform output
2. Log into **WebDev Zimbabwe** (your domain registrar)
3. Go to domain management for `zimfeast.com`
4. **Replace the existing nameservers** with the 4 AWS Route 53 nameservers
5. Save changes

DNS propagation takes 1-48 hours (usually 1-2 hours). Check progress:
```bash
dig zimfeast.com NS
```

---

## Step 8: Push Initial Docker Images to ECR

First time only - ECS needs images in ECR before services can start.

```bash
# Get your AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account ID: $ACCOUNT_ID"

# Login to ECR
aws ecr get-login-password --region af-south-1 | \
  docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com

# Build and push each service (from backend/ directory)
cd backend
for svc in auth restaurant order driver payment; do
  echo "Building $svc-service..."
  docker build -t $ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com/zimfeast/$svc:latest \
    -f $svc-service/Dockerfile .
  docker push $ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com/zimfeast/$svc:latest
  echo "$svc pushed successfully!"
done

# Build and push realtime service (Go)
docker build -t $ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com/zimfeast/realtime:latest \
  -f realtime-service/Dockerfile .
docker push $ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com/zimfeast/realtime:latest
echo "All images pushed!"
cd ..
```

---

## Step 9: Run Database Migrations

Only the Django services (auth, restaurant, payment) need migrations. The Go services (order, driver) use `backend/go-migrations.sql` for initial schema setup.

```bash
# Get network configuration
SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=tag:Name,Values=zimfeast-public-*" \
  --query 'Subnets[*].SubnetId' --output text | tr '\t' ',')

SG=$(aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=zimfeast-ecs-*" \
  --query 'SecurityGroups[0].SecurityGroupId' --output text)

echo "Subnets: $SUBNETS"
echo "Security Group: $SG"

# Run Django migrations (auth, restaurant, payment only)
for svc in auth restaurant payment; do
  TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition zimfeast-$svc \
    --query 'taskDefinition.taskDefinitionArn' --output text)

  aws ecs run-task \
    --cluster zimfeast-cluster \
    --task-definition $TASK_DEF \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
    --overrides "{\"containerOverrides\":[{\"name\":\"$svc\",\"command\":[\"python\",\"manage.py\",\"migrate\",\"--noinput\"]}]}" \
    --count 1

  echo "Migration started for $svc-service"
  sleep 10
done

# For fresh deployments: initialize Go service databases
# psql -h $RDS_ENDPOINT -U zimfeast -f backend/go-migrations.sql
```

Wait a few minutes for all migrations to complete. Check logs:
```bash
aws logs tail /ecs/zimfeast/auth --since 5m
```

---

## Step 10: Deploy Frontend to S3

```bash
# Install dependencies and build
cd webapp
npm ci
npm run build

# Get the S3 bucket name
BUCKET=$(cd ../infra && terraform output -raw frontend_bucket)

# Upload to S3 with cache headers
aws s3 sync dist/public/ s3://$BUCKET --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" --exclude "*.json"

aws s3 cp dist/public/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront cache
DIST_ID=$(cd ../infra && terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

---

## Step 11: Create GitHub Deploy User & Set Secrets

### Create IAM User for GitHub Actions

```bash
# Create the deploy user
aws iam create-user --user-name zimfeast-github-deploy

# Attach required policies
aws iam attach-user-policy --user-name zimfeast-github-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess
aws iam attach-user-policy --user-name zimfeast-github-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
aws iam attach-user-policy --user-name zimfeast-github-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam attach-user-policy --user-name zimfeast-github-deploy \
  --policy-arn arn:aws:iam::aws:policy/CloudFrontFullAccess
aws iam attach-user-policy --user-name zimfeast-github-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess

# Create access keys (SAVE THE OUTPUT!)
aws iam create-access-key --user-name zimfeast-github-deploy
```

### Add GitHub Secrets

Go to your GitHub repo -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**

Add these 3 secrets:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | AccessKeyId from the command above |
| `AWS_SECRET_ACCESS_KEY` | SecretAccessKey from the command above |
| `VITE_GOOGLE_MAPS_API_KEY` | Your Google Maps API key |

After this, **every push to `main` automatically deploys**:
- Backend service changes -> builds Docker -> pushes to ECR -> rolling deploy to ECS (zero downtime)
- Frontend changes -> builds React app -> syncs to S3 -> invalidates CloudFront

---

## Step 12: Verify Everything Works

```bash
# Check all ECS services are running
aws ecs describe-services --cluster zimfeast-cluster \
  --services auth restaurant order driver payment realtime \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount,status:status}' \
  --output table

# Test health endpoints
curl https://zimfeast.com/api/accounts/health/
curl https://zimfeast.com/api/restaurants/health/
curl https://zimfeast.com/api/orders/health/
curl https://zimfeast.com/api/drivers/health/
curl https://zimfeast.com/api/payments/health/

# Test the frontend loads
curl -I https://zimfeast.com

# Check service logs if anything fails
aws logs tail /ecs/zimfeast/auth --follow
aws logs tail /ecs/zimfeast/order --follow
```

---

## Set Up Billing Alarm (Recommended)

Avoid surprise charges by setting up a billing alarm:

```bash
# Create SNS topic for alerts
aws sns create-topic --name zimfeast-billing-alerts --region us-east-1
# Note the TopicArn from the output

# Subscribe your email
aws sns subscribe \
  --topic-arn YOUR_TOPIC_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-east-1
# Check your email and confirm the subscription

# Create billing alarm ($150 threshold)
aws cloudwatch put-metric-alarm \
  --alarm-name zimfeast-billing-alarm \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --threshold 150 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD \
  --evaluation-periods 1 \
  --alarm-actions YOUR_TOPIC_ARN \
  --region us-east-1
```

---

## Phase Cost Breakdown

### Phase 1 — Launch (~$110–130/month)

| Resource | Config | Monthly Cost |
|----------|--------|-------------|
| ECS Fargate (6 services) | 0.25 vCPU, 0.5 GB each | ~$62 |
| RDS PostgreSQL | db.t4g.micro, single-AZ | ~$0 (free tier) or ~$15 |
| ALB | 1 load balancer + LCU | ~$23 |
| ElastiCache Redis | cache.t3.micro | ~$15 |
| CloudFront CDN | Light traffic | ~$1–3 |
| S3 (frontend + media) | Minimal storage | ~$1–2 |
| Route 53 | 1 hosted zone | ~$0.50 |
| CloudWatch Logs | 6 services, 30-day retention | ~$3–5 |
| **Total** | | **~$106–125** |

No NAT Gateway (saves ~$38/month) — Fargate tasks run in public subnets with security groups.
No Aurora Serverless (saves ~$30/month) — standard RDS with free tier eligibility.

### Phase 2 — Growing (~$150–250/month)

Change in `terraform.tfvars`:
```hcl
db_instance_class = "db.t4g.small"   # +$30/month
db_multi_az       = true              # +$30/month (failover replica)
```

Auto-scaling handles Fargate — each additional container adds ~$10/month.

### Phase 3 — Scale (~$300+/month)

Change in `terraform.tfvars`:
```hcl
db_instance_class = "db.t4g.medium"  # +$60/month over micro
```

Consider adding a NAT Gateway ($38/month) for enhanced security if needed.

---

## Troubleshooting

### Services not starting
```bash
# Check ECS service events
aws ecs describe-services --cluster zimfeast-cluster --services auth \
  --query 'services[0].events[0:5]'

# Check container logs
aws logs tail /ecs/zimfeast/auth --since 1h
```

### 502 Bad Gateway errors
Health checks may be failing. Check ALB target group health:
```bash
# List target groups
aws elbv2 describe-target-groups --query 'TargetGroups[*].{Name:TargetGroupName,Arn:TargetGroupArn}' --output table

# Check health of a target group
aws elbv2 describe-target-health --target-group-arn YOUR_TG_ARN
```

### Database connection issues
Ensure the ECS security group allows traffic to the RDS security group on port 5432:
```bash
aws ec2 describe-security-groups --filters "Name=group-name,Values=zimfeast-*" \
  --query 'SecurityGroups[*].{Name:GroupName,Id:GroupId}'
```

### DNS not resolving
Check nameserver propagation:
```bash
dig zimfeast.com NS
# Should show 4 AWS Route 53 nameservers
```

### Force redeploy a service (zero downtime)
```bash
aws ecs update-service --cluster zimfeast-cluster --service auth --force-new-deployment
```

### Create admin user
```bash
TASK_DEF=$(aws ecs describe-task-definition --task-definition zimfeast-auth --query 'taskDefinition.taskDefinitionArn' --output text)
SUBNETS=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=zimfeast-public-*" --query 'Subnets[*].SubnetId' --output text | tr '\t' ',')
SG=$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=zimfeast-ecs-*" --query 'SecurityGroups[0].SecurityGroupId' --output text)

aws ecs run-task \
  --cluster zimfeast-cluster \
  --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"auth","command":["python","manage.py","createsuperuser","--noinput","--email","admin@zimfeast.com"]}]}' \
  --count 1
```

Or use the admin registration page at `https://zimfeast.com/zimfeast/admin/register_user`.

---

## Useful Commands

```bash
# View all Terraform outputs
cd infra && terraform output

# SSH into a running container (for debugging)
aws ecs execute-command --cluster zimfeast-cluster --task TASK_ID --container auth --interactive --command "/bin/sh"

# Scale a service manually
aws ecs update-service --cluster zimfeast-cluster --service order --desired-count 5

# View CloudFront distribution status
aws cloudfront list-distributions --query 'DistributionList.Items[*].{Id:Id,Domain:DomainName,Status:Status}'

# Check RDS status
aws rds describe-db-instances --db-instance-identifier zimfeast-db \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Class:DBInstanceClass,Storage:AllocatedStorage}'

# Destroy everything (WARNING: irreversible!)
cd infra && terraform destroy
```
