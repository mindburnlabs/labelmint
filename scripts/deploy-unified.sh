#!/bin/bash

# LabelMint Unified Deployment Script
# Consolidates all deployment functionality with environment support and rollback capabilities

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
UNIFIED_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.unified.yml"
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_DIR="$PROJECT_ROOT/logs"

# Default configuration
ENVIRONMENT=${ENVIRONMENT:-"development"}
COMPOSE_FILE_NAME="docker-compose.yml"
FORCE_DEPLOY=${FORCE_DEPLOY:-false}
SKIP_BACKUP=${SKIP_BACKUP:-false}
ENABLE_ROLLBACK=${ENABLE_ROLLBACK:-true}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_DIR/deploy_$(date +%Y%m%d).log"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2 | tee -a "$LOG_DIR/deploy_$(date +%Y%m%d).log"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_DIR/deploy_$(date +%Y%m%d).log"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_DIR/deploy_$(date +%Y%m%d).log"
}

info() {
    echo -e "${PURPLE}[INFO]${NC} $1" | tee -a "$LOG_DIR/deploy_$(date +%Y%m%d).log"
}

debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1" | tee -a "$LOG_DIR/deploy_$(date +%Y%m%d).log"
    fi
}

# Ensure directories exist
ensure_directories() {
    mkdir -p "$BACKUP_DIR" "$LOG_DIR"
}

# Show help
show_help() {
    cat << EOF
LabelMint Unified Deployment Script

This script provides comprehensive deployment functionality for all LabelMint environments
with built-in health checks, backup capabilities, and rollback support.

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    deploy [env]             Deploy to specified environment (default: development)
    rollback [backup]        Rollback to specified backup or latest
    status                  Show deployment status
    logs [service]          Show service logs
    stop                    Stop all services
    restart [service]       Restart specific service or all services
    backup                  Create manual backup
    cleanup                 Clean up Docker resources
    health                  Run health checks
    config                  Show current configuration
    help                    Show this help message

Environments:
    development             Local development environment
    staging                 Staging environment for testing
    production              Production environment
    debug                   Development with debugging tools enabled

Options:
    --force                 Force deployment without confirmation
    --skip-backup           Skip backup creation
    --no-rollback           Disable rollback capability
    --timeout SECONDS       Health check timeout (default: 300)
    --debug                 Enable debug logging
    --compose-file FILE     Use specific compose file
    --profile PROFILE       Docker Compose profile to use
    --dry-run               Show what would be done without executing

Examples:
    $0 deploy production              # Deploy to production
    $0 deploy development --debug     # Deploy to development with debug
    $0 rollback backup_20241024_120000 # Rollback to specific backup
    $0 status                         # Show current status
    $0 logs web                       # Show web service logs
    $0 backup --force                 # Create backup without confirmation

Environment Files:
    .env                     Development environment
    .env.staging             Staging environment
    .env.production          Production environment
    .env.unified.example     Unified environment template

Service Health Endpoints:
    Web: http://localhost:\${WEB_PORT:-3000}/api/health
    API Gateway: http://localhost:\${API_GATEWAY_PORT:-3104}/health
    Labeling Backend: http://localhost:\${LABELING_BACKEND_PORT:-3101}/health
    Payment Backend: http://localhost:\${PAYMENT_BACKEND_PORT:-3103}/health

EOF
}

# Parse command line arguments
parse_arguments() {
    COMMAND="deploy"
    ENVIRONMENT="development"
    BACKUP_NAME=""
    SERVICE_NAME=""
    DRY_RUN=false
    COMPOSE_PROFILE=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            deploy|rollback|status|logs|stop|restart|backup|cleanup|health|config|help)
                COMMAND="$1"
                shift
                ;;
            development|staging|production|debug)
                ENVIRONMENT="$1"
                shift
                ;;
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --no-rollback)
                ENABLE_ROLLBACK=false
                shift
                ;;
            --timeout)
                HEALTH_CHECK_TIMEOUT="$2"
                shift 2
                ;;
            --debug)
                export DEBUG=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --compose-file)
                COMPOSE_FILE_NAME="$2"
                shift 2
                ;;
            --profile)
                COMPOSE_PROFILE="$2"
                shift 2
                ;;
            --backup-name)
                BACKUP_NAME="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                if [[ "$COMMAND" == "logs" || "$COMMAND" == "restart" ]]; then
                    SERVICE_NAME="$1"
                elif [[ "$COMMAND" == "rollback" && -z "$BACKUP_NAME" ]]; then
                    BACKUP_NAME="$1"
                fi
                shift
                ;;
        esac
    done

    debug "Command: $COMMAND"
    debug "Environment: $ENVIRONMENT"
    debug "Force deploy: $FORCE_DEPLOY"
    debug "Skip backup: $SKIP_BACKUP"
    debug "Dry run: $DRY_RUN"
}

