#!/bin/bash

# LabelMint Monitoring Setup Script
# This script sets up monitoring dashboards and alerts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GRAFANA_URL="http://localhost:3001"
GRAFANA_USER="admin"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-labelmint123secure}"
PROMETHEUS_URL="http://localhost:9090"

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

header() {
    echo -e "\n${PURPLE}=== $1 ===${NC}"
}

# Function to wait for Grafana to be ready
wait_for_grafana() {
    local max_attempts=30
    local attempt=1

    log "Waiting for Grafana to be ready..."

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
            success "Grafana is ready"
            return 0
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    error "Grafana failed to start after $max_attempts attempts"
    return 1
}

# Function to wait for Prometheus to be ready
wait_for_prometheus() {
    local max_attempts=30
    local attempt=1

    log "Waiting for Prometheus to be ready..."

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$PROMETHEUS_URL/-/healthy" > /dev/null 2>&1; then
            success "Prometheus is ready"
            return 0
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    error "Prometheus failed to start after $max_attempts attempts"
    return 1
}

# Function to get Grafana API token
get_grafana_token() {
    log "Getting Grafana API token..."

    local response
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"labelmint-setup\",\"role\":\"Admin\"}" \
        "$GRAFANA_URL/api/auth/keys" \
        -u "$GRAFANA_USER:$GRAFANA_PASSWORD" 2>/dev/null || echo "")

    if [[ -n "$response" ]]; then
        local key=$(echo "$response" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
        if [[ -n "$key" ]]; then
            echo "$key"
            return 0
        fi
    fi

    warn "Could not create API token, using basic auth"
    echo ""
}

# Function to create Grafana datasource
create_datasource() {
    local api_key="$1"
    local datasource_name="$2"
    local datasource_url="$3"
    local datasource_type="$4"

    log "Creating datasource: $datasource_name"

    local auth_header=""
    if [[ -n "$api_key" ]]; then
        auth_header="Authorization: Bearer $api_key"
    else
        auth_header="Authorization: Basic $(echo -n "$GRAFANA_USER:$GRAFANA_PASSWORD" | base64)"
    fi

    local datasource_config=$(cat <<EOF
{
    "name": "$datasource_name",
    "type": "$datasource_type",
    "url": "$datasource_url",
    "access": "proxy",
    "isDefault": false,
    "editable": true
}
EOF
)

    local response
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "$auth_header" \
        -d "$datasource_config" \
        "$GRAFANA_URL/api/datasources" 2>/dev/null || echo "")

    if echo "$response" | grep -q '"id"'; then
        success "Datasource $datasource_name created successfully"
        return 0
    else
        warn "Failed to create datasource $datasource_name (may already exist)"
        return 1
    fi
}

# Function to import Grafana dashboard
import_dashboard() {
    local api_key="$1"
    local dashboard_file="$2"
    local dashboard_title="$3"

    log "Importing dashboard: $dashboard_title"

    if [[ ! -f "$dashboard_file" ]]; then
        error "Dashboard file not found: $dashboard_file"
        return 1
    fi

    local auth_header=""
    if [[ -n "$api_key" ]]; then
        auth_header="Authorization: Bearer $api_key"
    else
        auth_header="Authorization: Basic $(echo -n "$GRAFANA_USER:$GRAFANA_PASSWORD" | base64)"
    fi

    # Read dashboard file and create import payload
    local dashboard_content=$(cat "$dashboard_file")
    local import_payload=$(cat <<EOF
{
    "dashboard": $dashboard_content,
    "overwrite": true,
    "inputs": []
}
EOF
)

    local response
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "$auth_header" \
        -d "$import_payload" \
        "$GRAFANA_URL/api/dashboards/db" 2>/dev/null || echo "")

    if echo "$response" | grep -q '"id"'; then
        success "Dashboard $dashboard_title imported successfully"
        return 0
    else
        error "Failed to import dashboard $dashboard_title"
        echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4 || echo "Unknown error"
        return 1
    fi
}

# Function to reload Prometheus configuration
reload_prometheus() {
    log "Reloading Prometheus configuration..."

    if curl -s -X POST "$PROMETHEUS_URL/-/reload" > /dev/null 2>&1; then
        success "Prometheus configuration reloaded"
        return 0
    else
        warn "Failed to reload Prometheus configuration"
        return 1
    fi
}

