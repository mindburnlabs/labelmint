# AWS Application Load Balancer Configuration
provider "aws" {
  region = var.aws_region
}

# Application Load Balancer
resource "aws_lb" "labelmint_alb" {
  name               = "labelmint-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.public_subnet_ids

  # Enable access logs
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    prefix  = "alb-logs"
    enabled = true
  }

  # Enable deletion protection in production
  enable_deletion_protection = var.environment == "production" ? true : false

  # Enable cross-zone load balancing
  enable_cross_zone_load_balancing = true

  # Enable HTTP/2
  enable_http2 = true

  # IP address type
  ip_address_type = "ipv4"

  # Enable TLS version 1.2 and 1.3
  drop_invalid_header_fields = true

  tags = {
    Name        = "labelmint-alb"
    Environment = var.environment
    Project     = "labelmint"
    ManagedBy   = "terraform"
  }
}

# HTTPS Listener with SSL certificate
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.labelmint_alb.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # Modern TLS policy
  certificate_arn   = var.ssl_certificate_arn

  # Default action - forward to primary target group
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.primary_tg.arn
  }

  tags = {
    Name        = "labelmint-https-listener"
    Environment = var.environment
  }
}

# HTTP Listener (redirects to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.labelmint_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = {
    Name        = "labelmint-http-listener"
    Environment = var.environment
  }
}

# Primary Target Group (Web servers)
resource "aws_lb_target_group" "primary_tg" {
  name     = "labelmint-primary-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  # Health check configuration
  health_check {
    enabled             = true
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    path                = "/api/health"
    matcher             = "200"
    protocol            = "HTTP"
    port                = "traffic-port"
  }

  # Deregistration delay
  deregistration_delay = 60

  # Target type (instance or ip)
  target_type = "ip"

  # Stickiness for websockets
  stickiness {
    enabled    = true
    type       = "lb_cookie"
    cookie_duration = 3600 # 1 hour
  }

  # Protocol version
  protocol_version = "HTTP1"

  # Enable slow start
  slow_start = 60

  # Load balancing algorithm
  load_balancing_algorithm_type = "round_robin"

  tags = {
    Name        = "labelmint-primary-tg"
    Environment = var.environment
    Component   = "web"
  }

  depends_on = [aws_lb.labelmint_alb]
}

# API Target Group (API servers)
resource "aws_lb_target_group" "api_tg" {
  name     = "labelmint-api-tg"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 15
    path                = "/api/health"
    matcher             = "200"
    protocol            = "HTTP"
    port                = "traffic-port"
  }

  deregistration_delay = 30
  target_type          = "ip"

  # No stickiness for API (stateless)
  stickiness {
    enabled = false
    type    = "lb_cookie"
  }

  protocol_version = "HTTP1"

  tags = {
    Name        = "labelmint-api-tg"
    Environment = var.environment
    Component   = "api"
  }

  depends_on = [aws_lb.labelmint_alb]
}

# WebSocket Target Group
resource "aws_lb_target_group" "websocket_tg" {
  name     = "labelmint-websocket-tg"
  port     = 3002
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    path                = "/api/health"
    matcher             = "200"
    protocol            = "HTTP"
    port                = "traffic-port"
  }

  deregistration_delay = 120 # Longer for WebSocket connections
  target_type          = "ip"

  # Sticky sessions required for WebSocket
  stickiness {
    enabled        = true
    type           = "app_cookie"
    cookie_name    = "WS_SESSION"
    cookie_duration = 86400 # 24 hours
  }

  protocol_version = "HTTP1"

  tags = {
    Name        = "labelmint-websocket-tg"
    Environment = var.environment
    Component   = "websocket"
  }

  depends_on = [aws_lb.labelmint_alb]
}

# Listener Rules for routing
resource "aws_lb_listener_rule" "api_routing" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_tg.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }

  tags = {
    Name        = "api-routing-rule"
    Environment = var.environment
  }
}

resource "aws_lb_listener_rule" "websocket_routing" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 90

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.websocket_tg.arn
  }

  condition {
    path_pattern {
      values = ["/ws/*", "/socket.io/*"]
    }
  }

  condition {
    http_header {
      http_header_name = "Upgrade"
      values           = ["websocket"]
    }
  }

  tags = {
    Name        = "websocket-routing-rule"
    Environment = var.environment
  }
}

