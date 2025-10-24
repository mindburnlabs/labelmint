#!/bin/bash
# Zero-Downtime Deployment Script for LabelMint
# =============================================
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-staging}"
SERVICE="${2:-all}"
REGION="${AWS_REGION:-us-east-1}"
HEALTH_CHECK_TIMEOUT=300
ROLLBACK_TIMEOUT=600

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp} - $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp} - $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp} - $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} ${timestamp} - $message"
            ;;
    esac
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    cleanup
    exit 1
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up temporary resources..."
    # Add cleanup logic here
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error_exit "AWS CLI is not installed"
    fi

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error_exit "kubectl is not installed"
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed"
    fi

    # Check if logged in to ECR
    if ! aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"; then
        error_exit "Failed to log in to ECR"
    fi

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error_exit "AWS credentials not configured"
    fi

    log "INFO" "Prerequisites check passed"
}

# Get current task definition
get_current_task_definition() {
    local service_name=$1
    aws ecs describe-services \
        --cluster "labelmint-$ENVIRONMENT" \
        --services "$service_name" \
        --region "$REGION" \
        --query 'services[0].taskDefinition' \
        --output text
}

# Create new task definition
create_task_definition() {
    local service_name=$1
    local image_tag=$2
    local task_def_file="$PROJECT_ROOT/infrastructure/terraform/task-definitions/$service_name-$ENVIRONMENT.json"

    log "INFO" "Creating new task definition for $service_name with image tag $image_tag"

    # Get current task definition
    local current_task_def=$(get_current_task_definition "$service_name")

    # Download current task definition
    aws ecs describe-task-definition \
        --task-definition "$current_task_def" \
        --region "$REGION" \
        > "/tmp/current-$service_name-task-def.json"

    # Update image in task definition
    jq --arg image "$AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/labelmint-$service_name:$image_tag" \
        '.taskDefinition.containerDefinitions[0].image = $image' \
        "/tmp/current-$service_name-task-def.json" \
        > "/tmp/new-$service_name-task-def.json"

    # Remove unwanted fields
    jq '.taskDefinition | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' \
        "/tmp/new-$service_name-task-def.json" \
        > "/tmp/final-$service_name-task-def.json"

    # Register new task definition
    local new_task_def=$(aws ecs register-task-definition \
        --cli-input-json file:///tmp/final-$service_name-task-def.json \
        --region "$REGION" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)

    log "INFO" "Created new task definition: $new_task_def"
    echo "$new_task_def"
}

# Update service
update_service() {
    local service_name=$1
    local task_definition_arn=$2

    log "INFO" "Updating ECS service: $service_name"

    aws ecs update-service \
        --cluster "labelmint-$ENVIRONMENT" \
        --service "$service_name" \
        --task-definition "$task_definition_arn" \
        --force-new-deployment \
        --region "$REGION" \
        --query 'service.serviceArn' \
        --output text
}

# Wait for deployment to stabilize
wait_for_deployment() {
    local service_name=$1
    local timeout=$2

    log "INFO" "Waiting for deployment to stabilize for $service_name (timeout: ${timeout}s)..."

    local start_time=$(date +%s)
    local end_time=$((start_time + timeout))

    while true; do
        local current_time=$(date +%s)

        if [ $current_time -gt $end_time ]; then
            error_exit "Deployment timeout for $service_name after ${timeout}s"
        fi

        local service_status=$(aws ecs describe-services \
            --cluster "labelmint-$ENVIRONMENT" \
            --services "$service_name" \
            --region "$REGION" \
            --query 'services[0].deployments[0].rolloutState' \
            --output text)

        case $service_status in
            "COMPLETED")
                log "INFO" "Deployment completed for $service_name"
                return 0
                ;;
            "FAILED")
                log "ERROR" "Deployment failed for $service_name"
                return 1
                ;;
            "IN_PROGRESS")
                log "INFO" "Deployment in progress for $service_name..."
                sleep 10
                ;;
            *)
                log "DEBUG" "Unknown deployment state: $service_status"
                sleep 10
                ;;
        esac
    done
}

# Health check
health_check() {
    local service_name=$1
    local url=$2
    local timeout=${3:-300}

    log "INFO" "Performing health check for $service_name at $url (timeout: ${timeout}s)..."

    local start_time=$(date +%s)
    local end_time=$((start_time + timeout))

    while true; do
        local current_time=$(date +%s)

        if [ $current_time -gt $end_time ]; then
            error_exit "Health check timeout for $service_name after ${timeout}s"
        fi

        if curl -f -s "$url/health" > /dev/null; then
            log "INFO" "Health check passed for $service_name"
            return 0
        fi

        log "DEBUG" "Health check failed, retrying in 10 seconds..."
        sleep 10
    done
}