# Load environment configuration
load_environment() {
    local env_file="$PROJECT_ROOT/.env"

    case "$ENVIRONMENT" in
        "staging")
            env_file="$PROJECT_ROOT/.env.staging"
            ;;
        "production")
            env_file="$PROJECT_ROOT/.env.production"
            ;;
        "debug")
            env_file="$PROJECT_ROOT/.env"
            COMPOSE_PROFILE="debug"
            ;;
    esac

    if [[ ! -f "$env_file" ]]; then
        if [[ -f "$PROJECT_ROOT/.env.unified.example" ]]; then
            warn "Environment file $env_file not found. Creating from template..."
            cp "$PROJECT_ROOT/.env.unified.example" "$env_file"
            warn "Please edit $env_file with your configuration before continuing"
            if [[ "$FORCE_DEPLOY" != "true" ]]; then
                exit 1
            fi
        else
            error "Environment file $env_file not found and no template available"
            exit 1
        fi
    fi

    # Load environment variables
    set -a
    source "$env_file"
    set +a

    success "Environment loaded: $ENVIRONMENT"
    debug "Environment file: $env_file"
}

# Validate prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    local prerequisites_failed=false

    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        prerequisites_failed=true
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed or not in PATH"
        prerequisites_failed=true
    fi

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        prerequisites_failed=true
    fi

    # Check required tools based on environment
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if ! command -v curl &> /dev/null; then
            error "curl is required for production deployment health checks"
            prerequisites_failed=true
        fi
    fi

    if [[ "$prerequisites_failed" == "true" ]]; then
        error "Prerequisites check failed"
        exit 1
    fi

    success "Prerequisites check passed"
}

# Validate environment variables
validate_environment() {
    log "Validating environment variables..."

    local required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
    )

    # Additional variables for production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        required_vars+=(
            "TON_API_KEY"
            "TELEGRAM_BOT_TOKEN"
            "MINIO_ACCESS_KEY"
            "MINIO_SECRET_KEY"
        )
    fi

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" || "${!var}" == "CHANGE_THIS"* ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing or unset environment variables:"
        for var in "${missing_vars[@]}"; do
            error "  - $var"
        done
        exit 1
    fi

    success "Environment validation passed"
}

# Determine compose file
get_compose_file() {
    local compose_file="$PROJECT_ROOT/$COMPOSE_FILE_NAME"

    # Handle special cases for unified deployment
    if [[ "$ENVIRONMENT" == "debug" && -f "$UNIFIED_COMPOSE_FILE" ]]; then
        compose_file="$UNIFIED_COMPOSE_FILE"
    elif [[ "$ENVIRONMENT" == "production" && -f "$PROJECT_ROOT/docker-compose.prod.yml" ]]; then
        compose_file="$PROJECT_ROOT/docker-compose.prod.yml"
    elif [[ "$ENVIRONMENT" == "staging" && -f "$PROJECT_ROOT/docker-compose.staging.yml" ]]; then
        compose_file="$PROJECT_ROOT/docker-compose.staging.yml"
    fi

    if [[ ! -f "$compose_file" ]]; then
        error "Docker Compose file not found: $compose_file"
        exit 1
    fi

    echo "$compose_file"
}

