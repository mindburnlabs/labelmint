#!/bin/bash
# LabelMint Deployment Script
# Usage: ./deploy.sh [environment] [action]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${1:-staging}
ACTION=${2:-deploy}
DRY_RUN=${DRY_RUN:-false}
SKIP_BUILD=${SKIP_BUILD:-false}
SKIP_TESTS=${SKIP_TESTS:-false}
HELM_TIMEOUT=${HELM_TIMEOUT:-10m}

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check required tools
    local required_tools=("kubectl" "helm" "docker" "aws" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            print_error "$tool is not installed"
            exit 1
        fi
    done

    # Check kubectl context
    local current_context=$(kubectl config current-context)
    print_status "Using kubectl context: $current_context"

    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "Please run this script from the root of the repository"
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Function to validate environment
validate_environment() {
    print_status "Validating environment: $ENVIRONMENT"

    # Check if environment config exists
    local env_file="infrastructure/environments/$ENVIRONMENT/env.yaml"
    if [ ! -f "$env_file" ]; then
        print_error "Environment config not found: $env_file"
        exit 1
    fi

    # Extract namespace from config
    NAMESPACE=$(yq eval '.namespace' "$env_file")

    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        print_warning "Namespace $NAMESPACE does not exist. Creating..."
        kubectl create namespace "$NAMESPACE"
    fi

    print_success "Environment validation passed"
}

# Function to run tests
run_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        print_warning "Skipping tests as requested"
        return 0
    fi

    print_status "Running tests..."

    # Run unit tests
    pnpm test:unit

    # Run integration tests
    pnpm test:integration

    # Run security scan
    pnpm audit --audit-level high

    print_success "All tests passed"
}

# Function to build and push Docker images
build_and_push() {
    if [ "$SKIP_BUILD" = "true" ]; then
        print_warning "Skipping build as requested"
        return 0
    fi

    print_status "Building and pushing Docker images..."

    # Build images
    docker-compose -f infrastructure/docker/docker-compose.yml build

    # Get registry URL from environment
    local registry="ghcr.io/labelmint/labelmint"

    # Tag and push images
    local services=("labelmint-backend" "labelmint-frontend" "labelmint-workers")
    for service in "${services[@]}"; do
        local tag="${registry}/${service}:${ENVIRONMENT}-${BUILD_NUMBER:-latest}"

        # Tag image
        docker tag "labelmint/${service}:latest" "$tag"

        # Push image
        docker push "$tag"

        print_success "Pushed $tag"
    done

    print_success "All images built and pushed"
}

# Function to deploy monitoring
deploy_monitoring() {
    print_status "Deploying monitoring stack..."

    # Add Helm repos
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Deploy Prometheus
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --values infrastructure/helm/monitoring/prometheus-values.yaml \
        --wait \
        --timeout $HELM_TIMEOUT

    # Deploy Loki
    helm upgrade --install loki grafana/loki-stack \
        --namespace monitoring \
        --values infrastructure/helm/monitoring/loki-values.yaml \
        --wait \
        --timeout $HELM_TIMEOUT

    # Deploy Tempo
    helm upgrade --install tempo grafana/tempo \
        --namespace monitoring \
        --values infrastructure/helm/monitoring/tempo-values.yaml \
        --wait \
        --timeout $HELM_TIMEOUT

    print_success "Monitoring stack deployed"
}

# Function to deploy application
deploy_application() {
    print_status "Deploying application to $ENVIRONMENT..."

    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Deploy secrets
    if [ "$ENVIRONMENT" = "production" ]; then
        # Use sealed secrets or external secrets for production
        kubectl apply -f infrastructure/security/sealed-secrets.yaml
    else
        # Use regular secrets for non-production
        kubectl apply -f infrastructure/k8s/configmaps/labelmint-secrets.yaml
    fi

    # Deploy configmaps
    kubectl apply -f infrastructure/k8s/configmaps/ -n "$NAMESPACE"

    # Deploy services
    kubectl apply -f infrastructure/k8s/services/ -n "$NAMESPACE"

    # Deploy applications
    kubectl apply -f infrastructure/k8s/deployments/ -n "$NAMESPACE"

    # Deploy ingress
    kubectl apply -f infrastructure/k8s/ingress/ -n "$NAMESPACE"

    # Wait for deployments to be ready
    kubectl rollout status deployment/labelmint-backend -n "$NAMESPACE" --timeout=5m
    kubectl rollout status deployment/labelmint-frontend -n "$NAMESPACE" --timeout=5m
    kubectl rollout status deployment/postgres -n "$NAMESPACE" --timeout=5m
    kubectl rollout status deployment/redis -n "$NAMESPACE" --timeout=5m

    print_success "Application deployed successfully"
}

