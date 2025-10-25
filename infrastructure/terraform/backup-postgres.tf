# Enhanced PostgreSQL Backup Configuration for LabelMint

# Enhanced RDS Backup Configuration with Extended Retention
resource "aws_db_instance" "main_enhanced" {
  identifier = "${var.project_name}-${var.environment}-db-enhanced"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class  = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  port = 5432

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  # Enhanced Backup Configuration
  backup_retention_period = 35  # 35 days for production
  backup_window          = "02:00-03:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  # Point-in-Time Recovery
  delete_automated_backups = false

  # Export Logs to CloudWatch
  enabled_cloudwatch_logs_exports = ["postgresql", "postgresql"]

  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-${var.environment}-db-enhanced-final-snapshot"
  copy_tags_to_snapshot     = true

  deletion_protection = var.environment == "production" ? true : false

  # Performance Insights
  performance_insights_enabled = true
  performance_insights_retention_period = 30  # Extended retention

  # Enhanced Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres-enhanced"
    Environment = var.environment
    Backup = "enhanced"
  }

  depends_on = [aws_iam_role_policy_attachment.rds_enhanced_monitoring]
}

# Cross-Region Read Replica for Disaster Recovery
resource "aws_db_instance" "dr_replica" {
  count = var.environment == "production" ? 1 : 0
  provider = aws.dr_region  # This will be defined in provider configuration

  identifier = "${var.project_name}-${var.environment}-db-dr-replica"

  replicate_source_db = "${aws_db_instance.main.identifier}"  # Source from primary region
  instance_class      = var.db_read_replica_instance_class

  port = 5432

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group_main_region.name

  # DR Replica Backup Configuration
  backup_retention_period = 35
  backup_window          = "03:30-04:30"
  delete_automated_backups = false

  skip_final_snapshot = false
  final_snapshot_identifier = "${var.project_name}-${var.environment}-db-dr-replica-final-snapshot"

  # Performance Insights
  performance_insights_enabled = true
  performance_insights_retention_period = 30

  # Enhanced Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres-dr-replica"
    Environment = var.environment
    DR = "cross-region"
  }

  depends_on = [aws_db_instance.main]
}

# AWS Backup for PostgreSQL
resource "aws_backup_vault" "postgres" {
  name = "${var.project_name}-${var.environment}-postgres-backup-vault"

  encryption_key_arn = aws_kms_key.backup.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres-backup-vault"
    Environment = var.environment
  }
}

# Backup Plan for PostgreSQL
resource "aws_backup_plan" "postgres" {
  name = "${var.project_name}-${var.environment}-postgres-backup-plan"

  rule {
    name              = "daily_postgres_backups"
    target_vault_name = aws_backup_vault.postgres.name
    schedule          = "cron(0 2 * * ? *)"

    lifecycle {
      delete_after = 90  # Keep daily backups for 90 days
    }

    recovery_point_tags = {
      Name = "${var.project_name}-${var.environment}-postgres-backup"
      Environment = var.environment
      BackupType = "daily"
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.postgres_dr.arn
      lifecycle {
        delete_after = 180  # Keep DR backups for 180 days
      }
    }
  }

  rule {
    name              = "weekly_postgres_backups"
    target_vault_name = aws_backup_vault.postgres.name
    schedule          = "cron(0 3 ? * SUN *)"

    lifecycle {
      delete_after = 365  # Keep weekly backups for 1 year
    }

    recovery_point_tags = {
      Name = "${var.project_name}-${var.environment}-postgres-backup"
      Environment = var.environment
      BackupType = "weekly"
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.postgres_dr.arn
      lifecycle {
        delete_after = 2555  # Keep DR backups for 7 years
      }
    }
  }

  rule {
    name              = "monthly_postgres_backups"
    target_vault_name = aws_backup_vault.postgres.name
    schedule          = "cron(0 4 1 * ? *)"

    lifecycle {
      delete_after = 2555  # Keep monthly backups for 7 years
    }

    recovery_point_tags = {
      Name = "${var.project_name}-${var.environment}-postgres-backup"
      Environment = var.environment
      BackupType = "monthly"
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.postgres_dr.arn
      lifecycle {
        delete_after = 2555  # Keep DR backups for 7 years
      }
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres-backup-plan"
    Environment = var.environment
  }
}

# Backup Selection for PostgreSQL
resource "aws_backup_selection" "postgres" {
  iam_role_arn = aws_iam_role.backup_service.arn
  name         = "${var.project_name}-${var.environment}-postgres-selection"
  plan_id      = aws_backup_plan.postgres.id

  resources = [aws_db_instance.main_enhanced.arn]

  selection_tag {
    type  = "STRING_EQUALS"
    key   = "Environment"
    value = var.environment
  }
}

# DR Backup Vault in Different Region
resource "aws_backup_vault" "postgres_dr" {
  provider = aws.dr_region
  name = "${var.project_name}-${var.environment}-postgres-backup-vault-dr"

  encryption_key_arn = aws_kms_key.backup_dr.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres-backup-vault-dr"
    Environment = var.environment
    DR = "cross-region"
  }
}

