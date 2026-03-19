#!/bin/bash
# Scale individual services up or down
# Usage: ./infra/scripts/docker-scale.sh <service> <replicas>
# Example: ./infra/scripts/docker-scale.sh order-service 5

set -e

# Ensure we run from the backend/ directory (where docker-compose.yml lives)
cd "$(dirname "$0")/../../backend"

SERVICE=${1:-"order-service"}
REPLICAS=${2:-3}

echo "Scaling $SERVICE to $REPLICAS replicas..."
docker compose up -d --scale "$SERVICE=$REPLICAS" --no-recreate

echo "Done. Current state:"
docker compose ps "$SERVICE"
