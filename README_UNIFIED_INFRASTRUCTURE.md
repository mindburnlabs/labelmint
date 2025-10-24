# LabelMint Unified Infrastructure

This repository contains the completely consolidated and unified Docker infrastructure for LabelMint. This setup resolves all network conflicts, eliminates duplicate configurations, and provides a standardized, production-ready deployment platform.

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose v2.0+
- 4GB+ RAM available for Docker
- At least 10GB free disk space

### 1. Environment Setup

```bash
# Copy environment template
cp .env.unified.example .env

# Edit the environment file with your configuration
nano .env
```

### 2. Deploy All Services

```bash
# Deploy the complete stack
./scripts/deploy-unified.sh deploy

# Or with debug tools (Redis Commander, PgAdmin)
./scripts/deploy-unified.sh deploy debug
```

### 3. Access Your Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Web Application | http://localhost:3000 | - |
| API Gateway | http://localhost:3104 | - |
| Labeling Backend | http://localhost:3101 | - |
| Payment Backend | http://localhost:3103 | - |
| Grafana Dashboard | http://localhost:3001 | admin / admin |
| Prometheus | http://localhost:9090 | - |
| MinIO Console | http://localhost:9001 | See .env |
| Redis Commander* | http://localhost:8081 | admin / admin |
| PgAdmin* | http://localhost:5050 | See .env |

*Only available with `deploy debug`

## 📁 Architecture Overview

```
labelmint/
├── docker-compose.unified.yml          # Main unified configuration
├── .env.unified.example                # Environment template
├── scripts/                            # Deployment and management scripts
│   ├── deploy-unified.sh              # Main deployment script
│   ├── test-unified-deployment.sh     # Comprehensive testing
│   └── rollback-unified.sh            # Rollback procedures
├── infrastructure/                     # Infrastructure configurations
│   ├── nginx/                         # Nginx reverse proxy
│   ├── monitoring/                    # Monitoring stack (Prometheus, Grafana, Loki)
│   └── monitoring/rules/              # Alert rules
├── services/                          # Application services
│   ├── labeling-backend/              # Labeling backend service
│   ├── payment-backend/               # Payment backend service
│   ├── api-gateway/                   # API gateway
│   └── bots/                          # Telegram bots
└── apps/                              # Frontend applications
    └── telegram-mini-app/             # Telegram mini app
```

## 🌐 Network Architecture

The unified infrastructure uses a secure, segmented network architecture:

- **labelmint-frontend** (172.20.0.0/16): Web apps, nginx
- **labelmint-backend** (172.21.0.0/16): APIs, services
- **labelmint-data** (172.22.0.0/16): Databases, Redis, MinIO
- **labelmint-monitoring** (10.10.0.0/24): Monitoring stack
- **labelmint-bots** (172.23.0.0/16): Bot services

## 🔧 Service Details

### Core Services

- **PostgreSQL**: Primary database (port 5432)
- **Redis**: Cache and session store (port 6379)
- **MinIO**: S3-compatible object storage (ports 9000/9001)
- **Nginx**: Reverse proxy and load balancer (ports 80/443)

### Application Services

- **Web**: Frontend application (port 3000 → 3002)
- **Labeling Backend**: Core labeling API (port 3101)
- **Payment Backend**: Payment processing API (port 3103)
- **API Gateway**: Unified API entry point (port 3104)
- **Client Bot**: Telegram client bot (port 3105)
- **Worker Bot**: Telegram worker bot (port 3106)

### Monitoring Stack

- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Visualization dashboards (port 3001)
- **Loki**: Log aggregation (port 3100)
- **Tempo**: Distributed tracing (port 3200)
- **AlertManager**: Alert routing and notifications (port 9093)
- **Node Exporter**: System metrics (port 9100)

## 📊 Monitoring & Observability

### Grafana Dashboards

- **System Overview**: CPU, memory, disk usage
- **Application Metrics**: Request rates, error rates, latency
- **Database Performance**: PostgreSQL and Redis metrics
- **Business Metrics**: Orders, users, conversions
- **Security**: Authentication failures, suspicious activity

### Alerting

- **Critical Alerts**: Service down, high error rates (Slack + Email)
- **Warning Alerts**: High resource usage (Email)
- **Info Alerts**: Business metrics (Slack)

### Log Aggregation

- **Loki**: Centralized log storage
- **Structured Logging**: JSON format with correlation IDs
- **Log Retention**: 14 days by default
- **Trace-to-Logs**: Automatic correlation with Tempo

## 🛡️ Security Features

- **Non-root Containers**: All services run as non-root users
- **Network Segmentation**: Services isolated by network
- **Secrets Management**: Environment-based secrets
- **SSL/TLS**: HTTPS with automatic redirects
- **Rate Limiting**: Built-in rate limiting for APIs
- **Health Checks**: Comprehensive health monitoring
- **Security Headers**: OWASP-recommended headers

## 🔄 Deployment Commands

### Basic Operations

