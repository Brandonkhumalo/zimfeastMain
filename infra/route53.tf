# ─── DNS ──────────────────────────────────────────────────────────────
resource "aws_route53_zone" "main" {
  name = var.domain
  tags = { Name = "${var.project}-dns" }
}

# Phase 1: A record → EC2 Elastic IP
# Phase 2+: A record → ALB (alias)
resource "aws_route53_record" "root" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "A"

  # Phase 1: point to EC2 Elastic IP
  dynamic "alias" {
    for_each = var.phase != "phase1" ? [1] : []
    content {
      name                   = aws_lb.main[0].dns_name
      zone_id                = aws_lb.main[0].zone_id
      evaluate_target_health = true
    }
  }

  # Phase 1: direct IP
  ttl     = var.phase == "phase1" ? 300 : null
  records = var.phase == "phase1" ? [aws_eip.ec2[0].public_ip] : null
}

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain}"
  type    = "CNAME"
  ttl     = 300
  records = [var.domain]
}
