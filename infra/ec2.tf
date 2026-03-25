# ─── EC2 Instance (Phase 1 only) ─────────────────────────────────────
# Single EC2 running docker-compose with all services.
# Decommissioned when moving to ECS in Phase 2.

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_eip" "ec2" {
  count  = var.phase == "phase1" ? 1 : 0
  domain = "vpc"
  tags   = { Name = "${var.project}-ec2-eip" }
}

resource "aws_eip_association" "ec2" {
  count         = var.phase == "phase1" ? 1 : 0
  instance_id   = aws_instance.backend[0].id
  allocation_id = aws_eip.ec2[0].id
}

resource "aws_instance" "backend" {
  count = var.phase == "phase1" ? 1 : 0

  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.ec2_instance_type
  key_name               = var.ec2_key_name != "" ? var.ec2_key_name : null
  vpc_security_group_ids = [aws_security_group.backend.id]

  root_block_device {
    volume_size = 25
    volume_type = "gp3"
  }

  # Install Docker, AWS CLI, Certbot, and clone repo on first boot
  user_data = <<-USERDATA
    #!/bin/bash
    set -e

    # Install Docker
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker ubuntu

    # Install AWS CLI + PostgreSQL client + Certbot
    apt-get update
    apt-get install -y awscli postgresql-client certbot nginx

    # Clone repo
    su - ubuntu -c "git clone https://github.com/your-org/zimfeastMain.git /home/ubuntu/zimfeastMain"

    # Set up Nginx as SSL reverse proxy to Docker (port 80)
    cat > /etc/nginx/sites-available/zimfeast <<'NGINX'
    server {
        listen 80;
        server_name zimfeast.com www.zimfeast.com;
        return 301 https://$$host$$request_uri;
    }

    server {
        listen 443 ssl;
        server_name zimfeast.com www.zimfeast.com;

        ssl_certificate     /etc/letsencrypt/live/zimfeast.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/zimfeast.com/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        client_max_body_size 20M;

        # Proxy everything to Docker's Nginx gateway on port 8080
        location / {
            proxy_pass http://127.0.0.1:8080;
            proxy_set_header Host $$host;
            proxy_set_header X-Real-IP $$remote_addr;
            proxy_set_header X-Forwarded-For $$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # WebSocket: Socket.IO (customer order tracking)
        location /socket.io/ {
            proxy_pass http://127.0.0.1:8080;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $$host;
            proxy_set_header X-Real-IP $$remote_addr;
            proxy_read_timeout 86400;
        }

        # WebSocket: restaurant dashboard
        location /ws/restaurant/ {
            proxy_pass http://127.0.0.1:8080;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $$host;
            proxy_set_header X-Real-IP $$remote_addr;
            proxy_read_timeout 86400;
        }
    }
    NGINX

    ln -sf /etc/nginx/sites-available/zimfeast /etc/nginx/sites-enabled/zimfeast
    rm -f /etc/nginx/sites-enabled/default

    echo "=== ZimFeast EC2 bootstrap complete ==="
    echo "Next: SSH in, configure .env, get SSL cert, then docker compose up"
  USERDATA

  tags = { Name = "${var.project}-backend" }
}
