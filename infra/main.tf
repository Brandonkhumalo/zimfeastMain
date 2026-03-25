# ─── ZimFeast Infrastructure ─────────────────────────────────────────
# Phase-controlled deployment:
#   phase1 → EC2 + RDS micro + ElastiCache micro  (~$35/mo)
#   phase2 → ECS + ALB + RDS small Multi-AZ        (~$102/mo)
#   phase3 → ECS auto-scaling + RDS split           (~$200+/mo)
#
# Zero application code changes between phases.

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Store state in S3 (create bucket first):
  #   aws s3 mb s3://zimfeast-terraform-state --region af-south-1
  backend "s3" {
    bucket = "zimfeast-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "af-south-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}

# ─── Data Sources ────────────────────────────────────────────────────

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}
