# Variables for Payment System Infrastructure

variable "payments_image" {
  description = "Docker image for payment services"
  type        = string
  default     = "labelmint/payments:latest"
}

variable "payments_desired_count" {
  description = "Desired count of payment service tasks"
  type        = number
  default     = 2
}

variable "payments_min_capacity" {
  description = "Minimum capacity for payment service auto scaling"
  type        = number
  default     = 1
}

variable "payments_max_capacity" {
  description = "Maximum capacity for payment service auto scaling"
  type        = number
  default     = 10
}

variable "payment_alert_email" {
  description = "Email address for payment alerts"
  type        = string
  sensitive   = true
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for payment alerts"
  type        = string
  sensitive   = true
  default     = ""
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "ton_api_key" {
  description = "TON API key for mainnet access"
  type        = string
  sensitive   = true
}

variable "stripe_secret_key" {
  description = "Stripe secret key for backup payments"
  type        = string
  sensitive   = true
}

variable "paypal_client_id" {
  description = "PayPal client ID for backup payments"
  type        = string
  sensitive   = true
}

variable "paypal_client_secret" {
  description = "PayPal client secret for backup payments"
  type        = string
  sensitive   = true
}

variable "enable_payment_monitoring" {
  description = "Enable payment monitoring service"
  type        = bool
  default     = true
}

variable "enable_fee_optimization" {
  description = "Enable automatic fee optimization"
  type        = bool
  default     = true
}

variable "backup_payment_methods" {
  description = "List of enabled backup payment methods"
  type        = list(string)
  default     = ["stripe", "paypal"]
}

variable "payment_failure_threshold" {
  description = "Payment failure rate threshold for alerts (%)"
  type        = number
  default     = 5
}

variable "pending_transaction_threshold" {
  description = "Pending transaction count threshold for alerts"
  type        = number
  default     = 100
}

variable "gas_price_threshold" {
  description = "Gas price threshold for alerts (in nanoTON)"
  type        = string
  default     = "150000000"
}

variable "max_transaction_amount" {
  description = "Maximum transaction amount in USDT"
  type        = string
  default     = "1000000000000"
}

variable "min_transaction_amount" {
  description = "Minimum transaction amount in USDT"
  type        = string
  default     = "1000000"
}

variable "payment_security_group" {
  description = "Security group ID for payment services"
  type        = string
  default     = ""
}

variable "enable_multisig" {
  description = "Enable multi-signature for large transactions"
  type        = bool
  default     = true
}

variable "multisig_threshold" {
  description = "Threshold amount requiring multi-signature (in USDT)"
  type        = string
  default     = "1000000000000"
}

variable "max_daily_volume" {
  description = "Maximum daily transaction volume (in USDT)"
  type        = string
  default     = "10000000000000"
}

variable "suspicious_activity_threshold" {
  description = "Number of failed transactions to trigger suspicious activity alert"
  type        = number
  default     = 10
}