# ─── ECR Repositories ────────────────────────────────────────────────
# Docker image registry for all microservices. Created in all phases.

locals {
  ecr_repos = toset([
    "api-gateway",
    "auth-service",
    "restaurant-service",
    "order-service",
    "payment-service",
    "realtime-service",
    "frontend",
  ])
}

resource "aws_ecr_repository" "services" {
  for_each = local.ecr_repos

  name                 = "${var.project}-${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = false
  }
}

# Keep only the last 10 images to save storage cost
resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
