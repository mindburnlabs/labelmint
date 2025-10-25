# Multi-Region Disaster Recovery Infrastructure for LabelMint

# DR Provider Configuration (to be added to providers.tf)
# provider "aws" {
#   alias  = "dr_region"
#   region = var.dr_region
# }

# DR Region VPC
resource "aws_vpc" "dr" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  cidr_block           = var.dr_vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-vpc"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region Subnets
resource "aws_subnet" "dr_public" {
  count = var.environment == "production" ? 3 : 0
  provider = aws.dr_region

  vpc_id                  = aws_vpc.dr[0].id
  cidr_block              = cidrsubnet(var.dr_vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.dr[0].names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-public-subnet-${count.index + 1}"
    Environment = var.environment
    Type = "Public"
    DR = "cross-region"
  }
}

resource "aws_subnet" "dr_private" {
  count = var.environment == "production" ? 3 : 0
  provider = aws.dr_region

  vpc_id            = aws_vpc.dr[0].id
  cidr_block        = cidrsubnet(var.dr_vpc_cidr, 4, count.index + 10)
  availability_zone = data.aws_availability_zones.dr[0].names[count.index]

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-private-subnet-${count.index + 1}"
    Environment = var.environment
    Type = "Private"
    DR = "cross-region"
  }
}

# DR Region Internet Gateway
resource "aws_internet_gateway" "dr" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  vpc_id = aws_vpc.dr[0].id

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-igw"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region NAT Gateways
resource "aws_eip" "dr_nat" {
  count = var.environment == "production" ? 3 : 0
  provider = aws.dr_region

  domain = "vpc"

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-nat-eip-${count.index + 1}"
    Environment = var.environment
    DR = "cross-region"
  }
}

resource "aws_nat_gateway" "dr" {
  count = var.environment == "production" ? 3 : 0
  provider = aws.dr_region

  allocation_id = aws_eip.dr_nat[count.index].id
  subnet_id     = aws_subnet.dr_public[count.index].id

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-nat-${count.index + 1}"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region Route Tables
resource "aws_route_table" "dr_public" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  vpc_id = aws_vpc.dr[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.dr[0].id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-public-rt"
    Environment = var.environment
    DR = "cross-region"
  }
}

resource "aws_route_table" "dr_private" {
  count = var.environment == "production" ? 3 : 0
  provider = aws.dr_region

  vpc_id = aws_vpc.dr[0].id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.dr[count.index].id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-private-rt-${count.index + 1}"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region Route Table Associations
resource "aws_route_table_association" "dr_public" {
  count = var.environment == "production" ? 3 : 0
  provider = aws.dr_region

  subnet_id      = aws_subnet.dr_public[count.index].id
  route_table_id = aws_route_table.dr_public[0].id
}

resource "aws_route_table_association" "dr_private" {
  count = var.environment == "production" ? 3 : 0
  provider = aws.dr_region

  subnet_id      = aws_subnet.dr_private[count.index].id
  route_table_id = aws_route_table.dr_private[count.index].id
}

# DR Region ECS Cluster
resource "aws_ecs_cluster" "dr" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  name = "${var.project_name}-${var.environment}-dr-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-cluster"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region Application Load Balancer
resource "aws_lb" "dr" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  name               = "${var.project_name}-${var.environment}-dr-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.dr_alb[0].id]
  subnets            = aws_subnet.dr_public[*].id

  enable_deletion_protection = false

  access_logs {
    bucket  = aws_s3_bucket.dr_alb_logs[0].id
    prefix  = "dr-alb-logs"
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-alb"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region ALB Security Group
resource "aws_security_group" "dr_alb" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  name        = "${var.project_name}-${var.environment}-dr-alb-sg"
  description = "Security group for DR ALB"
  vpc_id      = aws_vpc.dr[0].id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-alb-sg"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region ECS Task Security Group
resource "aws_security_group" "ecs_tasks_dr" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  name        = "${var.project_name}-${var.environment}-dr-ecs-tasks-sg"
  description = "Allow inbound traffic from DR ALB"
  vpc_id      = aws_vpc.dr[0].id

  ingress {
    description     = "From DR ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.dr_alb[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-ecs-tasks-sg"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region S3 Buckets
resource "aws_s3_bucket" "dr_backups" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  bucket = "${var.project_name}-${var.environment}-dr-backups"

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-backups"
    Environment = var.environment
    DR = "cross-region"
  }
}

resource "aws_s3_bucket_versioning" "dr_backups" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  bucket = aws_s3_bucket.dr_backups[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "dr_backups" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  bucket = aws_s3_bucket.dr_backups[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "dr_backups" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  bucket = aws_s3_bucket.dr_backups[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "dr_alb_logs" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  bucket = "${var.project_name}-${var.environment}-dr-alb-logs"

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-alb-logs"
    Environment = var.environment
    DR = "cross-region"
  }
}

# Route53 Health Checks and DNS Failover
resource "aws_route53_health_check" "primary" {
  fqdn                            = aws_lb.main.dns_name
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/health"
  failure_threshold               = 3
  request_interval                = 30
  cloudwatch_alarm_region         = var.aws_region
  cloudwatch_alarm_name           = aws_cloudwatch_metric_alarm.alb_unhealthy_hosts.alarm_name
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "${var.project_name}-${var.environment}-primary-health-check"
    Environment = var.environment
  }
}

resource "aws_route53_health_check" "dr" {
  count = var.environment == "production" ? 1 : 0

  fqdn                            = aws_lb.dr[0].dns_name
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/health"
  failure_threshold               = 3
  request_interval                = 30
  cloudwatch_alarm_region         = var.dr_region
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-health-check"
    Environment = var.environment
    DR = "cross-region"
  }
}

