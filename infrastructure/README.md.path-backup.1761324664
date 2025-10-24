# LabelMint Infrastructure

This directory contains all the infrastructure configurations for LabelMint, including Kubernetes manifests, Docker configurations, monitoring stack, and deployment scripts.

## 📁 Directory Structure

```
infrastructure/
├── docker/              # Docker configurations and optimized Dockerfiles
├── k8s/                 # Kubernetes manifests
│   ├── deployments/     # Application deployments
│   ├── services/        # Service definitions
│   ├── ingress/         # Ingress and routing rules
│   ├── configmaps/      # Configuration maps
│   └── namespace.yaml/  # Namespace definition
├── monitoring/          # Monitoring stack configurations
│   ├── prometheus.yml/  # Prometheus rules and configuration
│   ├── grafana/         # Grafana dashboards and provisioning
│   ├── loki/            # Loki log aggregation
│   └── tempo/           # Tempo distributed tracing
├── security/            # Security policies and configurations
├── environments/        # Environment-specific configurations
├── scripts/             # Deployment and utility scripts
└── helm/               # Helm charts and values
```

## 🚀 Quick Start

### Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Docker installed
- Helm 3.x installed
- AWS CLI (for AWS deployments)

### Local Development

1. Start all services locally:
```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

2. Access services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Grafana: http://localhost:3003 (admin/admin123)
- Prometheus: http://localhost:9090
- MinIO: http://localhost:9001 (minioadmin/minioadmin123)

### Deployment to Kubernetes

1. Deploy to staging:
```bash
./infrastructure/scripts/deploy.sh staging deploy
```

2. Deploy to production:
```bash
./infrastructure/scripts/deploy.sh production deploy
```

## 📊 Monitoring

### Prometheus

Prometheus is configured to collect metrics from:
- Application endpoints (exposed on port 9090)
- Node metrics (node-exporter)
- Database metrics (postgres-exporter)
- Redis metrics (redis-exporter)
- Kubernetes API

Key features:
- 15-second scrape interval
- 30-day retention period
- Remote write to Cortex/Thanos for long-term storage

### Grafana Dashboards

Pre-configured dashboards include:
- LabelMint Overview (application health)
- Kubernetes Resources (cluster resources)
- Database Performance (PostgreSQL metrics)
- Cache Performance (Redis metrics)
- Infrastructure Overview (node metrics)

### Loki

Log aggregation with Loki includes:
- Application logs (JSON format)
- System logs (syslog)
- Nginx access/error logs
- Database logs
- 14-day retention

### Tempo

Distributed tracing with Tempo:
- OpenTelemetry collector
- Jaeger compatibility
- 7-day retention
- Service map generation

## 🔒 Security

### Network Policies

- Default deny policy for all namespaces
- Specific policies for LabelMint namespace
- Only allowed ingress from ingress controller
- Egress restrictions for external API calls

### Pod Security

- Non-root user execution
- Read-only root filesystem
- Resource limits and requests
- Security context constraints

### Secrets Management

- Vault for production secrets
- External Secrets Operator integration
- Environment-specific secret handling
- Encrypted storage and transit

## 🛠️ Configuration

### Environment Variables

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | production |
| DB_HOST | Database host | postgres-service |
| REDIS_HOST | Redis host | redis-service |
| MINIO_ENDPOINT | MinIO endpoint | minio-service |
| LOG_LEVEL | Logging level | info |

### Resource Allocation

Production resource limits:
- Backend: 500m CPU, 1Gi memory
- Frontend: 250m CPU, 512Mi memory
- Workers: 250m CPU, 512Mi memory
- PostgreSQL: 1000m CPU, 2Gi memory

## 📋 Health Checks

All services include health checks:
- `/health` endpoint for liveness
- `/ready` endpoint for readiness
- `/metrics` endpoint for Prometheus
- Database connection checks
- Cache connectivity checks

## 🔄 CI/CD Integration

The deployment script integrates with GitHub Actions:
- Automated builds on push
- Security scanning
- Automated tests
- Multi-arch Docker builds
- Helm deployments

## 📈 Scaling

### Horizontal Pod Autoscaling

- CPU-based scaling (70% target)
- Memory-based scaling (80% target)
- Custom metrics support
- Min/max replica limits

### Cluster Autoscaling

- Node group auto-scaling
- Spot instance support
- Cluster optimization
- Cost management

## 🗂️ Backup and Recovery

### Database Backups

- Automated daily backups
- Point-in-time recovery
- Cross-region replication
- 30-day retention

### Stateful Services

- Persistent volumes with snapshots
- Backup verification
- Disaster recovery procedures
- RTO/RPO targets

## 🐛 Troubleshooting

### Common Issues

1. **Pods not starting**
   ```bash
   kubectl describe pod <pod-name> -n labelmint
   kubectl logs <pod-name> -n labelmint
   ```

2. **Service not accessible**
   ```bash
   kubectl get svc -n labelmint
   kubectl get ingress -n labelmint
   ```

3. **High memory usage**
   ```bash
   kubectl top pods -n labelmint
   kubectl describe node <node-name>
   ```

### Logs

- Application logs: `kubectl logs -n labelmint -l app=labelmint-backend`
- System logs: Check Loki in Grafana
- Audit logs: `kubectl get events -n labelmint --sort-by=.metadata.creationTimestamp`

## 📚 Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [Helm Charts](https://helm.sh/docs/topics/charts/)
- [Security Best Practices](https://kubernetes.io/docs/concepts/security/)

## 🤝 Contributing

When making changes to infrastructure:

1. Test changes in development first
2. Update documentation
3. Run security scans
4. Get code review
5. Deploy to staging before production

## 📞 Support

For infrastructure issues:
- Check monitoring dashboards
- Review deployment logs
- Check the troubleshooting guide
- Contact the DevOps team