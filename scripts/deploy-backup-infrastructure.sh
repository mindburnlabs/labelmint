#!/bin/bash

# LabelMint Backup Infrastructure Deployment Script
# This script deploys the comprehensive backup and disaster recovery infrastructure

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/infrastructure/terraform"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

# Default values
ENVIRONMENT="${ENVIRONMENT:-production}"
PROJECT_NAME="${PROJECT_NAME:-labelmintit}"
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
DR_REGION="${DR_REGION:-us-west-2}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-90}"
RPO_THRESHOLD_MINUTES="${RPO_THRESHOLD_MINUTES:-60}"
RTO_THRESHOLD_MINUTES="${RTO_THRESHOLD_MINUTES:-240}"

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed"
    fi

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        error "Terraform is not installed"
    fi

    # Check Python (for Lambda functions)
    if ! command -v python3 &> /dev/null; then
        error "Python 3 is not installed"
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials are not configured"
    fi

    # Verify AWS regions
    if ! aws ec2 describe-regions --region-names "$PRIMARY_REGION" &> /dev/null; then
        error "Primary region $PRIMARY_REGION is not accessible"
    fi

    if ! aws ec2 describe-regions --region-names "$DR_REGION" &> /dev/null; then
        error "DR region $DR_REGION is not accessible"
    fi

    log "Prerequisites check completed successfully"
}

# Function to create Lambda deployment packages
create_lambda_packages() {
    log "Creating Lambda deployment packages..."

    # Create directory for Lambda packages
    mkdir -p "$PROJECT_ROOT/lambda/packages"

    # Backup test Lambda
    info "Creating backup test Lambda package..."
    cd "$PROJECT_ROOT/lambda"

    # Create zip file for backup test Lambda
    python3 - <<'EOF'
import zipfile
import os

# Create backup test lambda zip
with zipfile.ZipFile('backup-test-lambda.zip', 'w') as zipf:
    zipf.write('backup-test-lambda.py', 'index.py')

    # Add any dependencies if needed
    # (for now, we're using only boto3 which is included in Lambda runtime)

print("backup-test-lambda.zip created successfully")
EOF

    # RTO/RPO monitor Lambda
    info "Creating RTO/RPO monitor Lambda package..."
    python3 - <<'EOF'
import zipfile
import os

# Create RTO/RPO monitor lambda zip
with zipfile.ZipFile('rto-rpo-monitor.zip', 'w') as zipf:
    zipf.write('rto-rpo-monitor.py', 'index.py')

print("rto-rpo-monitor.zip created successfully")
EOF

    # Move packages to terraform directory
    mv backup-test-lambda.zip rto-rpo-monitor.zip packages/

    log "Lambda deployment packages created successfully"
}

# Function to validate Terraform configuration
validate_terraform() {
    log "Validating Terraform configuration..."

    cd "$TERRAFORM_DIR"

    # Initialize Terraform
    info "Initializing Terraform..."
    terraform init

    # Validate configuration
    info "Validating Terraform configuration..."
    terraform validate

    # Plan deployment
    info "Creating Terraform plan..."
    terraform plan \
        -var="environment=$ENVIRONMENT" \
        -var="project_name=$PROJECT_NAME" \
        -var="aws_region=$PRIMARY_REGION" \
        -var="dr_region=$DR_REGION" \
        -var="backup_retention_days=$BACKUP_RETENTION_DAYS" \
        -var="rpo_threshold_minutes=$RPO_THRESHOLD_MINUTES" \
        -var="rto_threshold_minutes=$RTO_THRESHOLD_MINUTES" \
        -out="backup-infrastructure.plan"

    log "Terraform validation completed successfully"
}

# Function to deploy backup infrastructure
deploy_backup_infrastructure() {
    log "Deploying backup infrastructure..."

    cd "$TERRAFORM_DIR"

    # Apply Terraform configuration
    info "Applying Terraform configuration..."
    terraform apply backup-infrastructure.plan

    log "Backup infrastructure deployed successfully"
}

