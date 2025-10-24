#!/bin/bash

# LabelMint Unified Deployment Script
# This script orchestrates the deployment of the consolidated LabelMint infrastructure

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.unified.yml"
ENV_FILE="$PROJECT_ROOT/.env"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed or not in PATH"
        exit 1
    fi

    # Check if .env file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        warn ".env file not found. Creating from template..."
        if [[ -f "$PROJECT_ROOT/.env.unified.example" ]]; then
            cp "$PROJECT_ROOT/.env.unified.example" "$ENV_FILE"
            warn "Please edit $ENV_FILE with your configuration before continuing"
            exit 1
        else
            error "Environment template file not found"
            exit 1
        fi
    fi

    # Check if docker-compose.unified.yml exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error "Unified docker-compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    success "Prerequisites check passed"
}

# Validate configuration
validate_config() {
    log "Validating configuration..."

    # Load environment variables
    source "$ENV_FILE"

    # Check required variables
    local required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "MINIO_ACCESS_KEY"
        "MINIO_SECRET_KEY"
    )

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            error "  - $var"
        done
        exit 1
    fi

    success "Configuration validation passed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."

    local directories=(
        "logs"
        "uploads"
        "cache/nginx"
        "infrastructure/grafana/provisioning"
        "infrastructure/grafana/dashboards"
        "infrastructure/monitoring/rules"
        "infrastructure/monitoring/alerts"
        "infrastructure/nginx/conf.d"
        "infrastructure/nginx/ssl"
        "redis"
        "minio"
        "scripts"
    )

    for dir in "${directories[@]}"; do
        mkdir -p "$PROJECT_ROOT/$dir"
    done

    success "Directories created"
}

# Network cleanup and setup
setup_networks() {
    log "Setting up Docker networks..."

    # Remove existing conflicting networks
    local networks_to_remove=(
        "labelmint_default"
        "labelmint_labelmint-network"
    )

    for network in "${networks_to_remove[@]}"; do
        if docker network ls | grep -q "$network"; then
            log "Removing conflicting network: $network"
            docker network rm "$network" || true
        fi
    done

    success "Network setup completed"
}

# Start services
start_services() {
    local profile=${1:-""}

    log "Starting LabelMint services..."

    cd "$PROJECT_ROOT"

    if [[ -n "$profile" ]]; then
        log "Starting with profile: $profile"
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile "$profile" up -d
    else
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    fi

    success "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    log "Waiting for services to be healthy..."

    local services=(
        "postgres"
        "redis"
        "web"
        "labeling-backend"
        "payment-backend"
        "prometheus"
        "grafana"
    )

    local timeout=300
    local interval=10
    local elapsed=0

    while [[ $elapsed -lt $timeout ]]; do
        local all_healthy=true

        for service in "${services[@]}"; do
            local health
            health=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")

            if [[ "$health" != "healthy" ]]; then
                all_healthy=false
                break
            fi
        done

        if [[ "$all_healthy" == true ]]; then
            success "All services are healthy"
            return 0
        fi

        sleep $interval
        elapsed=$((elapsed + interval))
        log "Waiting for services... ($elapsed/${timeout}s)"
    done

    warn "Timeout waiting for services to become healthy"
    return 1
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."

    cd "$PROJECT_ROOT"

    # Wait for database to be ready
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER:-labelmint}" -d "${POSTGRES_DB:-labelmint}" &>/dev/null; then
            break
        fi

        log "Waiting for database to be ready... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done

    if [[ $attempt -gt $max_attempts ]]; then
        error "Database is not ready after $max_attempts attempts"
        return 1
    fi

    # Run migrations for each backend service
    local services=(
        "labeling-backend"
        "payment-backend"
    )

    for service in "${services[@]}"; then
        log "Running migrations for $service..."
        if docker-compose -f "$COMPOSE_FILE" exec -T "$service" pnpm db:migrate || true; then
            success "Migrations completed for $service"
        else
            warn "Migrations failed or not needed for $service"
        fi
    done

    success "Database migrations completed"
}

