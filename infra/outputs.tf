# ─── Outputs ─────────────────────────────────────────────────────────

output "nameservers" {
  description = "Point your domain registrar to these nameservers"
  value       = aws_route53_zone.main.name_servers
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.main.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "ecr_registry" {
  description = "ECR registry URL (use in CI/CD)"
  value       = split("/", values(aws_ecr_repository.services)[0].repository_url)[0]
}

# Phase 1 outputs
output "ec2_public_ip" {
  description = "EC2 Elastic IP (Phase 1)"
  value       = var.phase == "phase1" ? aws_eip.ec2[0].public_ip : "N/A (Phase 2+)"
}

# Phase 2+ outputs
output "alb_dns_name" {
  description = "ALB DNS name (Phase 2+)"
  value       = var.phase != "phase1" ? aws_lb.main[0].dns_name : "N/A (Phase 1)"
}
