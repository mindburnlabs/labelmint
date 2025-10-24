#!/bin/bash

# Production Health Check Script
# Checks the health of all production services

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Production Health Check${NC}"
echo -e "${BLUE}========================${NC}"

# Service URLs and endpoints
SERVICES=(
    "Web Application:http://localhost/api/health"
    "Labeling Backend:http://localhost:3001/health"
    "Payment Backend:http://localhost:3000/health"
    "Telegram Mini-App:http://localhost/health"
    "Grafana:http://localhost:9090/api/health"
)

# Health check function
check_service() {
    local name=$1
    local url=$2
    local timeout=10

    echo -n "Checking $name... "

    if curl -f -s --max-time $timeout "$url" > /dev/null; then
        echo -e "${GREEN}✅ Healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Unhealthy${NC}"
        return 1
    fi
}

# Check all services
echo ""
FAILED_SERVICES=()

for service in "${SERVICES[@]}"; do
    name=$(echo "$service" | cut -d: -f1)
    url=$(echo "$service" | cut -d: -f2)

    if ! check_service "$name" "$url"; then
        FAILED_SERVICES+=("$name")
    fi
done

# Docker services health
echo -e "\n${YELLOW}🐳 Docker Services Status:${NC}"
echo -e "${YELLOW}=========================${NC}"
docker-compose -f docker-compose.prod.yml ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"

# Resource usage
echo -e "\n${YELLOW}📊 Resource Usage:${NC}"
echo -e "${YELLOW}=================${NC}"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Database connections
echo -e "\n${YELLOW}🗄️ Database Connections:${NC}"
echo -e "${YELLOW}======================${NC}"

# PostgreSQL
PG_CONNECTIONS=$(docker exec labelmint-postgres-prod psql -U labelmint -d labelmint_prod -t "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'" -A -t | tail -1 2>/dev/null || echo "0")
echo -e "PostgreSQL: $PG_CONNECTIONS active connections"

# Redis
REDIS_MEMORY=$(docker exec labelmint-redis-prod redis-cli info memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 || echo "Unknown")
echo -e "Redis: $REDIS_MEMORY memory used"

# SSL Certificate check (if applicable)
echo -e "\n${YELLOW}🔒 SSL Certificate Status:${NC}"
echo -e "${YELLOW}========================${NC}"

if command -v openssl &> /dev/null; then
    if openssl s_client -connect labelmint.it:443 -servername labelmint.it -showcerts 2>/dev/null | grep -q "subject=/CN=labelmint.it"; then
        echo -e "${GREEN}✅ SSL certificate is valid${NC}"
    else
        echo -e "${YELLOW}⚠️  SSL certificate check failed or not configured${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  OpenSSL not available for SSL check${NC}"
fi

# Log errors from services
echo -e "\n${YELLOW}📋 Recent Errors (Last 100 lines):${NC}"
echo -e "${YELLOW}===============================${NC}"

for service in labeling-backend payment-backend web; do
    echo -e "\n${BLUE}$service logs:${NC}"
    if docker logs "labelmint-$service-prod" 2>&1 | tail -20 | grep -qi "error\|fail\|exception"; then
        echo -e "${RED}Errors found in $service logs${NC}"
        docker logs "labelmint-$service-prod" 2>&1 | grep -i "error\|fail\|exception" | tail -5
    else
        echo -e "${GREEN}No errors in $service logs${NC}"
    fi
done

# Summary
echo -e "\n${BLUE}========================${NC}"
echo -e "${BLUE}Health Check Summary:${NC}"

if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All services are healthy!${NC}"
    exit 0
else
    echo -e "${RED}❌ Unhealthy services detected:${NC}"
    for service in "${FAILED_SERVICES[@]}"; do
        echo -e "${RED}  - $service${NC}"
    done
    echo -e "\n${YELLOW}Please check the service logs for more details${NC}"
    exit 1
fi