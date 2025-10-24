# Monitoring Configuration

This directory contains centralized monitoring configuration for the LabelMint platform using Prometheus, Grafana, Loki, and Tempo.

## Directory Structure

```
config/monitoring/
├── prometheus/
│   └── prometheus.yml          # Main Prometheus configuration
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── datasources.yml  # Grafana datasources
│   │   └── dashboards/
│   │       └── dashboards.yml   # Dashboard providers
│   └── dashboards/              # Dashboard JSON files
│       ├── labelmint/           # LabelMint application dashboards
│       ├── infrastructure/      # Infrastructure dashboards
│       ├── security/           # Security monitoring dashboards
│       └── performance/        # Performance dashboards
├── rules/
│   └── labelmint-alerts.yml    # Prometheus recording/alerting rules
├── alerts/
│   └── labelmint-alerts.yml    # AlertManager configuration
└── README.md                   # This file
```

## Components

### Prometheus

**Configuration File:** `prometheus/prometheus.yml`

The Prometheus configuration includes:

- **Global Settings:** 15s scrape intervals, environment labels
- **Service Discovery:** All LabelMint services (web, APIs, bots, databases)
- **Infrastructure Monitoring:** Node exporter, cAdvisor, database exporters
- **Application Monitoring:** Custom metrics from all services
- **External Monitoring:** Blackbox exporter for URL monitoring
- **Alerting:** Integration with AlertManager
- **Remote Storage:** Configuration for long-term storage (optional)

**Key Features:**
- Comprehensive service monitoring
- System metrics collection
- Log aggregation metrics (Loki)
- Distributed tracing metrics (Tempo)
- Environment-aware labeling
- Kubernetes support (when deployed in K8s)

### Grafana

**Datasources:** `grafana/provisioning/datasources/datasources.yml`

Configured datasources:
- **Prometheus:** Primary metrics datasource (default)
- **Loki:** Log aggregation with trace linking
- **Tempo:** Distributed tracing
- **Specialized datasources:** Node Exporter, PostgreSQL, Redis, MinIO

**Dashboards:** `grafana/dashboards/`

Dashboard categories:
- **LabelMint:** Application-specific dashboards
- **Infrastructure:** System and service health
- **Security:** Security monitoring and alerts
- **Performance:** Performance analysis and optimization

### Alerting

**Prometheus Rules:** `rules/labelmint-alerts.yml`
- Recording rules for computed metrics
- Alerting rules for proactive monitoring
- Service-level objective (SLO) monitoring

**AlertManager:** `alerts/labelmint-alerts.yml`
- Alert routing and grouping
- Notification channels (email, Slack, etc.)
- Alert inhibition and silencing rules

## Usage

### With Docker Compose

The monitoring configuration is automatically mounted when using the consolidated Docker Compose files:

```bash
# Start with monitoring
docker-compose -f config/docker/docker-compose.yml -f config/docker/docker-compose.prod.yml up -d

# Access services
# Grafana: http://localhost:3001
# Prometheus: http://localhost:9090
# AlertManager: http://localhost:9093
```

### Direct Configuration

To use these configurations directly with standalone services:

```bash
# Prometheus
prometheus --config.file=config/monitoring/prometheus/prometheus.yml

# Grafana
grafana server --config=config/monitoring/grafana/grafana.ini \
  --homepath=/usr/share/grafana
```

## Configuration Details

### Prometheus Targets

| Service | Port | Metrics Path | Description |
|---------|------|--------------|-------------|
| Prometheus | 9090 | /metrics | Prometheus self-monitoring |
| Web App | 3002 | /metrics | Frontend application metrics |
| Labeling Backend | 3101 | /metrics | Labeling API metrics |
| Payment Backend | 3103 | /metrics | Payment API metrics |
| API Gateway | 3104 | /metrics | Gateway metrics |
| Client Bot | 3105 | /metrics | Client bot metrics |
| Worker Bot | 3106 | /metrics | Worker bot metrics |
| Node Exporter | 9100 | /metrics | System metrics |
| PostgreSQL Exporter | 9187 | /metrics | Database metrics |
| Redis Exporter | 9121 | /metrics | Redis metrics |
| MinIO | 9000 | /minio/v2/metrics/cluster | Storage metrics |
| Nginx | 9113 | /metrics | Reverse proxy metrics |
| Loki | 3100 | /metrics | Log aggregation metrics |
| Tempo | 3200 | /metrics | Tracing metrics |
| AlertManager | 9093 | /metrics | Alerting metrics |