# Rollback deployment
rollback_deployment() {
    local service_name=$1
    local previous_task_def=$2

    log "WARN" "Rolling back $service_name to previous task definition: $previous_task_def"

    aws ecs update-service \
        --cluster "labelmint-$ENVIRONMENT" \
        --service "$service_name" \
        --task-definition "$previous_task_def" \
        --force-new-deployment \
        --region "$REGION"

    if wait_for_deployment "$service_name" "$ROLLBACK_TIMEOUT"; then
        log "INFO" "Rollback completed successfully for $service_name"
    else
        error_exit "Rollback failed for $service_name"
    fi
}

# Get load balancer DNS name
get_load_balancer_dns() {
    local service_name=$1

    aws elbv2 describe-load-balancers \
        --region "$REGION" \
        --names "labelmint-$ENVIRONMENT-$service_name-alb" \
        --query 'LoadBalancers[0].DNSName' \
        --output text
}

# Deploy service
deploy_service() {
    local service_name=$1
    local image_tag=$2
    local health_url=$3

    log "INFO" "Starting deployment of $service_name"

    # Store current task definition for rollback
    local current_task_def=$(get_current_task_definition "$service_name")
    log "INFO" "Current task definition: $current_task_def"

    # Create new task definition
    local new_task_def=$(create_task_definition "$service_name" "$image_tag")

    # Update service
    update_service "$service_name" "$new_task_def"

    # Wait for deployment
    if wait_for_deployment "$service_name" "$HEALTH_CHECK_TIMEOUT"; then
        # Perform health check
        local lb_dns=$(get_load_balancer_dns "$service_name")
        local service_url="http://$lb_dns"

        if health_check "$service_name" "$service_url"; then
            log "INFO" "Deployment of $service_name completed successfully"
            return 0
        else
            log "ERROR" "Health check failed for $service_name"
            rollback_deployment "$service_name" "$current_task_def"
            return 1
        fi
    else
        log "ERROR" "Deployment failed for $service_name"
        rollback_deployment "$service_name" "$current_task_def"
        return 1
    fi
}

# Deploy all services
deploy_all() {
    local image_tag=$1

    # Deploy backend first
    if deploy_service "labelmint-backend" "$image_tag" "http://backend-api.labelmint.it"; then
        log "INFO" "Backend deployed successfully"
    else
        error_exit "Backend deployment failed"
    fi

    # Deploy web
    if deploy_service "labelmint-web" "$image_tag" "http://labelmint.it"; then
        log "INFO" "Web deployed successfully"
    else
        error_exit "Web deployment failed"
    fi

    # Deploy payment service
    if deploy_service "labelmint-payment" "$image_tag" "http://payment-api.labelmint.it"; then
        log "INFO" "Payment service deployed successfully"
    else
        error_exit "Payment service deployment failed"
    fi
}

# Main function
main() {
    log "INFO" "Starting zero-downtime deployment for LabelMint"
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Service: $SERVICE"
    log "INFO" "Region: $REGION"

    # Check prerequisites
    check_prerequisites

    # Get image tag from Git
    local image_tag="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
    log "INFO" "Using image tag: $image_tag"

    # Build and push Docker images
    log "INFO" "Building and pushing Docker images..."
    if ! "$PROJECT_ROOT/scripts/build-and-push.sh" "$image_tag"; then
        error_exit "Failed to build and push Docker images"
    fi

    # Deploy based on service parameter
    case $SERVICE in
        "backend")
            deploy_service "labelmint-backend" "$image_tag" "http://backend-api.labelmint.it"
            ;;
        "web")
            deploy_service "labelmint-web" "$image_tag" "http://labelmint.it"
            ;;
        "payment")
            deploy_service "labelmint-payment" "$image_tag" "http://payment-api.labelmint.it"
            ;;
        "all")
            deploy_all "$image_tag"
            ;;
        *)
            error_exit "Unknown service: $SERVICE. Valid options: backend, web, payment, all"
            ;;
    esac

    log "INFO" "Deployment completed successfully!"

    # Send notification
    if command -v slack-cli &> /dev/null; then
        slack-cli send \
            --channel "#deployments" \
            --message "✅ Deployment to $ENVIRONMENT completed successfully! Service: $SERVICE, Image tag: $image_tag"
    fi
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi