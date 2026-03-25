#!/bin/bash
# ─── ZimFeast SSL Setup (Phase 1: EC2 + Let's Encrypt) ──────────────
# Run this AFTER:
#   1. Route 53 A record points zimfeast.com to your EC2 Elastic IP
#   2. Docker compose is running on port 8080
#
# This script:
#   - Gets a free Let's Encrypt SSL certificate
#   - Configures Nginx as an HTTPS reverse proxy
#   - Sets up auto-renewal
#   - Reloads Nginx with zero downtime
#
# Usage: sudo bash infra/scripts/setup-ssl.sh
set -e

DOMAIN="zimfeast.com"
EMAIL="${1:-admin@zimfeast.com}"
DOCKER_PORT=8080  # Docker's api-gateway port (mapped from 80 in docker-compose)

echo "=== ZimFeast SSL Setup ==="
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# Step 1: Install Nginx and Certbot
echo "[1/5] Installing Nginx and Certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot

# Step 2: Stop Nginx temporarily so Certbot can use port 80
echo "[2/5] Getting SSL certificate from Let's Encrypt..."
systemctl stop nginx || true
certbot certonly --standalone \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

# Step 3: Write Nginx config
echo "[3/5] Writing Nginx config..."
cat > /etc/nginx/sites-available/zimfeast << 'NGINX_CONF'
# ─── ZimFeast HTTPS Reverse Proxy ────────────────────────────────────
# Terminates SSL and proxies to Docker containers on port 8080.

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name zimfeast.com www.zimfeast.com;
    return 301 https://$host$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name zimfeast.com www.zimfeast.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate     /etc/letsencrypt/live/zimfeast.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zimfeast.com/privkey.pem;

    # Modern TLS config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    client_max_body_size 20M;

    # ─── Proxy to Docker api-gateway ─────────────────────────────────
    # All requests go to Nginx inside Docker, which routes to services.

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Timeouts for slow API calls
        proxy_connect_timeout 30s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }

    # ─── WebSocket: Socket.IO (customer order tracking) ──────────────
    location /socket.io/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 86400;
    }

    # ─── WebSocket: restaurant dashboard ─────────────────────────────
    location /ws/restaurant/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 86400;
    }
}
NGINX_CONF

# Step 4: Enable the site and test config
echo "[4/5] Enabling Nginx config..."
ln -sf /etc/nginx/sites-available/zimfeast /etc/nginx/sites-enabled/zimfeast
rm -f /etc/nginx/sites-enabled/default

# Test config before starting
nginx -t

# Step 5: Start Nginx and set up auto-renewal
echo "[5/5] Starting Nginx and configuring auto-renewal..."
systemctl start nginx
systemctl enable nginx

# Certbot auto-renewal with Nginx reload (runs twice daily via systemd timer)
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh << 'HOOK'
#!/bin/bash
nginx -t && systemctl reload nginx
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# Test renewal
certbot renew --dry-run

echo ""
echo "=== SSL Setup Complete ==="
echo ""
echo "  https://zimfeast.com     → Docker api-gateway (port $DOCKER_PORT)"
echo "  http://zimfeast.com      → redirects to HTTPS"
echo ""
echo "  SSL cert auto-renews via: systemctl list-timers certbot.timer"
echo "  Test renewal:             sudo certbot renew --dry-run"
echo "  Check Nginx:              sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "IMPORTANT: Update docker-compose.yml to map api-gateway to port $DOCKER_PORT:"
echo "  api-gateway:"
echo "    ports:"
echo "      - \"$DOCKER_PORT:80\""
