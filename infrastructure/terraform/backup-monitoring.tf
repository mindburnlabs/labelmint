# Backup and Recovery Monitoring System with RTO/RPO Tracking

# CloudWatch Dashboard for Backup Monitoring
resource "aws_cloudwatch_dashboard" "backup_monitoring" {
  dashboard_name = "${var.project_name}-${var.environment}-backup-monitoring"

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
            [".", ".", ".", aws_backup_vault.redis.name, ".", "."],
            [".", ".", ".", aws_backup_vault.postgres_dr.name, ".", ".", { "region": var.dr_region }],
            [".", ".", ".", aws_backup_vault.redis_dr.name, ".", ".", { "region": var.dr_region }]
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
          colors = ["#1a7f37", "#1a7f37", "#0969da", "#0969da"]
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
            ["AWS/Backup", "BackupJobFailed", "BackupVaultName", aws_backup_vault.postgres.name],
            [".", ".", ".", aws_backup_vault.redis.name],
            [".", ".", ".", aws_backup_vault.postgres_dr.name, ".", { "region": var.dr_region }],
            [".", ".", ".", aws_backup_vault.redis_dr.name, ".", { "region": var.dr_region }]
          ]
          period = 3600
          stat   = "Sum"
          region = var.aws_region
          title  = "Backup Failures"
          yAxis = {
            left = {
              min = 0
            }
          }
          colors = ["#cf222e", "#cf222e", "#cf222e", "#cf222e"]
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
            ["${var.project_name}-${var.environment}/backup-testing", "BackupAgeHours", "TestType", "postgresql"],
            [".", ".", ".", "redis"],
            [".", "BackupTestResult", "TestType", "postgresql"],
            [".", ".", ".", "redis"]
          ]
          period = 3600
          stat   = "Average"
          region = var.aws_region
          title  = "Backup Test Results & Age"
          yAxis = {
            left = {
              min = 0,
              label = "Hours"
            }
            right = {
              min = 0,
              max = 1,
              label = "Success Rate"
            }
          }
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
            ["AWS/Route53", "HealthCheckStatus", "HealthCheckId", aws_route53_health_check.primary.id],
            [".", ".", ".", aws_route53_health_check.dr[0].id],
            ["AWS/ApplicationELB", "HTTPCode_Target_2XX_Count", "LoadBalancer", aws_lb.main.arn_suffix],
            [".", ".", ".", aws_lb.dr[0].arn_suffix, ".", { "region": var.dr_region }]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Health Checks & Application Status"
          yAxis = {
            left = {
              min = 0,
              max = 1,
              label = "Health Status"
            }
            right = {
              min = 0,
              label = "Request Count"
            }
          }
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/lambda/labelmintit-production-backup-test'\n| fields @timestamp, @message\n| filter @message like /FAILED/\n| sort @timestamp desc\n| limit 50"
          region  = var.aws_region
          title   = "Backup Test Failures"
          view    = "table"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main_enhanced.identifier],
            [".", "DatabaseConnections", ".", "."],
            [".", "FreeStorageSpace", ".", "."],
            [".", "ReadLatency", ".", "."]
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
        y      = 18
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "EngineCPUUtilization", "ReplicationGroupId", aws_elasticache_replication_group.main_enhanced.id],
            [".", "CurrConnections", ".", "."],
            [".", "CacheHits", ".", "."],
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
    Name = "${var.project_name}-${var.environment}-backup-monitoring"
    Environment = var.environment
  }
}