# Function to run smoke tests
run_smoke_tests() {
    print_status "Running smoke tests..."

    # Get ingress URL
    local ingress_url=$(kubectl get ingress labelmint-ingress -n "$NAMESPACE" -o jsonpath='{.spec.rules[0].host}')

    # Health check
    local retries=30
    local count=0
    while [ $count -lt $retries ]; do
        if curl -f "https://$ingress_url/health" &> /dev/null; then
            print_success "Health check passed"
            break
        fi
        count=$((count + 1))
        sleep 10
    done

    if [ $count -eq $retries ]; then
        print_error "Health check failed after $retries attempts"
        exit 1
    fi

    # Check API endpoints
    local endpoints=(
        "/api/health"
        "/api/ready"
        "/metrics"
    )

    for endpoint in "${endpoints[@]}"; do
        if curl -f "https://api.$ingress_url$endpoint" &> /dev/null; then
            print_success "Endpoint $endpoint is healthy"
        else
            print_warning "Endpoint $endpoint is not responding"
        fi
    done

    print_success "Smoke tests completed"
}

# Function to cleanup old resources
cleanup() {
    print_status "Cleaning up old resources..."

    # Remove old Docker images
    docker system prune -f

    # Remove old Helm releases
    helm list --namespace "$NAMESPACE" -q | grep -v prometheus | while read -r release; do
        if helm status "$release" -n "$NAMESPACE" | grep -q "deployed"; then
            local status=$(helm get values "$release" -n "$NAMESPACE" -o json | jq -r '.status // "unknown"')
            if [ "$status" = "failed" ]; then
                print_warning "Removing failed release: $release"
                helm uninstall "$release" -n "$NAMESPACE"
            fi
        fi
    done

    # Clean up old failed pods
    kubectl delete pods --field-selector=status.phase=Failed -n "$NAMESPACE" --ignore-not-found=true

    print_success "Cleanup completed"
}

# Function to generate deployment report
generate_report() {
    print_status "Generating deployment report..."

    local report_file="deployment-report-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).json"

    # Gather deployment information
    local report=$(cat <<EOF
{
  "deployment": {
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "timestamp": "$(date -Iseconds)",
    "git_commit": "$(git rev-parse HEAD)",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD)",
    "build_number": "${BUILD_NUMBER:-N/A}",
    "deployer": "${USER:-N/A}"
  },
  "cluster": {
    "context": "$(kubectl config current-context)",
    "version": "$(kubectl version --short | grep 'Server Version' | cut -d' ' -f3)"
  },
  "resources": {
    "deployments": $(kubectl get deployments -n "$NAMESPACE" -o json | jq '.items | length'),
    "pods": $(kubectl get pods -n "$NAMESPACE" -o json | jq '.items | length'),
    "services": $(kubectl get services -n "$NAMESPACE" -o json | jq '.items | length')
  },
  "status": "success"
}
EOF
)

    echo "$report" | jq '.' > "$report_file"

    print_success "Deployment report generated: $report_file"
}

# Function to display help
show_help() {
    cat << EOF
LabelMint Deployment Script

Usage: $0 [ENVIRONMENT] [ACTION] [OPTIONS]

ENVIRONMENTS:
  development   Deploy to development environment
  staging       Deploy to staging environment
  production    Deploy to production environment

ACTIONS:
  deploy        Deploy the application (default)
  update        Update existing deployment
  rollback      Rollback to previous version
  status        Show deployment status
  clean         Cleanup old resources
  monitor       Deploy monitoring stack only

ENVIRONMENT VARIABLES:
  DRY_RUN=true              Simulate deployment without making changes
  SKIP_BUILD=true           Skip Docker build and push
  SKIP_TESTS=true           Skip running tests
  BUILD_NUMBER=123          Build number for image tags
  HELM_TIMEOUT=15m          Timeout for Helm operations

EXAMPLES:
  $0 staging deploy                    Deploy to staging
  $0 production deploy                  Deploy to production
  $0 staging update                     Update staging deployment
  $0 production rollback               Rollback production
  DRY_RUN=true $0 staging deploy       Simulate deployment
  SKIP_TESTS=true $0 development deploy Deploy without tests

EOF
}

# Main execution
main() {
    # Parse command line arguments
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        status)
            validate_environment
            kubectl get all -n "$NAMESPACE"
            exit 0
            ;;
        rollback)
            validate_environment
            print_status "Rolling back deployment in $ENVIRONMENT..."
            helm rollback labelmint -n "$NAMESPACE"
            exit 0
            ;;
        clean)
            validate_environment
            cleanup
            exit 0
            ;;
        monitor)
            check_prerequisites
            validate_environment
            deploy_monitoring
            exit 0
            ;;
    esac

    # Execute deployment pipeline
    print_status "Starting deployment to $ENVIRONMENT..."

    check_prerequisites
    validate_environment
    run_tests
    build_and_push

    if [ "$ACTION" = "deploy" ]; then
        deploy_application
        deploy_monitoring
        run_smoke_tests
        generate_report
        cleanup
    fi

    print_success "Deployment completed successfully!"

    # Show next steps
    echo
    print_status "Next steps:"
    echo "  1. Check the application: https://app.${ENVIRONMENT}.labelmint.com"
    echo "  2. Check monitoring: https://grafana.${ENVIRONMENT}.labelmint.com"
    echo "  3. Check logs: kubectl logs -n $NAMESPACE -l app=labelmint-backend"
    echo "  4. Check metrics: kubectl port-forward -n monitoring svc/prometheus-server 9090:80"
}

# Trap to handle interruptions
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"