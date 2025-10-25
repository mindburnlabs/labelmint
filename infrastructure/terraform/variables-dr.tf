# Disaster Recovery Variables

variable "dr_region" {
  description = "AWS region for disaster recovery"
  type        = string
  default     = "us-west-2"
}

variable "dr_vpc_cidr" {
  description = "CIDR block for DR VPC"
  type        = string
  default     = "10.1.0.0/16"
}

variable "backup_retention_days" {
  description = "Default backup retention period in days"
  type        = number
  default     = 90
}

variable "cross_region_backup_enabled" {
  description = "Enable cross-region backup replication"
  type        = bool
  default     = true
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "enable_global_redis" {
  description = "Enable Redis Global Datastore"
  type        = bool
  default     = false
}

variable "backup_window_start" {
  description = "Start time for backup window (HH:MM)"
  type        = string
  default     = "02:00"
}

variable "backup_window_end" {
  description = "End time for backup window (HH:MM)"
  type        = string
  default     = "04:00"
}

variable "rpo_threshold_minutes" {
  description = "Recovery Point Objective threshold in minutes"
  type        = number
  default     = 60
}

variable "rto_threshold_minutes" {
  description = "Recovery Time Objective threshold in minutes"
  type        = number
  default     = 240
}

variable "dr_environment_ready" {
  description = "DR environment is ready for failover"
  type        = bool
  default     = false
}

variable "backup_encryption_enabled" {
  description = "Enable backup encryption"
  type        = bool
  default     = true
}

variable "automated_backup_testing" {
  description = "Enable automated backup testing"
  type        = bool
  default     = true
}

variable "backup_compliance_reporting" {
  description = "Enable backup compliance reporting"
  type        = bool
  default     = true
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for backup notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "emergency_contacts" {
  description = "List of emergency contact emails"
  type        = list(string)
  default     = []
}

variable "dr_notification_emails" {
  description = "List of DR notification emails"
  type        = list(string)
  default     = []
}

variable "backup_cost_optimization" {
  description = "Enable backup cost optimization features"
  type        = bool
  default     = true
}

variable "backup_performance_tier" {
  description = "Backup performance tier"
  type        = string
  default     = "standard"
  validation {
    condition = contains(["standard", "high"], var.backup_performance_tier)
    error_message = "The backup_performance_tier must be either 'standard' or 'high'."
  }
}