#!/bin/bash

# LabelMint Unified Deployment Test Script
# Validates that all services are running correctly after migration

set -euo pipefail

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
ENV_FILE="$PROJECT_ROOT/.env"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Logging functions
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

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"

    ((TOTAL_TESTS++))
    log "Running test: $test_name"

    if eval "$test_command"; then
        success "✓ $test_name"
        ((PASSED_TESTS++))
        return 0
    else
        error "✗ $test_name"
        ((FAILED_TESTS++))
        return 1
    fi
}

# Wait for service to be ready
wait_for_service() {
    local service_name="$1"
    local health_url="$2"
    local max_attempts=30
    local attempt=1

    log "Waiting for $service_name to be ready..."

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$health_url" &>/dev/null; then
            success "$service_name is ready"
            return 0
        fi

        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    error "$service_name failed to become ready after $max_attempts attempts"
    return 1
}

# Check Docker compose status
check_compose_status() {
    log "Checking Docker Compose status..."

    cd "$PROJECT_ROOT"
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        success "Docker Compose services are running"
        return 0
    else
        error "No Docker Compose services are running"
        return 1
    fi
}

# Network connectivity tests
test_network_connectivity() {
    log "Testing network connectivity..."

    # Test frontend to backend connectivity
    run_test "Frontend to Backend Connectivity" \
        "docker-compose -f '$COMPOSE_FILE' exec -T web curl -sf http://labeling-backend:3101/health"

    # Test API gateway to backend connectivity
    run_test "API Gateway to Backend Connectivity" \
        "docker-compose -f '$COMPOSE_FILE' exec -T api-gateway curl -sf http://labeling-backend:3101/health"

    # Test payment backend connectivity
    run_test "Payment Backend Connectivity" \
        "docker-compose -f '$COMPOSE_FILE' exec -T api-gateway curl -sf http://payment-backend:3103/health"
}

# Service health tests
test_service_health() {
    log "Testing service health endpoints..."

    # Web application
    run_test "Web Application Health" \
        "curl -sf http://localhost:${WEB_PORT:-3000}/api/health"

    # Labeling backend
    run_test "Labeling Backend Health" \
        "curl -sf http://localhost:${LABELING_BACKEND_PORT:-3101}/health"

    # Payment backend
    run_test "Payment Backend Health" \
        "curl -sf http://localhost:${PAYMENT_BACKEND_PORT:-3103}/health"

    # API Gateway
    run_test "API Gateway Health" \
        "curl -sf http://localhost:${API_GATEWAY_PORT:-3104}/health"

    # Nginx health
    run_test "Nginx Health" \
        "curl -sf http://localhost:${NGINX_HTTP_PORT:-80}/nginx-health"
}

# Database connectivity tests
test_database_connectivity() {
    log "Testing database connectivity..."

    # PostgreSQL connectivity
    run_test "PostgreSQL Connectivity" \
        "docker-compose -f '$COMPOSE_FILE' exec -T postgres psql -U '${POSTGRES_USER:-labelmint}' -d '${POSTGRES_DB:-labelmint}' -c 'SELECT 1;' &>/dev/null"

    # Redis connectivity
    run_test "Redis Connectivity" \
        "docker-compose -f '$COMPOSE_FILE' exec -T redis redis-cli ping"

    # Redis bots connectivity
    run_test "Redis Bots Connectivity" \
        "docker-compose -f '$COMPOSE_FILE' exec -T redis-bots redis-cli ping"
}

# Storage connectivity tests
test_storage_connectivity() {
    log "Testing storage connectivity..."

    # MinIO connectivity
    run_test "MinIO Connectivity" \
        "curl -sf http://localhost:${MINIO_PORT:-9000}/minio/health/live"

    # MinIO console
    run_test "MinIO Console Accessibility" \
        "curl -sf http://localhost:${MINIO_CONSOLE_PORT:-9001} &>/dev/null"
}

