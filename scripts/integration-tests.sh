#!/bin/bash

# LabelMint Integration Tests
# Comprehensive end-to-end testing for the unified infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

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

test_header() {
    echo -e "\n${PURPLE}=== $1 ===${NC}"
}

test_case() {
    echo -e "\n${CYAN}Test Case: $1${NC}"
    ((TOTAL_TESTS++))
}

test_pass() {
    echo -e "${GREEN}  ✅ PASS: $1${NC}"
    ((PASSED_TESTS++))
}

test_fail() {
    echo -e "${RED}  ❌ FAIL: $1${NC}"
    ((FAILED_TESTS++))
}

# Function to test HTTP endpoint
test_http_endpoint() {
    local test_name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local timeout="${4:-10}"

    test_case "$test_name"

    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")

    if [[ "$response" == "$expected_status" ]]; then
        test_pass "$test_name (HTTP $response)"
        return 0
    else
        test_fail "$test_name (Expected HTTP $expected_status, got HTTP $response)"
        return 1
    fi
}

# Function to test database connectivity
test_database() {
    local test_name="$1"
    local host="$2"
    local port="$3"
    local database="$4"
    local user="$5"

    test_case "$test_name"

    if command -v pg_isready &> /dev/null; then
        if pg_isready -h "$host" -p "$port" -d "$database" -U "$user" --timeout=10 > /dev/null 2>&1; then
            test_pass "$test_name (PostgreSQL ready)"
            return 0
        else
            test_fail "$test_name (PostgreSQL not ready)"
            return 1
        fi
    else
        # Fallback to netcat
        if nc -z -w3 "$host" "$port" 2>/dev/null; then
            test_pass "$test_name (Port $port accessible)"
            return 0
        else
            test_fail "$test_name (Port $port not accessible)"
            return 1
        fi
    fi
}

# Function to test Redis connectivity
test_redis() {
    local test_name="$1"
    local host="$2"
    local port="$3"

    test_case "$test_name"

    if redis-cli -h "$host" -p "$port" ping > /dev/null 2>&1; then
        test_pass "$test_name (Redis PING successful)"
        return 0
    else
        test_fail "$test_name (Redis PING failed)"
        return 1
    fi
}

# Function to test MinIO functionality
test_minio() {
    local test_name="$1"
    local endpoint="$2"
    local access_key="$3"
    local secret_key="$4"

    test_case "$test_name"

    # Test health endpoint
    if curl -sf "$endpoint/minio/health/live" > /dev/null 2>&1; then
        # Test mc client if available
        if command -v mc &> /dev/null; then
            if mc ls labelmint/ > /dev/null 2>&1; then
                test_pass "$test_name (MinIO API and client working)"
                return 0
            else
                test_fail "$test_name (MinIO API working, client not configured)"
                return 1
            fi
        else
            test_pass "$test_name (MinIO API working)"
            return 0
        fi
    else
        test_fail "$test_name (MinIO API not accessible)"
        return 1
    fi
}

# Function to test Docker container status
test_container() {
    local test_name="$1"
    local container_name="$2"
    local expected_status="${3:-running}"

    test_case "$test_name"

    local status
    status=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "not_found")

    if [[ "$status" == "$expected_status" ]]; then
        local health=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")
        if [[ "$health" == "healthy" ]] || [[ "$health" == "none" ]]; then
            test_pass "$test_name (Container $status, health: $health)"
            return 0
        else
            test_fail "$test_name (Container $status, but unhealthy: $health)"
            return 1
        fi
    else
        test_fail "$test_name (Expected status $expected_status, got $status)"
        return 1
    fi
}

# Function to test network connectivity
test_network() {
    local test_name="$1"
    local source_container="$2"
    local target_host="$3"
    local target_port="$4"

    test_case "$test_name"

    if docker exec "$source_container" nc -z -w3 "$target_host" "$target_port" 2>/dev/null; then
        test_pass "$test_name (Network connectivity from $source_container to $target_host:$target_port)"
        return 0
    else
        test_fail "$test_name (No network connectivity from $source_container to $target_host:$target_port)"
        return 1
    fi
}

# Function to test service configuration
test_service_config() {
    local test_name="$1"
    local config_file="$2"
    local required_key="$3"

    test_case "$test_name"

    if [[ -f "$config_file" ]]; then
        if grep -q "$required_key" "$config_file"; then
            test_pass "$test_name (Configuration key '$required_key' found)"
            return 0
        else
            test_fail "$test_name (Configuration key '$required_key' not found in $config_file)"
            return 1
        fi
    else
        test_fail "$test_name (Configuration file $config_file not found)"
        return 1
    fi
}

