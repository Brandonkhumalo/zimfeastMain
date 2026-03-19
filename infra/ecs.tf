# ─── ECS Cluster ─────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${var.project}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = { Name = "${var.project}-cluster" }
}

# ─── Service Discovery Namespace ─────────────────────────────────────
resource "aws_service_discovery_private_dns_namespace" "main" {
  name = "${var.project}.local"
  vpc  = aws_vpc.main.id
}

# ─── Shared environment variables ────────────────────────────────────
locals {
  common_env = [
    { name = "SECRET_KEY", value = var.django_secret_key },
    { name = "JWT_SECRET_KEY", value = var.jwt_secret_key },
    { name = "DEBUG", value = "False" },
    { name = "ALLOWED_HOSTS", value = "*" },
    { name = "CORS_ALLOWED_ORIGINS", value = "https://${var.domain},https://www.${var.domain}" },
    { name = "REDIS_URL", value = "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379" },
    { name = "POSTGRES_USER", value = var.db_username },
    { name = "POSTGRES_PASSWORD", value = var.db_password },
    { name = "POSTGRES_HOST", value = aws_db_instance.main.address },
    { name = "POSTGRES_PORT", value = "5432" },
    { name = "GOOGLE_API_KEY", value = var.google_api_key },
    { name = "OPENAI_API_KEY", value = var.openai_api_key },
    { name = "SENDGRID_API_KEY", value = var.sendgrid_api_key },
    { name = "PAYNOW_INTEGRATION_ID", value = var.paynow_integration_id },
    { name = "PAYNOW_INTEGRATION_KEY", value = var.paynow_integration_key },
    { name = "PAYNOW_RETURN_URL", value = "https://${var.domain}/payment-return" },
    { name = "PAYNOW_RESULT_URL", value = "https://${var.domain}/api/payments/callback/" },
    { name = "SERVICE_API_KEY", value = var.service_api_key },
    { name = "AUTH_SERVICE_URL", value = "http://auth.${var.project}.local:8001" },
    { name = "RESTAURANT_SERVICE_URL", value = "http://restaurant.${var.project}.local:8002" },
    { name = "ORDER_SERVICE_URL", value = "http://order.${var.project}.local:8003" },
    { name = "DRIVER_SERVICE_URL", value = "http://driver.${var.project}.local:8004" },
    { name = "PAYMENT_SERVICE_URL", value = "http://payment.${var.project}.local:8005" },
    { name = "AWS_STORAGE_BUCKET_NAME", value = aws_s3_bucket.media.id },
    { name = "AWS_S3_REGION_NAME", value = var.aws_region },
    { name = "MEDIA_URL", value = "https://media.${var.domain}/" },
  ]
}

# ─── Django Microservices ────────────────────────────────────────────
resource "aws_service_discovery_service" "services" {
  for_each = var.services
  name     = each.key

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
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

resource "aws_ecs_task_definition" "services" {
  for_each                 = var.services
  family                   = "${var.project}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = each.key
    image     = "${aws_ecr_repository.services[each.key].repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = each.value.port
      protocol      = "tcp"
    }]

    environment = concat(local.common_env, [
      { name = each.value.db_env_var, value = each.value.db_name }
    ])

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project}/${each.key}"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])

  tags = { Name = "${var.project}-${each.key}-task" }
}

resource "aws_ecs_service" "services" {
  for_each        = var.services
  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = each.value.min_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.services[each.key].arn
    container_name   = each.key
    container_port   = each.value.port
  }

  service_registries {
    registry_arn = aws_service_discovery_service.services[each.key].arn
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  depends_on = [aws_lb_listener.https]
}

# ─── Realtime Service (Go) ──────────────────────────────────────
resource "aws_service_discovery_service" "realtime" {
  name = "realtime"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
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

resource "aws_ecs_task_definition" "realtime" {
  family                   = "${var.project}-realtime"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.realtime_cpu
  memory                   = var.realtime_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "realtime"
    image     = "${aws_ecr_repository.services["realtime"].repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 3001
      protocol      = "tcp"
    }]

    environment = [
      { name = "REDIS_URL", value = "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379" },
      { name = "REALTIME_PORT", value = "3001" },
      { name = "ORDER_SERVICE_URL", value = "http://order.${var.project}.local:8003" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project}/realtime"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "realtime" {
  name            = "realtime"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.realtime.arn
  desired_count   = var.realtime_min_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.realtime.arn
    container_name   = "realtime"
    container_port   = 3001
  }

  service_registries {
    registry_arn = aws_service_discovery_service.realtime.arn
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  depends_on = [aws_lb_listener.https]
}

# ─── Auto Scaling ────────────────────────────────────────────────────
resource "aws_appautoscaling_target" "services" {
  for_each           = var.services
  max_capacity       = each.value.max_count
  min_capacity       = each.value.min_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.services[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "services_cpu" {
  for_each           = var.services
  name               = "${var.project}-${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.services[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.services[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.services[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_target" "realtime" {
  max_capacity       = var.realtime_max_count
  min_capacity       = var.realtime_min_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.realtime.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "realtime_cpu" {
  name               = "${var.project}-realtime-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.realtime.resource_id
  scalable_dimension = aws_appautoscaling_target.realtime.scalable_dimension
  service_namespace  = aws_appautoscaling_target.realtime.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