# Route53 Record Set with Failover
resource "aws_route53_record" "primary" {
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  set_identifier = "primary"
  failover_routing_policy {
    type = "PRIMARY"
  }

  alias {
    name                   = aws_lb.main.dns_name
    zone_id               = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.primary.id
}

resource "aws_route53_record" "dr" {
  count = var.environment == "production" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  set_identifier = "dr"
  failover_routing_policy {
    type = "SECONDARY"
  }

  alias {
    name                   = aws_lb.dr[0].dns_name
    zone_id               = aws_lb.dr[0].zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.dr[0].id
}

# CloudWatch Event Rules for Automated Failover
resource "aws_cloudwatch_event_rule" "failover_trigger" {
  name        = "${var.project_name}-${var.environment}-failover-trigger"
  description = "Trigger for automated failover to DR region"

  event_pattern = jsonencode({
    source      = ["aws.health"]
    detail-type = ["AWS Health Event"]
    detail = {
      eventScopeCode = ["PUBLIC", "ACCOUNT_SPECIFIC"]
      service       = ["EC2", "RDS", "ELASTICACHE"]
      eventTypeCode = [
        "AWS_EC2_INSTANCE_STOP_RETIREMENT_SCHEDULED",
        "AWS_EC2_INSTANCE_REBOOT_RETIREMENT_SCHEDULED",
        "AWS_RDS_DEGRADED_PERFORMANCE",
        "AWS_RDS_AVAILABILITY_EVENT",
        "AWS_ELASTICACHE_DEGRADED_PERFORMANCE",
        "AWS_ELASTICACHE_AVAILABILITY_EVENT"
      ]
    }
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-failover-trigger"
    Environment = var.environment
  }
}

# Lambda Function for Automated Failover
resource "aws_lambda_function" "failover" {
  filename         = "failover.zip"
  function_name    = "${var.project_name}-${var.environment}-failover"
  role            = aws_iam_role.failover_lambda.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 300

  environment {
    variables = {
      PRIMARY_REGION = var.aws_region
      DR_REGION = var.dr_region
      PRIMARY_CLUSTER = aws_ecs_cluster.main.name
      DR_CLUSTER = aws_ecs_cluster.dr[0].name
      PRIMARY_ALB = aws_lb.main.arn
      DR_ALB = aws_lb.dr[0].arn
      DOMAIN_NAME = var.domain_name
      NOTIFICATION_SNS = aws_sns_topic.alerts.arn
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-failover"
    Environment = var.environment
  }
}

# IAM Role for Failover Lambda
resource "aws_iam_role" "failover_lambda" {
  name = "${var.project_name}-${var.environment}-failover-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "failover_lambda" {
  name = "${var.project_name}-${var.environment}-failover-lambda-policy"
  role = aws_iam_role.failover_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeClusters",
          "ecs:ListTasks"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:ModifyListener",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeLoadBalancers"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "route53:ChangeResourceRecordSets",
          "route53:GetHealthCheck",
          "route53:UpdateHealthCheck"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}

# CloudWatch Event Target for Failover
resource "aws_cloudwatch_event_target" "failover_lambda" {
  rule      = aws_cloudwatch_event_rule.failover_trigger.name
  target_id = "FailoverLambda"
  arn       = aws_lambda_function.failover.arn
}

# RTO/RPO Monitoring CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "dr_metrics" {
  dashboard_name = "${var.project_name}-${var.environment}-dr-metrics"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Backup", "BackupJobStatus", "BackupVaultName", aws_backup_vault.postgres.name, "State", "COMPLETED"],
            [".", ".", ".", aws_backup_vault.redis.name, ".", "."]
          ]
          period = 3600
          stat   = "Sum"
          region = var.aws_region
          title  = "Backup Completion Status"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Route53", "HealthCheckStatus", "HealthCheckId", aws_route53_health_check.primary.id],
            [".", ".", ".", aws_route53_health_check.dr[0].id]
          ]
          period = 60
          stat   = "Average"
          region = var.aws_region
          title  = "Health Check Status"
          yAxis = {
            left = {
              min = 0
              max = 1
            }
          }
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main_enhanced.identifier],
            [".", "DatabaseConnections", ".", "."],
            [".", "FreeStorageSpace", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Primary Database Metrics"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "EngineCPUUtilization", "ReplicationGroupId", aws_elasticache_replication_group.main_enhanced.id],
            [".", "CurrConnections", ".", "."],
            [".", "BytesUsedForCache", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Primary Redis Metrics"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-metrics"
    Environment = var.environment
  }
}

# Data Sources for DR Region
data "aws_availability_zones" "dr" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region
  state = "available"
}