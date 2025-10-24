# ECS Outputs
output "ecs_cluster_name" {
  description = "ECS Cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS Service name"
  value       = aws_ecs_service.app.name
}

output "ecs_task_definition_arn" {
  description = "ECS Task Definition ARN"
  value       = aws_ecs_task_definition.app.arn
}

# ALB Outputs
output "load_balancer_dns_name" {
  description = "Load Balancer DNS name"
  value       = aws_lb.main.dns_name
}

output "load_balancer_zone_id" {
  description = "Load Balancer Zone ID"
  value       = aws_lb.main.zone_id
}

output "load_balancer_arn" {
  description = "Load Balancer ARN"
  value       = aws_lb.main.arn
}

# RDS Outputs
output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "rds_port" {
  description = "RDS port"
  value       = aws_db_instance.main.port
}

output "rds_instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}

output "rds_read_replica_endpoint" {
  description = "RDS read replica endpoint"
  value       = var.environment == "production" ? aws_db_instance.read_replica[0].endpoint : null
  sensitive   = true
}

# Redis Outputs
output "redis_endpoint" {
  description = "Redis endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_auth_token" {
  description = "Redis auth token"
  value       = aws_elasticache_replication_group.main.auth_token
  sensitive   = true
}

# S3 Outputs
output "assets_bucket_name" {
  description = "S3 assets bucket name"
  value       = aws_s3_bucket.assets.id
}

output "assets_bucket_domain_name" {
  description = "S3 assets bucket domain name"
  value       = aws_s3_bucket.assets.bucket_domain_name
}

output "uploads_bucket_name" {
  description = "S3 uploads bucket name"
  value       = aws_s3_bucket.uploads.id
}

output "uploads_bucket_domain_name" {
  description = "S3 uploads bucket domain name"
  value       = aws_s3_bucket.uploads.bucket_domain_name
}

output "backups_bucket_name" {
  description = "S3 backups bucket name"
  value       = aws_s3_bucket.backups.id
}

# CloudFront Outputs
output "assets_cloudfront_domain_name" {
  description = "CloudFront distribution domain name for assets"
  value       = aws_cloudfront_distribution.assets.domain_name
}

output "uploads_cloudfront_domain_name" {
  description = "CloudFront distribution domain name for uploads"
  value       = aws_cloudfront_distribution.uploads.domain_name
}

output "assets_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for assets"
  value       = aws_cloudfront_distribution.assets.id
}

output "uploads_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for uploads"
  value       = aws_cloudfront_distribution.uploads.id
}

# VPC Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs"
  value       = module.vpc.natgw_ids
}

# Security Outputs
output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.main.arn
}

output "kms_key_id" {
  description = "KMS Key ID"
  value       = aws_kms_key.main.key_id
}

output "kms_key_arn" {
  description = "KMS Key ARN"
  value       = aws_kms_key.main.arn
}

# Monitoring Outputs
output "cloudwatch_log_group_name" {
  description = "CloudWatch Log Group name"
  value       = aws_cloudwatch_log_group.ecs_logs.name
}

output "sns_topic_arn" {
  description = "SNS Topic ARN for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch Dashboard URL"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

# Secrets Outputs
output "jwt_secret_arn" {
  description = "JWT Secret ARN"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "api_keys_secret_arn" {
  description = "API Keys Secret ARN"
  value       = aws_secretsmanager_secret.api_keys.arn
}

# Route53 Outputs (if applicable)
output "certificate_validation_records" {
  description = "Certificate validation records"
  value = aws_acm_certificate_validation.main.fqdns
}