# ─── IAM Roles (Phase 2+: ECS) ───────────────────────────────────────

# ECS Task Execution Role — allows ECS to pull images from ECR and write logs
resource "aws_iam_role" "ecs_execution" {
  count = var.phase != "phase1" ? 1 : 0

  name = "${var.project}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  count = var.phase != "phase1" ? 1 : 0

  role       = aws_iam_role.ecs_execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role — allows running containers to access AWS services
resource "aws_iam_role" "ecs_task" {
  count = var.phase != "phase1" ? 1 : 0

  name = "${var.project}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

# Allow ECS tasks to read secrets from Secrets Manager
resource "aws_iam_role_policy" "ecs_task_secrets" {
  count = var.phase != "phase1" ? 1 : 0

  name = "${var.project}-ecs-task-secrets"
  role = aws_iam_role.ecs_task[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
      ]
      Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.project}/*"
    }]
  })
}

# ─── CI/CD IAM User ─────────────────────────────────────────────────
# Used by GitHub Actions to push images and deploy

resource "aws_iam_user" "cicd" {
  name = "${var.project}-cicd"
}

resource "aws_iam_user_policy" "cicd" {
  name = "${var.project}-cicd-policy"
  user = aws_iam_user.cicd.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
        ]
        Resource = "*"
      },
    ]
  })
}
