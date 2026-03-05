#!/bin/bash
# Start the entire ZimFeast microservices stack
set -e

echo "=== ZimFeast Microservices Stack ==="
echo ""

# Step 1: Build all services
echo "[1/4] Building all services..."
docker compose build

# Step 2: Start infrastructure (postgres + redis)
echo "[2/4] Starting infrastructure..."
docker compose up -d postgres redis
echo "Waiting for infrastructure to be healthy..."
sleep 5

# Step 3: Run migrations for all services
echo "[3/4] Running database migrations..."
docker compose up migrate-auth migrate-restaurant migrate-order migrate-driver migrate-payment
echo "Migrations complete."

# Step 4: Start all services
echo "[4/4] Starting all services..."
docker compose up -d \
  auth-service \
  restaurant-service \
  order-service \
  driver-service \
  payment-service \
  realtime-service \
  frontend \
  api-gateway

echo ""
echo "=== ZimFeast is running! ==="
echo "  API Gateway:  http://localhost:80"
echo "  Auth Service:  http://localhost:8001 (internal)"
echo "  Restaurant:    http://localhost:8002 (internal)"
echo "  Orders:        http://localhost:8003 (internal)"
echo "  Drivers:       http://localhost:8004 (internal)"
echo "  Payments:      http://localhost:8005 (internal)"
echo "  Real-time:     http://localhost:3001 (internal)"
echo ""
echo "Run 'docker compose ps' to check service status"
echo "Run 'docker compose logs -f <service>' to tail logs"