# Function to test Prometheus targets
test_prometheus_targets() {
    log "Testing Prometheus targets..."

    local response
    response=$(curl -s "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null || echo "")

    if echo "$response" | grep -q '"activeTargets"'; then
        local active_targets=$(echo "$response" | grep -o '"health":"up"' | wc -l || echo "0")
        local total_targets=$(echo "$response" | grep -o '"health":"[^"]*"' | wc -l || echo "0")

        success "Prometheus targets: $active_targets/$total_targets active"
        return 0
    else
        warn "Could not fetch Prometheus targets"
        return 1
    fi
}

# Function to create alert manager configuration
create_alertmanager_config() {
    local alertmanager_dir="$PROJECT_ROOT/infrastructure/monitoring/alertmanager"
    local config_file="$alertmanager_dir/alertmanager.yml"

    if [[ ! -f "$config_file" ]]; then
        log "Creating AlertManager configuration..."

        mkdir -p "$alertmanager_dir"

        cat > "$config_file" << 'EOF'
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@labelmint.local'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'web.hook'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://localhost:8080/webhook'
        send_resolved: true

  - name: 'critical-alerts'
    email_configs:
      - to: 'admin@labelmint.local'
        subject: '[CRITICAL] LabelMint Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Labels: {{ range .Labels.SortedPairs }}{{ .Name }}={{ .Value }} {{ end }}
          {{ end }}

  - name: 'warning-alerts'
    email_configs:
      - to: 'alerts@labelmint.local'
        subject: '[WARNING] LabelMint Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
EOF

        success "AlertManager configuration created"
    else
        log "AlertManager configuration already exists"
    fi
}

# Function to display monitoring information
display_monitoring_info() {
    header "🎉 MONITORING SETUP COMPLETE"

    echo ""
    echo "📊 Monitoring Services:"
    echo "  📈 Grafana Dashboard: $GRAFANA_URL"
    echo "    Username: $GRAFANA_USER"
    echo "    Password: $GRAFANA_PASSWORD"
    echo ""
    echo "  🔍 Prometheus Server: $PROMETHEUS_URL"
    echo ""
    echo "  📋 Available Dashboards:"
    echo "    • LabelMint Infrastructure Overview"
    echo "    • System Metrics"
    echo "    • Container Monitoring"
    echo ""
    echo "  🚨 Alert Rules Configured:"
    echo "    • Container health monitoring"
    echo "    • Resource usage alerts (CPU, Memory, Disk)"
    echo "    • Service availability monitoring"
    echo "    • Database connection monitoring"
    echo ""
    echo "🔧 Next Steps:"
    echo "  1. Access Grafana: $GRAFANA_URL"
    echo "  2. Navigate to Dashboards to view monitoring"
    echo "  3. Check Alerting rules and notification channels"
    echo "  4. Configure email/Slack notifications as needed"
    echo ""
    echo "📚 Documentation:"
    echo "  • Runbooks: infrastructure/monitoring/runbooks/"
    echo "  • Dashboards: infrastructure/monitoring/grafana/dashboards/"
    echo "  • Alert Rules: infrastructure/monitoring/alertmanager/"
}

# Main function
main() {
    log "Starting LabelMint monitoring setup..."

    # Load environment variables
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        log "Loading environment variables from .env"
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi

    # Wait for services to be ready
    header "🔍 CHECKING SERVICE HEALTH"
    wait_for_grafana
    wait_for_prometheus

    # Get Grafana API token
    local api_key
    api_key=$(get_grafana_token)

    # Create datasources
    header "📊 CONFIGURING DATASOURCES"
    create_datasource "$api_key" "Prometheus" "http://labelmint-prometheus:9090" "prometheus"
    create_datasource "$api_key" "LabelMint-Prometheus" "$PROMETHEUS_URL" "prometheus"

    # Import dashboards
    header "📈 IMPORTING DASHBOARDS"
    import_dashboard "$api_key" "$PROJECT_ROOT/infrastructure/monitoring/grafana/dashboards/labelmint-infrastructure.json" "LabelMint Infrastructure Overview"

    # Create AlertManager configuration
    header "🚨 CONFIGURING ALERTS"
    create_alertmanager_config

    # Reload Prometheus configuration
    reload_prometheus

    # Test Prometheus targets
    test_prometheus_targets

    # Display monitoring information
    display_monitoring_info

    success "LabelMint monitoring setup completed successfully!"
}

# Run main function
main "$@"