# Monitoring system tests
test_monitoring_system() {
    log "Testing monitoring system..."

    # Prometheus
    run_test "Prometheus Health" \
        "curl -sf http://localhost:${PROMETHEUS_PORT:-9090}/-/healthy"

    # Grafana
    run_test "Grafana Health" \
        "curl -sf http://localhost:${GRAFANA_PORT:-3001}/api/health"

    # Loki
    run_test "Loki Health" \
        "curl -sf http://localhost:${LOKI_PORT:-3100}/ready"

    # Tempo
    run_test "Tempo Health" \
        "curl -sf http://localhost:${TEMPO_PORT:-3200}/ready"

    # AlertManager
    run_test "AlertManager Health" \
        "curl -sf http://localhost:${ALERTMANAGER_PORT:-9093}/-/healthy"

    # Node Exporter
    run_test "Node Exporter Metrics" \
        "curl -sf http://localhost:${NODE_EXPORTER_PORT:-9100}/metrics &>/dev/null"
}

# Bot services tests
test_bot_services() {
    log "Testing bot services..."

    # Client bot
    run_test "Client Bot Health" \
        "curl -sf http://localhost:${CLIENT_BOT_PORT:-3105}/health"

    # Worker bot
    run_test "Worker Bot Health" \
        "curl -sf http://localhost:${WORKER_BOT_PORT:-3106}/health"
}

# Port conflict tests
test_port_conflicts() {
    log "Testing for port conflicts..."

    local ports=(
        "${WEB_PORT:-3000}"
        "${LABELING_BACKEND_PORT:-3101}"
        "${PAYMENT_BACKEND_PORT:-3103}"
        "${API_GATEWAY_PORT:-3104}"
        "${CLIENT_BOT_PORT:-3105}"
        "${WORKER_BOT_PORT:-3106}"
        "${PROMETHEUS_PORT:-9090}"
        "${GRAFANA_PORT:-3001}"
        "${NGINX_HTTP_PORT:-80}"
        "${NGINX_HTTPS_PORT:-443}"
        "${MINIO_PORT:-9000}"
        "${MINIO_CONSOLE_PORT:-9001}"
        "${REDIS_BOTS_PORT:-6380}"
    )

    for port in "${ports[@]}"; do
        run_test "Port $port is Accessible" \
            "curl -sf http://localhost:$port &>/dev/null || nc -z localhost $port"
    done
}

# Network segmentation tests
test_network_segmentation() {
    log "Testing network segmentation..."

    # Test that frontend network cannot access data network directly
    run_test "Network Segmentation (Frontend to Data)" \
        "! docker-compose -f '$COMPOSE_FILE' exec -T web nc -z postgres 5432 &>/dev/null"

    # Test that backend network can access data network
    run_test "Network Connectivity (Backend to Data)" \
        "docker-compose -f '$COMPOSE_FILE' exec -T labeling-backend nc -z postgres 5432"
}

# Configuration validation tests
test_configuration() {
    log "Testing configuration validation..."

    # Check environment variables are set
    run_test "Required Environment Variables" \
        "docker-compose -f '$COMPOSE_FILE' exec -T labeling-backend env | grep -q 'NODE_ENV=production'"

    # Check database URL is configured
    run_test "Database URL Configuration" \
        "docker-compose -f '$COMPOSE_FILE' exec -T labeling-backend env | grep -q 'DATABASE_URL='"

    # Check Redis URL is configured
    run_test "Redis URL Configuration" \
        "docker-compose -f '$COMPOSE_FILE' exec -T labeling-backend env | grep -q 'REDIS_URL='"
}

# Performance tests
test_performance() {
    log "Testing performance..."

    # Test web application response time
    run_test "Web Application Response Time" \
        "curl -w '%{time_total}' -o /dev/null -s http://localhost:${WEB_PORT:-3000}/api/health | awk '{if (\$1 <= 2.0) exit 0; else exit 1}'"

    # Test API response time
    run_test "API Response Time" \
        "curl -w '%{time_total}' -o /dev/null -s http://localhost:${LABELING_BACKEND_PORT:-3101}/health | awk '{if (\$1 <= 1.0) exit 0; else exit 1}'"
}

