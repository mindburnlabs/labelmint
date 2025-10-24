#!/bin/bash

# Production Deployment Script
# Deploys Deligate.it to production

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying Deligate.it to Production${NC}"
echo -e "${BLUE}=====================================${NC}"

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Configuration
ENV_FILE=".env.production"
BACKUP_DIR="./backups/production/$(date +%Y%m%d_%H%M%S)"

# Check prerequisites
echo -e "\n${YELLOW}🔍 Checking prerequisites...${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if .env.production exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ $ENV_FILE not found. Please create it from .env.example${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Load environment variables
source "$ENV_FILE"

# Validate required environment variables
echo -e "\n${YELLOW}🔧 Validating environment variables...${NC}"

REQUIRED_VARS=(
    "POSTGRES_PASSWORD"
    "REDIS_PASSWORD"
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
    "TON_API_KEY"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "OPENAI_API_KEY"
    "TELEGRAM_BOT_TOKEN"
    "GRAFANA_PASSWORD"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ] || [ "${!var}" == "CHANGE_THIS*" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing or unset environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "${RED}  - $var${NC}"
    done
    echo -e "\n${YELLOW}Please update $ENV_FILE with the correct values${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables validation passed${NC}"

# Create backup directory
echo -e "\n${YELLOW}💾 Creating backup directory...${NC}"
mkdir -p "$BACKUP_DIR"

# Backup current production data if exists
if docker ps -q -f labelmint-postgres-prod &> /dev/null; then
    echo -e "${YELLOW}💾 Backing up database...${NC}"
    docker exec labelmint-postgres-prod pg_dump -U labelmint labelmint_prod > "$BACKUP_DIR/database.sql"
    echo -e "${GREEN}✅ Database backed up${NC}"
fi

# Pull latest images
echo -e "\n${YELLOW}📦 Pulling latest images...${NC}"
docker-compose -f docker-compose.prod.yml pull --quiet
echo -e "${GREEN}✅ Images pulled${NC}"

# Stop existing services
echo -e "\n${YELLOW}🛑 Stopping existing services...${NC}"
docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
echo -e "${GREEN}✅ Services stopped${NC}"

# Build new images
echo -e "\n${YELLOW}🔨 Building production images...${NC}"
docker-compose -f docker-compose.prod.yml build --parallel
echo -e "${GREEN}✅ Images built${NC}"

# Start services
echo -e "\n${YELLOW}🚀 Starting production services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo -e "\n${YELLOW}⏳ Waiting for services to be ready...${NC}"

# Function to check service health
wait_for_service() {
    local service=$1
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose.prod.yml ps $service | grep -q "Up (healthy)"; then
            echo -e "${GREEN}✅ $service is healthy${NC}"
            return 0
        fi

        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "\n${RED}❌ $service failed to become healthy${NC}"
    return 1
}

# Wait for critical services
wait_for_service "postgres"
wait_for_service "redis"
wait_for_service "labeling-backend"
wait_for_service "payment-backend"
wait_for_service "web"

# Run database migrations
echo -e "\n${YELLOW}🗄️ Running database migrations...${NC}"
docker-compose -f docker-compose.prod.yml exec -T labeling-backend pnpm db:migrate
echo -e "${GREEN}✅ Migrations completed${NC}"

# Health check
echo -e "\n${YELLOW}🔍 Running health checks...${NC}"

# Check web app
if curl -f http://localhost/api/health &> /dev/null; then
    echo -e "${GREEN}✅ Web application is responding${NC}"
else
    echo -e "${RED}❌ Web application is not responding${NC}"
fi

# Check API endpoints
if curl -f http://localhost:3001/health &> /dev/null; then
    echo -e "${GREEN}✅ Labeling API is responding${NC}"
else
    echo -e "${RED}❌ Labeling API is not responding${NC}"
fi

if curl -f http://localhost:3000/health &> /dev/null; then
    echo -e "${GREEN}✅ Payment API is responding${NC}"
else
    echo -e "${RED}❌ Payment API is not responding${NC}"
fi

# Show service status
echo -e "\n${BLUE}📊 Service Status:${NC}"
echo -e "${BLUE}=================${NC}"
docker-compose -f docker-compose.prod.yml ps

# Show URLs
echo -e "\n${GREEN}🌐 Production URLs:${NC}"
echo -e "${GREEN}==================${NC}"
echo -e "${BLUE}• Web Application:${NC}        https://labelmint.it"
echo -e "${BLUE}• Telegram Mini-App:${NC}     https://app.labelmint.it"
echo -e "${BLUE}• API Gateway:${NC}            https://api.labelmint.it"
echo -e "${BLUE}• Grafana Dashboard:${NC}      http://localhost:9090 (admin/yourpassword)"

# Save deployment info
echo -e "\n${YELLOW}📝 Saving deployment information...${NC}"
cat > "$BACKUP_DIR/deployment-info.txt" << EOF
Deployment Date: $(date)
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo "N/A")
Docker Compose Version: $(docker-compose --version)
Services Deployed:
- Web Application
- Labeling Backend
- Payment Backend
- Telegram Mini-App
- PostgreSQL
- Redis
- Prometheus
- Grafana
EOF

echo -e "${GREEN}✅ Deployment information saved${NC}"

# Cleanup old images
echo -e "\n${YELLOW}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f > /dev/null
echo -e "${GREEN}✅ Cleanup completed${NC}"

echo -e "\n${GREEN}🎉 Production deployment completed successfully!${NC}"
echo -e "${BLUE}=====================================${NC}"

echo -e "\n${YELLOW}📋 Post-deployment checklist:${NC}"
echo -e "${YELLOW}1. Update DNS records to point to your server${NC}"
echo -e "${YELLOW}2. Configure SSL certificates (Let's Encrypt recommended)${NC}"
echo -e "${YELLOW}3. Set up monitoring alerts in Grafana${NC}"
echo -e "${YELLOW}4. Test all critical user flows${NC}"
echo -e "${YELLOW}5. Monitor system performance for the first hour${NC}"

echo -e "\n${GREEN}✨ Your Deligate.it platform is now live!${NC}"