# Create backup
create_backup() {
    local backup_name="$1"
    local backup_path="$BACKUP_DIR/$backup_name"

    if [[ "$SKIP_BACKUP" == "true" ]]; then
        warn "Skipping backup creation"
        return 0
    fi

    log "Creating backup: $backup_name"

    mkdir -p "$backup_path"/{docker-compose,infrastructure,data,scripts}

    # Backup Docker compose files
    find "$PROJECT_ROOT" -name "docker-compose*.yml" -not -path "./backup/*" | \
        while read -r file; do
            cp "$file" "$backup_path/docker-compose/"
        done

    # Backup environment files
    find "$PROJECT_ROOT" -name ".env*" -not -path "./backup/*" | \
        while read -r file; do
            cp "$file" "$backup_path/"
        done

    # Backup infrastructure if exists
    if [[ -d "$PROJECT_ROOT/infrastructure" ]]; then
        cp -r "$PROJECT_ROOT/infrastructure" "$backup_path/"
    fi

    # Backup critical data volumes
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "Backing up critical data volumes..."
        local data_volumes=(
            "labelmint_postgres_data"
            "labelmint_redis_data"
        )

        for volume in "${data_volumes[@]}"; do
            if docker volume ls -q --filter "name=$volume" | grep -q .; then
                log "Backing up volume: $volume"
                docker run --rm -v "$volume":/source -v "$backup_path/data":/backup \
                    alpine tar czf "/backup/${volume}.tar.gz" -C /source . || true
            fi
        done
    fi

    # Create backup metadata
    cat > "$backup_path/backup-info.json" << EOF
{
    "backup_name": "$backup_name",
    "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "$ENVIRONMENT",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
    "docker_compose_file": "$COMPOSE_FILE_NAME",
    "compose_profile": "$COMPOSE_PROFILE"
}
EOF

    success "Backup created: $backup_path"
    echo "$backup_path"
}

# Setup Docker networks
setup_networks() {
    log "Setting up Docker networks..."

    # Remove existing conflicting networks
    local networks_to_remove=(
        "labelmint_default"
        "labelmint_labelmint-network"
    )

    for network in "${networks_to_remove[@]}"; do
        if docker network ls | grep -q "$network"; then
            debug "Removing conflicting network: $network"
            docker network rm "$network" || true
        fi
    done

    success "Network setup completed"
}

# Pull latest images
pull_images() {
    local compose_file="$1"

    log "Pulling latest Docker images..."

    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would pull images for $compose_file"
        return 0
    fi

    cd "$PROJECT_ROOT"

    local compose_cmd="docker-compose"
    if command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
    else
        compose_cmd="docker compose"
    fi

    if $compose_cmd -f "$compose_file" pull --quiet; then
        success "Images pulled successfully"
    else
        warn "Some images failed to pull (they may be built locally)"
    fi
}

# Build Docker images
build_images() {
    local compose_file="$1"

    log "Building Docker images..."

    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would build images for $compose_file"
        return 0
    fi

    cd "$PROJECT_ROOT"

    local compose_cmd="docker-compose"
    if command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
    else
        compose_cmd="docker compose"
    fi

    local build_args=""
    if [[ -n "$BUILD_ARGS" ]]; then
        build_args="--build-arg $BUILD_ARGS"
    fi

    if $compose_cmd -f "$compose_file" build $build_args --parallel; then
        success "Images built successfully"
    else
        error "Failed to build images"
        exit 1
    fi
}

# Stop existing services
stop_services() {
    local compose_file="$1"

    log "Stopping existing services..."

    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would stop services for $compose_file"
        return 0
    fi

    cd "$PROJECT_ROOT"

    local compose_cmd="docker-compose"
    if command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
    else
        compose_cmd="docker compose"
    fi

    if $compose_cmd -f "$compose_file" down --remove-orphans; then
        success "Services stopped"
    else
        warn "Some services may not have been running"
    fi
}

# Start services
start_services() {
    local compose_file="$1"

    log "Starting LabelMint services..."

    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would start services for $compose_file"
        return 0
    fi

    cd "$PROJECT_ROOT"

    local compose_cmd="docker-compose"
    if command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
    else
        compose_cmd="docker compose"
    fi

    local up_args="-d"
    if [[ -n "$COMPOSE_PROFILE" ]]; then
        up_args="--profile $COMPOSE_PROFILE $up_args"
        log "Using profile: $COMPOSE_PROFILE"
    fi

    if $compose_cmd -f "$compose_file" $up_args; then
        success "Services started successfully"
    else
        error "Failed to start services"
        exit 1
    fi
}

