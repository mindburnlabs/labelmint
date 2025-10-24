#!/bin/bash

# Production Deployment Script for TON Mainnet Payment System
# This script switches to mainnet and deploys the production payment system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="production"
REGION="us-east-1"
PROJECT_NAME="labelmint"

echo -e "${BLUE}🚀 Starting production payment system deployment...${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed"
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    # Check if logged into AWS
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "Not logged into AWS. Please run 'aws configure' first."
        exit 1
    fi

    print_status "Prerequisites check passed ✓"
}

# Verify environment variables
verify_env_vars() {
    print_status "Verifying environment variables..."

    required_vars=(
        "AWS_REGION"
        "TON_API_KEY"
        "TON_MASTER_KEY"
        "STRIPE_SECRET_KEY"
        "PAYPAL_CLIENT_ID"
        "PAYPAL_CLIENT_SECRET"
        "SLACK_WEBHOOK_URL"
        "PAYMENT_ALERT_EMAIL"
        "DATABASE_URL"
        "JWT_SECRET"
    )

    missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi

    print_status "Environment variables verified ✓"
}

# Backup current configuration
backup_config() {
    print_status "Backing up current configuration..."

    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # Backup Terraform state
    if [ -f "infrastructure/terraform/terraform.tfstate" ]; then
        cp infrastructure/terraform/terraform.tfstate "$BACKUP_DIR/"
    fi

    # Backup environment files
    find . -name ".env*" -not -path "./node_modules/*" | xargs -I {} cp {} "$BACKUP_DIR/"

    print_status "Configuration backed up to $BACKUP_DIR ✓"
}

# Build and push Docker images
build_and_push_images() {
    print_status "Building and pushing Docker images..."

    # Build payment service image
    cd backend
    docker build -t "$PROJECT_NAME/payments:latest" -f Dockerfile.payments .

    # Tag with timestamp
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    docker tag "$PROJECT_NAME/payments:latest" "$PROJECT_NAME/payments:$TIMESTAMP"

    # Push to ECR
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI

    docker tag "$PROJECT_NAME/payments:latest" "$ECR_URI/$PROJECT_NAME/payments:latest"
    docker push "$ECR_URI/$PROJECT_NAME/payments:latest"

    cd ..

    print_status "Docker images built and pushed ✓"
}

# Deploy infrastructure
deploy_infrastructure() {
    print_status "Deploying infrastructure with Terraform..."

    cd infrastructure/terraform

    # Initialize Terraform
    terraform init

    # Plan deployment
    print_status "Creating Terraform plan..."
    terraform plan \
        -var-file="variables.tfvars" \
        -var-file="variables-payments.tfvars" \
        -out=tfplan

    # Confirm deployment
    echo
    print_warning "Please review the Terraform plan above."
    read -p "Do you want to proceed with the deployment? (yes/no): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_error "Deployment cancelled"
        exit 1
    fi

    # Apply changes
    print_status "Applying Terraform configuration..."
    terraform apply tfplan

    cd ..

    print_status "Infrastructure deployed ✓"
}

# Configure mainnet settings
configure_mainnet() {
    print_status "Configuring TON mainnet settings..."

    # Update database configuration
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
        UPDATE system_configs
        SET value = 'mainnet'
        WHERE key = 'ton_network';

        UPDATE system_configs
        SET value = 'true'
        WHERE key = 'production_mode';

        UPDATE system_configs
        SET value = 'true'
        WHERE key = 'payment_monitoring_enabled';

        UPDATE system_configs
        SET value = 'true'
        WHERE key = 'fee_optimization_enabled';
    "

    # Seed backup payment methods
    node scripts/seed-backup-payments.js

    print_status "Mainnet configuration completed ✓"
}

