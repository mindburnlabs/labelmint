# LabelMint Operations Guide

**Version:** 1.0
**Last Updated:** 2025-10-24
**Environment:** Development/Production

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Service Architecture](#service-architecture)
3. [Quick Start](#quick-start)
4. [Service Management](#service-management)
5. [Monitoring & Alerting](#monitoring--alerting)
6. [Backup & Recovery](#backup--recovery)
7. [Troubleshooting](#troubleshooting)
8. [Security](#security)
9. [Maintenance](#maintenance)
10. [Emergency Procedures](#emergency-procedures)

---

## 🎯 Overview

LabelMint is a unified containerized infrastructure running on Docker with the following core components:

### Core Services
- **PostgreSQL** - Primary database (Port: 5432)
- **Redis** - Cache and session storage (Port: 6379)
- **MinIO** - Object storage (Port: 9000/9001)
- **Grafana** - Monitoring dashboard (Port: 3001)
- **Prometheus** - Metrics collection (Port: 9090)

### Network Architecture
```
labelmint-frontend    (172.20.0.0/16)  - Web applications
labelmint-backend    (172.21.0.0/16)  - API services
labelmint-data       (172.22.0.0/16)  - Databases & storage
labelmint-monitoring (10.10.0.0/24)   - Monitoring stack
labelmint-bots       (172.23.0.0/16)  - Bot services
```

---

## 🏗️ Service Architecture

### Infrastructure Components

| Service | Container Name | Port | Network | Health Check | Purpose |
|---------|---------------|------|---------|--------------|---------|
| PostgreSQL | labelmint-postgres | 5432 | labelmint-data | pg_isready | Primary Database |
| Redis | labelmint-redis | 6379 | labelmint-data | PING | Cache/Sessions |
| MinIO | labelmint-minio | 9000/9001 | labelmint-data | HTTP 200 | Object Storage |
| Grafana | labelmint-grafana | 3001 | labelmint-monitoring | API /health | Dashboards |
| Prometheus | labelmint-prometheus | 9090 | labelmint-monitoring | HTTP /-/healthy | Metrics |

### Application Services (Ready for Deployment)

| Service | Container Name | Port | Network | Status |
|---------|---------------|------|---------|---------|
| Web App | labelmint-web | 3000 | labelmint-frontend | Ready |
| API Gateway | labelmint-api-gateway | 3104 | labelmint-backend | Ready |
| Labeling Backend | labelmint-labeling-backend | 3101 | labelmint-backend | Ready |
| Payment Backend | labelmint-payment-backend | 3103 | labelmint-backend | Ready |
| Client Bot | labelmint-client-bot | 3105 | labelmint-bots | Ready |
| Worker Bot | labelmint-worker-bot | 3106 | labelmint-bots | Ready |

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop 4.0+
- Docker Compose 2.0+
- 8GB+ RAM
- 20GB+ disk space

### Starting the Infrastructure

```bash
# Clone the repository
git clone <repository-url>
cd labelmint

# Copy environment configuration
cp .env.example .env
# Edit .env with your credentials

# Start all services
docker-compose -f docker-compose.unified.yml up -d

# Verify services are running
./scripts/integration-tests.sh
```

### Access Points

After startup, access the services at:

- **Grafana Dashboard**: http://localhost:3001
  - Username: `admin`
  - Password: `labelmint123secure`

- **MinIO Console**: http://localhost:9001
  - Access Key: `labelmintadmin`
  - Secret Key: `labelmintadmin123`

- **Prometheus**: http://localhost:9090

### Environment Variables

Key environment variables in `.env`:

```bash
# Database Configuration
POSTGRES_USER=labelmint
POSTGRES_PASSWORD=labelmint123secure
POSTGRES_DB=labelmint

# Redis Configuration
REDIS_PASSWORD=redis123secure

# MinIO Configuration
MINIO_ROOT_USER=labelmintadmin
MINIO_ROOT_PASSWORD=labelmintadmin123

# Application Configuration
NODE_ENV=development
JWT_SECRET=labelmint-super-secret-jwt-key-2024
```

---

## 🔧 Service Management

### Docker Compose Commands

```bash
# Start all services
docker-compose -f docker-compose.unified.yml up -d

# Stop all services
docker-compose -f docker-compose.unified.yml down

# Restart specific service
docker-compose -f docker-compose.unified.yml restart postgres

# View logs
docker-compose -f docker-compose.unified.yml logs -f postgres

# Scale services
docker-compose -f docker-compose.unified.yml up -d --scale worker-bot=2
```

### Service Health Monitoring

```bash
# Check container status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check specific container health
docker inspect --format='{{.State.Health.Status}}' labelmint-postgres

# Resource usage
docker stats --no-stream
```

### Database Operations

#### PostgreSQL
```bash
# Connect to database
docker exec -it labelmint-postgres psql -U labelmint -d labelmint

# Create backup
docker exec labelmint-postgres pg_dump -U labelmint labelmint > backup.sql

# Restore backup
docker exec -i labelmint-postgres psql -U labelmint labelmint < backup.sql
```

#### Redis
```bash
# Connect to Redis
docker exec -it labelmint-redis redis-cli -a redis123secure

# Monitor Redis
docker exec labelmint-redis redis-cli -a redis123secure monitor
```

---

## 📊 Monitoring & Alerting

### Grafana Dashboards

Access Grafana at http://localhost:3001 with credentials:
- Username: `admin`
- Password: `labelmint123secure`

#### Available Dashboards
1. **LabelMint Infrastructure Overview** - System-wide metrics
2. **Container Monitoring** - Docker container performance
3. **Database Metrics** - PostgreSQL and Redis performance

### Prometheus Metrics

Access Prometheus at http://localhost:9090

#### Key Metrics to Monitor
- `up` - Service availability
- `container_cpu_usage_seconds_total` - Container CPU usage
- `container_memory_usage_bytes` - Container memory usage
- `node_memory_MemAvailable_bytes` - System memory
- `node_filesystem_avail_bytes` - Disk space

### Alert Rules

Critical alerts configured:
- **Container Down** - Services not responding
- **High CPU Usage** - CPU > 80% for 5+ minutes
- **High Memory Usage** - Memory > 85% for 5+ minutes
- **High Disk Usage** - Disk > 85% for 5+ minutes
- **Database Connection Failure** - Too many DB connections

### Setting Up Notifications

Edit `infrastructure/monitoring/alertmanager/alertmanager.yml` to configure:
- Email notifications
- Slack integration
- PagerDuty integration

```bash
# Reload AlertManager configuration
curl -X POST http://localhost:9093/-/reload
```

---

## 💾 Backup & Recovery

### Automated Backups

```bash
# Run backup script
./scripts/backup-infrastructure.sh

# Schedule daily backups
echo "0 2 * * * /path/to/labelmint/scripts/backup-infrastructure.sh" | crontab -
```

### Manual Backup Procedures

#### Database Backup
```bash
# PostgreSQL
docker exec labelmint-postgres pg_dump -U labelmint labelmint > backup-$(date +%Y%m%d).sql

# Redis
docker exec labelmint-redis redis-cli -a redis123secure BGSAVE
docker cp labelmint-redis:/data/dump.rdb redis-backup-$(date +%Y%m%d).rdb
```

#### Storage Backup
```bash
# MinIO data
docker cp labelmint-minio:/data ./backups/minio-$(date +%Y%m%d)/

# Configuration files
tar -czf config-backup-$(date +%Y%m%d).tar.gz infrastructure/ .env docker-compose.unified.yml
```

### Recovery Procedures

#### Complete System Recovery
```bash
# Stop all services
docker-compose -f docker-compose.unified.yml down

# Restore data volumes
docker volume rm labelmint_postgres_data labelmint_redis_data labelmint_minio_data

# Restore from backup
./scripts/restore-infrastructure.sh --backup-file backup-20251024.tar.gz

# Start services
docker-compose -f docker-compose.unified.yml up -d
```

#### Database Recovery
```bash
# PostgreSQL
docker exec -i labelmint-postgres psql -U labelmint labelmint < backup-20251024.sql

# Redis
docker cp redis-backup-20251024.rdb labelmint-redis:/data/dump.rdb
docker restart labelmint-redis
```

---

## 🔍 Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check Docker daemon
docker info

# Check port conflicts
netstat -tulpn | grep :5432

# Check logs
docker-compose -f docker-compose.unified.yml logs
```

#### Database Connection Issues
```bash
# Verify PostgreSQL is running
docker exec labelmint-postgres pg_isready -U labelmint

# Check network connectivity
docker network ls
docker network inspect labelmint_labelmint-data
```

#### High Resource Usage
```bash
# Check resource usage
docker stats

# Identify resource-heavy containers
docker stats --no-stream | sort -k2 -hr

# Clean up unused resources
docker system prune -a
```

#### Monitoring Issues
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Reload Prometheus config
curl -X POST http://localhost:9090/-/reload

# Check Grafana datasources
curl -u admin:labelmint123secure http://localhost:3001/api/datasources
```

### Log Analysis

#### Service Logs
```bash
# Real-time logs
docker-compose -f docker-compose.unified.yml logs -f

# Specific service logs
docker logs -f labelmint-postgres

# Log history
docker logs --tail 100 labelmint-postgres
```

#### System Logs
```bash
# Docker daemon logs
sudo journalctl -u docker.service

# System resource logs
top -p $(docker inspect --format '{{.State.Pid}}' labelmint-postgres)
```

---

## 🔒 Security

### Access Control

#### Database Security
```bash
# PostgreSQL - Change default passwords
ALTER USER labelmint WITH PASSWORD 'new-secure-password';

# Create read-only user
CREATE USER readonly WITH PASSWORD 'readonly-password';
GRANT CONNECT ON DATABASE labelmint TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
```

#### Redis Security
```bash
# Redis requires authentication (already configured)
redis-cli -a redis123secure

# Disable dangerous commands
CONFIG SET rename-command FLUSHDB ""
CONFIG SET rename-command FLUSHALL ""
CONFIG SET rename-command CONFIG ""
```

#### MinIO Security
```bash
# Access via console: http://localhost:9001
# Default credentials: labelmintadmin / labelmintadmin123

# Create IAM users and policies via MinIO console
```

### Network Security

#### Firewall Configuration
```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 3001/tcp  # Grafana
ufw allow 5432/tcp  # PostgreSQL (internal only)
ufw allow 6379/tcp  # Redis (internal only)
ufw allow 9000/tcp  # MinIO API
ufw allow 9001/tcp  # MinIO Console
```

#### SSL/TLS Configuration
```bash
# For production, configure SSL certificates
# Update nginx/traefik configurations
# Update database SSL settings
```

### Security Best Practices

1. **Regular Updates**: Keep Docker images updated
2. **Password Rotation**: Change passwords regularly
3. **Access Logs**: Monitor access logs
4. **Network Segmentation**: Use private networks
5. **Resource Limits**: Set memory and CPU limits
6. **Health Checks**: Configure proper health checks

---

## 🔄 Maintenance

### Regular Maintenance Tasks

#### Daily
- Check service health status
- Review monitoring dashboards
- Check for critical alerts

#### Weekly
- Review and rotate logs
- Check disk space usage
- Update Docker images if available
- Review backup completion

#### Monthly
- Security updates
- Performance tuning
- Capacity planning
- Documentation updates

### System Updates

#### Docker Images
```bash
# Pull latest images
docker-compose -f docker-compose.unified.yml pull

# Restart with new images
docker-compose -f docker-compose.unified.yml up -d

# Clean old images
docker image prune -a
```

#### System Packages
```bash
# macOS
brew update && brew upgrade

# Linux
sudo apt update && sudo apt upgrade
```

### Performance Tuning

#### Database Optimization
```bash
# PostgreSQL - Check slow queries
docker exec labelmint-postgres psql -U labelmint -d labelmint -c "
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;"

# Redis - Monitor memory usage
docker exec labelmint-redis redis-cli -a redis123secure info memory
```

#### Container Optimization
```bash
# Update resource limits in docker-compose.unified.yml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1'
    reservations:
      memory: 1G
      cpus: '0.5'
```

---

## 🚨 Emergency Procedures

### Service Outage Response

1. **Assess Impact**
   ```bash
   # Check service status
   docker ps --format "table {{.Names}}\t{{.Status}}"

   # Check monitoring
   curl http://localhost:3001/api/health
   curl http://localhost:9090/-/healthy
   ```

2. **Identify Root Cause**
   ```bash
   # Check recent logs
   docker logs --tail 50 labelmint-postgres

   # Check system resources
   docker stats --no-stream
   df -h
   free -h
   ```

3. **Restore Service**
   ```bash
   # Restart affected service
   docker-compose -f docker-compose.unified.yml restart postgres

   # If restart fails, check configuration
   docker-compose -f docker-compose.unified.yml logs postgres
   ```

### Data Recovery

#### Database Corruption
```bash
# Stop the database
docker stop labelmint-postgres

# Restore from latest backup
docker run --rm -v labelmint_postgres_data:/data -v $(pwd):/backup \
  postgres:15 psql -U labelmint -d labelmint < /backup/latest-backup.sql

# Start database
docker start labelmint-postgres
```

#### Storage Failure
```bash
# Check MinIO buckets
mc ls labelmint/

# Restore from backup if needed
mc mirror backup/ labelmint/
```

### Security Incident Response

1. **Isolate Affected Systems**
   ```bash
   # Stop external access
   ufw deny 3001/tcp
   ufw deny 9000/tcp
   ```

2. **Preserve Evidence**
   ```bash
   # Export logs
   docker logs labelmint-postgres > incident-postgres-$(date +%Y%m%d).log

   # Export system state
   docker ps > incident-containers-$(date +%Y%m%d).txt
   docker stats --no-stream > incident-resources-$(date +%Y%m%d).txt
   ```

3. **Investigate and Remediate**
   - Review access logs
   - Change all passwords
   - Update configurations
   - Patch vulnerabilities

---

## 📞 Support & Escalation

### Contact Information

- **Infrastructure Team**: infrastructure@labelmint.com
- **Emergency Contact**: +1-555-LABELMINT
- **Documentation**: https://docs.labelmint.com

### Escalation Levels

1. **Level 1** - Service restarts, basic troubleshooting
2. **Level 2** - Configuration issues, performance tuning
3. **Level 3** - Security incidents, data recovery
4. **Level 4** - Architecture changes, major outages

### Runbooks Location

- **Container Issues**: `infrastructure/monitoring/runbooks/container-issues.md`
- **Database Issues**: `infrastructure/monitoring/runbooks/database-issues.md`
- **Network Issues**: `infrastructure/monitoring/runbooks/network-issues.md`
- **Security Issues**: `infrastructure/monitoring/runbooks/security-issues.md`

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [MinIO Documentation](https://docs.min.io/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)

---

**Document Version**: 1.0
**Last Reviewed**: 2025-10-24
**Next Review Date**: 2025-11-24

For questions or updates, contact the infrastructure team.