# RTO/RPO Tracking CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "rpo_violation_postgresql" {
  alarm_name          = "${var.project_name}-${var.environment}-rpo-violation-postgresql"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BackupAgeHours"
  namespace           = "${var.project_name}-${var.environment}/backup-testing"
  period              = "3600"
  statistic           = "Average"
  threshold           = "2"  # 2 hours RPO threshold
  treat_missing_data  = "notBreaching"
  alarm_description   = "PostgreSQL backup RPO violation detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    TestType = "postgresql"
    Environment = var.environment
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rpo-violation-postgresql"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "rpo_violation_redis" {
  alarm_name          = "${var.project_name}-${var.environment}-rpo-violation-redis"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BackupAgeHours"
  namespace           = "${var.project_name}-${var.environment}/backup-testing"
  period              = "3600"
  statistic           = "Average"
  threshold           = "25"  # 25 hours RPO threshold for Redis
  treat_missing_data  = "notBreaching"
  alarm_description   = "Redis backup RPO violation detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    TestType = "redis"
    Environment = var.environment
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rpo-violation-redis"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "backup_test_failure" {
  alarm_name          = "${var.project_name}-${var.environment}-backup-test-failure"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BackupTestResult"
  namespace           = "${var.project_name}-${var.environment}/backup-testing"
  period              = "3600"
  statistic           = "Average"
  threshold           = "1"  # 1 = success, 0 = failure
  treat_missing_data  = "breaching"
  alarm_description   = "Backup test failure detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    Environment = var.environment
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backup-test-failure"
    Environment = var.environment
  }
}

# Recovery Time Objective Tracking
resource "aws_cloudwatch_metric_alarm" "rto_violation" {
  alarm_name          = "${var.project_name}-${var.environment}-rto-violation"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "RecoveryTimeMinutes"
  namespace           = "${var.project_name}-${var.environment}/disaster-recovery"
  period              = "3600"
  statistic           = "Average"
  threshold           = "240"  # 4 hours RTO threshold
  treat_missing_data  = "notBreaching"
  alarm_description   = "Recovery Time Objective violation detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    Environment = var.environment
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rto-violation"
    Environment = var.environment
  }
}

# Backup Performance Metrics
resource "aws_cloudwatch_metric_alarm" "backup_job_duration_high" {
  alarm_name          = "${var.project_name}-${var.environment}-backup-job-duration-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "BackupJobDuration"
  namespace           = "AWS/Backup"
  period              = "3600"
  statistic           = "Average"
  threshold           = "1800"  # 30 minutes
  alarm_description   = "Backup job duration is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    BackupVaultName = aws_backup_vault.postgres.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backup-job-duration-high"
    Environment = var.environment
  }
}

# Cross-Region Replication Lag Monitoring
resource "aws_cloudwatch_metric_alarm" "replication_lag" {
  alarm_name          = "${var.project_name}-${var.environment}-replication-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReplicationLag"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "300"  # 5 minutes
  alarm_description   = "Cross-region replication lag is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main_enhanced.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-replication-lag"
    Environment = var.environment
  }
}

# DR Environment Health Monitoring
resource "aws_cloudwatch_metric_alarm" "dr_environment_unhealthy" {
  count = var.environment == "production" ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-dr-environment-unhealthy"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"  # 1 = healthy, 0 = unhealthy
  alarm_description   = "DR environment is unhealthy"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    HealthCheckId = aws_route53_health_check.dr[0].id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-dr-environment-unhealthy"
    Environment = var.environment
    DR = "cross-region"
  }
}