# Function to configure backup testing
configure_backup_testing() {
    log "Configuring automated backup testing..."

    # Deploy backup testing framework
    info "Deploying backup testing framework..."
    cd "$PROJECT_ROOT"

    # Create Python package for backup testing
    pip3 install -r requirements.txt --target scripts/ 2>/dev/null || true

    # Set up CloudWatch Events for backup testing
    aws events put-rule \
        --name "${PROJECT_NAME}-${ENVIRONMENT}-backup-testing-schedule" \
        --schedule-expression "cron(0 6 * * ? *)" \
        --region "$PRIMARY_REGION"

    # Add permission for CloudWatch to invoke Lambda
    aws lambda add-permission \
        --function-name "${PROJECT_NAME}-${ENVIRONMENT}-backup-test" \
        --statement-id "CloudWatchEventsPermission" \
        --action "lambda:InvokeFunction" \
        --principal "events.amazonaws.com" \
        --source-arn "$(aws events describe-rule --name "${PROJECT_NAME}-${ENVIRONMENT}-backup-testing-schedule" --query 'Arn' --output text)" \
        --region "$PRIMARY_REGION"

    log "Backup testing configuration completed"
}

# Function to verify deployment
verify_deployment() {
    log "Verifying backup infrastructure deployment..."

    # Check backup vaults
    info "Verifying backup vaults..."
    BACKUP_VAULTS=(
        "${PROJECT_NAME}-${ENVIRONMENT}-postgres-backup-vault"
        "${PROJECT_NAME}-${ENVIRONMENT}-redis-backup-vault"
    )

    for vault in "${BACKUP_VAULTS[@]}"; do
        if aws backup describe-backup-vault --backup-vault-name "$vault" --region "$PRIMARY_REGION" &> /dev/null; then
            log "✓ Backup vault $vault exists"
        else
            error "✗ Backup vault $vault does not exist"
        fi
    done

    # Check DR backup vaults
    if [ "$ENVIRONMENT" = "production" ]; then
        info "Verifying DR backup vaults..."
        DR_BACKUP_VAULTS=(
            "${PROJECT_NAME}-${ENVIRONMENT}-postgres-backup-vault-dr"
            "${PROJECT_NAME}-${ENVIRONMENT}-redis-backup-vault-dr"
        )

        for vault in "${DR_BACKUP_VAULTS[@]}"; do
            if aws backup describe-backup-vault --backup-vault-name "$vault" --region "$DR_REGION" &> /dev/null; then
                log "✓ DR backup vault $vault exists"
            else
                error "✗ DR backup vault $vault does not exist"
            fi
        done
    fi

    # Check Lambda functions
    info "Verifying Lambda functions..."
    LAMBDA_FUNCTIONS=(
        "${PROJECT_NAME}-${ENVIRONMENT}-backup-test"
        "${PROJECT_NAME}-${ENVIRONMENT}-rto-rpo-monitor"
        "${PROJECT_NAME}-${ENVIRONMENT}-backup-compliance-report"
    )

    for func in "${LAMBDA_FUNCTIONS[@]}"; do
        if aws lambda get-function --function-name "$func" --region "$PRIMARY_REGION" &> /dev/null; then
            log "✓ Lambda function $func exists"
        else
            error "✗ Lambda function $func does not exist"
        fi
    done

    # Check CloudWatch dashboards
    info "Verifying CloudWatch dashboards..."
    if aws cloudwatch get-dashboard --dashboard-name "${PROJECT_NAME}-${ENVIRONMENT}-backup-monitoring" --region "$PRIMARY_REGION" &> /dev/null; then
        log "✓ CloudWatch backup monitoring dashboard exists"
    else
        error "✗ CloudWatch backup monitoring dashboard does not exist"
    fi

    # Check Route53 health checks (if production)
    if [ "$ENVIRONMENT" = "production" ]; then
        info "Verifying Route53 health checks..."
        HEALTH_CHECKS=(
            "${PROJECT_NAME}-${ENVIRONMENT}-primary-health-check"
            "${PROJECT_NAME}-${ENVIRONMENT}-dr-health-check"
        )

        for check in "${HEALTH_CHECKS[@]}"; do
            if aws route53 get-health-check --health-check-id "$(aws route53 list-health-checks --query "HealthChecks[?CallerReference=='$check'].Id" --output text)" &> /dev/null; then
                log "✓ Health check $check exists"
            else
                warn "⚠ Health check $check may not exist"
            fi
        done
    fi

    log "Deployment verification completed"
}

