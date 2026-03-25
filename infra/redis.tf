# ─── ElastiCache Redis ───────────────────────────────────────────────
# Phase 1: cache.t3.micro (single node)
# Phase 2+: cache.t3.small

resource "aws_security_group" "redis" {
  name_prefix = "${var.project}-redis-"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
    description     = "Redis from backend services"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-redis" }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project}-redis"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.phase == "phase1" ? "cache.t3.micro" : "cache.t3.small"
  num_cache_nodes      = 1
  port                 = 6379
  parameter_group_name = "default.redis7"
  security_group_ids   = [aws_security_group.redis.id]

  tags = { Name = "${var.project}-redis" }
}
