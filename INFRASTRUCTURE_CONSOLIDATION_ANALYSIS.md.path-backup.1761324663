# LabelMint Infrastructure Consolidation Analysis

## Executive Summary

This document identifies critical infrastructure conflicts and consolidation opportunities in the LabelMint repository. The analysis reveals significant duplication, network conflicts, and configuration drift across 16+ Docker compose files and multiple infrastructure directories.

## 🔴 Critical Conflicts Identified

### 1. Network Conflicts
- **Primary Issue**: Multiple compose files use the same subnet `172.20.0.0/16`
  - `/docker-compose.yml` (main): `172.20.0.0/16`
  - `/services/bots/docker-compose.yml`: `172.20.0.0/16`
  - `/infrastructure/docker/docker-compose.yml`: `172.20.0.0/16`

### 2. Port Conflicts
- **Grafana Port Conflicts**:
  - Main compose: `3000:3000`
  - Infrastructure compose: `3003:3000`
  - Monitoring compose: `3000:3000`

- **Redis Port Variations**:
  - All compose files expose `6379:6379` (potential conflicts)

- **API Backend Port Conflicts**:
  - Payment backend: Exposed as `3003` in main compose, referenced as `3000` in bots compose

### 3. Service Name Inconsistencies
- Container naming patterns are inconsistent across compose files
- Some use `labelmint-{service}` while others use `{service}` only
- Health check configurations vary significantly

## 📊 Infrastructure Inventory

### Docker Compose Files (16 total)
1. `/docker-compose.yml` (main) - 590 lines, comprehensive stack
2. `/infrastructure/docker/docker-compose.yml` - 373 lines, infrastructure focus
3. `/services/bots/docker-compose.yml` - 106 lines, bot services only
4. `/monitoring/docker-compose.yml` - 283 lines, monitoring stack
5. `/database/docker-compose.yml` - Database services
6. `/services/api-gateway/docker-compose.yml` - API gateway
7. `/services/api-gateway/docker-compose.prod.yml` - Production API gateway
8. `/docker-compose.prod.yml` - Production configuration
9. `/docker-compose.test.yml` - Test environment
10. `/docker-compose.enterprise.yml` - Enterprise features

### Duplicate Dockerfiles Analysis

#### Labeling Backend
- **Location A**: `/Dockerfile.labeling-backend` (58 lines)
- **Location B**: `/services/labeling-backend/Dockerfile` (60 lines)
- **Differences**:
  - Location A: Uses `pnpm@9.15.1`, exposes `3001`, healthcheck with `node dist/healthcheck.js`
  - Location B: Uses build-time `pnpm`, includes `dumb-init`, more comprehensive healthcheck with `curl`
- **Recommendation**: Use Location B (more robust production setup)

#### Payment Backend
- **Location A**: `/Dockerfile.payment-backend` (58 lines)
- **Location B**: `/services/payment-backend/Dockerfile.payments` (69 lines)
- **Differences**:
  - Location A: Uses Node.js 20, pnpm, exposes `3000`
  - Location B: Uses Node.js 18, npm, different entry point, exposes `3001`
- **Recommendation**: Standardize on Node.js 20 version, use pnpm, resolve port discrepancy

#### Telegram Mini App
- **Location A**: `/Dockerfile.telegram-mini-app` (36 lines, nginx-based)
- **Location B**: `/apps/telegram-mini-app/Dockerfile` (12 lines, dev-focused)
- **Differences**: Completely different purposes
  - Location A: Production nginx build
  - Location B: Development server
- **Recommendation**: Keep both for different purposes, rename for clarity

### Monitoring Configuration Conflicts

#### Prometheus Configurations (3 files)
1. `/monitoring/prometheus/prometheus.yml` (224 lines) - Comprehensive with Kubernetes
2. `/infrastructure/monitoring/prometheus.yml/prometheus.yml` (242 lines) - Production-focused
3. `/services/api-gateway/monitoring/prometheus.yml` (30 lines) - Simple gateway monitoring

**Issues**:
- Different external labels (`labelmintit` vs `labelmint-prod`)
- Different scraping targets and intervals
- Inconsistent alertmanager configurations
- Different remote write configurations

### Kubernetes Infrastructure Duplication

#### Duplicate K8s Directories
- **Primary**: `/k8s/` - 18 files, Kustomize-based structure
- **Duplicate**: `/infrastructure/k8s/` - 11 files, legacy structure

**Conflicts**:
- Different naming conventions
- Different resource configurations
- Duplicate service definitions
- Inconsistent labeling strategies

## 🏗️ Proposed Consolidation Structure

### 1. Unified Network Architecture
```
 Networks:
   - labelmint-frontend: 172.20.0.0/16 (Web apps, nginx)
   - labelmint-backend: 172.21.0.0/16 (APIs, services)
   - labelmint-data: 172.22.0.0/16 (Databases, Redis)
   - labelmint-monitoring: 10.10.0.0/24 (Monitoring stack)
   - labelmint-bots: 172.23.0.0/16 (Bot services)
```

