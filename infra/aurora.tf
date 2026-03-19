# ─── RDS PostgreSQL ──────────────────────────────────────────────────
# Phase 1: db.t4g.micro (free tier eligible 12 months)
# Phase 2: db.t4g.small/medium (upgrade via db_instance_class variable)
# Phase 3: Migrate to Aurora Serverless v2 (when 500+ daily orders)

resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.project}-db-subnet" }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project}-db"
  engine         = "postgres"
  engine_version = "16.4"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100 # Auto-scales storage up to 100 GB
  storage_type          = "gp3"

  db_name  = "zimfeast_auth" # Default DB; others created via init
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  multi_az            = var.db_multi_az
  publicly_accessible = false

  backup_retention_period   = 7
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-final-snapshot"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  tags = { Name = "${var.project}-db" }
}

# Create the per-service databases
resource "null_resource" "create_databases" {
  depends_on = [aws_db_instance.main]

  provisioner "local-exec" {
    command = <<-EOT
      for db in zimfeast_restaurants zimfeast_orders zimfeast_drivers zimfeast_payments; do
        PGPASSWORD=${var.db_password} psql -h ${aws_db_instance.main.address} -U ${var.db_username} -d zimfeast_auth -c "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 || \
        PGPASSWORD=${var.db_password} psql -h ${aws_db_instance.main.address} -U ${var.db_username} -d zimfeast_auth -c "CREATE DATABASE $db;"
      done
    EOT
  }
}
