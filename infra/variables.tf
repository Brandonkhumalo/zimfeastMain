# ─── Core ────────────────────────────────────────────────────────────
variable "project" {
  default = "zimfeast"
}

variable "aws_region" {
  default = "af-south-1" # Cape Town — lowest latency to Zimbabwe
}

variable "environment" {
  default = "production"
}

variable "domain" {
  default = "zimfeast.com"
}

# ─── Phase Control ──────────────────────────────────────────────────
variable "phase" {
  description = "Deployment phase: phase1, phase2, or phase3"
  default     = "phase1"
  validation {
    condition     = contains(["phase1", "phase2", "phase3"], var.phase)
    error_message = "phase must be one of: phase1, phase2, phase3"
  }
}

# ─── Database ────────────────────────────────────────────────────────
variable "db_username" {
  default   = "zimfeast"
  sensitive = true
}

variable "db_password" {
  sensitive = true
}

variable "db_instance_class" {
  description = "phase1: db.t3.micro, phase2+: db.t3.small"
  default     = "db.t3.micro"
}

variable "db_multi_az" {
  description = "Enable Multi-AZ failover (phase2+)"
  default     = false
}

# ─── EC2 (Phase 1) ──────────────────────────────────────────────────
variable "ec2_instance_type" {
  default = "t3.small"
}

variable "ec2_key_name" {
  description = "EC2 key pair name (leave empty for EC2 Instance Connect)"
  default     = ""
}

# ─── Secrets ─────────────────────────────────────────────────────────
variable "django_secret_key" {
  sensitive = true
}

variable "jwt_secret_key" {
  sensitive = true
}

variable "service_api_key" {
  sensitive = true
}

variable "google_api_key" {
  default   = ""
  sensitive = true
}

variable "sendgrid_api_key" {
  default   = ""
  sensitive = true
}

variable "paynow_integration_id" {
  default   = ""
  sensitive = true
}

variable "paynow_integration_key" {
  default   = ""
  sensitive = true
}

variable "tumago_api_key" {
  default   = ""
  sensitive = true
}

variable "tumago_api_secret" {
  default   = ""
  sensitive = true
}

variable "field_encryption_key" {
  default   = ""
  sensitive = true
}