### 2. Port Allocation Strategy
```
 Frontend: 3000-3099
 Backend APIs: 3100-3199
 Databases: 5432, 6379, 27017
 Monitoring: 9090-9099, 3000-3100
 Storage: 9000-9099
 Debug Tools: 8080-8099
```

### 3. Consolidated Directory Structure
```
/
├── docker-compose.yml (main unified)
├── docker-compose.override.yml (development)
├── docker-compose.prod.yml (production)
├── docker-compose.monitoring.yml (monitoring stack)
├── services/
│   ├── api-gateway/
│   ├── labeling-backend/
│   ├── payment-backend/
│   ├── bots/
│   └── web/
├── infrastructure/
│   ├── docker/ (removed - merged to main)
│   ├── monitoring/ (consolidated configs)
│   ├── k8s/ (consolidated from both locations)
│   ├── terraform/
│   └── security/
└── apps/
    └── telegram-mini-app/
```

## 📋 Detailed Action Items

### Phase 1: Critical Conflict Resolution (Week 1)
1. **Resolve Network Conflicts**
   - Update bot services compose to use `172.23.0.0/16`
   - Update infrastructure compose to use `172.21.0.0/16`
   - Update monitoring compose to use `10.10.0.0/24`

2. **Resolve Port Conflicts**
   - Standardize Grafana to port `3000` (main), move others to `3001-3009`
   - Resolve payment backend port discrepancy (standardize on `3003`)
   - Document port allocation strategy

3. **Container Naming Standardization**
   - Implement consistent naming: `labelmint-{service}-{env}`
   - Update all compose files to follow convention

### Phase 2: Dockerfile Standardization (Week 2)
1. **LabelMint Backend Dockerfile**
   - Adopt `/services/labeling-backend/Dockerfile` as standard
   - Remove `/Dockerfile.labeling-backend`
   - Update all references

2. **Payment Backend Dockerfile**
   - Create unified version combining best of both
   - Standardize on Node.js 20, pnpm
   - Expose port `3003` consistently

3. **Telegram Mini App Dockerfiles**
   - Rename for clarity:
     - `/apps/telegram-mini-app/Dockerfile.dev`
     - `/apps/telegram-mini-app/Dockerfile.prod` (move from root)

### Phase 3: Monitoring Consolidation (Week 3)
1. **Prometheus Configuration**
   - Merge into single authoritative configuration
   - Environment-specific variants (dev/staging/prod)
   - Remove duplicate files

2. **Grafana Configuration**
   - Consolidate dashboards and datasources
   - Standardize provisioning configurations

3. **AlertManager Configuration**
   - Unified routing and receiver configuration
   - Environment-specific contact points

### Phase 4: Kubernetes Consolidation (Week 4)
1. **Merge K8s Directories**
   - Consolidate `/k8s/` and `/infrastructure/k8s/`
   - Adopt Kustomize-based structure from `/k8s/`
   - Remove legacy configurations

2. **Standardize Resource Naming**
   - Consistent labeling across all resources
   - Standard namespace strategy

### Phase 5: Docker Compose Unification (Week 5)
1. **Create Hierarchical Compose Structure**
   - Main compose with core services
   - Override files for different environments
   - Optional services via profiles

2. **Service Dependencies**
   - Resolve circular dependencies
   - Implement proper startup ordering
   - Standardize health checks

## 🔧 Implementation Guidelines

### Environment Variables Standardization
```bash
# Database
POSTGRES_PASSWORD=secure_password
REDIS_PASSWORD=secure_password

# Application
NODE_ENV=production
JWT_SECRET=secure_jwt_secret
LOG_LEVEL=info

# Monitoring
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=secure_grafana_password
```

### Health Check Standards
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:PORT/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

### Resource Limits Standardization
```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '1'
    reservations:
      memory: 512M
      cpus: '0.5'
```

## 📈 Expected Benefits

1. **Reduced Complexity**: From 16 compose files to 4-5 well-organized files
2. **Eliminated Conflicts**: No more network or port collisions
3. **Improved Maintainability**: Single source of truth for configurations
4. **Better Developer Experience**: Consistent patterns across services
5. **Production Readiness**: Standardized monitoring and alerting
6. **Cost Efficiency**: Optimized resource usage and deployment complexity

## 🚨 Migration Risks

1. **Service Downtime**: Network changes may require coordinated restarts
2. **Configuration Loss**: Some custom configurations might be lost in consolidation
3. **Team Adaptation**: Teams need to learn new structure and patterns
4. **Rollback Complexity**: Changes are extensive, rollback planning essential

## 📅 Timeline

- **Week 1**: Critical conflicts resolution (networks, ports)
- **Week 2**: Dockerfile standardization
- **Week 3**: Monitoring consolidation
- **Week 4**: Kubernetes consolidation
- **Week 5**: Docker compose unification
- **Week 6**: Testing, documentation, and training

## ✅ Success Criteria

1. All network conflicts resolved
2. All port conflicts eliminated
3. Duplicate configurations consolidated
4. Monitoring stack unified and functional
5. Kubernetes manifests consolidated
6. Documentation updated
7. Team trained on new structure
8. Production deployment successful