# Function to generate deployment report
generate_deployment_report() {
    log "Generating deployment report..."

    REPORT_FILE="$PROJECT_ROOT/deployment-reports/backup-deployment-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).json"
    mkdir -p "$(dirname "$REPORT_FILE")"

    cat > "$REPORT_FILE" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "project_name": "$PROJECT_NAME",
    "primary_region": "$PRIMARY_REGION",
    "dr_region": "$DR_REGION",
    "backup_retention_days": $BACKUP_RETENTION_DAYS,
    "rpo_threshold_minutes": $RPO_THRESHOLD_MINUTES,
    "rto_threshold_minutes": $RTO_THRESHOLD_MINUTES
  },
  "infrastructure": {
    "backup_vaults": {
      "primary": [
        "${PROJECT_NAME}-${ENVIRONMENT}-postgres-backup-vault",
        "${PROJECT_NAME}-${ENVIRONMENT}-redis-backup-vault"
      ],
      "dr": [
        "${PROJECT_NAME}-${ENVIRONMENT}-postgres-backup-vault-dr",
        "${PROJECT_NAME}-${ENVIRONMENT}-redis-backup-vault-dr"
      ]
    },
    "lambda_functions": [
      "${PROJECT_NAME}-${ENVIRONMENT}-backup-test",
      "${PROJECT_NAME}-${ENVIRONMENT}-rto-rpo-monitor",
      "${PROJECT_NAME}-${ENVIRONMENT}-backup-compliance-report"
    ],
    "monitoring": {
      "cloudwatch_dashboard": "${PROJECT_NAME}-${ENVIRONMENT}-backup-monitoring",
      "alarms": [
        "${PROJECT_NAME}-${ENVIRONMENT}-backup-failed",
        "${PROJECT_NAME}-${ENVIRONMENT}-rpo-violation-postgresql",
        "${PROJECT_NAME}-${ENVIRONMENT}-rpo-violation-redis",
        "${PROJECT_NAME}-${ENVIRONMENT}-replication-lag"
      ]
    }
  },
  "status": "completed",
  "next_steps": [
    "Monitor initial backup jobs",
    "Verify cross-region replication",
    "Test disaster recovery procedures",
    "Review monitoring alerts"
  ]
}
EOF

    log "Deployment report generated: $REPORT_FILE"
}

# Function to show post-deployment instructions
show_post_deployment_instructions() {
    log "Deployment completed successfully!"

    echo
    info "Post-Deployment Instructions:"
    echo "1. Monitor the first backup jobs in CloudWatch:"
    echo "   aws backup list-backup-jobs --region $PRIMARY_REGION"
    echo
    echo "2. Verify cross-region replication:"
    echo "   aws backup list-recovery-points-by-backup-vault --backup-vault-name ${PROJECT_NAME}-${ENVIRONMENT}-postgres-backup-vault-dr --region $DR_REGION"
    echo
    echo "3. Check monitoring dashboard:"
    echo "   https://console.aws.amazon.com/cloudwatch/home?region=$PRIMARY_REGION#dashboards:name=${PROJECT_NAME}-${ENVIRONMENT}-backup-monitoring"
    echo
    echo "4. Test backup framework manually:"
    echo "   python3 scripts/backup-testing-framework.py"
    echo
    echo "5. Review disaster recovery runbooks:"
    echo "   docs/disaster-recovery-runbooks.md"
    echo
    warn "Important: Schedule a disaster recovery drill within 30 days of deployment"
    warn "Update emergency contact information in runbooks"
    warn "Configure Slack/email notifications for backup alerts"
}

# Main execution function
main() {
    log "Starting LabelMint backup infrastructure deployment..."

    # Check if running in production
    if [ "$ENVIRONMENT" = "production" ]; then
        warn "DEPLOYING TO PRODUCTION ENVIRONMENT"
        warn "This will create production backup infrastructure"
        read -p "Are you sure you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^yes$ ]]; then
            error "Deployment cancelled by user"
        fi
    fi

    # Execute deployment steps
    check_prerequisites
    create_lambda_packages
    validate_terraform
    deploy_backup_infrastructure
    configure_backup_testing
    verify_deployment
    generate_deployment_report
    show_post_deployment_instructions

    log "Backup infrastructure deployment completed successfully!"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "validate")
        log "Running validation only..."
        check_prerequisites
        validate_terraform
        log "Validation completed successfully"
        ;;
    "verify")
        log "Running verification only..."
        check_prerequisites
        verify_deployment
        log "Verification completed successfully"
        ;;
    "test")
        log "Running backup testing framework..."
        cd "$PROJECT_ROOT"
        python3 scripts/backup-testing-framework.py
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [deploy|validate|verify|test|help]"
        echo "  deploy   - Deploy backup infrastructure (default)"
        echo "  validate - Validate Terraform configuration only"
        echo "  verify   - Verify existing deployment only"
        echo "  test     - Run backup testing framework"
        echo "  help     - Show this help message"
        ;;
    *)
        error "Unknown command: $1. Use 'help' for usage information."
        ;;
esac