# Run health checks
run_health_checks() {
    print_status "Running health checks..."

    # Wait for services to start
    sleep 30

    # Check API health
    API_URL="https://api.$PROJECT_NAME.com"

    if curl -f "$API_URL/health" > /dev/null 2>&1; then
        print_status "API health check passed ✓"
    else
        print_error "API health check failed"
        exit 1
    fi

    # Check payment service health
    if curl -f "$API_URL/api/payments/health" > /dev/null 2>&1; then
        print_status "Payment service health check passed ✓"
    else
        print_error "Payment service health check failed"
        exit 1
    fi

    # Check database connection
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
        print_status "Database connection check passed ✓"
    else
        print_error "Database connection check failed"
        exit 1
    fi

    # Check TON connection
    if node scripts/check-ton-connection.js > /dev/null 2>&1; then
        print_status "TON mainnet connection check passed ✓"
    else
        print_error "TON mainnet connection check failed"
        exit 1
    fi
}

# Setup monitoring alerts
setup_monitoring() {
    print_status "Setting up monitoring alerts..."

    # Create CloudWatch alarms
    aws cloudwatch put-metric-alarm \
        --alarm-name "$PROJECT_NAME-PaymentFailureRate" \
        --alarm-description "High payment failure rate" \
        --metric-name PaymentFailureRate \
        --namespace "Deligate/Payments" \
        --statistic Average \
        --period 300 \
        --threshold 5 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2

    aws cloudwatch put-metric-alarm \
        --alarm-name "$PROJECT_NAME-PendingTransactions" \
        --alarm-description "Too many pending transactions" \
        --metric-name PendingTransactions \
        --namespace "Deligate/Payments" \
        --statistic Average \
        --period 300 \
        --threshold 100 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 1

    print_status "Monitoring alerts configured ✓"
}

# Generate deployment report
generate_report() {
    print_status "Generating deployment report..."

    REPORT_FILE="deployment-reports/mainnet-deployment-$(date +%Y%m%d_%H%M%S).md"
    mkdir -p deployment-reports

    cat > "$REPORT_FILE" << EOF
# Production Payment System Deployment Report

**Date:** $(date)
**Environment:** Production (Mainnet)
**Region:** $REGION

## Deployment Summary

- ✅ Prerequisites verified
- ✅ Environment variables validated
- ✅ Configuration backed up
- ✅ Docker images built and pushed
- ✅ Infrastructure deployed
- ✅ Mainnet configured
- ✅ Health checks passed
- ✅ Monitoring configured

## Service Endpoints

- API: https://api.$PROJECT_NAME.com
- Admin Dashboard: https://admin.$PROJECT_NAME.com
- Payment API: https://api.$PROJECT_NAME.com/api/payments

## Configuration

- TON Network: Mainnet
- USDT Contract: EQCxE6mUtQJKFnGfaROTKOt1lEZb9ATg-TFoM3BzO5dYQfTj
- Monitoring: Enabled
- Fee Optimization: Enabled
- Backup Payments: Stripe, PayPal

## Next Steps

1. Monitor the system for the first 24 hours
2. Check alert integrations (Slack/Email)
3. Review transaction metrics
4. Update documentation

## Rollback Plan

If issues arise, run:
\`\`\`bash
./scripts/rollback-mainnet.sh
\`\`\`

EOF

    print_status "Deployment report generated: $REPORT_FILE ✓"
}

# Main execution
main() {
    print_status "Starting production payment system deployment to mainnet..."
    echo

    # Confirm deployment
    print_warning "This will deploy the payment system to TON MAINNET with REAL FUNDS."
    print_warning "Please ensure you have thoroughly tested on testnet."
    echo
    read -p "Type 'DEPLOY TO MAINNET' to confirm: " -r
    echo
    if [[ $REPLY != "DEPLOY TO MAINNET" ]]; then
        print_error "Deployment cancelled - confirmation not received"
        exit 1
    fi

    # Execute deployment steps
    check_prerequisites
    verify_env_vars
    backup_config
    build_and_push_images
    deploy_infrastructure
    configure_mainnet
    run_health_checks
    setup_monitoring
    generate_report

    echo
    print_status "🎉 Production payment system deployment completed successfully!"
    print_status "The system is now running on TON mainnet with production monitoring."
    echo
    print_status "Important:"
    print_status "- Monitor the dashboard for the first 24 hours"
    print_status "- All transactions will use REAL funds"
    print_status "- Alerts are configured for critical issues"
    print_status "- Backup payment methods are ready as fallback"
}

# Execute main function
main "$@"