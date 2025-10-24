#!/bin/bash

# LabelMint Enterprise Deployment Script
# This script deploys all enterprise services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting LabelMint Enterprise Deployment${NC}"

# Check if .env file exists
if [ ! -f .env.enterprise ]; then
    echo -e "${YELLOW}Creating .env.enterprise file from template...${NC}"
    cp .env.enterprise.template .env.enterprise
    echo -e "${RED}⚠️  Please update .env.enterprise with your configuration before running again${NC}"
    exit 1
fi

# Load environment variables
source .env.enterprise

# Create necessary directories
echo -e "${GREEN}📁 Creating directories...${NC}"
mkdir -p nginx/ssl
mkdir -p logs/enterprise
mkdir -p data/postgres
mkdir -p data/redis
mkdir -p data/elasticsearch
mkdir -p uploads/enterprise

# Generate SSL certificates if they don't exist
if [ ! -f nginx/ssl/cert.pem ]; then
    echo -e "${YELLOW}🔐 Generating self-signed SSL certificates...${NC}"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=LabelMint/CN=localhost"
fi

# Build and start services
echo -e "${GREEN}🔨 Building enterprise services...${NC}"
docker-compose -f docker-compose.enterprise.yml build

echo -e "${GREEN}🚢 Starting enterprise services...${NC}"
docker-compose -f docker-compose.enterprise.yml up -d

# Wait for services to be ready
echo -e "${GREEN}⏳ Waiting for services to be ready...${NC}"
sleep 30

# Check service health
echo -e "${GREEN}🏥 Checking service health...${NC}"

services=("enterprise-api:3003" "workflow-engine:3004" "collaboration-service:3005" "analytics-engine:3006" "white-label-service:3007")

for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if curl -f http://localhost:$port/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name is healthy${NC}"
    else
        echo -e "${RED}❌ $name is not responding${NC}"
    fi
done

# Run database migrations
echo -e "${GREEN}🗄️ Running database migrations...${NC}"
docker-compose -f docker-compose.enterprise.yml exec enterprise-api npm run migrate

# Display deployment information
echo -e "${GREEN}✨ Enterprise deployment complete!${NC}"
echo ""
echo -e "${GREEN}📍 Service URLs:${NC}"
echo "  • Enterprise API: https://localhost/api/enterprise"
echo "  • Workflow Engine: https://localhost/api/workflows"
echo "  • Collaboration Service: https://localhost/api/collaboration"
echo "  • Analytics Engine: https://localhost/api/analytics"
echo "  • White Label Service: https://localhost/api/white-label"
echo "  • SSO Service: https://localhost/api/sso"
echo ""
echo -e "${GREEN}📊 Additional Services:${NC}"
echo "  • Kibana Analytics: http://localhost:5601"
echo "  • RabbitMQ Management: http://localhost:15672"
echo ""
echo -e "${GREEN}📝 Next Steps:${NC}"
echo "  1. Configure your enterprise organization via the API"
echo "  2. Set up SSO integration if needed"
echo "  3. Configure white-label domains"
echo "  4. Set up analytics dashboards in Kibana"
echo ""
echo -e "${YELLOW}📋 Useful Commands:${NC}"
echo "  • View logs: docker-compose -f docker-compose.enterprise.yml logs -f [service-name]"
echo "  • Stop services: docker-compose -f docker-compose.enterprise.yml down"
echo "  • Update services: docker-compose -f docker-compose.enterprise.yml pull && docker-compose -f docker-compose.enterprise.yml up -d"
echo ""