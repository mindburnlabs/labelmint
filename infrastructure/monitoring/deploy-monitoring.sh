#!/bin/bash

# LabelMint Production Monitoring Deployment Script
# ================================================

set -euo pipefail

# Configuration
MONITORING_NAMESPACE="monitoring"
CLUSTER_NAME="labelmint-production"
REGION="us-east-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi

    # Check if helm is available
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed"
        exit 1
    fi

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi

    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Create monitoring namespace
create_namespace() {
    log_info "Creating monitoring namespace..."

    kubectl create namespace $MONITORING_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

    log_success "Namespace created"
}

# Deploy Prometheus
deploy_prometheus() {
    log_info "Deploying Prometheus..."

    # Add prometheus-community helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    # Install/upgrade Prometheus
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace $MONITORING_NAMESPACE \
        --values - <<EOF
# Prometheus Configuration
prometheus:
  enabled: true
  serviceAccount:
    create: true
    name: prometheus
  service:
    type: LoadBalancer
    port: 9090
  persistence:
    enabled: true
    storageClass: "gp3"
    size: 100Gi

  # Prometheus production configuration
  prometheusSpec:
    retention: 15d
    retentionSize: 50GB
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 100Gi

    # Remote write configuration
    remoteWrite:
      - url: "https://prometheus-remote-storage.labelmint.it/api/v1/write"
        queueConfig:
          maxSamplesPerSend: 2000
          maxShards: 200
          capacity: 5000
          minBackoff: 30ms
          maxBackoff: 100ms

    # Additional scrape configurations
    additionalScrapeConfigs:
      - job_name: 'labelmint-services'
        kubernetes_sd_configs:
          - role: endpoints
        relabel_configs:
          - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
          - source_labels: [__address__, __meta_kubernetes_service_annotation_prometheus_io_port]
            action: replace
            regex: ([^:]+)(?::\d+)?;(\d+)
            replacement: \$1:\$2
            target_label: __address__

# AlertManager Configuration
alertmanager:
  enabled: true
  serviceAccount:
    create: true
  service:
    type: LoadBalancer
    port: 9093
  persistence:
    enabled: true
    storageClass: "gp3"
    size: 10Gi

  # AlertManager production configuration
  alertmanagerSpec:
    retention: 120h
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 10Gi

    # Custom alert configuration
    route:
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 12h
      receiver: 'default'

      routes:
        - match:
            severity: critical
          receiver: 'critical-alerts'
          group_wait: 10s
          repeat_interval: 5m

# Grafana Configuration
grafana:
  enabled: true
  serviceAccount:
    create: true
  service:
    type: LoadBalancer
    port: 3000

  # Grafana persistence
  persistence:
    enabled: true
    storageClassName: "gp3"
    size: 20Gi

  # Admin credentials (set in production via secrets)
  adminUser: admin
  adminPassword: "${GRAFANA_ADMIN_PASSWORD:-admin123}"

  # Data sources
  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
        - name: Prometheus
          type: prometheus
          url: http://prometheus:9090
          access: proxy
          isDefault: true
        - name: Loki
          type: loki
          url: http://loki:3100
          access: proxy
        - name: Tempo
          type: tempo
          url: http://tempo:3100
          access: proxy

  # Dashboard provisioning
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
        - name: 'labelmint-dashboards'
          orgId: 1
          folder: 'LabelMint'
          type: file
          disableDeletion: false
          editable: true
          options:
            path: /var/lib/grafana/dashboards/labelmint

  # Import dashboards
  dashboards:
    labelmint:
      business-intelligence:
        gnetId: 0
        datasource: Prometheus
        json: |
$(cat /Users/ivan/Code/labelmint/infrastructure/monitoring/grafana/dashboards/business-intelligence.json | sed 's/^/          /')
      security-overview:
        gnetId: 0
        datasource: Prometheus
        json: |
$(cat /Users/ivan/Code/labelmint/infrastructure/monitoring/grafana/dashboards/security-overview.json | sed 's/^/          /')

# Node Exporter
nodeExporter:
  enabled: true
  serviceAccount:
    create: true
  hostNetwork: true
  hostPID: true
  hostRootfs: true

# Blackbox Exporter
blackboxExporter:
  enabled: true
  serviceAccount:
    create: true
  config:
    modules:
      http_2xx:
        prober: http
        timeout: 5s
        http:
          valid_http_versions:
            - HTTP/1.1
            - HTTP/2.0
          valid_status_codes: []
          method: GET
          follow_redirects: true
          fail_if_ssl: false
          fail_if_not_ssl: false

EOF

    log_success "Prometheus deployed"
}