# Security tests
test_security() {
    log "Testing security configurations..."

    # Test that services run as non-root
    run_test "Non-root User (Labeling Backend)" \
        "docker-compose -f '$COMPOSE_FILE' exec -T labeling-backend id -u | grep -v '^0$'"

    # Test that services run as non-root
    run_test "Non-root User (Payment Backend)" \
        "docker-compose -f '$COMPOSE_FILE' exec -T payment-backend id -u | grep -v '^0$'"

    # Test HTTPS redirect (if SSL is configured)
    run_test "HTTP to HTTPS Redirect" \
        "curl -I -s http://localhost:${NGINX_HTTP_PORT:-80} | grep -q '301 Moved Permanently'"
}

# Load test
test_load() {
    log "Running basic load test..."

    # Simple concurrent load test
    run_test "Basic Load Test" \
        "for i in {1..10}; do curl -sf http://localhost:${WEB_PORT:-3000}/api/health & done; wait"
}

# Cleanup test
test_cleanup() {
    log "Testing cleanup procedures..."

    # Test that logs are being written
    run_test "Log Files Created" \
        "test -f '$PROJECT_ROOT/logs/backend/app.log' || docker-compose -f '$COMPOSE_FILE' exec -T labeling-backend ls logs/"
}

# Generate test report
generate_report() {
    log "Generating test report..."

    echo
    echo "=================================="
    echo "    LabelMint Deployment Test Report"
    echo "=================================="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo "=================================="

    if [[ $FAILED_TESTS -eq 0 ]]; then
        success "All tests passed! 🎉"
        echo "The unified deployment is working correctly."
        return 0
    else
        error "Some tests failed. Please check the logs above."
        echo "Run './scripts/deploy-unified.sh logs' for more information."
        return 1
    fi
}

# Show service URLs
show_service_urls() {
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
}

# Show help
show_help() {
    cat << EOF
LabelMint Unified Deployment Test Script

Usage: $0 [OPTIONS]

Options:
    --quick               Run only basic health checks
    --comprehensive       Run all tests including load and security (default)
    --health-only         Run only service health checks
    --network-only        Run only network connectivity tests
    --monitoring-only     Run only monitoring system tests
    --report              Show final report only
    --help                Show this help message

Examples:
    $0                    # Run comprehensive tests
    $0 --quick           # Run basic tests only
    $0 --health-only     # Check service health only
    $0 --monitoring-only # Test monitoring stack

EOF
}

# Main execution function
main() {
    local test_mode="comprehensive"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                test_mode="quick"
                shift
                ;;
            --comprehensive)
                test_mode="comprehensive"
                shift
                ;;
            --health-only)
                test_mode="health"
                shift
                ;;
            --network-only)
                test_mode="network"
                shift
                ;;
            --monitoring-only)
                test_mode="monitoring"
                shift
                ;;
            --report)
                test_mode="report"
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Load environment variables
    if [[ -f "$ENV_FILE" ]]; then
        source "$ENV_FILE"
    else
        warn "Environment file not found: $ENV_FILE"
    fi

    log "Starting LabelMint unified deployment tests..."
    log "Test mode: $test_mode"
    echo

    # Run tests based on mode
    case $test_mode in
        "quick")
            check_compose_status
            test_service_health
            test_database_connectivity
            ;;
        "health")
            test_service_health
            ;;
        "network")
            test_network_connectivity
            test_database_connectivity
            ;;
        "monitoring")
            test_monitoring_system
            ;;
        "comprehensive")
            check_compose_status
            test_network_connectivity
            test_service_health
            test_database_connectivity
            test_storage_connectivity
            test_monitoring_system
            test_bot_services
            test_port_conflicts
            test_network_segmentation
            test_configuration
            test_performance
            test_security
            test_load
            test_cleanup
            ;;
        "report")
            # Just generate report without running tests
            TOTAL_TESTS=0
            PASSED_TESTS=0
            FAILED_TESTS=0
            ;;
    esac

    # Show service URLs
    if [[ "$test_mode" != "report" ]]; then
        echo
        show_service_urls
    fi

    # Generate and return report
    generate_report
}

# Trap to handle interrupts
trap 'error "Test interrupted"; exit 130' INT TERM

# Run main function with all arguments
main "$@"