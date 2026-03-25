# ─── RDS PostgreSQL (PostGIS) ─────────────────────────────────────────
# Phase 1: db.t3.micro (free tier 12mo), single AZ
# Phase 2: db.t3.small, Multi-AZ
# Phase 3: Split into 3 RDS instances (auth+payments, orders, restaurants)

resource "aws_security_group" "rds" {
  name_prefix = "${var.project}-rds-"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
    description     = "PostgreSQL from backend services"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-rds" }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project}-db"
  engine         = "postgres"
  engine_version = "16"

  instance_class        = var.db_instance_class
  allocated_storage     = 20
  max_allocated_storage = 100 # auto-scale storage
  storage_type          = "gp3"

  db_name  = "postgres" # default DB; per-service DBs created by init-db.sql
  username = var.db_username
  password = var.db_password

  multi_az               = var.db_multi_az
  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.project}-db-final"

  # Enable Performance Insights (free for db.t3 instances)
  performance_insights_enabled = true

  tags = { Name = "${var.project}-db" }
}