# Deploy Loki for log aggregation
deploy_loki() {
    log_info "Deploying Loki..."

    # Add grafana helm repo
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Install/upgrade Loki
    helm upgrade --install loki grafana/loki-stack \
        --namespace $MONITORING_NAMESPACE \
        --values - <<EOF
# Loki Configuration
loki:
  enabled: true
  serviceAccount:
    create: true
  service:
    type: LoadBalancer
    port: 3100

  # Loki persistence
  persistence:
    enabled: true
    storageClassName: "gp3"
    size: 50Gi

  # Loki configuration
  config:
    auth_enabled: false

    server:
      http_listen_port: 3100

    ingester:
      lifecycler:
        address: 127.0.0.1
        ring:
          kvstore:
            store: inmemory
          replication_factor: 1
      chunk_idle_period: 1h
      max_chunk_age: 1h
      chunk_target_size: 1048576
      chunk_retain_period: 30s

    schema_config:
      configs:
        - from: 2020-10-24
          store: boltdb-shipper
          object_store: aws
          schema: v11
          index:
            prefix: index_
            period: 24h

    storage_config:
      aws:
        s3: s3://labelmint-logs/
        region: $REGION
      boltdb_shipper:
        shared_store: aws
        cache_ttl: 24h

    limits_config:
      enforce_metric_name: false
      reject_old_samples: true
      reject_old_samples_max_age: 168h
      max_entries_limit_per_query: 5000

# Promtail Configuration
promtail:
  enabled: true
  serviceAccount:
    create: true

  # Promtail configuration
  config:
    server:
      http_listen_port: 3101
      grpc_listen_port: 3102

    positions:
      filename: /tmp/positions.yaml

    clients:
      - url: http://loki:3100/loki/api/v1/push

    scrape_configs:
      - job_name: kubernetes-pods-name
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_name]
            target_label: name
          - source_labels: [__meta_kubernetes_pod_namespace]
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_container_name]
            target_label: container
          - source_labels: [__meta_kubernetes_pod_label_app]
            target_label: app
          - source_labels: [__meta_kubernetes_pod_label_component]
            target_label: component

EOF

    log_success "Loki deployed"
}

# Deploy Tempo for distributed tracing
deploy_tempo() {
    log_info "Deploying Tempo..."

    # Install Tempo
    helm upgrade --install tempo grafana/tempo \
        --namespace $MONITORING_NAMESPACE \
        --values - <<EOF
# Tempo Configuration
tempo:
  enabled: true
  serviceAccount:
    create: true
  service:
    type: LoadBalancer
    port: 3100

  # Tempo configuration
  configuration: |
    server:
      http_listen_port: 3100
      grpc_listen_port: 9096
      log_level: info

    distributor:
      receivers:
        otlp:
          protocols:
            http:
              endpoint: 0.0.0.0:4318
            grpc:
              endpoint: 0.0.0.0:4317
        jaeger:
          protocols:
            grpc:
              endpoint: 0.0.0.0:14250
            thrift_http:
              endpoint: 0.0.0.0:14268
        zipkin:
          endpoint: 0.0.0.0:9411

    ingester:
      lifecycler:
        address: 127.0.0.1
        ring:
          kvstore:
            store: memberlist
          replication_factor: 1
      trace_idle_period: 10s
      max_block_bytes: 1_000_000
      max_block_duration: 1m

    compactor:
      compaction:
        compaction_window: 1h
        retention_enabled: true
        delete_block_delay: 2h
      ring:
        kvstore:
          store: memberlist

    metrics_generator:
      processor:
        service_graphs:
          enabled: true
          max_items: 10000
          wait: 10s
          workers: 10
        span_metrics:
          enabled: true
      storage:
        path: /tmp/tempo/generator/wal
        remote_write:
          - url: http://prometheus:9090/api/v1/write
            send_exemplars: true

    storage:
      trace:
        backend: s3
        s3:
          bucket: labelmint-traces
          endpoint: s3.amazonaws.com
          region: $REGION
          access_key_id: \${AWS_ACCESS_KEY_ID}
          secret_access_key: \${AWS_SECRET_ACCESS_KEY}
        block:
          bloom_filter_false_positive: .01
          v2_encoding: zstd
        pool:
          max_workers: 100
          queue_depth: 10000

    overrides:
      per_tenant_override_config: /overrides.yaml

    memberlist:
      join_members:
        - tempo:7946

    limits:
      per_tenant:
        max_traces_per_user: 10000
        max_global_traces_per_user: 100000
        max_bytes_per_trace: 20000000
EOF

    log_success "Tempo deployed"
}