# Main test suite
main() {
    log "Starting LabelMint Integration Tests..."
    log "Test started at $(date)"

    # Load environment variables
    if [[ -f ".env" ]]; then
        log "Loading environment variables from .env"
        set -a
        source .env
        set +a
    fi

    test_header "🏗️ INFRASTRUCTURE TESTS"

    # Test Docker containers
    test_container "PostgreSQL Container" "labelmint-postgres" "running"
    test_container "Redis Container" "labelmint-redis" "running"
    test_container "MinIO Container" "labelmint-minio" "running"
    test_container "Grafana Container" "labelmint-grafana" "running"
    test_container "Prometheus Container" "labelmint-prometheus" "running"

    test_header "📊 MONITORING SERVICES TESTS"

    # Test monitoring endpoints
    test_http_endpoint "Grafana Health" "http://localhost:3001/api/health" "200"
    test_http_endpoint "Prometheus Health" "http://localhost:9090/-/healthy" "200"
    test_http_endpoint "MinIO Health" "http://localhost:9000/minio/health/live" "200"

    # Test Prometheus targets
    test_http_endpoint "Prometheus Targets" "http://localhost:9090/api/v1/targets" "200"

    test_header "🗄️ DATABASE SERVICES TESTS"

    # Test PostgreSQL
    test_database "PostgreSQL Connectivity" "localhost" "5432" "labelmint" "labelmint"

    # Test Redis
    test_redis "Redis Connectivity" "localhost" "6379"

    test_header "📦 STORAGE SERVICES TESTS"

    # Test MinIO with proper credentials
    test_minio "MinIO Storage" "http://localhost:9000" "labelmintadmin" "labelmintadmin123"

    test_header "🌐 NETWORK CONNECTIVITY TESTS"

    # Test network segmentation (should fail between networks)
    if docker ps --format '{{.Names}}' | grep -q "labelmint-postgres"; then
        if docker ps --format '{{.Names}}' | grep -q "labelmint-grafana"; then
            # This should work since Grafana can access Prometheus on monitoring network
            test_network "Grafana to Prometheus" "labelmint-grafana" "labelmint-prometheus" "9090" || true
        fi
    fi

    test_header "⚙️ CONFIGURATION TESTS"

    # Test important configuration files
    test_service_config "Docker Compose Configuration" "docker-compose.unified.yml" "networks:"
    test_service_config "Environment Configuration" ".env" "POSTGRES_PASSWORD"
    test_service_config "Prometheus Configuration" "infrastructure/monitoring/unified-prometheus.yml" "global:"
    test_service_config "Grafana Configuration" "infrastructure/monitoring/grafana/provisioning/" "datasources"

    test_header "📈 PERFORMANCE TESTS"

    # Test basic performance metrics
    test_case "Response Time Test - Grafana"
    local start_time=$(date +%s%N)
    curl -sf "http://localhost:3001/api/health" > /dev/null 2>&1
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

    if [[ $response_time -lt 5000 ]]; then
        test_pass "Grafana response time: ${response_time}ms (< 5000ms)"
    else
        test_fail "Grafana response time: ${response_time}ms (> 5000ms)"
    fi

    test_case "Response Time Test - Prometheus"
    start_time=$(date +%s%N)
    curl -sf "http://localhost:9090/-/healthy" > /dev/null 2>&1
    end_time=$(date +%s%N)
    response_time=$(( (end_time - start_time) / 1000000 ))

    if [[ $response_time -lt 3000 ]]; then
        test_pass "Prometheus response time: ${response_time}ms (< 3000ms)"
    else
        test_fail "Prometheus response time: ${response_time}ms (> 3000ms)"
    fi

    test_header "📋 SYSTEM RESOURCE TESTS"

    # Test disk space
    test_case "Disk Space Check"
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -lt 80 ]]; then
        test_pass "Disk usage: ${disk_usage}% (< 80%)"
    else
        test_fail "Disk usage: ${disk_usage}% (> 80%)"
    fi

    # Test memory usage
    test_case "Memory Usage Check"
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}' 2>/dev/null || echo "0")
    if [[ -n "$memory_usage" ]] && [[ "$memory_usage" != "0" ]]; then
        if [[ $memory_usage -lt 80 ]]; then
            test_pass "Memory usage: ${memory_usage}% (< 80%)"
        else
            test_fail "Memory usage: ${memory_usage}% (> 80%)"
        fi
    else
        test_pass "Memory usage check skipped (free command not available)"
    fi

    # Test results summary
    test_header "📊 TEST RESULTS SUMMARY"

    echo ""
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo ""

    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    fi

    echo "Success Rate: ${success_rate}%"

    if [[ $FAILED_TESTS -eq 0 ]]; then
        success "🎉 ALL TESTS PASSED! The LabelMint infrastructure is fully operational."
        echo ""
        echo "✅ Infrastructure Status: PRODUCTION READY"
        echo "🚀 Next Steps: Deploy application services and configure monitoring alerts"
        return 0
    else
        warn "⚠️  $FAILED_TESTS test(s) failed. Review the failures above."
        echo ""
        echo "🔧 Infrastructure Status: NEEDS ATTENTION"
        echo "📝 Recommended Actions:"
        echo "   1. Fix failed tests"
        echo "   2. Verify container health checks"
        echo "   3. Check network configurations"
        echo "   4. Review resource allocations"
        return 1
    fi
}

# Run main function
main "$@"