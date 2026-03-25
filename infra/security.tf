# ─── Security Groups ─────────────────────────────────────────────────
# Shared backend security group used by EC2 (Phase 1) and ECS (Phase 2+).

resource "aws_security_group" "backend" {
  name_prefix = "${var.project}-backend-"
  vpc_id      = data.aws_vpc.default.id

  # SSH (EC2 Instance Connect)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH / EC2 Instance Connect"
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  # Internal: allow all traffic within this security group (service-to-service)
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
    description = "Internal service-to-service"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-backend" }
}
