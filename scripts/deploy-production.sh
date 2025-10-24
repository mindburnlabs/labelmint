#!/bin/bash

set -euo pipefail

# Configuration
PROJECT_NAME="labelmint-it"
REGISTRY="ghcr.io"
ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.production.yml"
HEALTH_CHECK_URL="http://localhost:3000/health"
MAX_RETRIES=5
RETRY_DELAY=10
BACKUP_DIR="/var/backups/labelmint"
LOG_FILE="/var/log/labelmint/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$$1] - $2" | tee -a "$LOG_FILE"
}

# Send notification
send_notification() {
    local message="$1"
    local severity="$2"
    local webhook_url="${WEBHOOK_URL:-}"

    if [ -n "$webhook_url" ]; then
        curl -X POST "$webhook_url" \
             -H "Content-Type: application/json" \
             -d "{\"text\":\"$message\",\"severity\":\"$severity\"}" \
             2>/dev/null
    fi
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        echo -e "${RED}ERROR: This script must be run as root${NC}"
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."

    local deps=("docker" "docker-compose" "jq" "curl" "git" "node" "npm")

    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            echo -e "${RED}ERROR: $dep is not installed${NC}"
            exit 1
        fi
    done

    log "Dependencies check passed"
}

# Pre-deployment checks
pre_deploy_checks() {
    log "Running pre-deployment checks..."

    # Check if required files exist
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}ERROR: .env.production file not found${NC}"
        exit 1
    fi

    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}ERROR: $COMPOSE_FILE not found${NC}"
        exit 1
    fi

    # Source environment variables
    source "$ENV_FILE"

    # Validate required environment variables
    local required_vars=("DB_HOST" "DB_PASSWORD" "JWT_SECRET" "WEBHOOK_URL")

    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            echo -e "${RED}ERROR: Required environment variable $var is not set${NC}"
            exit 1
        fi
    done

    # Check disk space
    local available_space=$(df / | awk 'NR==1 {print $4}' | tail -n 1)
    local required_space=5242880  # 5GB

    if [ "$available_space" -lt "$required_space" ]; then
        echo -e "${YELLOW}WARNING: Low disk space. Available: $available_space bytes${NC}"
        send_notification "Low disk space warning: $available_space bytes available" "warning"
    fi

    # Check memory
    local available_memory=$(free -m | awk 'NR==2{print $7}' | tail -n 1)
    if [ "$available_memory" -lt 1048576 ]; then  # 1GB
        echo -e "${YELLOW}WARNING: Low memory. Available: $available_memory bytes${NC}"
        send_notification "Low memory warning: $available_memory bytes available" "warning"
    fi

    log "Pre-deployment checks completed"
}

# Backup current deployment
backup_current() {
    log "Creating backup of current deployment..."

    local backup_dir="$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"

    # Backup application code
    git archive --format=tar.gz -o "$backup_dir/code.tar.gz" \
      HEAD 2>/dev/null \
      --exclude=node_modules \
      --exclude=.git \
      --exclude=*.log \
      .

    # Backup database
    if command -v pg_dump >/dev/null 2>&1; then
        PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" \
          -d "$DB_NAME" \
          --no-owner \
          --verbose \
          --compress=9 \
          --file="$backup_dir/database.sql.gz" \
          2>/dev/null
        log "Database backup created"
    else
        log "WARNING: pg_dump not available, skipping database backup"
    fi

    # Backup uploads directory
    if [ -d "uploads" ]; then
        tar -czf "$backup_dir/uploads.tar.gz" uploads/ 2>/dev/null
        log "Uploads directory backed up"
    fi

    # Clean old backups (keep last 7)
    find "$BACKUP_DIR" -type d -mtime +7 -maxdepth 1 -exec rm -rf {} \; 2>/dev/null

    log "Backup created: $backup_dir"
}

# Pull latest code
pull_code() {
    log "Pulling latest code..."
    git fetch origin main
    git reset --hard origin/main
    git clean -fd

    log "Code updated to latest version"
}

