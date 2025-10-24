#!/bin/bash

# DeligateIT Monitoring Stack Startup Script

set -e

echo "🚀 Starting DeligeIT Monitoring Stack..."

# Create required directories
mkdir -p prometheus/{data,rules,alerts}
mkdir -p grafana/{data,dashboards,provisioning}
mkdir -p loki/{data,chunks,index}
mkdir -p jaeger/data
mkdir -p alertmanager/data
mkdir -p redis/data

# Set permissions
chmod -R 777 prometheus/data
chmod -R 777 grafana/data
chmod -R 777 loki/data
chmod -R 777 jaeger/data
chmod -R 777 alertmanager/data
chmod -R 777 redis/data

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it first."
    exit 1
fi

# Pull latest images
echo "📦 Pulling latest images..."
docker-compose pull

# Start services
echo "🎯 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
check_service() {
    local service=$1
    local url=$2

    if curl -s -f "$url" > /dev/null; then
        echo "✅ $service is healthy"
    else
        echo "⚠️  $service is not responding"
    fi
}

echo ""
echo "🔍 Checking service health..."
check_service "Prometheus" "http://localhost:9090/-/healthy"
check_service "Grafana" "http://localhost:3000/api/health"
check_service "Jaeger" "http://localhost:16686/"
check_service "Loki" "http://localhost:3100/ready"
check_service "Alertmanager" "http://localhost:9093/-/healthy"

echo ""
echo "📊 Monitoring Stack is ready!"
echo ""
echo "🔗 Access URLs:"
echo "   Grafana:     http://localhost:3000 (admin/admin123)"
echo "   Prometheus:  http://localhost:9090"
echo "   Jaeger:      http://localhost:16686"
echo "   Loki:        http://localhost:3100"
echo "   Alertmanager: http://localhost:9093"
echo ""
echo "📝 To view logs:"
echo "   docker-compose logs -f [service-name]"
echo ""
echo "🛑 To stop:"
echo "   docker-compose down"
echo ""
echo "🔄 To restart:"
echo "   docker-compose restart [service-name]"