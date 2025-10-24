#!/bin/bash
# Smoke Tests for LabelMint Deployment
# =====================================
set -euo pipefail

# Configuration
BASE_URL="${1:-https://staging.labelmint.it}"
TIMEOUT=30
RETRY_COUNT=5
RETRY_DELAY=10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Logging
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp} - $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp} - $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp} - $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} ${timestamp} - $message"
            ;;
    esac
}

# Test function
run_test() {
    local test_name=$1
    local test_command=$2

    log "INFO" "Running test: $test_name"

    local attempt=1
    while [ $attempt -le $RETRY_COUNT ]; do
        if eval "$test_command"; then
            log "INFO" "✅ $test_name - PASSED"
            ((TESTS_PASSED++))
            return 0
        else
            log "WARN" "❌ $test_name - FAILED (attempt $attempt/$RETRY_COUNT)"
            if [ $attempt -lt $RETRY_COUNT ]; then
                log "INFO" "Retrying in $RETRY_DELAY seconds..."
                sleep $RETRY_DELAY
            fi
            ((attempt++))
        fi
    done

    log "ERROR" "❌ $test_name - FAILED after $RETRY_COUNT attempts"
    ((TESTS_FAILED++))
    return 1
}

# HTTP request with timeout
http_request() {
    local url=$1
    local expected_status=${2:-200}
    local timeout=${3:-30}

    curl -f -s -o /dev/null -w "%{http_code}" \
        --max-time "$timeout" \
        --connect-timeout 10 \
        "$url" | grep -q "^$expected_status$"
}

# Health check tests
test_health_endpoints() {
    # API Health
    run_test "API Health Check" \
        "http_request '$BASE_URL/api/health' 200"

    # Web App Health
    run_test "Web App Health Check" \
        "http_request '$BASE_URL/api/health' 200"

    # Payment API Health
    run_test "Payment API Health Check" \
        "http_request '$BASE_URL/payment/api/health' 200"
}

# Basic functionality tests
test_basic_functionality() {
    # Test main page loads
    run_test "Main Page Load" \
        "http_request '$BASE_URL' 200"

    # Test API endpoints respond
    run_test "API Version Endpoint" \
        "http_request '$BASE_URL/api/version' 200"

    # Test CORS headers
    run_test "CORS Headers" \
        "curl -s -I '$BASE_URL/api/health' | grep -i 'access-control-allow-origin'"

    # Test static assets
    run_test "Static Assets" \
        "http_request '$BASE_URL/_next/static/css/app.css' 200"
}

# Database connectivity tests
test_database_connectivity() {
    # Test database connection via API
    run_test "Database Connection" \
        "http_request '$BASE_URL/api/health/db' 200"

    # Test Redis connection
    run_test "Redis Connection" \
        "http_request '$BASE_URL/api/health/redis' 200"
}

# Authentication tests
test_authentication() {
    # Test login endpoint exists
    run_test "Login Endpoint Available" \
        "curl -s -X POST '$BASE_URL/api/auth/login' \
         -H 'Content-Type: application/json' \
         -d '{"email":"test@example.com","password":"test"}' \
         -w '%{http_code}' | grep -E '^(200|401|400)$'"

    # Test JWT validation endpoint
    run_test "JWT Validation Endpoint" \
        "http_request '$BASE_URL/api/auth/validate' 401"
}

# API functionality tests
test_api_functionality() {
    # Test tasks endpoint
    run_test "Tasks List Endpoint" \
        "http_request '$BASE_URL/api/tasks' 401"

    # Test users endpoint
    run_test "Users Endpoint" \
        "http_request '$BASE_URL/api/users' 401"

    # Test analytics endpoint
    run_test "Analytics Endpoint" \
        "http_request '$BASE_URL/api/analytics/overview' 401"
}

# Performance tests
test_performance() {
    # Test response time
    run_test "Response Time < 2s" \
        "curl -o /dev/null -s -w '%{time_total}' '$BASE_URL/api/health' | awk '{print \$1 < 2.0}' | grep -q 1"

    # Test concurrent connections
    run_test "Concurrent Connections" \
        "for i in {1..5}; do curl -s '$BASE_URL/api/health' & done; wait"
}

# Security tests
test_security_headers() {
    # Test security headers
    run_test "Security Headers Present" \
        "curl -s -I '$BASE_URL' | grep -i 'x-frame-options\\|x-content-type-options\\|x-xss-protection'"

    # Test HTTPS redirect
    if [[ $BASE_URL == https://* ]]; then
        run_test "HTTPS Enforced" \
            "curl -s -I 'http://$(echo $BASE_URL | sed 's/https:\/\///')' | grep -i '301\\|302'"
    fi
}

# Monitoring tests
test_monitoring() {
    # Test metrics endpoint (should require auth)
    run_test "Metrics Endpoint Secured" \
        "http_request '$BASE_URL/metrics' 401"

    # Test Prometheus scraping
    run_test "Prometheus Metrics Available" \
        "http_request '$BASE_URL/api/metrics' 401"
}

# WebSocket tests
test_websocket() {
    # Test WebSocket endpoint
    run_test "WebSocket Endpoint Available" \
        "curl -i -N -H 'Connection: Upgrade' \
         -H 'Upgrade: websocket' \
         -H 'Sec-WebSocket-Key: test' \
         -H 'Sec-WebSocket-Version: 13' \
         '$(echo $BASE_URL | sed 's/http/ws/')' | grep -i '101\\|400'"
}

# Integration tests
test_integration() {
    # Test TON payment integration
    run_test "TON Payment Integration" \
        "http_request '$BASE_URL/api/payment/ton/info' 200"

    # Test Telegram bot integration
    run_test "Telegram Bot Webhook" \
        "curl -s -X POST '$BASE_URL/api/telegram/webhook' \
         -H 'Content-Type: application/json' \
         -d '{"update_id":123}' \
         -w '%{http_code}' | grep -E '^(200|401)$'"

    # Test file upload
    run_test "File Upload Endpoint" \
        "curl -s -X POST '$BASE_URL/api/upload' \
         -F 'file=@/dev/null' \
         -w '%{http_code}' | grep -E '^(400|200)$'"
}

# Generate test report
generate_report() {
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local pass_rate=0

    if [ $total_tests -gt 0 ]; then
        pass_rate=$((TESTS_PASSED * 100 / total_tests))
    fi

    echo
    echo "=================================="
    echo "🧪 Smoke Test Report"
    echo "=================================="
    echo "Total Tests: $total_tests"
    echo "✅ Passed: $TESTS_PASSED"
    echo "❌ Failed: $TESTS_FAILED"
    echo "📊 Pass Rate: ${pass_rate}%"
    echo "=================================="

    if [ $TESTS_FAILED -eq 0 ]; then
        log "INFO" "All smoke tests passed! 🎉"
        return 0
    else
        log "ERROR" "Some smoke tests failed! ❌"
        return 1
    fi
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up..."
    # Add any cleanup logic here
}

# Main execution
main() {
    log "INFO" "Starting smoke tests for $BASE_URL"
    log "INFO" "Timeout per test: ${TIMEOUT}s"
    log "INFO" "Retry count: $RETRY_COUNT"

    # Trap cleanup on exit
    trap cleanup EXIT

    # Run all test suites
    test_health_endpoints
    test_basic_functionality
    test_database_connectivity
    test_authentication
    test_api_functionality
    test_performance
    test_security_headers
    test_monitoring
    test_websocket
    test_integration

    # Generate report
    generate_report
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi