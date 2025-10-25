# Enhanced Redis Backup Configuration for LabelMint

# Enhanced ElastiCache Replication Group with Improved Backup
resource "aws_elasticache_replication_group" "main_enhanced" {
  replication_group_id       = "${var.project_name}-${var.environment}-redis-enhanced"
  description               = "Enhanced Redis cluster for ${var.environment}"
  engine                    = "redis"
  engine_version            = var.redis_engine_version
  node_type                 = var.redis_node_type
  port                      = 6379
  parameter_group_name       = aws_elasticache_parameter_group.enhanced.name

  num_cache_clusters         = var.redis_num_nodes
  automatic_failover_enabled = true
  multi_az_enabled          = true

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  # Enhanced Backup Configuration
  snapshot_window            = "02:00-04:00"  # Backup window
  snapshot_retention_limit   = 30            # Keep snapshots for 30 days
  maintenance_window         = "sun:05:00-sun:06:00"

  # Global Datastore for Cross-Region Replication
  global_replication_group_id = var.environment == "production" ? aws_elasticache_global_replication_group.main[0].global_replication_group_id : null

  auto_minor_version_upgrade = true

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Enhanced Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-enhanced"
    Environment = var.environment
    Backup = "enhanced"
  }
}

# Global Redis Replication Group for Cross-Region DR
resource "aws_elasticache_global_replication_group" "main" {
  count = var.environment == "production" ? 1 : 0

  global_replication_group_id        = "${var.project_name}-${var.environment}-redis-global"
  global_replication_group_description = "Global Redis replication for ${var.project_name} ${var.environment}"
  primary_region                    = var.aws_region

  members {
    region = var.aws_region
    replication_group_id = aws_elasticache_replication_group.main_enhanced.id
    role = "PRIMARY"
  }

  members {
    region = var.dr_region
    replication_group_id = aws_elasticache_replication_group.dr_replica[0].id
    role = "SECONDARY"
  }

  cache_node_type = var.redis_node_type
  engine = "redis"
  engine_version = var.redis_engine_version

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-global"
    Environment = var.environment
    DR = "global-replication"
  }
}

# DR Region Redis Replica
resource "aws_elasticache_replication_group" "dr_replica" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region

  replication_group_id       = "${var.project_name}-${var.environment}-redis-dr-replica"
  description               = "DR Redis replica for ${var.environment}"
  engine                    = "redis"
  engine_version            = var.redis_engine_version
  node_type                 = var.redis_node_type
  port                      = 6379
  parameter_group_name       = aws_elasticache_parameter_group_dr[0].name

  num_cache_clusters         = var.redis_num_nodes
  automatic_failover_enabled = true
  multi_az_enabled          = true

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  # DR Backup Configuration
  snapshot_window            = "03:00-05:00"
  snapshot_retention_limit   = 30
  maintenance_window         = "sun:06:00-sun:07:00"

  auto_minor_version_upgrade = true

  subnet_group_name  = aws_elasticache_subnet_group_dr[0].name
  security_group_ids = [aws_security_group_redis_dr[0].id]

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_dr[0].name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-dr-replica"
    Environment = var.environment
    DR = "cross-region-replica"
  }
}

# Enhanced Redis Parameter Group
resource "aws_elasticache_parameter_group" "enhanced" {
  family = "redis7.x"
  name   = "${var.project_name}-${var.environment}-redis-enhanced-params"

  # Memory Management
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  # Performance Optimization
  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  # Persistence Configuration for Backup Performance
  parameter {
    name  = "save"
    value = "900 1 300 10 60 10000"
  }

  parameter {
    name  = "stop-writes-on-bgsave-error"
    value = "yes"
  }

  parameter {
    name  = "rdbcompression"
    value = "yes"
  }

  parameter {
    name  = "rdbchecksum"
    value = "yes"
  }

  # AOF Configuration
  parameter {
    name  = "appendonly"
    value = "yes"
  }

  parameter {
    name  = "appendfsync"
    value = "everysec"
  }

  parameter {
    name  = "no-appendfsync-on-rewrite"
    value = "no"
  }

  parameter {
    name  = "auto-aof-rewrite-percentage"
    value = "100"
  }

  parameter {
    name  = "auto-aof-rewrite-min-size"
    value = "64mb"
  }

  # Slow Log Configuration
  parameter {
    name  = "slowlog-log-slower-than"
    value = "10000"
  }

  parameter {
    name  = "slowlog-max-len"
    value = "256"
  }

  # Event Notification
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  # Client Configuration
  parameter {
    name  = "maxclients"
    value = "10000"
  }

  # Replication Configuration
  parameter {
    name  = "min-replicas-max-lag"
    value = "10"
  }

  parameter {
    name  = "min-replicas-to-write"
    value = "1"
  }

  # Security Configuration
  parameter {
    name  = "protected-mode"
    value = "yes"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-enhanced-params"
    Environment = var.environment
  }
}

