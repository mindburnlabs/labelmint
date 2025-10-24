# Staging Environment Configuration

environment = "staging"
app_image = "your-registry/labelmintit:staging"
domain_name = "staging.labelmintit.com"
ssl_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/staging-cert-arn"
alert_email = "alerts@labelmintit.com"

# Database - smaller instance for staging
db_password = "staging-db-password"
db_instance_class = "db.t4g.small"
db_read_replica_instance_class = "db.t4g.small"
db_allocated_storage = 50
db_max_allocated_storage = 500

# Redis - smaller node for staging
redis_node_type = "cache.t4g.micro"
redis_num_nodes = 2
redis_auth_token = "staging-redis-token"

# ECS - smaller resources for staging
task_cpu = 512
task_memory = 1024
desired_count = 1
min_capacity = 1
max_capacity = 3

# Secrets
jwt_secret = "staging-jwt-secret-key"
openai_api_key = "sk-test-staging-openai-key"
stripe_secret_key = "sk_test_staging_stripe_key"

# Security
enable_shield_advanced = false
waf_whitelist_ips = []

# AWS Region
aws_region = "us-east-1"
availability_zones = ["us-east-1a", "us-east-1b"]
vpc_cidr = "10.1.0.0/16"

# Route53 (optional)
route53_zone_id = ""