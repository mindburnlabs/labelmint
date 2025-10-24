# 🏗️ LabelMint Infrastructure

Comprehensive infrastructure setup for the LabelMint data labeling platform, designed for scalability, security, and high availability across cloud and on-premises deployments.

## 🎯 Architecture Overview

LabelMint infrastructure follows a **multi-layered architecture** with clear separation of concerns, supporting both development and production environments:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloud Infrastructure                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   AWS ECS   │  │  Kubernetes │  │   Docker    │            │
│  │             │  │             │  │  Compose    │            │
│  │ • Fargate  │  │ • EKS       │  │ • Local     │            │
│  │ • RDS      │  │ • RDS       │  │ • Staging   │            │
│  │ • ElastiCache│ │ • ElastiCache│ │ • Testing   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    Container Runtime   │
                    │                       │
                    │ ┌─────┐ ┌─────┐ ┌─────┐ │
                    │ │Web  │ │API  │ │Bot  │ │
                    │ │App  │ │GW   │ │Svc  │ │
                    │ └─────┘ └─────┘ └─────┘ │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │    Data & Storage     │
                    │                       │
                    │ ┌─────┐ ┌─────┐ ┌─────┐ │
                    │ │PostgreSQL│Redis│S3/MinIO│ │
                    │ └─────┘ └─────┘ └─────┘ │
                    └───────────────────────┘
```

## 📁 Infrastructure Components

### 🐳 Docker Configuration (`docker/`)
Container orchestration and local development setup.

**Features:**
- **Multi-environment** Docker Compose files
- **Service Dependencies** and startup ordering
- **Health Checks** and readiness probes
- **Volume Management** for data persistence
- **Network Isolation** for security
- **Environment Configuration** management

**Quick Start:**
```bash
# Development environment
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d

# Production environment
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d

# View services
docker-compose ps
```

**Services Included:**
- **Web Applications** (Next.js apps)
- **Backend Services** (API Gateway, Labeling, Payment)
- **Telegram Bots** (Client & Worker)
- **Databases** (PostgreSQL, Redis)
- **Storage** (MinIO/S3)
- **Monitoring** (Prometheus, Grafana, Loki)

### ☸️ Kubernetes Configuration (`k8s/`)
Production-grade Kubernetes deployment manifests.

**Features:**
- **Declarative Configuration** with YAML manifests
- **Resource Management** and limits
- **Health Checks** and probes
- **Service Discovery** and load balancing
- **ConfigMaps** and Secrets management
- **Ingress** configuration with SSL
- **Auto-scaling** policies

**Cluster Structure:**
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: labelmint
  labels:
    name: labelmint

# k8s/deployments/
├── web-app.yaml
├── admin-dashboard.yaml
├── api-gateway.yaml
├── labeling-backend.yaml
├── payment-backend.yaml
└── telegram-bots.yaml
```

**Quick Start:**
```bash
# Apply all manifests
kubectl apply -f k8s/

# Apply specific component
kubectl apply -f k8s/deployments/

# Check deployment status
kubectl get pods -n labelmint
kubectl get services -n labelmint
```

### 🌩️ Cloud Infrastructure (`terraform/`)
Infrastructure as Code with Terraform for AWS deployment.

**Features:**
- **Multi-environment** support (dev/staging/prod)
- **Modular Design** with reusable components
- **State Management** with remote backend
- **Security Best Practices** with IAM and VPC
- **Cost Optimization** with auto-scaling
- **Monitoring Integration** with CloudWatch

**Components:**
- **Compute**: ECS Fargate with auto-scaling
- **Database**: RDS PostgreSQL with read replicas
- **Cache**: ElastiCache Redis cluster
- **Storage**: S3 buckets with lifecycle policies
- **Network**: VPC with public/private subnets
- **Security**: WAF, security groups, KMS encryption

**Quick Start:**
```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var-file=environments/production.tfvars

# Apply configuration
terraform apply -var-file=environments/production.tfvars
```

**Environments:**
- **Development**: Single-region, minimal resources
- **Staging**: Multi-AZ, production-like setup
- **Production**: Multi-region, high availability

### 📊 Monitoring Stack (`monitoring/`)
Comprehensive observability and alerting solution.

**Architecture:**
```
Applications ──► Prometheus ──► Grafana
     │               │              │
     ▼               ▼              ▼
   Logs ──► Loki ──► AlertManager
     │               │              │
     ▼               ▼              ▼
 Traces ──► Jaeger ──► Notifications
```

**Services:**
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation and querying
- **Jaeger**: Distributed tracing
- **AlertManager**: Alert routing and management

**Quick Start:**
```bash
cd infrastructure/monitoring

# Start monitoring stack
docker-compose up -d

# Access services
# Grafana: http://localhost:3000 (admin/admin)
# Prometheus: http://localhost:9090
# Jaeger: http://localhost:16686
```