# DR Region Parameter Group
resource "aws_elasticache_parameter_group" "dr" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region
  family = "redis7.x"
  name   = "${var.project_name}-${var.environment}-redis-dr-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  parameter {
    name  = "save"
    value = "900 1 300 10 60 10000"
  }

  parameter {
    name  = "stop-writes-on-bgsave-error"
    value = "yes"
  }

  parameter {
    name  = "rdbcompression"
    value = "yes"
  }

  parameter {
    name  = "rdbchecksum"
    value = "yes"
  }

  parameter {
    name  = "appendonly"
    value = "yes"
  }

  parameter {
    name  = "appendfsync"
    value = "everysec"
  }

  parameter {
    name  = "slowlog-log-slower-than"
    value = "10000"
  }

  parameter {
    name  = "slowlog-max-len"
    value = "256"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-dr-params"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region Subnet Group
resource "aws_elasticache_subnet_group" "dr" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region
  name       = "${var.project_name}-${var.environment}-cache-dr-subnet"
  subnet_ids = aws_subnet.dr_private[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-cache-dr-subnet"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region Security Group
resource "aws_security_group" "redis_dr" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region
  name        = "${var.project_name}-${var.environment}-redis-dr-sg"
  description = "Allow traffic for DR Redis"
  vpc_id      = aws_vpc.dr[0].id

  ingress {
    description     = "Redis from DR ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks_dr[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-dr-sg"
    Environment = var.environment
    DR = "cross-region"
  }
}

# DR Region CloudWatch Log Group
resource "aws_cloudwatch_log_group" "redis_slow_dr" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region
  name              = "/aws/elasticache/redis/${var.project_name}-${var.environment}/slow-log-dr"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-slow-logs-dr"
    Environment = var.environment
    DR = "cross-region"
  }
}

# Redis Backup Vault
resource "aws_backup_vault" "redis" {
  name = "${var.project_name}-${var.environment}-redis-backup-vault"

  encryption_key_arn = aws_kms_key.backup.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-backup-vault"
    Environment = var.environment
  }
}

# Redis Backup Plan
resource "aws_backup_plan" "redis" {
  name = "${var.project_name}-${var.environment}-redis-backup-plan"

  rule {
    name              = "daily_redis_backups"
    target_vault_name = aws_backup_vault.redis.name
    schedule          = "cron(0 3 * * ? *)"

    lifecycle {
      delete_after = 60  # Keep daily Redis backups for 60 days
    }

    recovery_point_tags = {
      Name = "${var.project_name}-${var.environment}-redis-backup"
      Environment = var.environment
      BackupType = "daily"
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.redis_dr.arn
      lifecycle {
        delete_after = 120  # Keep DR backups for 120 days
      }
    }
  }

  rule {
    name              = "weekly_redis_backups"
    target_vault_name = aws_backup_vault.redis.name
    schedule          = "cron(0 4 ? * SUN *)"

    lifecycle {
      delete_after = 365  # Keep weekly backups for 1 year
    }

    recovery_point_tags = {
      Name = "${var.project_name}-${var.environment}-redis-backup"
      Environment = var.environment
      BackupType = "weekly"
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.redis_dr.arn
      lifecycle {
        delete_after = 2555  # Keep DR backups for 7 years
      }
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-backup-plan"
    Environment = var.environment
  }
}

# Redis Backup Selection
resource "aws_backup_selection" "redis" {
  iam_role_arn = aws_iam_role.backup_service.arn
  name         = "${var.project_name}-${var.environment}-redis-selection"
  plan_id      = aws_backup_plan.redis.id

  resources = [aws_elasticache_replication_group.main_enhanced.arn]

  selection_tag {
    type  = "STRING_EQUALS"
    key   = "Environment"
    value = var.environment
  }
}

# DR Redis Backup Vault
resource "aws_backup_vault" "redis_dr" {
  provider = aws.dr_region
  name = "${var.project_name}-${var.environment}-redis-backup-vault-dr"

  encryption_key_arn = aws_kms_key.backup_dr.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-backup-vault-dr"
    Environment = var.environment
    DR = "cross-region"
  }
}