# Static assets routing to CloudFront (via redirect)
resource "aws_lb_listener_rule" "static_assets" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 80

  action {
    type = "redirect"

    redirect {
      host        = "cdn.labelmint.it"
      path        = "/#{path}"
      query       = "#{query}"
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_302"
    }
  }

  condition {
    path_pattern {
      values = ["/assets/*", "/static/*", "/_nuxt/*", "*.js", "*.css", "*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg", "*.webp", "*.woff", "*.woff2"]
    }
  }

  tags = {
    Name        = "static-assets-redirect"
    Environment = var.environment
  }
}

# Security Group for ALB
resource "aws_security_group" "alb_sg" {
  name_prefix = "labelmint-alb-sg"
  vpc_id      = var.vpc_id

  # HTTP access
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP access"
  }

  # HTTPS access
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS access"
  }

  # Egress to target groups
  egress {
    from_port   = 3000
    to_port     = 3002
    protocol    = "tcp"
    security_groups = [var.ecs_security_group_id]
    description = "Access to ECS services"
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name        = "labelmint-alb-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# WAF Web ACL for ALB protection
resource "aws_wafv2_web_acl" "labelmint_waf" {
  name        = "labelmint-waf"
  scope       = "REGIONAL"
  description = "WAF for Deligate ALB"

  # AWS Managed Rules
  default_action {
    allow {}
  }

  # Rule to allow known IPs
  rule {
    name     = "allow-known-ips"
    priority = 1

    action {
      allow {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.allowed_ips.arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "allow-known-ips"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Common Rule Set
  rule {
    name     = "aws-managed-common-rule-set"
    priority = 10

    override {
      action {
        block {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesCommonRuleSet"
          vendor_name = "AWS"

          # Exclusions for specific rules
          excluded_rule {
            name = "SizeRestrictions_BODY"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-managed-common-rule-set"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed SQL Injection Rule Set
  rule {
    name     = "aws-managed-sql-injection"
    priority = 20

    override {
      action {
        block {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesSQLiRuleSet"
          vendor_name = "AWS"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-managed-sql-injection"
      sampled_requests_enabled   = true
    }
  }

  # Rate limiting rule
  rule {
    name     = "rate-limit"
    priority = 100

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 5000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "labelmint-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "labelmint-waf"
    Environment = var.environment
  }
}

# WAF IP Set for allowed IPs
resource "aws_wafv2_ip_set" "allowed_ips" {
  name               = "labelmint-allowed-ips"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = var.allowed_ips
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "labelmint_waf_alb" {
  resource_arn = aws_lb.labelmint_alb.arn
  web_acl_arn  = aws_wafv2_web_acl.labelmint_waf.arn
}

# S3 Bucket for ALB logs
resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${var.environment}-labelmint-alb-logs-${random_string.suffix.result}"
  force_destroy = true

  tags = {
    Name        = "labelmint-alb-logs"
    Environment = var.environment
    Purpose     = "alb-access-logs"
  }
}

# Random suffix for unique bucket name
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# S3 Bucket versioning
resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Bucket lifecycle
resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "alb_logs_lifecycle"
    status = "Enabled"

    expiration {
      days = 90
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 60
      storage_class = "GLACIER"
    }
  }
}

# CloudWatch Log Group for ALB
resource "aws_cloudwatch_log_group" "alb_logs" {
  name              = "/aws/alb/labelmint-alb"
  retention_in_days = 30

  tags = {
    Name        = "labelmint-alb-logs"
    Environment = var.environment
  }
}

# Outputs
output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.labelmint_alb.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.labelmint_alb.zone_id
}

output "alb_arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.labelmint_alb.arn
}

output "target_group_arns" {
  description = "ARNs of the target groups"
  value = {
    primary   = aws_lb_target_group.primary_tg.arn
    api       = aws_lb_target_group.api_tg.arn
    websocket = aws_lb_target_group.websocket_tg.arn
  }
}