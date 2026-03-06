# ZimFeast AWS Deployment Guide

## Prerequisites

1. **AWS Account** with billing enabled
2. **AWS CLI** installed and configured: `aws configure`
3. **Terraform** installed (v1.5+): https://developer.hashicorp.com/terraform/install
4. **Docker** installed (for building images locally if needed)
5. **GitHub repository** with the code pushed

## Step 1: Enable Cape Town Region

AWS af-south-1 (Cape Town) must be manually enabled:
1. Go to AWS Console -> Account -> AWS Regions
2. Enable "Africa (Cape Town) af-south-1"
3. Wait a few minutes for it to activate

## Step 2: Create Terraform State Bucket

```bash
aws s3 mb s3://zimfeast-terraform-state --region af-south-1
aws s3api put-bucket-versioning \
  --bucket zimfeast-terraform-state \
  --versioning-configuration Status=Enabled
```

## Step 3: Create IAM User for GitHub Actions

```bash
# Create the user
aws iam create-user --user-name zimfeast-github-deploy

# Attach policies
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

# Create access keys
aws iam create-access-key --user-name zimfeast-github-deploy
# Save the AccessKeyId and SecretAccessKey output!
```

## Step 4: Configure Terraform Variables

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your real values:
```hcl
db_password            = "your-strong-password-here"
django_secret_key      = "random-50-char-string"
jwt_secret_key         = "another-random-50-char-string"
service_api_key        = "inter-service-key"
google_api_key         = "AIzaSy..."
vite_google_maps_api_key = "AIzaSy..."
sendgrid_api_key       = "SG...."
paynow_integration_id  = "22041"
paynow_integration_key = "2016f23f-..."
```

Generate random keys:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

## Step 5: Deploy Infrastructure

```bash
cd infra

# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Deploy everything (takes 15-20 minutes first time)
terraform apply
```

When complete, Terraform outputs:
- **nameservers**: Update these at your domain registrar (WebDev Zimbabwe)
- **ecr_urls**: Where to push Docker images
- **cloudfront_domain**: Your CDN URL
- **aurora_endpoint**: Database endpoint
- **redis_endpoint**: Redis endpoint

## Step 6: Point Domain to Route 53

1. Copy the 4 nameservers from Terraform output
2. Log into WebDev Zimbabwe where you registered zimfeast.com
3. Update nameservers to the 4 AWS Route 53 nameservers
4. Wait for DNS propagation (can take up to 48 hours, usually 1-2 hours)

## Step 7: Push Initial Docker Images

First time only - push images so ECS services can start:

```bash
# Login to ECR
aws ecr get-login-password --region af-south-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com

# Build and push each service (from project root)
for svc in auth restaurant order driver payment; do
  docker build -t YOUR_ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com/zimfeast/$svc:latest \
    -f services/$svc-service/Dockerfile .
  docker push YOUR_ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com/zimfeast/$svc:latest
done

# Realtime service
docker build -t YOUR_ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com/zimfeast/realtime:latest \
  -f services/realtime-service/Dockerfile .
docker push YOUR_ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com/zimfeast/realtime:latest
```

Replace `YOUR_ACCOUNT_ID` with your AWS account ID (find it: `aws sts get-caller-identity --query Account --output text`).

## Step 8: Run Initial Migrations

```bash
# Get network info
SUBNETS=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=zimfeast-private-*" --query 'Subnets[*].SubnetId' --output text | tr '\t' ',')
SG=$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=zimfeast-ecs-sg" --query 'SecurityGroups[0].SecurityGroupId' --output text)

# Run migrations for each Django service
for svc in auth restaurant order driver payment; do
  TASK_DEF=$(aws ecs describe-task-definition --task-definition zimfeast-$svc --query 'taskDefinition.taskDefinitionArn' --output text)

  aws ecs run-task \
    --cluster zimfeast-cluster \
    --task-definition $TASK_DEF \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=DISABLED}" \
    --overrides "{\"containerOverrides\":[{\"name\":\"$svc\",\"command\":[\"python\",\"manage.py\",\"migrate\",\"--noinput\"]}]}" \
    --count 1

  echo "Migration started for $svc"
  sleep 10
done
```

## Step 9: Deploy Frontend

```bash
# Build frontend
npm ci && npm run build

# Upload to S3
aws s3 sync dist/public/ s3://zimfeast-frontend --delete

# Invalidate CloudFront cache
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

## Step 10: Configure GitHub Secrets

Go to your GitHub repo -> Settings -> Secrets and variables -> Actions.
Add these secrets:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | From Step 3 |
| `AWS_SECRET_ACCESS_KEY` | From Step 3 |
| `VITE_GOOGLE_MAPS_API_KEY` | Your Google Maps API key |

After this, every push to `main` automatically deploys:
- Backend changes -> builds Docker images -> deploys to ECS
- Frontend changes -> builds React -> syncs to S3 -> invalidates CloudFront

## Verifying Deployment

```bash
# Check ECS services are running
aws ecs list-services --cluster zimfeast-cluster

# Check service status
aws ecs describe-services --cluster zimfeast-cluster \
  --services auth restaurant order driver payment realtime \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount,status:status}'

# Check logs for a service
aws logs tail /ecs/zimfeast/auth --follow

# Test the API
curl https://zimfeast.com/api/accounts/login/ -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

## Updating Paynow URLs

The Paynow return/result URLs are automatically set by Terraform:
- Return URL: `https://zimfeast.com/payment-return`
- Result URL: `https://zimfeast.com/api/payments/callback/`

These are passed as environment variables to the payment service.

## Costs

Monitor costs at: AWS Console -> Billing -> Cost Explorer

Set up a billing alarm:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name zimfeast-billing-alarm \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --threshold 200 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD \
  --evaluation-periods 1 \
  --alarm-actions YOUR_SNS_TOPIC_ARN
```

## Troubleshooting

**Services not starting?**
```bash
aws logs tail /ecs/zimfeast/auth --since 1h
```

**Database connection issues?**
Ensure ECS security group can reach RDS security group on port 5432.

**502 errors?**
Health check might be failing. Check ALB target group health:
```bash
aws elbv2 describe-target-health --target-group-arn YOUR_TG_ARN
```

**DNS not working?**
Check nameserver propagation: `dig zimfeast.com NS`