**Key Features:**
- **Pre-built Dashboards** for all services
- **Custom Alerting Rules** with notifications
- **Log Aggregation** with structured logging
- **Performance Monitoring** with APM
- **Business Metrics** tracking

## 🔧 Configuration Management

### Environment Variables
Centralized configuration management across all infrastructure components:

```bash
# Core Configuration
NODE_ENV=production
ENVIRONMENT=production
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379

# Security
JWT_SECRET=your-jwt-secret
API_SECRET_KEY=your-api-secret

# External Services
TON_API_KEY=your-ton-api-key
TELEGRAM_BOT_TOKEN=your-bot-token

# Monitoring
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_ENABLED=true
```

### Service Configuration
```typescript
// infrastructure/config/services.ts
export const serviceConfig = {
  web: {
    port: 3000,
    replicas: 3,
    resources: {
      cpu: '500m',
      memory: '512Mi',
    },
  },
  apiGateway: {
    port: 3104,
    replicas: 2,
    resources: {
      cpu: '250m',
      memory: '256Mi',
    },
  },
  databases: {
    postgres: {
      host: 'postgres',
      port: 5432,
      database: 'labelmint',
      poolSize: 20,
    },
    redis: {
      host: 'redis',
      port: 6379,
      maxRetries: 3,
    },
  },
};
```

## 🚀 Deployment Strategies

### 1. Development Environment
**Purpose**: Local development and testing

**Setup:**
```bash
# Using Docker Compose
docker-compose -f docker/docker-compose.dev.yml up -d

# Or locally
pnpm install
pnpm run dev
```

**Features:**
- **Hot Reload** for fast development
- **Debug Tools** and verbose logging
- **Mock Services** for external dependencies
- **Data Seeding** for consistent test data

### 2. Staging Environment
**Purpose**: Pre-production validation

**Setup:**
```bash
# Using Kubernetes
kubectl apply -f k8s/environments/staging/

# Or Terraform
terraform apply -var-file=environments/staging.tfvars
```

**Features:**
- **Production-like** configuration
- **Automated Testing** integration
- **Performance Testing** capabilities
- **Security Scanning** and validation

### 3. Production Environment
**Purpose**: Live production deployment

**Setup:**
```bash
# Using Terraform (recommended)
terraform apply -var-file=environments/production.tfvars

# Or Kubernetes with Helm
helm install labelmint ./charts/labelmint --namespace production
```

**Features:**
- **High Availability** with multi-AZ deployment
- **Auto-scaling** based on demand
- **Backup and Recovery** procedures
- **Monitoring and Alerting** configured
- **Security Hardening** applied

## 🔐 Security Architecture

### Network Security
- **VPC Isolation** with private subnets
- **Security Groups** with least privilege
- **WAF Integration** for DDoS protection
- **SSL/TLS** encryption everywhere
- **Bastion Hosts** for admin access

### Application Security
- **Container Security** with image scanning
- **Secrets Management** with AWS Secrets Manager
- **IAM Roles** with least privilege
- **Encryption at Rest** and in transit
- **Audit Logging** with CloudTrail

### Compliance
- **SOC 2 Type II** compliant infrastructure
- **GDPR** data protection measures
- **PCI DSS** for payment processing
- **ISO 27001** security standards
- **HIPAA** compliance for healthcare data

## 📊 Performance Optimization

### Database Optimization
```sql
-- PostgreSQL configuration
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

-- Index optimization
CREATE INDEX CONCURRENTLY idx_tasks_created_at ON tasks(created_at);
CREATE INDEX CONCURRENTLY idx_users_status ON users(status);
```

### Caching Strategy
- **Redis** for session storage and caching
- **Application-level** caching with TTL
- **CDN** for static assets (CloudFront)
- **Database Query** result caching
- **API Response** caching with Vary headers

### Auto-scaling Configuration
```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: labelmint-web-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: labelmint-web
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## 🔍 Monitoring & Observability

### Health Checks
```typescript
// Health endpoint configuration
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      storage: await checkStorage(),
      external: await checkExternalServices(),
    },
  };
  res.json(health);
});
```

### Metrics Collection
```typescript
// Prometheus metrics
import { register, Counter, Histogram, Gauge } from 'prom-client';

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});
```

### Alerting Rules
```yaml
# Prometheus alert rules
groups:
- name: labelmint.rules
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second"

  - alert: DatabaseConnectionHigh
    expr: pg_stat_activity_count > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High database connections"
      description: "Database has {{ $value }} active connections"
```

## 🛠️ Infrastructure Management

### CI/CD Integration
```yaml
# .github/workflows/infrastructure.yml
name: Infrastructure Deployment
on:
  push:
    paths: ['infrastructure/**']
    branches: [main, develop]

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: hashicorp/setup-terraform@v2
      - run: terraform fmt -check
      - run: terraform validate
      - run: terraform plan
      - if: github.ref == 'refs/heads/main'
        run: terraform apply -auto-approve

  kubernetes:
    runs-on: ubuntu-latest
    needs: terraform
    steps:
      - uses: actions/checkout@v3
      - uses: azure/setup-kubectl@v3
      - run: kubectl apply -f k8s/
