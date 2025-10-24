# Production Environment Configuration

environment = "production"
app_image = "your-registry/labelmintit:production"
domain_name = "labelmintit.com"
ssl_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/prod-cert-arn"
alert_email = "alerts@labelmintit.com"

# Database - production instances
db_password = "production-db-password" # Use actual production password
db_instance_class = "db.r6g.large"
db_read_replica_instance_class = "db.r6g.large"
db_allocated_storage = 500
db_max_allocated_storage = 5000

# Redis - production configuration
redis_node_type = "cache.r6g.large"
redis_num_nodes = 3
redis_auth_token = "production-redis-token" # Use actual production token
redis_memory_threshold = 8589934592 # 8 GB

# ECS - production resources
task_cpu = 2048
task_memory = 4096
desired_count = 3
min_capacity = 2
max_capacity = 20

# Secrets - use actual production secrets
jwt_secret = "production-jwt-secret-key" # Use actual production secret
openai_api_key = "sk-prod-actual-openai-key" # Use actual production key
stripe_secret_key = "sk_live_production_stripe_key" # Use actual production key

# Security - enable advanced protection
enable_shield_advanced = true
waf_whitelist_ips = [
  "203.0.113.0/24",  # Example office IP range
  "198.51.100.0/24"   # Example CI/CD IP range
]

# AWS Region
aws_region = "us-east-1"
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
vpc_cidr = "10.0.0.0/16"

# Route53 for DNS validation
route53_zone_id = "Z1D633PEXAMPLE" # Replace with actual zone ID

# Application AWS Keys (if needed)
aws_access_key_id = "AKIAXXXXXXXXXXXXXXXX" # Use actual or IAM role
aws_secret_access_key = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"