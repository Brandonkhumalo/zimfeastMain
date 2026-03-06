# ─── Application Load Balancer ────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${var.project}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = { Name = "${var.project}-alb" }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.alb.arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      message_body = "{\"error\": \"Not found\"}"
      status_code  = "404"
    }
  }

  depends_on = [aws_acm_certificate_validation.alb]
}

# HTTP -> HTTPS redirect
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
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

# ─── Target Groups (one per service) ────────────────────────────────
resource "aws_lb_target_group" "services" {
  for_each    = var.services
  name        = "${var.project}-${each.key}"
  port        = each.value.port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/api/${each.key == "auth" ? "accounts" : each.key == "restaurant" ? "restaurants" : each.key == "driver" ? "drivers" : each.key == "payment" ? "payments" : "orders"}/health/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200,404,405" # 404/405 acceptable if health endpoint not implemented
  }
}

resource "aws_lb_target_group" "realtime" {
  name        = "${var.project}-realtime"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/socket.io/?EIO=4&transport=polling"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200,400"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }
}

# ─── Listener Rules (path-based routing) ─────────────────────────────
resource "aws_lb_listener_rule" "auth" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services["auth"].arn
  }

  condition {
    path_pattern { values = ["/api/accounts/*"] }
  }
}

resource "aws_lb_listener_rule" "restaurant" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services["restaurant"].arn
  }

  condition {
    path_pattern { values = ["/api/restaurants/*"] }
  }
}

resource "aws_lb_listener_rule" "order" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services["order"].arn
  }

  condition {
    path_pattern { values = ["/api/orders/*"] }
  }
}

resource "aws_lb_listener_rule" "driver" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 40

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services["driver"].arn
  }

  condition {
    path_pattern { values = ["/api/drivers/*"] }
  }
}

resource "aws_lb_listener_rule" "payment" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 50

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services["payment"].arn
  }

  condition {
    path_pattern { values = ["/api/payments/*"] }
  }
}

resource "aws_lb_listener_rule" "realtime" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 60

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.realtime.arn
  }

  condition {
    path_pattern { values = ["/socket.io/*"] }
  }
}

resource "aws_lb_listener_rule" "media" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 70

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services["restaurant"].arn
  }

  condition {
    path_pattern { values = ["/media/*"] }
  }
}
