# Production Payment System Infrastructure
# Additional Terraform configuration for payment monitoring and optimization

# CloudWatch for Payment Monitoring
resource "aws_cloudwatch_log_group" "payment_metrics" {
  name              = "/aws/ecs/labelmint-payments"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-payment-metrics"
  }
}

# CloudWatch Alarms for Payment Failures
resource "aws_cloudwatch_metric_alarm" "high_payment_failure_rate" {
  alarm_name          = "${var.project_name}-high-payment-failure-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "PaymentFailureRate"
  namespace           = "Deligate/Payments"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"
  alarm_description   = "This metric monitors payment failure rate"
  alarm_actions       = [aws_sns_topic.payment_alerts.arn]

  tags = {
    Name = "${var.project_name}-payment-failure-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "stuck_transactions" {
  alarm_name          = "${var.project_name}-stuck-transactions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "PendingTransactions"
  namespace           = "Deligate/Payments"
  period              = "300"
  statistic           = "Average"
  threshold           = "100"
  alarm_description   = "Too many pending transactions"
  alarm_actions       = [aws_sns_topic.payment_alerts.arn]

  tags = {
    Name = "${var.project_name}-stuck-transactions-alarm"
  }
}

# SNS Topic for Payment Alerts
resource "aws_sns_topic" "payment_alerts" {
  name = "${var.project_name}-payment-alerts"

  tags = {
    Name = "${var.project_name}-payment-alerts"
  }
}

# SNS Topic Subscription for Email Alerts
resource "aws_sns_topic_subscription" "email_alerts" {
  topic_arn = aws_sns_topic.payment_alerts.arn
  protocol  = "email"
  endpoint  = var.payment_alert_email
}

# SNS Topic Subscription for Slack Integration (via HTTPS)
resource "aws_sns_topic_subscription" "slack_alerts" {
  count     = var.slack_webhook_url != "" ? 1 : 0
  topic_arn = aws_sns_topic.payment_alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}

# Enhanced ECS Task Definition with Payment Services
resource "aws_ecs_task_definition" "payments" {
  family                   = "${var.project_name}-${var.environment}-payments"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "payments"
      image = var.payments_image

      portMappings = [
        {
          containerPort = 3001
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "DATABASE_URL"
          value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}:5432/${var.db_name}"
        },
        {
          name  = "REDIS_URL"
          value = "redis://${aws_elasticache_subnet_group.main.name}:6379"
        },
        {
          name  = "TON_NETWORK"
          value = "mainnet"
        },
        {
          name  = "ENABLE_PAYMENT_MONITORING"
          value = "true"
        },
        {
          name  = "ENABLE_FEE_OPTIMIZATION"
          value = "true"
        }
      ]

      secrets = [
        {
          name      = "TON_API_KEY"
          valueFrom = aws_secretsmanager_secret.ton_api_key.arn
        },
        {
          name      = "TON_MASTER_KEY"
          valueFrom = aws_secretsmanager_secret.ton_master_key.arn
        },
        {
          name      = "STRIPE_SECRET_KEY"
          valueFrom = aws_secretsmanager_secret.stripe_keys.arn
        },
        {
          name      = "PAYPAL_CLIENT_ID"
          valueFrom = aws_secretsmanager_secret.paypal_keys.arn
        },
        {
          name      = "SLACK_WEBHOOK_URL"
          valueFrom = aws_secretsmanager_secret.alert_webhooks.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.payment_metrics.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "payments"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      depends_on = [aws_db_instance.main]
    }
  ])

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }
}

# Secrets Manager for Payment Service Keys
resource "aws_secretsmanager_secret" "ton_api_key" {
  name = "${var.project_name}-${var.environment}-ton-api-key"
}

resource "aws_secretsmanager_secret" "ton_master_key" {
  name = "${var.project_name}-${var.environment}-ton-master-key"
}

resource "aws_secretsmanager_secret" "stripe_keys" {
  name = "${var.project_name}-${var.environment}-stripe-keys"
}

resource "aws_secretsmanager_secret" "paypal_keys" {
  name = "${var.project_name}-${var.environment}-paypal-keys"
}

resource "aws_secretsmanager_secret" "alert_webhooks" {
  name = "${var.project_name}-${var.environment}-alert-webhooks"
}

# ECS Service for Payment Monitoring
resource "aws_ecs_service" "payments" {
  name            = "${var.project_name}-${var.environment}-payments-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.payments.arn
  desired_count   = var.payments_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 50
    deployment_circuit_breaker {
      enable   = true
      rollback = true
    }
  }

  depends_on = [
    aws_lb_listener.https,
    aws_cloudwatch_log_group.payment_metrics
  ]

  tags = {
    Name = "${var.project_name}-payments-service"
  }
}

# Enhanced Security Group for Payment Services
resource "aws_security_group" "payments" {
  name        = "${var.project_name}-${var.environment}-payments-sg"
  description = "Security group for payment services"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "From ALB"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-payments-sg"
  }
}

# Auto Scaling for Payment Service
resource "aws_appautoscaling_target" "payments_target" {
  max_capacity       = var.payments_max_capacity
  min_capacity       = var.payments_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.payments.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Scale Up Policy for Payments
resource "aws_appautoscaling_policy" "payments_scale_up" {
  name               = "${var.project_name}-${var.environment}-payments-scale-up"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.payments_target.resource_id
  scalable_dimension = aws_appautoscaling_target.payments_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.payments_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 60.0
    scale_in_cooldown = 300
    scale_out_cooldown = 60
  }
}

# Scale Down Policy for Payments
resource "aws_appautoscaling_policy" "payments_scale_down" {
  name               = "${var.project_name}-${var.environment}-payments-scale-down"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.payments_target.resource_id
  scalable_dimension = aws_appautoscaling_target.payments_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.payments_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 20.0
    scale_in_cooldown = 300
    scale_out_cooldown = 60
  }
}

# Route 53 Health Check for Payment Service
resource "aws_route53_health_check" "payments_health" {
  fqdn                            = "${var.project_name}.${var.domain_name}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/api/payments/health"
  failure_threshold               = 3
  request_interval                = 30
  cloudwatch_alarm_region         = var.aws_region
  cloudwatch_alarm_name           = aws_cloudwatch_metric_alarm.payments_health.name
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "${var.project_name}-payments-health-check"
  }
}

# CloudWatch Alarm for Payment Service Health
resource "aws_cloudwatch_metric_alarm" "payments_health" {
  alarm_name          = "${var.project_name}-payments-health"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Average"
  threshold           = "5"
  alarm_description   = "Payment service health check"
  alarm_actions       = [aws_sns_topic.payment_alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }

  tags = {
    Name = "${var.project_name}-payments-health-alarm"
  }
}

# KMS Key for Payment Data Encryption
resource "aws_kms_key" "payments" {
  description             = "KMS key for payment data encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

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
        Sid    = "Allow ECS Tasks"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-payments-kms"
  }
}

resource "aws_kms_alias" "payments" {
  name          = "alias/${var.project_name}-payments"
  target_key_id = aws_kms_key.payments.key_id
}