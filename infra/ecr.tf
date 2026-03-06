# ─── ECR Repositories ────────────────────────────────────────────────
locals {
  ecr_repos = toset(["auth", "restaurant", "order", "driver", "payment", "realtime"])
}

resource "aws_ecr_repository" "services" {
  for_each             = local.ecr_repos
  name                 = "${var.project}/${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${var.project}-${each.key}" }
}

# Lifecycle policy: keep last 10 images
resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = local.ecr_repos
  repository = aws_ecr_repository.services[each.key].name

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
