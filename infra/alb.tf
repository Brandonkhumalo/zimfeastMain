# ─── Application Load Balancer (Phase 2+) ────────────────────────────
# ALB with SSL termination via ACM certificate.
# Phase 1 uses EC2 Elastic IP + host Nginx + Let's Encrypt instead.

resource "aws_lb" "main" {
  count = var.phase != "phase1" ? 1 : 0

  name               = "${var.project}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.backend.id]
  subnets            = data.aws_subnets.default.ids

  tags = { Name = "${var.project}-alb" }
}

# Target group: Nginx api-gateway container on port 80
resource "aws_lb_target_group" "gateway" {
  count = var.phase != "phase1" ? 1 : 0

  name        = "${var.project}-gateway-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  # Enable stickiness for WebSocket connections
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }
}

# HTTPS listener (primary)
resource "aws_lb_listener" "https" {
  count = var.phase != "phase1" ? 1 : 0

  load_balancer_arn = aws_lb.main[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.gateway[0].arn
  }
}

# HTTP listener → redirect to HTTPS
resource "aws_lb_listener" "http_redirect" {
  count = var.phase != "phase1" ? 1 : 0

  load_balancer_arn = aws_lb.main[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
