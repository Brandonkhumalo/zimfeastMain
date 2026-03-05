#!/bin/bash
# Scale individual services up or down
# Usage: ./scripts/docker-scale.sh <service> <replicas>
# Example: ./scripts/docker-scale.sh order-service 5

set -e

SERVICE=${1:-"order-service"}
REPLICAS=${2:-3}

echo "Scaling $SERVICE to $REPLICAS replicas..."
docker compose up -d --scale "$SERVICE=$REPLICAS" --no-recreate

echo "Done. Current state:"
docker compose ps "$SERVICE"
