# ─── ElastiCache Redis ──────────────────────────────────────────────
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project}-redis"
  description          = "ZimFeast Redis cluster"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t3.micro" # Start small, upgrade as needed
  num_cache_clusters   = 1
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  automatic_failover_enabled = false
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false # Set true if needed, requires TLS in app

  tags = { Name = "${var.project}-redis" }
}