```bash
# Deploy all services
./scripts/deploy-unified.sh deploy

# Deploy with debug tools
./scripts/deploy-unified.sh deploy debug

# Stop all services
./scripts/deploy-unified.sh stop

# Show service status
./scripts/deploy-unified.sh status

# View logs
./scripts/deploy-unified.sh logs

# Clean up resources
./scripts/deploy-unified.sh remove-all
```

### Testing

```bash
# Comprehensive test suite
./scripts/test-unified-deployment.sh

# Quick health check
./scripts/test-unified-deployment.sh --quick

# Test monitoring stack only
./scripts/test-unified-deployment.sh --monitoring-only

# Test network connectivity
./scripts/test-unified-deployment.sh --network-only
```

### Rollback

```bash
# Create backup before rollback
./scripts/rollback-unified.sh backup

# Preview rollback (dry run)
./scripts/rollback-unified.sh dry-run

# Perform rollback
./scripts/rollback-unified.sh rollback

# Force rollback without confirmation
./scripts/rollback-unified.sh rollback --force

# Rollback with data preservation
./scripts/rollback-unified.sh rollback --preserve-data
```

## 📈 Performance Tuning

### Resource Allocation

- **PostgreSQL**: 2GB RAM, 1 CPU
- **Redis**: 512MB RAM, 0.5 CPU
- **Web App**: 1GB RAM, 1 CPU
- **Backend APIs**: 1GB RAM, 1 CPU each
- **Monitoring**: 2GB RAM total

### Optimization Tips

1. **Database Optimization**
   - Use connection pooling
   - Enable query caching
   - Monitor slow queries

2. **Redis Optimization**
   - Enable persistence
   - Configure memory limits
   - Use clustering for production

3. **Nginx Optimization**
   - Enable gzip compression
   - Configure proper caching
   - Use keep-alive connections

4. **Docker Optimization**
   - Use multi-stage builds
   - Enable layer caching
   - Optimize image sizes

## 🔍 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using a port
   lsof -i :3000
   # Update .env to use different port
   ```

2. **Network Issues**
   ```bash
   # Check Docker networks
   docker network ls
   # Remove conflicting networks
   docker network rm <network-name>
   ```

3. **Service Won't Start**
   ```bash
   # Check service logs
   docker-compose -f docker-compose.unified.yml logs <service-name>
   # Check resource usage
   docker stats
   ```

4. **Database Connection Issues**
   ```bash
   # Test database connectivity
   docker-compose -f docker-compose.unified.yml exec postgres psql -U labelmint -d labelmint
   ```

### Health Checks

All services include comprehensive health checks:

```bash
# Check all service health
./scripts/test-unified-deployment.sh --health-only

# Individual service health checks
curl http://localhost:3000/api/health  # Web app
curl http://localhost:3101/health      # Labeling backend
curl http://localhost:3103/health      # Payment backend
curl http://localhost:3104/health      # API gateway
```

## 🚀 Production Deployment

### Environment Preparation

1. **Server Requirements**
   - 8GB+ RAM
   - 4+ CPU cores
   - 50GB+ SSD storage
   - Ubuntu 20.04+ or CentOS 8+

2. **Docker Setup**
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Security Hardening**
   - Configure firewall rules
   - Set up SSL certificates
   - Configure backup strategy
   - Enable log rotation

### Production Configuration

```bash
# Production environment file
cp .env.unified.example .env.production

# Update for production
NODE_ENV=production
ENVIRONMENT=production
LOG_LEVEL=warn

# Use strong passwords
POSTGRES_PASSWORD=your_secure_postgres_password
REDIS_PASSWORD=your_secure_redis_password
JWT_SECRET=your_very_secure_jwt_secret

# Configure external services
SMTP_ENABLED=true
SMTP_HOST=your-smtp-server
SMTP_USER=your-email@domain.com
```

### Deployment Commands

```bash
# Deploy to production
ENV_FILE=.env.production ./scripts/deploy-unified.sh deploy

# Verify deployment
./scripts/test-unified-deployment.sh

# Set up monitoring alerts
# Configure Grafana dashboards
# Set up backup schedules
```

## 📋 Maintenance

### Daily Tasks

- Check service health
- Review system metrics
- Monitor disk space
- Check error logs

### Weekly Tasks

- Update container images
- Review security alerts
- Backup configurations
- Performance tuning

### Monthly Tasks

- Security updates
- Log rotation review
- Capacity planning
- Documentation updates

## 📚 Additional Resources

### Documentation

- [Infrastructure Analysis](INFRASTRUCTURE_CONSOLIDATION_ANALYSIS.md) - Detailed technical analysis
- [Migration Guide](DOCKER_MIGRATION_GUIDE.md) - Step-by-step migration instructions
- [API Documentation](docs/api/) - API reference documentation
- [Architecture Guide](docs/architecture/) - System architecture documentation

### Support

- **Issues**: Create GitHub issue with "Infrastructure" label
- **Emergencies**: Contact infrastructure team via Slack
- **Documentation**: LabelMint Wiki
- **Runbooks**: `docs/runbooks/`

### Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Last Updated**: October 24, 2025
**Version**: 1.0.0
**Maintainers**: LabelMint Infrastructure Team