# Auto Scaling Configuration for Deligate Application
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Auto Scaling Group for Web Services
resource "aws_autoscaling_group" "web_asg" {
  name                = "labelmint-web-asg"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [aws_lb_target_group.primary_tg.arn]
  health_check_type   = "EC2"
  health_check_grace_period = 300

  # Launch template
  launch_template {
    id      = aws_launch_template.web_lt.id
    version = "$Latest"
  }

  # Scaling configuration
  min_size         = var.web_min_capacity
  max_size         = var.web_max_capacity
  desired_capacity = var.web_desired_capacity

  # Instance refresh
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 90
      instance_warmup        = 300
    }
    triggers = ["tag"]
  }

  # Mixed instances policy for cost optimization
  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 2
      on_demand_percentage_above_base_capacity = 40
      spot_allocation_strategy                 = "capacity-optimized"
      spot_instance_pools                      = 4
      on_demand_percentage_above_base_capacity = 40
    }

    override {
      instance_type     = "c6i.large"
      weighted_capacity = "1"
    }
    override {
      instance_type     = "c6i.xlarge"
      weighted_capacity = "2"
    }
    override {
      instance_type     = "c5.large"
      weighted_capacity = "1"
    }
  }

  # Tags
  tag {
    key                 = "Name"
    value               = "labelmint-web"
    propagate_at_launch = true
  }
  tag {
    key                 = "Environment"
    value               = var.environment
    propagate_at_launch = true
  }
  tag {
    key                 = "Component"
    value               = "web"
    propagate_at_launch = true
  }
}

# Auto Scaling Group for API Services
resource "aws_autoscaling_group" "api_asg" {
  name                = "labelmint-api-asg"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [aws_lb_target_group.api_tg.arn]
  health_check_type   = "EC2"
  health_check_grace_period = 180

  launch_template {
    id      = aws_launch_template.api_lt.id
    version = "$Latest"
  }

  min_size         = var.api_min_capacity
  max_size         = var.api_max_capacity
  desired_capacity = var.api_desired_capacity

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 80
      instance_warmup        = 180
    }
  }

  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 1
      on_demand_percentage_above_base_capacity = 50
      spot_allocation_strategy                 = "capacity-optimized"
    }

    override {
      instance_type     = "c6i.xlarge"
      weighted_capacity = "1"
    }
    override {
      instance_type     = "c6i.2xlarge"
      weighted_capacity = "2"
    }
  }

  tag {
    key                 = "Name"
    value               = "labelmint-api"
    propagate_at_launch = true
  }
  tag {
    key                 = "Environment"
    value               = var.environment
    propagate_at_launch = true
  }
  tag {
    key                 = "Component"
    value               = "api"
    propagate_at_launch = true
  }
}

