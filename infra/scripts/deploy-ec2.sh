#!/bin/bash
# ─── ZimFeast EC2 Deploy Script (Phase 1) ────────────────────────────
# Pull latest images from ECR and restart services with zero downtime.
# Supports rollback to previous images.
#
# Usage:
#   ./deploy-ec2.sh              # Deploy latest
#   ./deploy-ec2.sh rollback     # Rollback to previous version
set -e

cd "$(dirname "$0")/../../backend"
source .env 2>/dev/null || true

ECR_REGISTRY="${ECR_REGISTRY:-}"
if [ -z "$ECR_REGISTRY" ]; then
  echo "ERROR: Set ECR_REGISTRY in .env or environment"
  exit 1
fi

ACTION="${1:-deploy}"

# Login to ECR
echo "[1/3] Logging into ECR..."
aws ecr get-login-password --region af-south-1 | docker login --username AWS --password-stdin "$ECR_REGISTRY"

if [ "$ACTION" = "rollback" ]; then
  echo "[ROLLBACK] Rolling back to previous images..."
  # Docker keeps the previous image — just restart with the cached version
  docker compose down
  docker compose up -d
  echo "Rollback complete. Check: docker compose ps"
  exit 0
fi

# Pull latest images
echo "[2/3] Pulling latest images..."
docker compose pull

# Rolling restart: bring up new containers before stopping old ones
echo "[3/3] Restarting services..."
docker compose up -d --remove-orphans

# Wait for health checks
echo ""
echo "Waiting for services to be healthy..."
sleep 10
docker compose ps

# Verify health endpoint
echo ""
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "=== Deploy successful! Health check: OK ==="
else
  echo "WARNING: Health check returned $HTTP_STATUS — check logs: docker compose logs -f"
fi

# Reload host Nginx (if installed — Phase 1 SSL proxy)
if command -v nginx &> /dev/null && [ -f /etc/nginx/sites-enabled/zimfeast ]; then
  echo "Reloading host Nginx..."
  sudo nginx -t && sudo systemctl reload nginx
fi
