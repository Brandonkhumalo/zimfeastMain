# ─── Outputs ─────────────────────────────────────────────────────────
output "nameservers" {
  description = "Point your domain registrar to these nameservers"
  value       = aws_route53_zone.main.name_servers
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.main.domain_name
}

output "alb_dns" {
  value = aws_lb.main.dns_name
}

output "aurora_endpoint" {
  value = aws_rds_cluster.main.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "frontend_bucket" {
  value = aws_s3_bucket.frontend.id
}

output "media_bucket" {
  value = aws_s3_bucket.media.id
}

output "ecr_urls" {
  value = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.main.id
}
