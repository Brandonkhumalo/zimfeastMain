# ─── Core ────────────────────────────────────────────────────────────
variable "project" {
  default = "zimfeast"
}

variable "aws_region" {
  default = "af-south-1" # Cape Town - closest to Zimbabwe
}

variable "domain" {
  default = "zimfeast.com"
}

# ─── Database ────────────────────────────────────────────────────────
variable "db_username" {
  default   = "zimfeast"
  sensitive = true
}

variable "db_password" {
  sensitive = true
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

variable "vite_google_maps_api_key" {
  default = ""
}

variable "openai_api_key" {
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

# ─── Database sizing ─────────────────────────────────────────────────
variable "db_instance_class" {
  description = "RDS instance class — Phase 1: db.t4g.micro, Phase 2: db.t4g.small, Phase 3: db.t4g.medium"
  default     = "db.t4g.micro" # Free tier eligible for 12 months
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for RDS high availability (Phase 2+)"
  default     = false
}

# ─── Service sizing ──────────────────────────────────────────────────
variable "services" {
  description = "Fargate service definitions"
  type = map(object({
    port       = number
    cpu        = number
    memory     = number
    min_count  = number
    max_count  = number
    db_name    = string
    db_env_var = string
  }))
  default = {
    auth = {
      port       = 8001
      cpu        = 256
      memory     = 512
      min_count  = 1
      max_count  = 10
      db_name    = "zimfeast_auth"
      db_env_var = "AUTH_DB_NAME"
    }
    restaurant = {
      port       = 8002
      cpu        = 256
      memory     = 512
      min_count  = 1
      max_count  = 10
      db_name    = "zimfeast_restaurants"
      db_env_var = "RESTAURANT_DB_NAME"
    }
    order = {
      port       = 8003
      cpu        = 256       # Go: reduced from 512 (Django)
      memory     = 512       # Fargate minimum for 256 CPU
      min_count  = 1
      max_count  = 20
      db_name    = "zimfeast_orders"
      db_env_var = "ORDER_DB_NAME"
    }
    driver = {
      port       = 8004
      cpu        = 256
      memory     = 512       # Fargate minimum for 256 CPU
      min_count  = 1
      max_count  = 10
      db_name    = "zimfeast_drivers"
      db_env_var = "DRIVER_DB_NAME"
    }
    payment = {
      port       = 8005
      cpu        = 256
      memory     = 512
      min_count  = 1
      max_count  = 15
      db_name    = "zimfeast_payments"
      db_env_var = "PAYMENT_DB_NAME"
    }
  }
}

variable "realtime_cpu" {
  default = 256
}

variable "realtime_memory" {
  default = 512  # Fargate minimum for 256 CPU
}

variable "realtime_min_count" {
  default = 1
}

variable "realtime_max_count" {
  default = 10
}