# KMS Key for Backup Encryption
resource "aws_kms_key" "backup" {
  description = "KMS key for ${var.project_name} ${var.environment} backup encryption"
  enable_key_rotation = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow AWS Backup Service"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-backup-kms"
    Environment = var.environment
  }
}

resource "aws_kms_alias" "backup" {
  name          = "alias/${var.project_name}-${var.environment}-backup"
  target_key_id = aws_kms_key.backup.key_id
}

# KMS Key for DR Backup Encryption (in DR region)
resource "aws_kms_key" "backup_dr" {
  provider = aws.dr_region
  description = "KMS key for ${var.project_name} ${var.environment} DR backup encryption"
  enable_key_rotation = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow AWS Backup Service"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-backup-dr-kms"
    Environment = var.environment
    DR = "cross-region"
  }
}

resource "aws_kms_alias" "backup_dr" {
  provider = aws.dr_region
  name          = "alias/${var.project_name}-${var.environment}-backup-dr"
  target_key_id = aws_kms_key.backup_dr.key_id
}

# IAM Role for AWS Backup Service
resource "aws_iam_role" "backup_service" {
  name = "${var.project_name}-${var.environment}-backup-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-backup-service-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "backup_service" {
  role       = aws_iam_role.backup_service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackupService"
}

# Enhanced RDS Parameter Group for Performance and Backup Optimization
resource "aws_db_parameter_group" "enhanced" {
  family = "postgres15"
  name   = "${var.project_name}-${var.environment}-enhanced-pg-params"

  # Performance Optimization
  parameters {
    name  = "shared_buffers"
    value = "0.25"
  }

  parameters {
    name  = "effective_cache_size"
    value = "0.75"
  }

  parameters {
    name  = "work_mem"
    value = "4096"
  }

  parameters {
    name  = "maintenance_work_mem"
    value = "1048576"
  }

  # WAL Configuration for Backup Performance
  parameters {
    name  = "wal_buffers"
    value = "16384"
  }

  parameters {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  parameters {
    name  = "max_wal_size"
    value = "4GB"
  }

  parameters {
    name  = "min_wal_size"
    value = "1GB"
  }

  # Connection Management
  parameters {
    name  = "max_connections"
    value = "300"
  }

  parameters {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  # Logging Configuration
  parameters {
    name  = "log_checkpoints"
    value = "1"
  }

  parameters {
    name  = "log_connections"
    value = "1"
  }

  parameters {
    name  = "log_disconnections"
    value = "1"
  }

  parameters {
    name  = "log_lock_waits"
    value = "1"
  }

  parameters {
    name  = "log_temp_files"
    value = "0"
  }

  parameters {
    name  = "log_autovacuum_min_duration"
    value = "0"
  }

  # Performance Monitoring
  parameters {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,auto_explain"
  }

  parameters {
    name  = "auto_explain.log_min_duration"
    value = "1000"
  }

  parameters {
    name  = "auto_explain.log_analyze"
    value = "1"
  }

  parameters {
    name  = "auto_explain.log_buffers"
    value = "1"
  }

  parameters {
    name  = "auto_explain.log_triggers"
    value = "1"
  }

  # Optimizer Settings
  parameters {
    name  = "random_page_cost"
    value = "1.1"
  }

  parameters {
    name  = "effective_io_concurrency"
    value = "200"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-enhanced-pg-params"
    Environment = var.environment
  }
}

# Enhanced CloudWatch Alarms for Backup Monitoring
resource "aws_cloudwatch_metric_alarm" "backup_failed" {
  alarm_name          = "${var.project_name}-${var.environment}-backup-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BackupJobFailed"
  namespace           = "AWS/Backup"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Backup job failed"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    BackupVaultName = aws_backup_vault.postgres.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backup-failed-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "backup_recovery_point_creation_failed" {
  alarm_name          = "${var.project_name}-${var.environment}-backup-recovery-point-creation-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "RecoveryPointCreationFailed"
  namespace           = "AWS/Backup"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Backup recovery point creation failed"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    BackupVaultName = aws_backup_vault.postgres.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backup-recovery-point-creation-failed-alarm"
    Environment = var.environment
  }
}

# Database Restore Testing Lambda
resource "aws_iam_role" "lambda_restore_test" {
  name = "${var.project_name}-${var.environment}-lambda-restore-test-role"

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

resource "aws_iam_role_policy" "lambda_restore_test" {
  name = "${var.project_name}-${var.environment}-lambda-restore-test-policy"
  role = aws_iam_role.lambda_restore_test.id

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
          "rds:RestoreDBInstanceFromDBSnapshot",
          "rds:DescribeDBInstances",
          "rds:DescribeDBSnapshots",
          "rds:DeleteDBInstance"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Event Rule for Automated Backup Testing
resource "aws_cloudwatch_event_rule" "backup_test_schedule" {
  name                = "${var.project_name}-${var.environment}-backup-test-schedule"
  description         = "Schedule for automated backup testing"
  schedule_expression = "cron(0 6 ? * SUN *)"  # Weekly on Sunday at 6 AM

  tags = {
    Name = "${var.project_name}-${var.environment}-backup-test-schedule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "backup_test_lambda" {
  rule      = aws_cloudwatch_event_rule.backup_test_schedule.name
  target_id = "BackupTestLambda"
  arn       = aws_lambda_function.backup_test.arn
}