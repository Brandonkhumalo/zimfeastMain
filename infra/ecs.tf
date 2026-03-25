# ─── ECS Cluster (Phase 2+) ──────────────────────────────────────────
# Phase 2: ECS with EC2 launch type (2x t3.small)
# Phase 3: ECS with EC2 ASG + service auto-scaling

resource "aws_ecs_cluster" "main" {
  count = var.phase != "phase1" ? 1 : 0

  name = "${var.project}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${var.project}-cluster" }
}

# ─── CloudWatch Log Group ───────────────────────────────────────────
resource "aws_cloudwatch_log_group" "ecs" {
  count = var.phase != "phase1" ? 1 : 0

  name              = "/ecs/${var.project}"
  retention_in_days = 14
}

# ─── Service Discovery (Cloud Map) ──────────────────────────────────
# Private DNS namespace so ECS services find each other by name
resource "aws_service_discovery_private_dns_namespace" "main" {
  count = var.phase != "phase1" ? 1 : 0

  name = "${var.project}.local"
  vpc  = data.aws_vpc.default.id
}

# ─── ECS Task Definitions ───────────────────────────────────────────
# One task definition per service. Environment variables match docker-compose.yml.

locals {
  ecs_services = var.phase != "phase1" ? {
    "auth-service" = {
      image  = "${aws_ecr_repository.services["auth-service"].repository_url}:latest"
      port   = 8001
      cpu    = 256
      memory = 512
      env_extra = {
        AUTH_DB_NAME = "zimfeast_auth"
      }
    }
    "restaurant-service" = {
      image  = "${aws_ecr_repository.services["restaurant-service"].repository_url}:latest"
      port   = 8002
      cpu    = 256
      memory = 512
      env_extra = {
        RESTAURANT_DB_NAME = "zimfeast_restaurants"
      }
    }
    "order-service" = {
      image  = "${aws_ecr_repository.services["order-service"].repository_url}:latest"
      port   = 8003
      cpu    = 256
      memory = 128
      env_extra = {
        ORDER_DB_NAME    = "zimfeast_orders"
        TUMAGO_API_URL   = "https://tumago.co.zw/api/v1"
        TUMAGO_API_KEY   = var.tumago_api_key
        TUMAGO_API_SECRET = var.tumago_api_secret
      }
    }
    "payment-service" = {
      image  = "${aws_ecr_repository.services["payment-service"].repository_url}:latest"
      port   = 8005
      cpu    = 256
      memory = 512
      env_extra = {
        PAYMENT_DB_NAME = "zimfeast_payments"
      }
    }
    "realtime-service" = {
      image  = "${aws_ecr_repository.services["realtime-service"].repository_url}:latest"
      port   = 3001
      cpu    = 256
      memory = 256
      env_extra = {
        REALTIME_PORT = "3001"
      }
    }
    "api-gateway" = {
      image  = "${aws_ecr_repository.services["api-gateway"].repository_url}:latest"
      port   = 80
      cpu    = 256
      memory = 128
      env_extra = {}
    }
  } : {}

  # Environment variables shared by all services
  common_env = var.phase != "phase1" ? {
    SECRET_KEY             = var.django_secret_key
    JWT_SECRET_KEY         = var.jwt_secret_key
    DEBUG                  = "False"
    ALLOWED_HOSTS          = "${var.domain},www.${var.domain}"
    CORS_ALLOWED_ORIGINS   = "https://${var.domain},https://www.${var.domain}"
    REDIS_URL              = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
    POSTGRES_USER          = var.db_username
    POSTGRES_PASSWORD      = var.db_password
    POSTGRES_HOST          = aws_db_instance.main.address
    POSTGRES_PORT          = "5432"
    GOOGLE_API_KEY         = var.google_api_key
    SENDGRID_API_KEY       = var.sendgrid_api_key
    SERVICE_API_KEY        = var.service_api_key
    PAYNOW_RETURN_URL      = "https://${var.domain}/payment-return"
    PAYNOW_RESULT_URL      = "https://${var.domain}/api/payments/callback/"
    PAYNOW_INTEGRATION_ID  = var.paynow_integration_id
    PAYNOW_INTEGRATION_KEY = var.paynow_integration_key
    # Service discovery URLs (Cloud Map DNS)
    AUTH_SERVICE_URL       = "http://auth-service.${var.project}.local:8001"
    RESTAURANT_SERVICE_URL = "http://restaurant-service.${var.project}.local:8002"
    ORDER_SERVICE_URL      = "http://order-service.${var.project}.local:8003"
    PAYMENT_SERVICE_URL    = "http://payment-service.${var.project}.local:8005"
  } : {}
}

resource "aws_ecs_task_definition" "services" {
  for_each = local.ecs_services

  family                   = "${var.project}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = aws_iam_role.ecs_execution[0].arn
  task_role_arn            = aws_iam_role.ecs_task[0].arn

  container_definitions = jsonencode([{
    name      = each.key
    image     = each.value.image
    cpu       = each.value.cpu
    memory    = each.value.memory
    essential = true

    portMappings = [{
      containerPort = each.value.port
      protocol      = "tcp"
    }]

    environment = [
      for k, v in merge(local.common_env, each.value.env_extra) : {
        name  = k
        value = v
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs[0].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = each.key
      }
    }
  }])
}

# ─── ECS Services ────────────────────────────────────────────────────

resource "aws_ecs_service" "services" {
  for_each = local.ecs_services

  name            = "${var.project}-${each.key}"
  cluster         = aws_ecs_cluster.main[0].id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = 2
  launch_type     = "EC2"

  network_configuration {
    subnets         = data.aws_subnets.default.ids
    security_groups = [aws_security_group.backend.id]
  }

  # Service discovery registration
  service_registries {
    registry_arn = aws_service_discovery_service.services[each.key].arn
  }

  # Only the api-gateway is attached to the ALB
  dynamic "load_balancer" {
    for_each = each.key == "api-gateway" ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.gateway[0].arn
      container_name   = each.key
      container_port   = each.value.port
    }
  }

  depends_on = [aws_lb_listener.https]
}

# Service discovery entries for each service
resource "aws_service_discovery_service" "services" {
  for_each = local.ecs_services

  name = each.key

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main[0].id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

# ─── Auto Scaling (Phase 3) ─────────────────────────────────────────

locals {
  autoscale_services = var.phase == "phase3" ? {
    "api-gateway"        = { min = 2, max = 6 }
    "auth-service"       = { min = 2, max = 6 }
    "restaurant-service" = { min = 2, max = 8 }
    "order-service"      = { min = 2, max = 10 }
    "payment-service"    = { min = 2, max = 6 }
    "realtime-service"   = { min = 2, max = 10 }
  } : {}
}

resource "aws_appautoscaling_target" "ecs" {
  for_each = local.autoscale_services

  max_capacity       = each.value.max
  min_capacity       = each.value.min
  resource_id        = "service/${aws_ecs_cluster.main[0].name}/${aws_ecs_service.services[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_cpu" {
  for_each = local.autoscale_services

  name               = "${each.key}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
