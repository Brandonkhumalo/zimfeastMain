# ─── Aurora Serverless v2 (PostgreSQL) ──────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.project}-db-subnet" }
}

resource "aws_rds_cluster" "main" {
  cluster_identifier     = "${var.project}-cluster"
  engine                 = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = "16.4"
  master_username        = var.db_username
  master_password        = var.db_password
  database_name          = "zimfeast_auth" # Default DB; others created via init
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  backup_retention_period = 7
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.project}-final-snapshot"

  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 16
  }

  tags = { Name = "${var.project}-aurora" }
}

resource "aws_rds_cluster_instance" "main" {
  count              = 1
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version

  tags = { Name = "${var.project}-aurora-instance-${count.index}" }
}

# Create the 5 per-service databases using a provisioner
resource "null_resource" "create_databases" {
  depends_on = [aws_rds_cluster_instance.main]

  provisioner "local-exec" {
    command = <<-EOT
      for db in zimfeast_restaurants zimfeast_orders zimfeast_drivers zimfeast_payments; do
        PGPASSWORD=${var.db_password} psql -h ${aws_rds_cluster.main.endpoint} -U ${var.db_username} -d zimfeast_auth -c "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 || \
        PGPASSWORD=${var.db_password} psql -h ${aws_rds_cluster.main.endpoint} -U ${var.db_username} -d zimfeast_auth -c "CREATE DATABASE $db;"
      done
    EOT
  }
}