# Lambda Function for RTO/RPO Monitoring
resource "aws_lambda_function" "rto_rpo_monitor" {
  filename         = "rto-rpo-monitor.zip"
  function_name    = "${var.project_name}-${var.environment}-rto-rpo-monitor"
  role            = aws_iam_role.rto_rpo_monitor_role.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 300

  environment {
    variables = {
      PROJECT_NAME = var.project_name
      ENVIRONMENT = var.environment
      RPO_THRESHOLD_MINUTES = "60"
      RTO_THRESHOLD_MINUTES = "240"
      SNS_TOPIC_ARN = aws_sns_topic.alerts.arn
      BACKUP_VAULT_POSTGRES = aws_backup_vault.postgres.name
      BACKUP_VAULT_REDIS = aws_backup_vault.redis.name
      DB_IDENTIFIER = aws_db_instance.main_enhanced.identifier
      REDIS_REPLICATION_GROUP = aws_elasticache_replication_group.main_enhanced.id
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rto-rpo-monitor"
    Environment = var.environment
  }
}

# IAM Role for RTO/RPO Monitor Lambda
resource "aws_iam_role" "rto_rpo_monitor_role" {
  name = "${var.project_name}-${var.environment}-rto-rpo-monitor-role"

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

  tags = {
    Name = "${var.project_name}-${var.environment}-rto-rpo-monitor-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "rto_rpo_monitor_policy" {
  name = "${var.project_name}-${var.environment}-rto-rpo-monitor-policy"
  role = aws_iam_role.rto_rpo_monitor_role.id

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
          "backup:ListRecoveryPointsByBackupVault",
          "backup:DescribeRecoveryPoint",
          "backup:GetRestoreJobMetadata"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:DescribeDBSnapshots"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "elasticache:DescribeReplicationGroups",
          "elasticache:DescribeSnapshots"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricStatistics"
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

# CloudWatch Event Rule for RTO/RPO Monitoring
resource "aws_cloudwatch_event_rule" "rto_rpo_monitor_schedule" {
  name                = "${var.project_name}-${var.environment}-rto-rpo-monitor-schedule"
  description         = "Schedule for RTO/RPO monitoring"
  schedule_expression = "rate(15 minutes)"

  tags = {
    Name = "${var.project_name}-${var.environment}-rto-rpo-monitor-schedule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "rto_rpo_monitor_lambda" {
  rule      = aws_cloudwatch_event_rule.rto_rpo_monitor_schedule.name
  target_id = "RTORPOMonitorLambda"
  arn       = aws_lambda_function.rto_rpo_monitor.arn
}

# Backup Health Score Composite Metric
resource "aws_cloudwatch_metric_math_expression" "backup_health_score" {
  depends_on = [aws_cloudwatch_metric_alarm.backup_test_failure]

  name = "BackupHealthScore"
  expression = "(backup_success_rate * 0.6) + (backup_timeliness * 0.4)"

  using_metrics = {
    backup_success_rate = aws_cloudwatch_metric_alarm.backup_test_failure.metric_name
    backup_timeliness   = aws_cloudwatch_metric_alarm.rpo_violation_postgresql.metric_name
  }
}

# Backup Compliance Report Generator
resource "aws_lambda_function" "backup_compliance_report" {
  filename         = "backup-compliance-report.zip"
  function_name    = "${var.project_name}-${var.environment}-backup-compliance-report"
  role            = aws_iam_role.backup_compliance_report_role.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = 900

  environment {
    variables = {
      PROJECT_NAME = var.project_name
      ENVIRONMENT = var.environment
      REPORT_BUCKET = "${var.project_name}-${var.environment}-backups"
      EMAIL_RECIPIENTS = "backup-reports@labelmintit.com"
      SNS_TOPIC_ARN = aws_sns_topic.alerts.arn
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backup-compliance-report"
    Environment = var.environment
  }
}

# IAM Role for Backup Compliance Report
resource "aws_iam_role" "backup_compliance_report_role" {
  name = "${var.project_name}-${var.environment}-backup-compliance-report-role"

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

resource "aws_iam_role_policy" "backup_compliance_report_policy" {
  name = "${var.project_name}-${var.environment}-backup-compliance-report-policy"
  role = aws_iam_role.backup_compliance_report_role.id

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
          "backup:ListRecoveryPointsByBackupVault",
          "backup:DescribeBackupJob",
          "backup:DescribeRestoreJob",
          "backup:GetBackupPlan"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-${var.environment}-backups",
          "arn:aws:s3:::${var.project_name}-${var.environment}-backups/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

# Schedule for Daily Compliance Reports
resource "aws_cloudwatch_event_rule" "backup_compliance_schedule" {
  name                = "${var.project_name}-${var.environment}-backup-compliance-schedule"
  description         = "Schedule for daily backup compliance reports"
  schedule_expression = "cron(0 8 * * ? *)"  # Daily at 8 AM UTC

  tags = {
    Name = "${var.project_name}-${var.environment}-backup-compliance-schedule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "backup_compliance_lambda" {
  rule      = aws_cloudwatch_event_rule.backup_compliance_schedule.name
  target_id = "BackupComplianceLambda"
  arn       = aws_lambda_function.backup_compliance_report.arn
}