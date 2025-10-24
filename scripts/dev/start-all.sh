#!/bin/bash

# Deligate.it Development Environment Startup Script
# This script starts all services and applications in development mode

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}🚀 Starting Deligate.it Development Environment${NC}"
echo -e "${BLUE}=============================================${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local port=$1
    local service=$2
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}⏳ Waiting for $service to be ready on port $port...${NC}"

    while [ $attempt -le $max_attempts ]; do
        if port_in_use $port; then
            echo -e "${GREEN}✅ $service is ready!${NC}"
            return 0
        fi

        sleep 2
        attempt=$((attempt + 1))
        echo -n "."
    done

    echo -e "\n${RED}❌ $service failed to start within timeout${NC}"
    return 1
}

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

if ! command_exists pnpm; then
    echo -e "${RED}❌ pnpm is not installed. Please install pnpm first.${NC}"
    echo "Visit: https://pnpm.io/installation"
    exit 1
fi

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Check if .env file exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        echo -e "${YELLOW}📝 Please edit .env file with your configuration${NC}"
    else
        echo -e "${RED}❌ .env.example file not found${NC}"
        exit 1
    fi
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pnpm install
fi

# Start infrastructure services (Redis, PostgreSQL)
echo -e "${YELLOW}🐳 Starting infrastructure services...${NC}"
cd "$PROJECT_ROOT/infrastructure/docker"

# Stop existing containers if running
docker-compose down

# Start infrastructure services
docker-compose up -d postgres redis

# Wait for database to be ready
wait_for_service 5432 "PostgreSQL"

# Wait for Redis to be ready
wait_for_service 6379 "Redis"

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
cd "$PROJECT_ROOT"

# Run migrations for each service
for service in services/*/; do
    if [ -f "$service/package.json" ]; then
        service_name=$(basename "$service")
        echo -e "${YELLOW}📋 Running migrations for $service_name...${NC}"

        cd "$service"
        if pnpm run db:migrate 2>/dev/null || pnpm prisma migrate deploy 2>/dev/null || true; then
            echo -e "${GREEN}✅ $service_name migrations completed${NC}"
        else
            echo -e "${YELLOW}⚠️  No migrations found for $service_name${NC}"
        fi
        cd "$PROJECT_ROOT"
    fi
done

# Seed database if needed
echo -e "${YELLOW}🌱 Seeding database...${NC}"
if pnpm run db:seed 2>/dev/null || true; then
    echo -e "${GREEN}✅ Database seeded successfully${NC}"
else
    echo -e "${YELLOW}⚠️  No seed script found or seeding failed${NC}"
fi

# Start backend services
echo -e "${YELLOW}🔧 Starting backend services...${NC}"

# Start Labeling Backend (port 3001)
echo -e "${YELLOW}📊 Starting Labeling Backend on port 3001...${NC}"
cd "$PROJECT_ROOT/services/labeling-backend"
pnpm run dev &
LABELING_PID=$!
cd "$PROJECT_ROOT"

# Wait for labeling backend
wait_for_service 3001 "Labeling Backend"

# Start Payment Backend (port 3000)
echo -e "${YELLOW}💳 Starting Payment Backend on port 3000...${NC}"
cd "$PROJECT_ROOT/services/payment-backend"
pnpm run dev &
PAYMENT_PID=$!
cd "$PROJECT_ROOT"

# Wait for payment backend
wait_for_service 3000 "Payment Backend"

# Start frontend applications
echo -e "${YELLOW}🎨 Starting frontend applications...${NC}"

# Start Web App (port 3002)
echo -e "${YELLOW}🌐 Starting Web App on port 3002...${NC}"
cd "$PROJECT_ROOT/apps/web"
PORT=3002 pnpm run dev &
WEB_PID=$!
cd "$PROJECT_ROOT"

# Wait for web app
wait_for_service 3002 "Web App"

# Start Telegram Mini App (port 5173)
echo -e "${YELLOW}📱 Starting Telegram Mini App on port 5173...${NC}"
cd "$PROJECT_ROOT/apps/telegram-mini-app"
pnpm run dev &
TELEGRAM_PID=$!
cd "$PROJECT_ROOT"

# Wait for telegram mini app
wait_for_service 5173 "Telegram Mini App"

# Create a PID file to track all processes
echo "$LABELING_PID" > "$PROJECT_ROOT/.pids/labeling-backend.pid"
echo "$PAYMENT_PID" > "$PROJECT_ROOT/.pids/payment-backend.pid"
echo "$WEB_PID" > "$PROJECT_ROOT/.pids/web-app.pid"
echo "$TELEGRAM_PID" > "$PROJECT_ROOT/.pids/telegram-mini-app.pid"

# Display service URLs
echo -e "\n${GREEN}🎉 All services started successfully!${NC}"
echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}📊 Labeling Backend:${NC}    http://localhost:3001"
echo -e "${GREEN}💳 Payment Backend:${NC}     http://localhost:3000"
echo -e "${GREEN}🌐 Web Application:${NC}     http://localhost:3002"
echo -e "${GREEN}📱 Telegram Mini App:${NC}   http://localhost:5173"
echo -e "${GREEN}🗄️  PostgreSQL:${NC}         localhost:5432"
echo -e "${GREEN}🔴 Redis:${NC}              localhost:6379"
echo -e "${BLUE}=============================================${NC}"

# Display useful commands
echo -e "\n${YELLOW}📋 Useful Commands:${NC}"
echo -e "${BLUE}• View logs:${NC}           pnpm run logs:dev"
echo -e "${BLUE}• Stop all services:${NC}   pnpm run stop:dev"
echo -e "${BLUE}• Run tests:${NC}           pnpm test"
echo -e "${BLUE}• Lint code:${NC}           pnpm lint"
echo -e "${BLUE}• Format code:${NC}         pnpm format"
echo -e "${BLUE}• Database studio:${NC}     pnpm run db:studio"

# Handle graceful shutdown
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"

    if [ -f "$PROJECT_ROOT/.pids/labeling-backend.pid" ]; then
        kill $(cat "$PROJECT_ROOT/.pids/labeling-backend.pid") 2>/dev/null || true
    fi

    if [ -f "$PROJECT_ROOT/.pids/payment-backend.pid" ]; then
        kill $(cat "$PROJECT_ROOT/.pids/payment-backend.pid") 2>/dev/null || true
    fi

    if [ -f "$PROJECT_ROOT/.pids/web-app.pid" ]; then
        kill $(cat "$PROJECT_ROOT/.pids/web-app.pid") 2>/dev/null || true
    fi

    if [ -f "$PROJECT_ROOT/.pids/telegram-mini-app.pid" ]; then
        kill $(cat "$PROJECT_ROOT/.pids/telegram-mini-app.pid") 2>/dev/null || true
    fi

    # Stop Docker containers
    cd "$PROJECT_ROOT/infrastructure/docker"
    docker-compose down

    # Clean up PID files
    rm -rf "$PROJECT_ROOT/.pids"

    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Create PID directory
mkdir -p "$PROJECT_ROOT/.pids"

echo -e "\n${GREEN}✨ Development environment is ready!${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Keep script running
wait