# Deploy custom monitoring exporters
deploy_exporters() {
    log_info "Deploying custom exporters..."

    # Apply custom exporter configurations
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: labelmint-metrics-exporter
  namespace: $MONITORING_NAMESPACE
spec:
  replicas: 2
  selector:
    matchLabels:
      app: labelmint-metrics-exporter
  template:
    metadata:
      labels:
        app: labelmint-metrics-exporter
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: metrics-exporter
        image: labelmint/metrics-exporter:latest
        ports:
        - containerPort: 8080
        env:
        - name: METRICS_INTERVAL
          value: "30s"
        - name: BUSINESS_METRICS_ENABLED
          value: "true"
        - name: BLOCKCHAIN_METRICS_ENABLED
          value: "true"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: labelmint-metrics-exporter
  namespace: $MONITORING_NAMESPACE
  labels:
    app: labelmint-metrics-exporter
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
spec:
  selector:
    app: labelmint-metrics-exporter
  ports:
  - port: 8080
    targetPort: 8080
EOF

    log_success "Custom exporters deployed"
}

# Apply monitoring rules and alerts
apply_monitoring_rules() {
    log_info "Applying monitoring rules..."

    # Apply alerting rules
    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: labelmint-business-metrics
  namespace: $MONITORING_NAMESPACE
spec:
  groups:
$(cat /Users/ivan/Code/labelmint/infrastructure/monitoring/alerts/business-metrics.yml | sed 's/^/    /')
EOF

    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: labelmint-application-performance
  namespace: $MONITORING_NAMESPACE
spec:
  groups:
$(cat /Users/ivan/Code/labelmint/infrastructure/monitoring/alerts/application-performance.yml | sed 's/^/    /')
EOF

    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: labelmint-security-monitoring
  namespace: $MONITORING_NAMESPACE
spec:
  groups:
$(cat /Users/ivan/Code/labelmint/infrastructure/monitoring/alerts/security-monitoring.yml | sed 's/^/    /')
EOF

    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: labelmint-blockchain-monitoring
  namespace: $MONITORING_NAMESPACE
spec:
  groups:
$(cat /Users/ivan/Code/labelmint/infrastructure/monitoring/alerts/blockchain-monitoring.yml | sed 's/^/    /')
EOF

    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: labelmint-payment-processing
  namespace: $MONITORING_NAMESPACE
spec:
  groups:
$(cat /Users/ivan/Code/labelmint/infrastructure/monitoring/alerts/payment-processing.yml | sed 's/^/    /')
EOF

    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: labelmint-infrastructure-health
  namespace: $MONITORING_NAMESPACE
spec:
  groups:
$(cat /Users/ivan/Code/labelmint/infrastructure/monitoring/alerts/infrastructure-health.yml | sed 's/^/    /')
EOF

    log_success "Monitoring rules applied"
}

# Create monitoring secrets
create_secrets() {
    log_info "Creating monitoring secrets..."

    # Create secret for AlertManager configuration
    kubectl create secret generic alertmanager-config \
        --from-file=alertmanager.yml=/Users/ivan/Code/labelmint/infrastructure/monitoring/alertmanager/production-alertmanager.yml \
        --namespace $MONITORING_NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -

    # Create secret for AWS credentials
    kubectl create secret generic aws-credentials \
        --from-literal=AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}" \
        --from-literal=AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
        --namespace $MONITORING_NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -

    log_success "Secrets created"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying monitoring deployment..."

    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus -n $MONITORING_NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana -n $MONITORING_NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=loki -n $MONITORING_NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=tempo -n $MONITORING_NAMESPACE --timeout=300s

    # Check services
    kubectl get svc -n $MONITORING_NAMESPACE
    kubectl get pods -n $MONITORING_NAMESPACE

    log_success "Monitoring deployment verified"
}

# Print access information
print_access_info() {
    log_info "Monitoring Stack Access Information:"
    echo
    echo "Grafana:"
    echo "  URL: $(kubectl get svc prometheus-grafana -n $MONITORING_NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):3000"
    echo "  Username: admin"
    echo "  Password: ${GRAFANA_ADMIN_PASSWORD:-admin123}"
    echo
    echo "Prometheus:"
    echo "  URL: $(kubectl get svc prometheus-kube-prometheus-prometheus -n $MONITORING_NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):9090"
    echo
    echo "AlertManager:"
    echo "  URL: $(kubectl get svc prometheus-kube-prometheus-alertmanager -n $MONITORING_NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):9093"
    echo
    echo "Loki:"
    echo "  URL: $(kubectl get svc loki -n $MONITORING_NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):3100"
    echo
    echo "Tempo:"
    echo "  URL: $(kubectl get svc tempo -n $MONITORING_NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):3100"
    echo
    echo "Runbooks and documentation:"
    echo "  https://runbooks.labelmint.it"
    echo
    log_success "Monitoring deployment completed successfully!"
}

# Main execution
main() {
    log_info "Starting LabelMint Production Monitoring Deployment..."

    check_prerequisites
    create_namespace
    create_secrets
    deploy_prometheus
    deploy_loki
    deploy_tempo
    deploy_exporters
    apply_monitoring_rules
    verify_deployment
    print_access_info
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi