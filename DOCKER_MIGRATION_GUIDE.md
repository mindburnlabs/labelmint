# LabelMint Docker Infrastructure Migration Guide

## Overview

This guide walks you through migrating from the current fragmented Docker infrastructure to the unified consolidated setup. This migration resolves network conflicts, eliminates duplicate configurations, and provides a standardized deployment approach.

## 🚨 Pre-Migration Checklist

### 1. Backup Current Configuration
```bash
# Create backup directory
mkdir -p backup/$(date +%Y%m%d)
cp -r docker-compose*.yml backup/$(date +%Y%m%d)/
cp -r infrastructure/ backup/$(date +%Y%m%d)/
cp -r k8s/ backup/$(date +%Y%m%d)/
cp .env* backup/$(date +%Y%m%d)/
```

### 2. Stop Current Services
```bash
# Stop all running compose services
docker-compose down
docker-compose -f infrastructure/docker/docker-compose.yml down
docker-compose -f monitoring/docker-compose.yml down
docker-compose -f services/bots/docker-compose.yml down
```

### 3. Remove Conflicting Networks
```bash
# Remove networks that cause conflicts
docker network rm labelmint-network || true
docker network rm labelmint_default || true
docker network rm infrastructure_labelmint-network || true
```

## 📋 Migration Steps

### Step 1: Environment Configuration

1. **Create new environment file:**
```bash
cp .env.unified.example .env
```

2. **Update environment variables:**
   - Copy values from existing `.env` files
   - Update port mappings to avoid conflicts
   - Verify all required variables are set

3. **Key port changes in unified setup:**
```
Old -> New
Grafana: 3000 -> 3001
Labeling Backend: 3001 -> 3101
Payment Backend: 3003 -> 3103
API Gateway: 3002 -> 3104
```

### Step 2: Update Dockerfile References

1. **Labeling Backend:**
```bash
# Remove old Dockerfile
rm Dockerfile.labeling-backend

# Use unified version (already exists)
# services/labeling-backend/Dockerfile.unified
```

2. **Payment Backend:**
```bash
# Remove old Dockerfile
rm Dockerfile.payment-backend

# Use unified version (already exists)
# services/payment-backend/Dockerfile.unified
```

3. **Telegram Mini App:**
```bash
# Remove old Dockerfile
rm Dockerfile.telegram-mini-app

# Use unified versions (already exist)
# apps/telegram-mini-app/Dockerfile.unified.prod
# apps/telegram-mini-app/Dockerfile.unified.dev
```

### Step 3: Update Service Configurations

1. **API Gateway Configuration:**
```yaml
# Update service URLs in api-gateway config
UPSTREAM_SERVICES: "labeling-backend:3101,payment-backend:3103"
```

2. **Bot Service Configuration:**
```yaml
# Update bot configurations to use new ports
LABELING_API_URL: http://labeling-backend:3101
PAYMENT_API_URL: http://payment-backend:3103
```

3. **Frontend Configuration:**
```yaml
# Update frontend API URLs
NEXT_PUBLIC_API_URL: http://localhost:3101
NEXT_PUBLIC_WS_URL: ws://localhost:3101
```

### Step 4: Monitoring Configuration Migration

1. **Prometheus Configuration:**
   - Unified configuration is in `infrastructure/monitoring/unified-prometheus.yml`
   - Old configurations can be archived:
```bash
mkdir -p archive/monitoring
mv monitoring/prometheus/prometheus.yml archive/monitoring/
mv infrastructure/monitoring/prometheus.yml/prometheus.yml archive/monitoring/
```

2. **Grafana Dashboards:**
   - Consolidate all dashboards to `infrastructure/monitoring/grafana/dashboards/`
   - Update data source configurations if needed

### Step 5: Kubernetes Consolidation

1. **Merge K8s Configurations:**
```bash
# Archive old configurations
mv infrastructure/k8s/ archive/k8s-infrastructure/
# Keep the better structured /k8s/ directory
```

2. **Update Ingress Configurations:**
   - Update service references to new port numbers
   - Ensure proper network policies are in place

## 🚀 Deployment

### Option 1: Full Deployment
```bash
# Deploy all services
./scripts/deploy-unified.sh deploy
```

### Option 2: Debug Deployment
```bash
# Deploy with debug tools (Redis Commander, PgAdmin)
./scripts/deploy-unified.sh deploy debug
```

### Option 3: Gradual Migration

1. **Phase 1 - Data Layer:**
```bash
# Deploy only data services
docker-compose -f docker-compose.unified.yml up -d postgres redis minio
```

2. **Phase 2 - Backend Services:**
```bash
# Deploy backend services
docker-compose -f docker-compose.unified.yml up -d labeling-backend payment-backend
```

3. **Phase 3 - Application Layer:**
```bash
# Deploy web and API gateway
docker-compose -f docker-compose.unified.yml up -d web api-gateway
```

4. **Phase 4 - Monitoring:**
```bash
# Deploy monitoring stack
docker-compose -f docker-compose.unified.yml up -d prometheus grafana loki tempo
```

## ✅ Verification Steps

### 1. Service Health Check
```bash
# Check all services are running
./scripts/deploy-unified.sh status

# Check service health
curl http://localhost:3000/api/health  # Web
curl http://localhost:3101/health      # Labeling Backend
curl http://localhost:3103/health      # Payment Backend
curl http://localhost:3104/health      # API Gateway
```

### 2. Database Connectivity
```bash
# Test database connection
docker-compose -f docker-compose.unified.yml exec postgres psql -U labelmint -d labelmint -c "SELECT version();"
```

### 3. Redis Connectivity
```bash
# Test Redis connection
docker-compose -f docker-compose.unified.yml exec redis redis-cli ping
```

### 4. Monitoring Verification
```bash
# Access Grafana
open http://localhost:3001

# Access Prometheus
open http://localhost:9090

# Check MinIO Console
open http://localhost:9001
```

## 🔄 Rollback Procedure

If you need to rollback to the previous setup:

### 1. Stop Unified Services
```bash
./scripts/deploy-unified.sh stop
```

### 2. Restore Old Configuration
```bash
# Restore from backup
cp -r backup/2024MMDD/* ./
```

### 3. Start Old Services
```bash
# Start with old configuration
docker-compose up -d
```

## 📊 Post-Migration Benefits

1. **No Network Conflicts**: All services use dedicated subnets
2. **Standardized Ports**: Clear port allocation strategy
3. **Unified Monitoring**: Single Prometheus/Grafana setup
4. **Better Security**: Non-root containers, proper secrets management
5. **Improved Maintainability**: Single source of truth for configuration
6. **Easier Debugging**: Consistent logging and health checks

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use:**
```bash
# Check what's using the port
lsof -i :3001
# Update .env file to use different port
```

2. **Network Conflicts:**
```bash
# Remove conflicting networks
docker network ls
docker network rm <conflicting-network>
```

3. **Permission Issues:**
```bash
# Fix directory permissions
sudo chown -R $USER:$USER ./
```

4. **Database Connection Issues:**
```bash
# Check database logs
docker-compose -f docker-compose.unified.yml logs postgres
```

### Health Check Failures

1. **Increase Health Check Timeout:**
```yaml
# In docker-compose.unified.yml
healthcheck:
  start_period: 120s  # Increase from 60s
```

2. **Manual Service Restart:**
```bash
# Restart specific service
docker-compose -f docker-compose.unified.yml restart labeling-backend
```

## 📞 Support

If you encounter issues during migration:

1. Check logs: `./scripts/deploy-unified.sh logs`
2. Verify configuration: `./scripts/deploy-unified.sh status`
3. Review this guide for common solutions
4. Check the infrastructure analysis document for detailed configuration

## 🎯 Next Steps

After successful migration:

1. **Archive Old Configuration:** Move old files to an archive directory
2. **Update Documentation:** Ensure all team documentation reflects new setup
3. **Team Training:** Conduct training session on new deployment process
4. **CI/CD Updates:** Update deployment pipelines to use new unified setup
5. **Monitoring Setup:** Configure alerts and dashboards in Grafana
6. **Security Review:** Review new security configurations and access controls

---

**Migration Date**: October 24, 2025
**Infrastructure Consolidation Agent**
**Next Review**: 30 days post-migration