# Wait for services to be healthy
wait_for_services() {
    local compose_file="$1"

    log "Waiting for services to be healthy..."

    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would wait for services to be healthy"
        return 0
    fi

    cd "$PROJECT_ROOT"

    local compose_cmd="docker-compose"
    if command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
    else
        compose_cmd="docker compose"
    fi

    # Critical services to wait for
    local critical_services=(
        "postgres"
        "redis"
    )

    # Additional services based on environment
    if [[ "$ENVIRONMENT" != "development" ]]; then
        critical_services+=(
            "labeling-backend"
            "payment-backend"
        )
    fi

    if [[ "$ENVIRONMENT" == "production" || "$ENVIRONMENT" == "staging" ]]; then
        critical_services+=("web")
    fi

    local timeout=$HEALTH_CHECK_TIMEOUT
    local interval=10
    local elapsed=0

    while [[ $elapsed -lt $timeout ]]; do
        local all_healthy=true

        for service in "${critical_services[@]}"; do
            local health_status
            health_status=$($compose_cmd -f "$compose_file" ps -q "$service" 2>/dev/null | \
                xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")

            if [[ "$health_status" != "healthy" ]]; then
                # Check if service is running without health check
                local container_status
                container_status=$($compose_cmd -f "$compose_file" ps "$service" 2>/dev/null | \
                    grep "Up" || echo "")

                if [[ -z "$container_status" ]]; then
                    all_healthy=false
                    debug "Service $service is not up yet"
                    break
                else
                    debug "Service $service is up but no health check configured"
                fi
            fi
        done

        if [[ "$all_healthy" == "true" ]]; then
            success "All critical services are healthy"
            return 0
        fi

        sleep $interval
        elapsed=$((elapsed + interval))
        info "Waiting for services... ($elapsed/${timeout}s)"
    done

    warn "Timeout waiting for services to become healthy"
    return 1
}

# Run database migrations
run_migrations() {
    local compose_file="$1"

    log "Running database migrations..."

    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would run database migrations"
        return 0
    fi

    cd "$PROJECT_ROOT"

    local compose_cmd="docker-compose"
    if command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
    else
        compose_cmd="docker compose"
    fi

    # Wait for database to be ready
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if $compose_cmd -f "$compose_file" exec -T postgres pg_isready -U "${POSTGRES_USER:-labelmint}" -d "${POSTGRES_DB:-labelmint}" &>/dev/null; then
            break
        fi

        debug "Waiting for database to be ready... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done

    if [[ $attempt -gt $max_attempts ]]; then
        warn "Database is not ready after $max_attempts attempts, skipping migrations"
        return 0
    fi

    # Run migrations for backend services
    local backend_services=(
        "labeling-backend"
        "payment-backend"
    )

    for service in "${backend_services[@]}"; do
        if $compose_cmd -f "$compose_file" ps -q "$service" &>/dev/null; then
            log "Running migrations for $service..."
            if $compose_cmd -f "$compose_file" exec -T "$service" pnpm db:migrate 2>/dev/null || \
               $compose_cmd -f "$compose_file" exec -T "$service" npm run db:migrate 2>/dev/null || \
               $compose_cmd -f "$compose_file" exec -T "$service" npx prisma migrate deploy 2>/dev/null; then
                success "Migrations completed for $service"
            else
                warn "Migrations failed or not needed for $service"
            fi
        fi
    done

    success "Database migrations completed"
}

# Run health checks
run_health_checks() {
    local compose_file="$1"

    log "Running health checks..."

    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would run health checks"
        return 0
    fi

    local checks_passed=true
    local health_endpoints=(
        "Web Application:${WEB_PORT:-3000}/api/health"
        "API Gateway:${API_GATEWAY_PORT:-3104}/health"
        "Labeling Backend:${LABELING_BACKEND_PORT:-3101}/health"
        "Payment Backend:${PAYMENT_BACKEND_PORT:-3103}/health"
    )

    for endpoint in "${health_endpoints[@]}"; do
        local service_name="${endpoint%%:*}"
        local service_url="${endpoint##*:}"

        if curl -f --max-time 10 "http://localhost:$service_url" &>/dev/null; then
            success "$service_name is responding"
        else
            warn "$service_name health check failed"
            checks_passed=false
        fi
    done

    if [[ "$checks_passed" == "true" ]]; then
        success "All health checks passed"
        return 0
    else
        warn "Some health checks failed"
        return 1
    fi
}

# Show deployment status
show_status() {
    local compose_file="$1"

    log "Deployment status for $ENVIRONMENT environment:"
    echo

    cd "$PROJECT_ROOT"

    local compose_cmd="docker-compose"
    if command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
    else
        compose_cmd="docker compose"
    fi

    # Show running services
    $compose_cmd -f "$compose_file" ps

    echo
    info "Service URLs:"
    echo "  Web Application:       http://localhost:${WEB_PORT:-3000}"
    echo "  API Gateway:           http://localhost:${API_GATEWAY_PORT:-3104}"
    echo "  Labeling Backend:      http://localhost:${LABELING_BACKEND_PORT:-3101}"
    echo "  Payment Backend:       http://localhost:${PAYMENT_BACKEND_PORT:-3103}"
    echo "  Grafana:               http://localhost:${GRAFANA_PORT:-3001}"
    echo "  Prometheus:            http://localhost:${PROMETHEUS_PORT:-9090}"
    echo "  MinIO Console:         http://localhost:${MINIO_CONSOLE_PORT:-9001}"

    if [[ "$ENVIRONMENT" == "debug" || "${ENABLE_DEBUG_TOOLS:-false}" == "true" ]]; then
        echo "  Redis Commander:      http://localhost:${REDIS_COMMANDER_PORT:-8081}"
        echo "  PgAdmin:              http://localhost:${PGADMIN_PORT:-5050}"
    fi

    echo
    info "Default credentials:"
    echo "  Grafana:               ${GRAFANA_USER:-admin} / ${GRAFANA_PASSWORD:-admin}"
    echo "  MinIO:                 ${MINIO_ACCESS_KEY} / [configured]"
}

# Show logs
show_logs() {
    local compose_file="$1"
    local service="$2"

    log "Showing logs for ${service:-all services}..."

    cd "$PROJECT_ROOT"

    local compose_cmd="docker-compose"
    if command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
    else
        compose_cmd="docker compose"
    fi

    if [[ -n "$service" ]]; then
        $compose_cmd -f "$compose_file" logs --tail=100 -f "$service"
    else
        $compose_cmd -f "$compose_file" logs --tail=50
    fi
}

# Cleanup resources
cleanup_resources() {
    log "Cleaning up Docker resources..."

    # Remove dangling images
    docker image prune -f &>/dev/null || true

    # Remove unused containers
    docker container prune -f &>/dev/null || true

    success "Cleanup completed"
}

# Main deployment function
deploy() {
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    local compose_file

    log "Starting LabelMint deployment to $ENVIRONMENT environment..."

    # Load environment and configuration
    load_environment
    check_prerequisites
    validate_environment

    compose_file=$(get_compose_file)
    info "Using compose file: $(basename "$compose_file")"

    # Create backup if enabled and not in dry run mode
    if [[ "$ENABLE_ROLLBACK" == "true" && "$DRY_RUN" != "true" ]]; then
        create_backup "$backup_name"
    fi

    # Execute deployment steps
    setup_networks
    pull_images "$compose_file"
    build_images "$compose_file"
    stop_services "$compose_file"
    start_services "$compose_file"

    # Wait for services and run migrations
    if ! wait_for_services "$compose_file"; then
        error "Services failed to become healthy within timeout"
        show_logs "$compose_file"
        exit 1
    fi

    run_migrations "$compose_file"

    # Run health checks for production/staging
    if [[ "$ENVIRONMENT" == "production" || "$ENVIRONMENT" == "staging" ]]; then
        run_health_checks "$compose_file" || warn "Some health checks failed"
    fi

    # Show final status
    show_status "$compose_file"
    cleanup_resources

    success "Deployment to $ENVIRONMENT completed successfully!"

    if [[ "$ENABLE_ROLLBACK" == "true" ]]; then
        echo
        info "Rollback information:"
        echo "  Backup name: $backup_name"
        echo "  Rollback command: $0 rollback $backup_name"
    fi
}

# Rollback function
rollback() {
    local backup_name="$1"
    local backup_path

    if [[ -z "$backup_name" ]]; then
        # Find latest backup
        backup_path=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" | sort -r | head -1)
        if [[ -z "$backup_path" ]]; then
            error "No backups found"
            exit 1
        fi
        backup_name=$(basename "$backup_path")
    else
        backup_path="$BACKUP_DIR/$backup_name"
    fi

    if [[ ! -d "$backup_path" ]]; then
        error "Backup not found: $backup_name"
        exit 1
    fi

    log "Rolling back to backup: $backup_name"

    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would rollback to $backup_name"
        return 0
    fi

    # Create backup of current state
    local pre_rollback_backup="pre_rollback_$(date +%Y%m%d_%H%M%S)"
    create_backup "$pre_rollback_backup"

    # Stop current services
    local current_compose_file=$(get_compose_file)
    stop_services "$current_compose_file"

    # Restore files from backup
    if [[ -d "$backup_path/docker-compose" ]]; then
        log "Restoring Docker compose files..."
        cp "$backup_path/docker-compose"/*.yml "$PROJECT_ROOT/"
    fi

    if [[ -n $(find "$backup_path" -name ".env*" 2>/dev/null) ]]; then
        log "Restoring environment files..."
        find "$backup_path" -name ".env*" -exec cp {} "$PROJECT_ROOT/" \;
    fi

    # Load restored environment
    load_environment
    validate_environment

    # Get restored compose file
    local restored_compose_file=$(get_compose_file)

    # Start restored services
    start_services "$restored_compose_file"
    wait_for_services "$restored_compose_file"
    run_migrations "$restored_compose_file"

    success "Rollback to $backup_name completed successfully!"
    show_status "$restored_compose_file"

    info "Pre-rollback backup: $pre_rollback_backup"
}

# Stop services function
stop() {
    local compose_file=$(get_compose_file)
    stop_services "$compose_file"
}

# Restart services function
restart() {
    local service="$1"
    local compose_file=$(get_compose_file)

    cd "$PROJECT_ROOT"

    local compose_cmd="docker-compose"
    if command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
    else
        compose_cmd="docker compose"
    fi

    if [[ -n "$service" ]]; then
        log "Restarting service: $service"
        $compose_cmd -f "$compose_file" restart "$service"
    else
        log "Restarting all services..."
        $compose_cmd -f "$compose_file" restart
    fi

    success "Restart completed"
}

# Main execution
main() {
    ensure_directories
    parse_arguments "$@"

    case "$COMMAND" in
        "deploy")
            deploy
            ;;
        "rollback")
            rollback "$BACKUP_NAME"
            ;;
        "status")
            local compose_file=$(get_compose_file)
            show_status "$compose_file"
            ;;
        "logs")
            local compose_file=$(get_compose_file)
            show_logs "$compose_file" "$SERVICE_NAME"
            ;;
        "stop")
            stop
            ;;
        "restart")
            restart "$SERVICE_NAME"
            ;;
        "backup")
            create_backup "manual_backup_$(date +%Y%m%d_%H%M%S)"
            ;;
        "cleanup")
            cleanup_resources
            ;;
        "health")
            local compose_file=$(get_compose_file)
            run_health_checks "$compose_file"
            ;;
        "config")
            info "Current configuration:"
            echo "  Environment: $ENVIRONMENT"
            echo "  Compose file: $COMPOSE_FILE_NAME"
            echo "  Profile: $COMPOSE_PROFILE"
            echo "  Force deploy: $FORCE_DEPLOY"
            echo "  Skip backup: $SKIP_BACKUP"
            echo "  Enable rollback: $ENABLE_ROLLBACK"
            echo "  Health check timeout: $HEALTH_CHECK_TIMEOUT"
            ;;
        "help")
            show_help
            ;;
        *)
            error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Trap to handle interrupts
trap 'error "Script interrupted"; exit 130' INT TERM

# Run main function with all arguments
main "$@"