# Enhanced CloudWatch Alarms for Redis Backup
resource "aws_cloudwatch_metric_alarm" "redis_snapshot_failed" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-snapshot-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ReplicationGroup"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "Redis snapshot creation failed"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main_enhanced.id
  }

  metric_query {
    id = "m1"
    return_data = true
    metric {
      metric_name = "CurrItems"
      namespace = "AWS/ElastiCache"
      period = "300"
      stat = "Average"
      dimensions = {
        ReplicationGroupId = aws_elasticache_replication_group.main_enhanced.id
      }
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-snapshot-failed-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high_critical" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-memory-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "BytesUsedForCache"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "10737418240" # 10 GB, more critical threshold
  alarm_description   = "Redis memory usage is critically high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main_enhanced.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-memory-critical-alarm"
    Environment = var.environment
  }
}

# Redis Restore Testing Lambda Function
resource "aws_lambda_function" "redis_backup_test" {
  filename         = "redis-backup-test.zip"
  function_name    = "${var.project_name}-${var.environment}-redis-backup-test"
  role            = aws_iam_role.lambda_redis_restore_test.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 900

  environment {
    variables = {
      REDIS_CLUSTER_ID = aws_elasticache_replication_group.main_enhanced.id
      DR_REDIS_CLUSTER_ID = var.environment == "production" ? aws_elasticache_replication_group.dr_replica[0].id : ""
      BACKUP_VAULT = aws_backup_vault.redis.name
      DR_BACKUP_VAULT = aws_backup_vault.redis_dr.name
      SNAPSHOT_RETENTION_DAYS = "7"
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-backup-test"
    Environment = var.environment
  }
}

# IAM Role for Redis Backup Test Lambda
resource "aws_iam_role" "lambda_redis_restore_test" {
  name = "${var.project_name}-${var.environment}-lambda-redis-restore-test-role"

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

resource "aws_iam_role_policy" "lambda_redis_restore_test" {
  name = "${var.project_name}-${var.environment}-lambda-redis-restore-test-policy"
  role = aws_iam_role.lambda_redis_restore_test.id

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
          "backup:DescribeBackupJob",
          "backup:DescribeRecoveryPoint",
          "backup:StartRestoreJob",
          "backup:GetRestoreJobMetadata"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "elasticache:CreateReplicationGroup",
          "elasticache:DescribeReplicationGroups",
          "elasticache:DeleteReplicationGroup",
          "elasticache:CreateSnapshot",
          "elasticache:DescribeSnapshots",
          "elasticache:DeleteSnapshot",
          "elasticache:CopySnapshot"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Event Rule for Redis Backup Testing
resource "aws_cloudwatch_event_rule" "redis_backup_test_schedule" {
  name                = "${var.project_name}-${var.environment}-redis-backup-test-schedule"
  description         = "Schedule for automated Redis backup testing"
  schedule_expression = "cron(0 7 ? * SUN *)"  # Weekly on Sunday at 7 AM

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-backup-test-schedule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "redis_backup_test_lambda" {
  rule      = aws_cloudwatch_event_rule.redis_backup_test_schedule.name
  target_id = "RedisBackupTestLambda"
  arn       = aws_lambda_function.redis_backup_test.arn
}