### Grafana Dashboard Access

Default credentials (change in production):
- **Username:** admin
- **Password:** admin

### Alerting Channels

Configure notification channels in AlertManager:

1. **Email:** SMTP configuration for email alerts
2. **Slack:** Webhook integration for Slack notifications
3. **Discord:** Webhook integration for Discord notifications
4. **Custom:** HTTP webhook endpoints for custom integrations

## Migration from Old Configuration

This centralized configuration replaces scattered monitoring configs:

### Before
```bash
infrastructure/monitoring/prometheus.yml
infrastructure/monitoring/prometheus.yml/prometheus.yml
services/api-gateway/monitoring/prometheus.yml
infrastructure/security-monitoring/prometheus/prometheus.yml
```

### After
```bash
config/monitoring/prometheus/prometheus.yml  # Single source of truth
```

### Update Docker Compose

Update your Docker Compose volumes:

```yaml
services:
  prometheus:
    volumes:
      - ./config/monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./config/monitoring/rules:/etc/prometheus/rules:ro
      - ./config/monitoring/alerts:/etc/prometheus/alerts:ro

  grafana:
    volumes:
      - ./config/monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./config/monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
```

## Best Practices

### Performance Optimization
1. **Scrape Intervals:** Balance between granularity and performance
2. **Retention Policies:** Configure appropriate data retention
3. **Remote Storage:** Use remote storage for long-term data
4. **Recording Rules:** Pre-compute expensive queries

### Security
1. **Authentication:** Enable authentication for all services
2. **Authorization:** Implement role-based access control
3. **Network Security:** Use firewall rules and network segmentation
4. **Data Encryption:** Encrypt data in transit and at rest

### Reliability
1. **High Availability:** Deploy multiple instances
2. **Resource Limits:** Set appropriate memory and CPU limits
3. **Health Checks:** Configure comprehensive health checks
4. **Backup:** Regular configuration and data backups

### Monitoring the Monitoring
1. **Prometheus Self-Monitoring:** Monitor Prometheus metrics
2. **Grafana Usage:** Track dashboard and query performance
3. **Alert Health:** Monitor alert delivery and effectiveness
4. **Capacity Planning:** Track resource usage and growth

## Troubleshooting

### Common Issues

**Prometheus not scraping targets:**
- Check network connectivity between Prometheus and targets
- Verify target endpoints are accessible
- Check service discovery configuration

**Grafana dashboards not loading:**
- Verify datasource connections
- Check dashboard JSON syntax
- Ensure proper permissions

**Alerts not firing:**
- Check alert rule syntax
- Verify AlertManager configuration
- Check notification channel setup

**High memory usage:**
- Optimize scrape intervals
- Reduce metric cardinality
- Configure appropriate retention policies

### Debug Commands

```bash
# Check Prometheus configuration
promtool check config config/monitoring/prometheus/prometheus.yml

# Check Prometheus rules
promtool check rules config/monitoring/rules/

# Test AlertManager configuration
amtool config routes test

# Verify Grafana datasources
curl http://admin:admin@localhost:3001/api/datasources
```

## Extending the Configuration

### Adding New Services

1. Add scrape config to `prometheus/prometheus.yml`
2. Create service-specific dashboards
3. Define relevant alerts and recording rules
4. Update documentation

### Adding New Dashboards

1. Create JSON dashboard file in appropriate category
2. Update dashboard provider configuration
3. Test dashboard functionality
4. Document dashboard purpose

### Custom Alerts

1. Define alerting rules in `rules/`
2. Configure AlertManager routing
3. Set up notification channels
4. Test alert delivery

## Environment-Specific Configurations

### Development
- Verbose logging enabled
- Shorter scrape intervals
- Debug dashboards included
- Relaxed alerting thresholds

### Production
- Optimized for performance
- Longer retention periods
- Comprehensive alerting
- Security hardening

### Testing
- Mock datasources available
- Minimal resource usage
- Isolated from production
- Automated validation