# Build Docker images
build_images() {
    log "Building Docker images..."

    # Build payment backend
    docker build -t "$PROJECT_NAME/payment-backend:latest" \
        -f ./services/payment-backend/Dockerfile \
        ./services/payment-backend/ || {
            echo -e "${RED}ERROR: Failed to build payment backend image${NC}"
            exit 1
        }

    # Build labeling backend
    docker build -t "$PROJECT_NAME/labeling-backend:latest" \
        -f ./services/labeling-backend/Dockerfile \
        ./services/labeling-backend/ || {
            echo -e "${RED}ERROR: Failed to build labeling backend image${NC}"
            exit 1
        }

    # Build web app
    docker build -t "$PROJECT_NAME/web-app:latest" \
        -f ./apps/web/Dockerfile \
        ./apps/web/ || {
            echo -e "${RED}ERROR: Failed to build web app image${NC}"
            exit 1
        }

    log "Docker images built successfully"
}

# Deploy application
deploy_application() {
    log "Deploying application..."

    source "$ENV_FILE"

    # Create production docker-compose override
    cat > docker-compose.override.yml <<EOF
version: '3.8'
services:
  payment-backend:
    image: $PROJECT_NAME/payment-backend:latest
    environment:
      - NODE_ENV=production
      - DB_HOST=$DB_HOST
      - DB_NAME=$DB_NAME
      - DB_USER=$DB_USER
      - DB_PASSWORD=$DB_PASSWORD
      - REDIS_HOST=$REDIS_HOST
      - REDIS_PORT=$REDIS_PORT
      - JWT_SECRET=$JWT_SECRET
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.payment-backend.rule=Host(\`labelmint-api.$TRAEFIK_DOMAIN\`)"

  labeling-backend:
    image: $PROJECT_NAME/labeling-backend:latest
    environment:
      - NODE_ENV=production
      - DB_HOST=$DB_HOST
      - DB_NAME=$DB_NAME
      - DB_USER=$DB_USER
      - DB_PASSWORD=$DB_PASSWORD
      - REDIS_HOST=$REDIS_HOST
      - REDIS_PORT=$REDIS_PORT
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.labeling-backend.rule=Host(\`labelmint-api.$TRAEFIK_DOMAIN\`)"

  web-app:
    image: $PROJECT_NAME/web-app:latest
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://$TRAEFIK_DOMAIN/api
      - NEXT_PUBLIC_WS_URL=wss://$TRAEFIK_DOMAIN
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web-app.rule=Host(\`$TRAEFIK_DOMAIN\`)"

EOF

    # Stop old containers
    log "Stopping old containers..."
    docker-compose -f "$COMPOSE_FILE" -f docker-compose.override.yml down || true

    # Pull latest images
    log "Pulling latest images..."
    docker-compose -f "$COMPOSE_FILE" -f docker-compose.override.yml pull

    # Start new containers
    log "Starting new containers..."
    docker-compose -f "$COMPOSE_FILE" -f docker-compose.override.yml up -d

    # Wait for application to be ready
    log "Waiting for application to be ready..."
    local retry=0
    while [ $retry -lt "$MAX_RETRIES" ]; do
        if curl -f "$HEALTH_CHECK_URL" | jq -r .status == "OK" 2>/dev/null; then
            log "Application is ready! (attempt $retry)"
            send_notification "Production deployment successful: $HEALTH_CHECK_URL is responding normally" "success"
            return 0
        fi

        retry=$((retry + 1))
        log "Health check failed (attempt $retry/$MAX_RETRIES), retrying in ${RETRY_DELAY} seconds..."
        sleep "$RETRY_DELAY"
    done

    echo -e "${RED}ERROR: Application failed to start properly after $MAX_RETRIES attempts${NC}"
    send_notification "CRITICAL: Production deployment failed - application not responding" "error"

    # Try to rollback
    log "Attempting rollback..."
    rollback

    exit 1
}

# Rollback to previous version
rollback() {
    log "Rolling back to previous version..."

    source "$ENV_FILE"

    # Get previous image tag
    local previous_tag=$(docker images --format "table {{.Repository}}" | grep latest | awk '{print $2}')

    if [ -z "$previous_tag" ]; then
        echo -e "${RED}ERROR: No previous image found for rollback${NC}"
        return 1
    fi

    # Use previous tag in docker-compose
    cat > docker-compose.rollback.yml << EOF
version: '3.8'
services:
  payment-backend:
    image: $PROJECT_NAME/payment-backend:$previous_tag
  labeling-backend:
    image: $PROJECT_NAME/labeling-backend:$previous_tag
  web-app:
    image: $PROJECT_NAME/web-app:$previous_tag
EOF

    # Deploy with rollback
    docker-compose -f "$COMPOSE_FILE" -f docker-compose.rollback.yml down
    docker-compose -f "$COMPOSE_FILE" -f docker-compose.rollback.yml pull
    docker-compose -f "$COMPOSE_FILE" -f docker-compose.rollback.yml up -d

    log "Rollback completed"
}

# Post-deployment verification
post_deploy_verification() {
    log "Running post-deployment verification..."

    # Check all services
    local services=("payment-backend" "labeling-backend" "web-app")

    for service in "${services[@]}"; do
        if curl -f "https://$TRAEFIK_DOMAIN/api/health/$service" | jq -r .status == "OK"; then
            log "✅ $service is healthy"
        else
            echo -e "${RED}❌ $service is not healthy"
            send_notification "Health check failed: $service service not responding" "error"
        fi
    done

    # Run smoke tests
    log "Running smoke tests..."
    local smoke_tests_passed=true

    # Test user registration
    if ! curl -f "https://$TRAEFIK_DOMAIN/api/auth/register" \
           -H "Content-Type: application/json" \
           -d '{"email":"test@example.com","password":"testpass123","firstName":"Test","lastName":"User"}' \
           -s -o /dev/null -w "%{http_code}" | grep -q "200" 2>/dev/null; then
        log "❌ User registration test failed"
        smoke_tests_passed=false
    else
        log "✅ User registration test passed"
    fi

    # Test file upload
    if ! curl -f "https://$TRAEFIK_DOMAIN/api/files" \
           -F "file=@/dev/null" \
           -H "Authorization: Bearer test-token" \
           -s -o /dev/null -w "%{http_code}" | grep -q "201" 2>/dev/null; then
        log "❌ File upload test failed"
        smoke_tests_passed=false
    else
        log "✅ File upload test passed"
    fi

    if [ "$smoke_tests_passed" = true ]; then
        send_notification "All smoke tests passed successfully!" "success"
        log "✅ All smoke tests passed!"
    else
        send_notification "Some smoke tests failed - please check immediately" "error"
        log "❌ Some smoke tests failed"
    fi

    log "Post-deployment verification completed"
}

# Cleanup old resources
cleanup() {
    log "Cleaning up old resources..."

    # Remove old Docker images (keep last 5)
    docker image prune -f --filter label=$PROJECT_NAME --keep-tag=5

    # Clean up old logs (keep 7 days)
    find /var/log/labelmint -name "*.log" -mtime +7 -delete

    # Clean up old backups (keep 7 days)
    find "$BACKUP_DIR" -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null

    log "Cleanup completed"
}

# Main deployment function
main() {
    log "Starting production deployment..."

    check_root
    check_dependencies
    pre_deploy_checks
    backup_current

    # Handle interruption gracefully
    trap 'log "${YELLOW}Deployment interrupted, attempting cleanup..."; cleanup; exit 1' INT TERM

    pull_code
    build_images
    deploy_application
    post_deploy_verification
    cleanup

    log "Production deployment completed successfully!"
    send_notification "Production deployment completed successfully! All systems operational" "success"
}

# Handle arguments
case "${1:-}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "backup")
        backup_current
        ;;
    "health-check")
        if curl -f "$HEALTH_CHECK_URL" | jq -r .status == "OK"; then
            echo -e "${GREEN}✅ Application is healthy${NC}"
        else
            echo -e "${RED}❌ Application health check failed${NC}"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|backup|health-check}"
        exit 1
        ;;
esac