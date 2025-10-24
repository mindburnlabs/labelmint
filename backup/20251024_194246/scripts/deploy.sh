#!/bin/bash

# LabelMint Deployment Script
# This script deploys the entire LabelMint platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="./logs/deploy_$(date +%Y%m%d_%H%M%S).log"

# Create necessary directories
mkdir -p backups logs

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    error ".env file not found. Please create it from .env.example"
fi

# Load environment variables
source .env

# Pre-deployment checks
log "Starting deployment to $ENVIRONMENT environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    error "Docker is not installed"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed"
fi

# Check Docker daemon is running
if ! docker info &> /dev/null; then
    error "Docker daemon is not running"
fi

# Create backup of current database if it exists
if [ "$ENVIRONMENT" = "production" ]; then
    log "Creating database backup..."
    mkdir -p "$BACKUP_DIR"

    if docker ps | grep -q labelmint-postgres; then
        docker exec labelmint-postgres pg_dump -U labelmint labelmint > "$BACKUP_DIR/database.sql"
        log "Database backup created at $BACKUP_DIR/database.sql"
    fi
fi

# Pull latest changes if git repository
if [ -d ".git" ]; then
    log "Pulling latest changes from repository..."
    git pull origin main
fi

# Build and deploy services
log "Building Docker images..."
docker-compose build --no-cache

log "Stopping existing services..."
docker-compose down

log "Starting services..."
docker-compose up -d

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 30

# Run database migrations
log "Running database migrations..."
docker-compose exec -T backend npx prisma migrate deploy || warning "Migration failed or not needed"

# Health checks
log "Performing health checks..."

# Check backend health
for i in {1..30}; do
    if curl -f http://localhost:3001/health &> /dev/null; then
        log "Backend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Backend health check failed"
    fi
    sleep 2
done

# Check web dashboard
for i in {1..30}; do
    if curl -f http://localhost:3000 &> /dev/null; then
        log "Web dashboard is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Web dashboard health check failed"
    fi
    sleep 2
done

# Check bots
log "Verifying Telegram bots..."
BOT_STATUS_CLIENT=$(docker-compose exec -T bot-client curl -s https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_CLIENT}/getMe | jq -r '.ok')
if [ "$BOT_STATUS_CLIENT" = "true" ]; then
    log "Client bot is running"
else
    warning "Client bot might not be responding"
fi

BOT_STATUS_WORKER=$(docker-compose exec -T bot-worker curl -s https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_WORKER}/getMe | jq -r '.ok')
if [ "$BOT_STATUS_WORKER" = "true" ]; then
    log "Worker bot is running"
else
    warning "Worker bot might not be responding"
fi

# Clean up old images
log "Cleaning up old Docker images..."
docker image prune -f

# Show running containers
log "Deployment complete! Running containers:"
docker-compose ps

# Display useful information
echo ""
log "=== LabelMint Deployment Summary ==="
echo -e "${GREEN}• Web Dashboard: https://labelmint.mindburn.org${NC}"
echo -e "${GREEN}• API Server: https://api.labelmint.mindburn.org${NC}"
echo -e "${GREEN}• Client Mini App: https://app.labelmint.mindburn.org${NC}"
echo -e "${GREEN}• Worker Mini App: https://workers.labelmint.mindburn.org${NC}"
echo -e "${GREEN}• Client Bot: @LabelMintBot${NC}"
echo -e "${GREEN}• Worker Bot: @LabelMintWorkerBot${NC}"
echo ""
echo -e "${YELLOW}• Logs: docker-compose logs -f [service]${NC}"
echo -e "${YELLOW}• Backup: $BACKUP_DIR${NC}"
echo ""

# Send deployment notification (optional)
if [ ! -z "$DEPLOYMENT_WEBHOOK" ]; then
    curl -X POST "$DEPLOYMENT_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"✅ LabelMint deployed to $ENVIRONMENT\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [{
                    \"title\": \"Environment\",
                    \"value\": \"$ENVIRONMENT\",
                    \"short\": true
                }, {
                    \"title\": \"Timestamp\",
                    \"value\": \"$(date)\",
                    \"short\": true
                }, {
                    \"title\": \"Backup\",
                    \"value\": \"$BACKUP_DIR\",
                    \"short\": false
                }]
            }]
        }"
fi

log "Deployment completed successfully!"