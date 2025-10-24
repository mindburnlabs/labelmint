# DeligateIT Monitoring Stack

This directory contains a comprehensive monitoring setup for the DeligeIT application using Prometheus, Grafana, Loki, Jaeger, and Alertmanager.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Backend App   │───▶│   Prometheus    │───▶│   Grafana      │
│                 │    │                 │    │                 │
│  - Metrics      │    │  - Collection   │    │  - Visualization │
│  - Tracing      │    │  - Storage      │    │  - Dashboards   │
│  - Health Checks│    │  - Alerting    │    │  - Alerting    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │   Alertmanager │    │      Loki       │
         │              │                 │    │                 │
         │              │  - Routing     │    │  - Log Storage  │
         │              │  - Silencing   │    │  - Querying    │
         │              │  - Grouping    │    │  - Retention   │
         │              └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│     Sentry      │
│                 │
│  - Error Track  │
│  - Performance │
│  - Release Mgmt │
└─────────────────┘
```

## Services

### 1. Prometheus
- **Port**: 9090
- **Purpose**: Metrics collection and storage
- **Features**:
  - Multi-dimensional data model
  - Powerful query language (PromQL)
  - Service discovery
  - Alerting rules
  - Remote write for long-term storage

### 2. Grafana
- **Port**: 3000
- **Credentials**: admin/admin123
- **Purpose**: Visualization and dashboarding
- **Features**:
  - Pre-built dashboards
  - Multiple data sources
  - Alerting integration
  - User management
  - Plugin support

### 3. Loki
- **Port**: 3100
- **Purpose**: Log aggregation and querying
- **Features**:
  - Promtail log collection
  - Label-based indexing
  - LogQL query language
  - Integration with Grafana
  - Long-term retention

### 4. Jaeger
- **Port**: 16686 (UI)
- **Purpose**: Distributed tracing
- **Features**:
  - Request tracing
  - Service topology
  - Performance analysis
  - Root cause analysis
  - Sampling strategies

### 5. Alertmanager
- **Port**: 9093
- **Purpose**: Alert management and routing
- **Features**:
  - Alert grouping
  - Multiple receivers
  - Silencing and inhibition
  - Template customization
  - Integration with Slack, PagerDuty

## Quick Start

### 1. Start the Monitoring Stack

```bash
cd monitoring
docker-compose up -d
```

### 2. Verify Services

```bash
# Check all services are running
docker-compose ps

# Check logs
docker-compose logs -f
```

### 3. Access Services

- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Alertmanager**: http://localhost:9093
- **Loki**: http://localhost:3100

### 4. Configure Backend for Monitoring

#### Environment Variables
Add these to your `.env` file:

```env
# Sentry
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=deligateit@1.0.0

# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090
```

#### Application Integration

```typescript
import SentryService from './config/sentry';
import MetricsService from './services/metrics';

// Capture errors
SentryService.captureException(error, {
  tags: { component: 'auth' }
});

// Record metrics
MetricsService.recordCacheHit('redis', 'user:*');
```

## Configuration

### Prometheus Configuration

Edit `prometheus/prometheus.yml`:
- Scrape intervals
- Target configurations
- Alert rule files
- Remote storage settings

### Grafana Datasources

Datasources are automatically provisioned:
- Prometheus: `http://prometheus:9090`
- Loki: `http://loki:3100`
- Jaeger: `http://jaeger:16686`

### Loki Configuration

Edit `loki/loki-config.yaml`:
- Storage backend
- Retention policies
- Indexing strategy
- Performance tuning

### Alertmanager Configuration

Edit `alertmanager/alertmanager.yml`:
- Notification channels
- Routing rules
- Templates
- Time intervals

## Health Endpoints

The backend provides these health endpoints:

- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed health with all checks
- `GET /ready` - Readiness probe (for Kubernetes)
- `GET /live` - Liveness probe (for Kubernetes)
- `GET /metrics` - Prometheus metrics
- `GET /version` - Version information

## Alerting

### Default Alerts

The following alerts are configured:

#### Performance
- **High Error Rate**: > 1% error rate
- **High Response Time**: > 500ms (95th percentile)
- **Memory Usage**: > 90%
- **CPU Usage**: > 80%

#### Infrastructure
- **Disk Space**: < 20% free
- **Database Connections**: > 80%
- **Redis Memory**: > 90%
- **Pod Restarts**: Continuous restarts

#### Application
- **Service Unhealthy**: Down endpoints
- **Slow Database Queries**: > 1s
- **Low Cache Hit Rate**: < 80%
- **User Activity Spikes**: Unusual patterns

### Alert Channels

1. **Email**: Default for all alerts
2. **Slack**: Warnings and critical
3. **PagerDuty**: Critical alerts only
4. **Opsgenie**: On-call escalation

## Dashboard Templates

### Pre-built Dashboards

1. **Backend Overview**
   - Request rate
   - Response time percentiles
   - Error rate
   - Resource usage

2. **Infrastructure**
   - System metrics
   - Container metrics
   - Disk usage
   - Network traffic

3. **Application Performance**
   - Database metrics
   - Cache performance
   - External API calls
   - Authentication events

4. **Business Metrics**
   - User registrations
   - Task completions
   - Active users
   - API usage

## Best Practices

### 1. Metrics
- Use appropriate metric types (Counter, Gauge, Histogram)
- Include relevant labels
- Document metrics with help text
- Use consistent naming conventions

### 2. Logging
- Structure logs as JSON
- Include correlation IDs
- Log at appropriate levels
- Avoid sensitive data

### 3. Tracing
- Trace critical paths
- Include relevant metadata
- Set appropriate sampling rates
- Use consistent span naming

### 4. Alerting
- Set meaningful thresholds
- Include runbook links
- Group related alerts
- Configure proper silencing

## Maintenance

### Backups

Prometheus data:
```bash
docker exec prometheus tar czf /tmp/prometheus-backup.tar.gz /prometheus
docker cp prometheus:/tmp/prometheus-backup.tar.gz ./
```

Grafana dashboards:
```bash
docker exec grafana tar czf /tmp/grafana-backup.tar.gz /var/lib/grafana
docker cp grafana:/tmp/grafana-backup.tar.gz ./
```

### Scaling

- **Prometheus**: Add remote storage for long-term retention
- **Loki**: Increase replicas and use object storage
- **Grafana**: Enable HA with database clustering
- **Alertmanager**: Configure HA pairs

### Security

- Use TLS for all connections
- Enable authentication in Grafana
- Restrict network access
- Rotate secrets regularly

## Troubleshooting

### Common Issues

1. **Prometheus not scraping targets**
   - Check network connectivity
   - Verify target endpoints
   - Review scrape configuration

2. **Grafana not showing data**
   - Verify datasource connection
   - Check time range
   - Validate queries

3. **Alertmanager not sending alerts**
   - Test email configuration
   - Verify webhook endpoints
   - Check routing rules

4. **Loki not receiving logs**
   - Verify Promtail configuration
   - Check file permissions
   - Review pipeline stages

### Debug Commands

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Test Loki queries
curl -G -s "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={job="deligateit-backend"}' \
  --data-urlencode 'start=2024-01-01T00:00:00Z' \
  --data-urlencode 'end=2024-01-01T01:00:00Z'

# Check Alertmanager status
curl http://localhost:9093/api/v1/status
```

## Integration with Kubernetes

When deploying to Kubernetes:

1. Use ServiceMonitor CRDs for Prometheus
2. Configure Prometheus Operator
3. Set up persistent volumes
4. Use ConfigMaps for configuration
5. Deploy with Helm charts

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Sentry Documentation](https://docs.sentry.io/)