```

### Backup Strategy
```bash
#!/bin/bash
# infrastructure/scripts/backup.sh

# Database backup
aws rds create-db-snapshot \
  --db-instance-identifier labelmint-prod \
  --db-snapshot-identifier labelmint-backup-$(date +%Y%m%d)

# S3 backup
aws s3 sync s3://labelmint-data/ s3://labelmint-backups/$(date +%Y%m%d)/

# Terraform state backup
aws s3 cp s3://labelmint-terraform-state/terraform.tfstate \
  s3://labelmint-backups/terraform/$(date +%Y%m%d)/terraform.tfstate
```

### Disaster Recovery
```bash
#!/bin/bash
# infrastructure/scripts/disaster-recovery.sh

# 1. Restore database from latest snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier labelmint-prod-restored \
  --db-snapshot-identifier labelmint-backup-latest

# 2. Restore S3 data
aws s3 sync s3://labelmint-backups/latest/ s3://labelmint-data-restored/

# 3. Update application configuration
kubectl set env deployment/labelmint-web \
  DATABASE_URL=postgresql://user:pass@restored-host:5432/db

# 4. Verify service health
kubectl get pods -n labelmint
curl -f https://api.labelmint.com/health
```

## 🧪 Testing Infrastructure

### Load Testing
```yaml
# infrastructure/load-testing/k6-config.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  let response = http.get('https://api.labelmint.com/health');
  check(response, {
    'status was 200': (r) => r.status == 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

### Chaos Testing
```yaml
# infrastructure/chaos/chaos-engine.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: labelmint-pod-failure
spec:
  selector:
    labelSelectors:
      app: labelmint-web
  mode: one
  action: pod-failure
  duration: '30s'
```

## 📚 Documentation Structure

```
infrastructure/
├── README.md                 # This file
├── docker/                   # Docker configurations
│   ├── README.md            # Docker setup guide
│   ├── docker-compose.yml   # Base configuration
│   ├── docker-compose.dev.yml
│   └── docker-compose.prod.yml
├── k8s/                      # Kubernetes manifests
│   ├── README.md            # Kubernetes guide
│   ├── namespace.yaml       # Namespace configuration
│   ├── deployments/         # Application deployments
│   ├── services/            # Service definitions
│   └── ingress/             # Ingress configuration
├── terraform/               # Infrastructure as Code
│   ├── README.md            # Terraform guide
│   ├── main.tf              # Main configuration
│   ├── variables.tf         # Variable definitions
│   ├── outputs.tf           # Output values
│   └── environments/        # Environment-specific configs
├── monitoring/              # Observability stack
│   ├── README.md            # Monitoring guide
│   ├── prometheus/          # Prometheus configuration
│   ├── grafana/             # Grafana dashboards
│   ├── loki/                # Log aggregation
│   └── alertmanager/        # Alert management
├── scripts/                 # Utility scripts
│   ├── deploy.sh            # Deployment script
│   ├── backup.sh            # Backup script
│   └── disaster-recovery.sh # Recovery procedures
└── docs/                    # Additional documentation
    ├── architecture.md      # Architecture overview
    ├── security.md          # Security policies
    └── performance.md       # Performance tuning
```

## 🚀 Best Practices

### Infrastructure as Code
- **Version Control** all infrastructure code
- **Modular Design** with reusable components
- **Automated Testing** for infrastructure changes
- **Documentation** with clear explanations
- **Consistent Naming** conventions

### Security
- **Principle of Least Privilege** for all access
- **Regular Security Audits** and updates
- **Secrets Management** with rotation
- **Network Segmentation** for isolation
- **Compliance Monitoring** and reporting

### Performance
- **Right-sizing** of resources
- **Auto-scaling** based on metrics
- **Caching Strategies** at multiple levels
- **Database Optimization** with proper indexing
- **CDN Usage** for static assets

### Reliability
- **Multi-AZ Deployments** for high availability
- **Health Checks** and automated recovery
- **Backup and Recovery** procedures
- **Monitoring and Alerting** coverage
- **Disaster Recovery** planning and testing

## 🤝 Contributing

### Infrastructure Changes
1. **Plan Changes** with Terraform plan
2. **Review Code** with peer review
3. **Test in Staging** before production
4. **Document Changes** with clear explanations
5. **Monitor Impact** after deployment

### Security Updates
1. **Regular Patching** of all components
2. **Vulnerability Scanning** of images
3. **Security Reviews** quarterly
4. **Incident Response** planning
5. **Compliance Audits** annually

## 📄 License

Infrastructure code is licensed under the MIT License. See [LICENSE](../../LICENSE) file for details.

---

**🚀 Built with ❤️ by the LabelMint Team**

For scalable, secure, and reliable cloud infrastructure.