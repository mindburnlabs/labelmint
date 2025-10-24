#!/bin/bash

# LabelMint Application Services Deployment Script
# This script builds and deploys the application services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.unified.yml"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Service build status
declare -A BUILD_STATUS
declare -A DEPLOY_STATUS

# Function to check if a service can be built
can_build() {
    local service_dir="$1"
    local dockerfile="$2"

    if [[ ! -f "$service_dir/$dockerfile" ]]; then
        warn "Dockerfile not found: $service_dir/$dockerfile"
        return 1
    fi

    if [[ ! -f "$service_dir/package.json" ]]; then
        warn "package.json not found: $service_dir"
        return 1
    fi

    return 0
}

# Function to generate lock file if missing
generate_lock_file() {
    local service_dir="$1"
    local service_name="$2"

    pushd "$service_dir" > /dev/null

    # Check if lock file exists
    if [[ -f "package-lock.json" ]] || [[ -f "pnpm-lock.yaml" ]]; then
        log "Lock file exists for $service_name"
        popd > /dev/null
        return 0
    fi

    log "Generating lock file for $service_name..."

    # Try npm first
    if command -v npm &> /dev/null; then
        npm install --package-lock-only
        if [[ -f "package-lock.json" ]]; then
            success "Generated package-lock.json for $service_name"
            popd > /dev/null
            return 0
        fi
    fi

    # Try pnpm
    if command -v pnpm &> /dev/null; then
        pnpm install --frozen-lockfile=false
        if [[ -f "pnpm-lock.yaml" ]]; then
            success "Generated pnpm-lock.yaml for $service_name"
            popd > /dev/null
            return 0
        fi
    fi

    warn "Could not generate lock file for $service_name"
    popd > /dev/null
    return 1
}

# Function to build a service
build_service() {
    local service_name="$1"
    local service_dir="$2"
    local dockerfile="$3"
    local image_tag="labelmint-$service_name:latest"

    log "Building $service_name..."

    if ! can_build "$service_dir" "$dockerfile"; then
        BUILD_STATUS[$service_name]="skipped"
        return 1
    fi

    # Generate lock file if needed
    generate_lock_file "$service_dir" "$service_name"

    # Build the Docker image
    if docker build -t "$image_tag" -f "$service_dir/$dockerfile" "$service_dir/"; then
        success "Built $service_name successfully"
        BUILD_STATUS[$service_name]="success"
        return 0
    else
        error "Failed to build $service_name"
        BUILD_STATUS[$service_name]="failed"
        return 1
    fi
}

# Function to deploy a service using docker run
deploy_service() {
    local service_name="$1"
    local port="$2"
    local env_vars="$3"
    local network="$4"
    local image_tag="labelmint-$service_name:latest"

    log "Deploying $service_name..."

    # Check if image exists
    if ! docker image inspect "$image_tag" &> /dev/null; then
        error "Image $image_tag not found"
        DEPLOY_STATUS[$service_name]="failed"
        return 1
    fi

    # Stop existing container if running
    if docker ps -a --format '{{.Names}}' | grep -q "^labelmint-$service_name$"; then
        log "Stopping existing container for $service_name..."
        docker stop "labelmint-$service_name" || true
        docker rm "labelmint-$service_name" || true
    fi

    # Deploy the service
    local cmd="docker run -d --name labelmint-$service_name --restart unless-stopped"

    if [[ -n "$port" ]]; then
        cmd="$cmd -p $port"
    fi

    if [[ -n "$network" ]]; then
        cmd="$cmd --network $network"
    fi

    if [[ -n "$env_vars" ]]; then
        cmd="$cmd $env_vars"
    fi

    cmd="$cmd $image_tag"

    if eval $cmd; then
        success "Deployed $service_name successfully"
        DEPLOY_STATUS[$service_name]="success"
        return 0
    else
        error "Failed to deploy $service_name"
        DEPLOY_STATUS[$service_name]="failed"
        return 1
    fi
}

# Function to check service health
check_service_health() {
    local service_name="$1"
    local health_check_url="$2"
    local max_attempts=30
    local attempt=1

    if [[ -z "$health_check_url" ]]; then
        warn "No health check URL for $service_name"
        return 0
    fi

    log "Checking health of $service_name..."

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$health_check_url" > /dev/null 2>&1; then
            success "$service_name is healthy"
            return 0
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    error "$service_name failed health check after $max_attempts attempts"
    return 1
}

