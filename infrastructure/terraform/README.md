# Terraform Infrastructure for DeligateIT

This Terraform configuration deploys a complete AWS infrastructure for the DeligateIT application using ECS Fargate with supporting services.

## Architecture Overview

- **Compute**: AWS ECS Fargate with auto-scaling
- **Database**: PostgreSQL with read replicas (production)
- **Cache**: ElastiCache Redis cluster with encryption
- **Storage**: S3 buckets with CloudFront CDN
- **Monitoring**: CloudWatch, alarms, and dashboards
- **Security**: WAF, security groups, IAM roles, KMS encryption

## Prerequisites

1. Terraform >= 1.5.0
2. AWS CLI configured with appropriate permissions
3. Docker image built and pushed to a registry
4. SSL certificate in ACM
5. Domain configured in Route53 (optional but recommended)

## Directory Structure

```
.
├── main.tf              # ECS Fargate and networking
├── rds.tf               # PostgreSQL configuration
├── redis.tf             # ElastiCache Redis
├── s3.tf                # S3 buckets and CloudFront
├── monitoring.tf        # CloudWatch, alerts, dashboards
├── security.tf          # WAF, security groups, IAM
├── variables.tf         # Variable definitions
├── outputs.tf           # Output values
├── terraform.tfvars.example  # Example variables
├── environments/
│   ├── staging.tfvars     # Staging environment vars
│   └── production.tfvars  # Production environment vars
└── README.md            # This file
```

## Setup Steps

### 1. Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

### 2. Configure Backend

Create an S3 bucket for Terraform state:

```bash
aws s3api create-bucket \
    --bucket deligateit-terraform-state \
    --region us-east-1

aws dynamodb create-table \
    --table-name terraform-locks \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST
```

### 3. Prepare Environment Variables

Copy the example file and configure:

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

Or use environment-specific files:

```bash
# For staging
cp environments/staging.tfvars terraform.tfvars

# For production
cp environments/production.tfvars terraform.tfvars
```

### 4. Plan the Deployment

```bash
terraform plan -var-file=terraform.tfvars
```

### 5. Apply the Configuration

```bash
terraform apply -var-file=terraform.tfvars
```

## Environment-Specific Deployment

### Staging

```bash
cp environments/staging.tfvars terraform.tfvars
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

### Production

```bash
cp environments/production.tfvars terraform.tfvars
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

## Key Components

### ECS Fargate

- Auto-scaling based on CPU utilization
- Health checks and graceful deployment
- Task execution and IAM roles configured
- CloudWatch logging enabled

### RDS PostgreSQL

- Multi-AZ deployment
- Automated backups (7-day retention)
- Read replica for production
- Enhanced monitoring enabled
- Encryption at rest and in transit

### ElastiCache Redis

- Cluster mode disabled for simplicity
- Automatic failover
- Encryption at rest and in transit
- Slow log enabled

### S3 Storage

- **Assets bucket**: Static files with CloudFront
- **Uploads bucket**: User-generated content
- **Backups bucket**: Database backups with lifecycle
- **ALB logs**: Load balancer access logs
- **CloudTrail logs**: Audit logs

### CloudFront CDN

- Two distributions: assets and uploads
- HTTPS-only with custom SSL certificate
- WAF integration
- Optimized for performance

### Security

- WAF with rate limiting and common attack protection
- VPC with private and public subnets
- Security groups for all services
- KMS encryption for sensitive data
- Secrets Manager for application secrets
- VPC endpoints for private connectivity

### Monitoring

- CloudWatch dashboard with all key metrics
- SNS alerts for critical issues
- Custom metrics for application errors
- VPC flow logs
- CloudTrail for audit

## Maintenance

### Updating the Application

1. Build and push new Docker image
2. Update `app_image` variable in terraform.tfvars
3. Run `terraform apply`

### Scaling

Adjust these variables based on needs:

- `desired_count`: Initial task count
- `min_capacity`/`max_capacity`: Auto-scaling limits
- `task_cpu`/`task_memory`: Task resources
- `db_instance_class`: Database size
- `redis_node_type`: Cache size

### Backup Strategy

- RDS: Automated daily backups (7-day retention)
- S3: Cross-region replication recommended
- Terraform state: S3 with versioning

## Cost Optimization

- Use right-sizing for instances
- Enable S3 lifecycle policies
- Consider reserved instances for predictable workloads
- Monitor CloudWatch metrics for optimization opportunities

## Security Best Practices

1. Rotate secrets regularly
2. Use least privilege IAM roles
3. Enable MFA for AWS users
4. Monitor security group rules
5. Keep Terraform code in version control
6. Review AWS Config findings

## Troubleshooting

### Common Issues

1. **Task fails to start**: Check CloudWatch logs and task definition
2. **Database connection**: Verify security groups and credentials
3. **SSL certificate**: Ensure ACM certificate is in us-east-1 for CloudFront
4. **WAF blocking**: Check WAF logs and rules

### Useful Commands

```bash
# Check ECS task status
aws ecs describe-services --cluster <cluster> --services <service>

# View CloudWatch logs
aws logs tail /ecs/deligateit-staging --follow

# Check ALB health
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# List WAF blocked requests
aws wafv2 get-sampled-requests --web-acl-arn <acl-arn> --scope CLOUDFRONT
```

## Outputs

After deployment, Terraform will output important values:

- Load balancer DNS name
- Database endpoints
- S3 bucket names
- CloudFront domain names
- KMS key ARN
- CloudWatch dashboard URL

## Destroy

To destroy all resources (⚠️ **Be extremely careful in production!**):

```bash
terraform destroy -var-file=terraform.tfvars
```

## Support

For issues or questions:

1. Check Terraform logs
2. Review AWS CloudWatch
3. Check service health dashboard
4. Consult AWS documentation