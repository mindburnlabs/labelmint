# LabelMint Infrastructure

Infrastructure configurations for LabelMint deployment and monitoring.

## 🚀 Quick Start

For local development and deployment, use the **unified deployment script**:

```bash
# Development environment
./scripts/deploy-unified.sh deploy development

# Production deployment
./scripts/deploy-unified.sh deploy production

# With debugging tools
./scripts/deploy-unified.sh deploy debug
```

## 📁 Directory Structure

```
infrastructure/
├── docker/              # Docker configurations
├── k8s/                 # Kubernetes manifests
│   ├── deployments/     # Application deployments
│   ├── services/        # Service definitions
│   └── ingress/         # Ingress and routing
├── monitoring/          # Monitoring stack
│   ├── prometheus.yml/  # Prometheus configuration
│   └── grafana/         # Dashboards
└── scripts/             # Utility scripts
```

## 📊 Monitoring & Observability

- **Prometheus**: Metrics collection (http://localhost:9090)
- **Grafana**: Visualization dashboards (http://localhost:3001)
- **Loki**: Log aggregation
- **Tempo**: Distributed tracing

## 🔧 Environment Configuration

- Development: `docker-compose.yml`
- Staging: `docker-compose.staging.yml`
- Production: `docker-compose.prod.yml`
- Debug: `docker-compose.unified.yml`

## 📚 Documentation

For detailed deployment instructions, see:
- [Main README](../README.md)
- [Deployment Guide](../docs/deployment/production.md)
- [Architecture Overview](../docs/architecture/overview.md)