# Main deployment function
main() {
    log "Starting LabelMint application services deployment..."

    # Change to project root
    cd "$PROJECT_ROOT"

    # Source environment variables
    if [[ -f ".env" ]]; then
        log "Loading environment variables from .env"
        set -a
        source .env
        set +a
    else
        warn "No .env file found, using defaults"
    fi

    # Services to build and deploy
    declare -A SERVICES
    SERVICES=(
        ["api-gateway"]="services/api-gateway:Dockerfile:3104:--network labelmint-backend:http://localhost:3104/health"
        ["client-bot"]="services/bots/client-bot:Dockerfile:3105:--network labelmint-bots"
        ["worker-bot"]="services/bots/worker-bot:Dockerfile:3106:--network labelmint-bots"
        ["telegram-mini-app"]="apps/telegram-mini-app:Dockerfile.unified.prod:3107:--network labelmint-frontend:http://localhost:3107"
    )

    log "Found ${#SERVICES[@]} services to deploy"

    # Build all services
    log "=== BUILD PHASE ==="
    for service_config in "${!SERVICES[@]}"; do
        IFS=':' read -r service_dir dockerfile port health_check <<< "${SERVICES[$service_config]}"

        log "Building $service_config..."
        if build_service "$service_config" "$service_dir" "$dockerfile"; then
            success "Build completed for $service_config"
        else
            warn "Build failed for $service_config, will skip deployment"
        fi
    done

    # Deploy services that were built successfully
    log "=== DEPLOY PHASE ==="
    for service_config in "${!SERVICES[@]}"; do
        if [[ "${BUILD_STATUS[$service_config]}" == "success" ]]; then
            IFS=':' read -r service_dir dockerfile port health_check <<< "${SERVICES[$service_config]}"

            # Prepare environment variables
            local env_vars=""
            case "$service_config" in
                "api-gateway")
                    env_vars="-e NODE_ENV=${NODE_ENV:-development} -e REDIS_URL=redis://labelmint-redis:6379 -e POSTGRES_URL=postgresql://labelmint:${POSTGRES_PASSWORD:-labelmint123secure}@labelmint-postgres:5432/labelmint"
                    ;;
                "client-bot")
                    env_vars="-e NODE_ENV=${NODE_ENV:-development} -e BOT_TOKEN=${CLIENT_BOT_TOKEN:-} -e REDIS_URL=redis://labelmint-redis:6379"
                    ;;
                "worker-bot")
                    env_vars="-e NODE_ENV=${NODE_ENV:-development} -e BOT_TOKEN=${WORKER_BOT_TOKEN:-} -e REDIS_URL=redis://labelmint-redis:6379"
                    ;;
                "telegram-mini-app")
                    env_vars="-e NODE_ENV=${NODE_ENV:-development}"
                    ;;
            esac

            local network_mapping=""
            case "$service_config" in
                "api-gateway") network_mapping="labelmint-backend" ;;
                "client-bot"|"worker-bot") network_mapping="labelmint-bots" ;;
                "telegram-mini-app") network_mapping="labelmint-frontend" ;;
            esac

            local port_mapping=""
            if [[ -n "$port" ]]; then
                port_mapping="$port:3000"
            fi

            if deploy_service "$service_config" "$port_mapping" "$env_vars" "$network_mapping"; then
                success "Deployment completed for $service_config"
            fi
        else
            warn "Skipping deployment of $service_config (build failed)"
        fi
    done

    # Health checks
    log "=== HEALTH CHECK PHASE ==="
    for service_config in "${!SERVICES[@]}"; do
        if [[ "${DEPLOY_STATUS[$service_config]}" == "success" ]]; then
            IFS=':' read -r service_dir dockerfile port health_check <<< "${SERVICES[$service_config]}"

            if [[ -n "$port" ]]; then
                local health_url="http://localhost:$port"
                if [[ -n "$health_check" ]] && [[ "$health_check" != "http"* ]]; then
                    health_url="$health_check"
                fi
                check_service_health "$service_config" "$health_url"
            fi
        fi
    done

    # Summary
    log "=== DEPLOYMENT SUMMARY ==="

    echo "Build Status:"
    for service in "${!BUILD_STATUS[@]}"; do
        local status="${BUILD_STATUS[$service]}"
        local status_icon="❌"
        [[ "$status" == "success" ]] && status_icon="✅"
        [[ "$status" == "skipped" ]] && status_icon="⏭️"
        echo "  $status_icon $service: $status"
    done

    echo ""
    echo "Deploy Status:"
    for service in "${!DEPLOY_STATUS[@]}"; do
        local status="${DEPLOY_STATUS[$service]}"
        local status_icon="❌"
        [[ "$status" == "success" ]] && status_icon="✅"
        echo "  $status_icon $service: $status"
    done

    # Show running containers
    echo ""
    log "Running LabelMint containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep labelmint || echo "No LabelMint containers running"

    log "Application services deployment completed!"
}

# Run main function
main "$@"