# Launch Template for Web Services
resource "aws_launch_template" "web_lt" {
  name_prefix   = "labelmint-web-lt"
  image_id      = var.ami_id
  instance_type = "c6i.large"
  key_name      = var.ssh_key_name

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [var.ecs_security_group_id]
    delete_on_termination       = true
  }

  # User data script
  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    component      = "web"
    environment    = var.environment
    log_level      = "info"
    newrelic_key   = var.newrelic_license_key
    datadog_key    = var.datadog_api_key
  }))

  # IAM instance profile
  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance_profile.name
  }

  # Monitoring
  monitoring {
    enabled = true
  }

  # Storage
  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 30
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
      throughput            = 125
      iops                  = 3000
    }
  }

  # CPU options for better performance
  cpu_options {
    core_count       = 2
    threads_per_core = 1
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "labelmint-web"
      Environment = var.environment
      Component   = "web"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Launch Template for API Services
resource "aws_launch_template" "api_lt" {
  name_prefix   = "labelmint-api-lt"
  image_id      = var.ami_id
  instance_type = "c6i.xlarge"
  key_name      = var.ssh_key_name

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [var.ecs_security_group_id]
    delete_on_termination       = true
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    component      = "api"
    environment    = var.environment
    log_level      = "warn"
    newrelic_key   = var.newrelic_license_key
    datadog_key    = var.datadog_api_key
  }))

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance_profile.name
  }

  monitoring {
    enabled = true
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 50
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
      throughput            = 250
      iops                  = 5000
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "labelmint-api"
      Environment = var.environment
      Component   = "api"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Scale-up Policy - CPU
resource "aws_autoscaling_policy" "web_scale_up_cpu" {
  name                   = "labelmint-web-scale-up-cpu"
  scaling_adjustment     = 2
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.web_asg.name
}

# Scale-down Policy - CPU
resource "aws_autoscaling_policy" "web_scale_down_cpu" {
  name                   = "labelmint-web-scale-down-cpu"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.web_asg.name
}

# CloudWatch Alarm - High CPU
resource "aws_cloudwatch_metric_alarm" "web_cpu_high" {
  alarm_name          = "labelmint-web-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "70"
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = [aws_autoscaling_policy.web_scale_up_cpu.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.web_asg.name
  }

  tags = {
    Environment = var.environment
    Component   = "web"
  }
}

# CloudWatch Alarm - Low CPU
resource "aws_cloudwatch_metric_alarm" "web_cpu_low" {
  alarm_name          = "labelmint-web-cpu-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "25"
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = [aws_autoscaling_policy.web_scale_down_cpu.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.web_asg.name
  }

  tags = {
    Environment = var.environment
    Component   = "web"
  }
}

# Memory-based scaling for API
resource "aws_autoscaling_policy" "api_scale_up_memory" {
  name                   = "labelmint-api-scale-up-memory"
  scaling_adjustment     = 1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 180
  autoscaling_group_name = aws_autoscaling_group.api_asg.name
}

resource "aws_autoscaling_policy" "api_scale_down_memory" {
  name                   = "labelmint-api-scale-down-memory"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.api_asg.name
}

# Request Queue Depth scaling
resource "aws_autoscaling_policy" "api_scale_up_queue" {
  name                   = "labelmint-api-scale-up-queue"
  scaling_adjustment     = 2
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 60
  autoscaling_group_name = aws_autoscaling_group.api_asg.name
}

# CloudWatch alarm for Request Queue Depth
resource "aws_cloudwatch_metric_alarm" "api_queue_depth" {
  alarm_name          = "labelmint-api-queue-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RequestCount"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Sum"
  threshold           = "1000"
  alarm_description   = "ALB request queue depth too high"
  alarm_actions       = [aws_autoscaling_policy.api_scale_up_queue.arn]

  dimensions = {
    LoadBalancer = aws_lb.labelmint_alb.arn_suffix
    TargetGroup  = aws_lb_target_group.api_tg.arn_suffix
  }

  tags = {
    Environment = var.environment
    Component   = "api"
  }
}

# Scheduled scaling for peak hours
resource "aws_autoscaling_schedule" "web_morning_scale_up" {
  scheduled_action_name  = "labelmint-web-morning-scale-up"
  min_size               = var.web_min_capacity
  max_size               = var.web_max_capacity
  desired_capacity       = var.web_desired_capacity + 2
  start_time             = "2023-01-01T08:00:00Z"
  recurrence             = "0 8 * * MON-FRI"
  autoscaling_group_name = aws_autoscaling_group.web_asg.name
}

resource "aws_autoscaling_schedule" "web_evening_scale_down" {
  scheduled_action_name  = "labelmint-web-evening-scale-down"
  min_size               = var.web_min_capacity
  max_size               = var.web_max_capacity
  desired_capacity       = var.web_desired_capacity
  start_time             = "2023-01-01T20:00:00Z"
  recurrence             = "0 20 * * MON-FRI"
  autoscaling_group_name = aws_autoscaling_group.web_asg.name
}

# Predictive scaling
resource "aws_autoscaling_policy" "web_predictive_scaling" {
  name               = "labelmint-web-predictive-scaling"
  policy_type        = "PredictiveScaling"
  autoscaling_group_name = aws_autoscaling_group.web_asg.name

  predictive_scaling_configuration {
    mode                         = "ForecastAndScale"
    scheduling_buffer_time       = 10
    max_capacity_breach_behavior = "IncreaseMaxCapacity"
    target_value                 = 70
  }
}

# Instance protection for critical instances
resource "aws_autoscaling_lifecycle_hook" "web_terminate" {
  name                   = "labelmint-web-terminate-hook"
  autoscaling_group_name = aws_autoscaling_group.web_asg.name
  lifecycle_transition   = "autoscaling:EC2_INSTANCE_TERMINATING"
  heartbeat_timeout      = 300
  default_result         = "CONTINUE"

  notification_target_arn = aws_sns_topic.autoscaling_notifications.arn
  role_arn                = aws_iam_role.autoscaling_lifecycle.arn
}

# SNS Topic for autoscaling notifications
resource "aws_sns_topic" "autoscaling_notifications" {
  name = "labelmint-autoscaling-notifications"

  tags = {
    Environment = var.environment
  }
}

# Email subscription for notifications
resource "aws_sns_topic_subscription" "email_notifications" {
  topic_arn = aws_sns_topic.autoscaling_notifications.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

# IAM Role for lifecycle hook
resource "aws_iam_role" "autoscaling_lifecycle" {
  name = "labelmint-autoscaling-lifecycle-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "autoscaling.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "autoscaling_lifecycle_sns" {
  role       = aws_iam_role.autoscaling_lifecycle.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AutoScalingNotificationAccessPolicy"
}

# Cost optimization - Instance refresh with savings
resource "aws_autoscaling_group" "web_asg_cost_optimized" {
  depends_on = [aws_autoscaling_group.web_asg]

  # Additional cost optimization settings
  capacity_rebalance = true

  # Termination policies
  termination_policies = ["OldestInstance", "ClosestToNextInstanceHour"]

  # Metrics collection
  enabled_metrics = [
    "GroupMinSize",
    "GroupMaxSize",
    "GroupDesiredCapacity",
    "GroupInServiceInstances",
    "GroupPendingInstances",
    "GroupStandbyInstances",
    "GroupTerminatingInstances",
    "GroupTotalInstances"
  ]

  metrics_granularity = "1Minute"
}

# Custom metrics for better scaling decisions
resource "aws_cloudwatch_metric_alarm" "web_response_time" {
  alarm_name          = "labelmint-web-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Average"
  threshold           = "1.0"
  alarm_description   = "Response time too high"
  alarm_actions       = [aws_autoscaling_policy.web_scale_up_cpu.arn]

  dimensions = {
    LoadBalancer = aws_lb.labelmint_alb.arn_suffix
    TargetGroup  = aws_lb_target_group.primary_tg.arn_suffix
  }
}

# Outputs
output "web_asg_name" {
  description = "Name of the web autoscaling group"
  value       = aws_autoscaling_group.web_asg.name
}

output "api_asg_name" {
  description = "Name of the API autoscaling group"
  value       = aws_autoscaling_group.api_asg.name
}

output "web_lt_id" {
  description = "ID of the web launch template"
  value       = aws_launch_template.web_lt.id
}

output "api_lt_id" {
  description = "ID of the API launch template"
  value       = aws_launch_template.api_lt.id
}