# Show deployment status
show_status() {
    log "Deployment status:"
    echo

    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" ps

    echo
    log "Service URLs:"
    echo "  Web Application:       http://localhost:${WEB_PORT:-3000}"
    echo "  API Gateway:           http://localhost:${API_GATEWAY_PORT:-3104}"
    echo "  Labeling Backend:      http://localhost:${LABELING_BACKEND_PORT:-3101}"
    echo "  Payment Backend:       http://localhost:${PAYMENT_BACKEND_PORT:-3103}"
    echo "  Grafana:               http://localhost:${GRAFANA_PORT:-3001}"
    echo "  Prometheus:            http://localhost:${PROMETHEUS_PORT:-9090}"
    echo "  MinIO Console:         http://localhost:${MINIO_CONSOLE_PORT:-9001}"

    if [[ "${ENABLE_DEBUG_TOOLS:-false}" == "true" ]]; then
        echo "  Redis Commander:      http://localhost:${REDIS_COMMANDER_PORT:-8081}"
        echo "  PgAdmin:              http://localhost:${PGADMIN_PORT:-5050}"
    fi

    echo
    log "Default credentials:"
    echo "  Grafana:               ${GRAFANA_USER:-admin} / ${GRAFANA_PASSWORD:-admin}"
    echo "  MinIO:                 ${MINIO_ACCESS_KEY} / ${MINIO_SECRET_KEY}"
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."

    # Remove dangling images
    docker image prune -f &>/dev/null || true

    success "Cleanup completed"
}

# Main deployment function
deploy() {
    local profile=${1:-""}

    log "Starting LabelMint unified deployment..."

    check_prerequisites
    validate_config
    create_directories
    setup_networks

    if [[ "$profile" == "debug" ]]; then
        warn "Deploying with debug tools enabled"
    fi

    start_services "$profile"

    if ! wait_for_services; then
        error "Services failed to become healthy"
        show_logs
        exit 1
    fi

    run_migrations
    show_status
    cleanup

    success "LabelMint deployment completed successfully!"
}

# Show logs function
show_logs() {
    log "Showing recent logs..."
    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" logs --tail=50
}

# Stop services function
stop_services() {
    log "Stopping LabelMint services..."

    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" down

    success "Services stopped"
}

# Remove all function (remove containers, networks, volumes)
remove_all() {
    log "Removing all LabelMint resources..."

    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" down -v --remove-orphans

    # Remove networks
    local networks=(
        "labelmint-labelmint-frontend"
        "labelmint-labelmint-backend"
        "labelmint-labelmint-data"
        "labelmint-labelmint-monitoring"
        "labelmint-labelmint-bots"
    )

    for network in "${networks[@]}"; do
        if docker network ls | grep -q "$network"; then
            docker network rm "$network" || true
        fi
    done

    success "All resources removed"
}

# Show help
show_help() {
    cat << EOF
LabelMint Unified Deployment Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    deploy [profile]     Deploy all services (default command)
    deploy debug         Deploy with debug tools enabled
    stop                Stop all services
    status              Show deployment status
    logs                Show service logs
    cleanup             Cleanup Docker resources
    remove-all          Remove all containers, networks, and volumes
    help                Show this help message

Examples:
    $0                  # Deploy all services
    $0 deploy           # Deploy all services
    $0 deploy debug     # Deploy with debug tools
    $0 stop             # Stop services
    $0 status           # Show status
    $0 logs             # Show logs

Environment:
    All configuration is read from .env file in the project root.
    Copy .env.unified.example to .env and customize as needed.

EOF
}

# Main script execution
main() {
    case "${1:-deploy}" in
        "deploy")
            deploy "${2:-}"
            ;;
        "stop")
            stop_services
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "cleanup")
            cleanup
            ;;
        "remove-all")
            remove_all
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Trap to handle interrupts
trap 'error "Script interrupted"; exit 130' INT TERM

# Run main function with all arguments
main "$@"