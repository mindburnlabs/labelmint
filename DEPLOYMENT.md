# 🚀 LabelMint Deployment Guide

Comprehensive deployment guide for LabelMint across all environments including development, staging, and production.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Environment Strategy](#environment-strategy)
3. [Prerequisites](#prerequisites)
4. [Development Deployment](#development-deployment)
5. [Staging Deployment](#staging-deployment)
6. [Production Deployment](#production-deployment)
7. [Infrastructure Deployment](#infrastructure-deployment)
8. [Database Deployment](#database-deployment)
9. [Monitoring & Observability](#monitoring--observability)
10. [Security & Compliance](#security--compliance)
11. [CI/CD Pipeline](#cicd-pipeline)
12. [Rollback Procedures](#rollback-procedures)
13. [Troubleshooting](#troubleshooting)
14. [Maintenance](#maintenance)

## Deployment Overview

LabelMint uses a modern, containerized deployment strategy with:

- **Container Architecture**: Docker containers orchestrated by Kubernetes
- **GitOps Approach**: Infrastructure as code with automated deployments
- **Blue-Green Deployments**: Zero-downtime deployments
- **Multi-Environment**: Development, staging, and production environments
- **Automated CI/CD**: GitHub Actions for continuous integration and deployment

### Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Development   │    │     Staging     │    │   Production    │
│   (Local)       │    │  (AWS/EKS)      │    │  (AWS/EKS)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 Git Repository (GitHub)                    │
│                 ┌─────────────────────┐                   │
│                 │   CI/CD Pipeline     │                   │
│                 │  (GitHub Actions)   │                   │
│                 └─────────────────────┘                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                Infrastructure (AWS)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │  EKS Cluster│ │   RDS       │ │      ElastiCache    │   │
│  │             │ │ PostgreSQL  │ │      Redis          │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Environment Strategy

### Environment Types

| Environment | Purpose | Infrastructure | Data | Access |
|-------------|---------|----------------|------|--------|
| **Development** | Local development & testing | Local Docker | Sample data | Developers |
| **Staging** | Pre-production testing | AWS EKS (small) | Anonymized test data | Team |
| **Production** | Live user traffic | AWS EKS (large) | Real user data | Ops team |

### Environment Configuration

```yaml
# environments/development.yaml
environment: development
namespace: labelmint-dev
replicas:
  web: 1
  api: 1
  worker: 1
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

# environments/staging.yaml
environment: staging
namespace: labelmint-staging
replicas:
  web: 2
  api: 2
  worker: 2
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 1Gi

# environments/production.yaml
environment: production
namespace: labelmint-prod
replicas:
  web: 3
  api: 3
  worker: 3
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
```

## Prerequisites

### Tools Required

- **Docker** 20.10+ and **Docker Compose** 2.0+
- **kubectl** 1.24+ and **helm** 3.x
- **AWS CLI** 2.x configured with appropriate permissions
- **Node.js** 20+ and **pnpm** 9.15.1+
- **Git** 2.30+

### AWS Permissions

Required AWS IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "eks:*",
        "ecr:*",
        "rds:*",
        "elasticache:*",
        "iam:*",
        "s3:*",
        "route53:*",
        "cloudfront:*",
        "logs:*",
        "cloudwatch:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### Domain Configuration

- **Primary Domain**: `labelmint.it`
- **API Domain**: `api.labelmint.it`
- **CDN Domain**: `cdn.labelmint.it`
- **Monitoring**: `grafana.labelmint.it`

## Development Deployment

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/mindburn-labs/labelmint.git
cd labelmint

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your local configuration

# 4. Start infrastructure services
docker-compose -f docker-compose.dev.yml up -d

# 5. Run database migrations
pnpm run db:migrate

# 6. Seed database with sample data
pnpm run db:seed

# 7. Start all services
pnpm run dev
```

### Development Services

| Service | Port | Description |
|---------|------|-------------|
| Web App | 3002 | Next.js web application |
| Admin Dashboard | 3000 | Admin interface |
| API Server | 3001 | REST API backend |
| Telegram Mini App | 5173 | Vite dev server |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache & sessions |
| MinIO | 9000/9001 | S3-compatible storage |

### Development Scripts

```bash
# Start all services
./scripts/dev/start-all.sh

# Stop all services
./scripts/dev/stop-all.sh

# Reset environment
./scripts/dev/reset.sh

# Check service health
./scripts/dev/health-check.sh
```

## Staging Deployment

### Staging Infrastructure

Staging runs on AWS EKS with a scaled-down infrastructure:

```yaml
# infrastructure/terraform/staging/main.tf
module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  cluster_name    = "labelmint-staging"
  cluster_version = "1.28"
  subnets         = module.vpc.private_subnets
  node_groups = {
    main = {
      desired_capacity = 2
      max_capacity     = 3
      min_capacity     = 1
      instance_types   = ["t3.medium"]
    }
  }
}
```

### Deploy to Staging

```bash
# 1. Ensure you're on the develop branch
git checkout develop
git pull origin develop

# 2. Build and push Docker images
docker build -t labelmint/web:staging ./apps/web
docker build -t labelmint/api:staging ./services/labeling-backend
docker build -t labelmint/payment:staging ./services/payment-backend

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
docker push $ECR_REGISTRY/labelmint/web:staging
docker push $ECR_REGISTRY/labelmint/api:staging
docker push $ECR_REGISTRY/labelmint/payment:staging

# 3. Deploy to Kubernetes
kubectl apply -f infrastructure/k8s/staging/
kubectl apply -f infrastructure/k8s/staging/deployments/

# 4. Wait for rollout
kubectl rollout status deployment/web-app -n labelmint-staging
kubectl rollout status deployment/api-server -n labelmint-staging

# 5. Run smoke tests
./scripts/testing/smoke-tests.sh staging
```

### Staging Configuration

```yaml
# infrastructure/k8s/staging/deployments/web-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: labelmint-staging
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: web-app
        image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/labelmint/web:staging
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "staging"
        - name: API_URL
          value: "https://api-staging.labelmint.it"
        resources:
          requests:
            cpu: 250m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Automated Staging Deployment

```bash
# CI/CD automatically deploys to staging on push to develop
git checkout develop
git commit -m "feat: add new feature"
git push origin develop

# Monitor deployment in GitHub Actions
# Deployment automatically runs smoke tests
# Notification sent to Slack on completion
```

## Production Deployment

### Production Infrastructure

Production runs on AWS EKS with high-availability configuration:

```yaml
# infrastructure/terraform/production/main.tf
module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  cluster_name    = "labelmint-production"
  cluster_version = "1.28"
  subnets         = module.vpc.private_subnets
  node_groups = {
    main = {
      desired_capacity = 3
      max_capacity     = 6
      min_capacity     = 2
      instance_types   = ["t3.large"]
      disk_size        = 50
    }
    spot = {
      desired_capacity = 2
      max_capacity     = 4
      min_capacity     = 0
      instance_types   = ["t3.medium"]
      spot_price       = "0.02"
      capacity_type    = "SPOT"
    }
  }
}
```

### Production Deployment Process

#### 1. Preparation

```bash
# Ensure develop branch is stable
git checkout develop
git pull origin develop

# Run full test suite
pnpm test:ci

# Security scan
./scripts/security/security-scan.sh

# Performance tests
./scripts/performance/load-tests.sh
```

#### 2. Create Release

```bash
# Create release branch
git checkout -b release/v1.2.0

# Update version numbers
echo "1.2.0" > VERSION

# Build production images
docker build -t labelmint/web:1.2.0 ./apps/web
docker build -t labelmint/api:1.2.0 ./services/labeling-backend
docker build -t labelmint/payment:1.2.0 ./services/payment-backend

# Tag and push images
docker tag labelmint/web:1.2.0 $ECR_REGISTRY/labelmint/web:1.2.0
docker tag labelmint/api:1.2.0 $ECR_REGISTRY/labelmint/api:1.2.0
docker tag labelmint/payment:1.2.0 $ECR_REGISTRY/labelmint/payment:1.2.0

docker push $ECR_REGISTRY/labelmint/web:1.2.0
docker push $ECR_REGISTRY/labelmint/api:1.2.0
docker push $ECR_REGISTRY/labelmint/payment:1.2.0
```

#### 3. Blue-Green Deployment

```bash
# Deploy to blue environment (current production)
kubectl apply -f infrastructure/k8s/production/blue/

# Verify blue deployment
kubectl rollout status deployment/web-app-blue -n labelmint-prod
./scripts/testing/smoke-tests.sh blue

# Update DNS to point to blue
kubectl patch service web-app-service -p '{"spec":{"selector":{"version":"blue"}}}'

# Deploy to green environment (new version)
kubectl apply -f infrastructure/k8s/production/green/

# Verify green deployment
kubectl rollout status deployment/web-app-green -n labelmint-prod
./scripts/testing/smoke-tests.sh green

# Health checks
./scripts/monitoring/health-check.sh green

# Switch traffic to green
kubectl patch service web-app-service -p '{"spec":{"selector":{"version":"green"}}}'

# Monitor for issues
./scripts/monitoring/observe.sh 300 # 5 minutes

# Keep blue for rollback
kubectl scale deployment web-app-blue --replicas=1 -n labelmint-prod
```

#### 4. Production Validation

```bash
# Run comprehensive health checks
./scripts/production/health-check.sh

# Load testing
./scripts/production/load-test.sh

# Security validation
./scripts/production/security-validation.sh

# Performance monitoring
./scripts/production/performance-check.sh

# User acceptance testing
./scripts/production/uat.sh
```

### Production Deployment Script

```bash
#!/bin/bash
# scripts/production/deploy.sh

set -e

VERSION=$1
ENVIRONMENT=${2:-production}

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version> [environment]"
    exit 1
fi

echo "🚀 Deploying LabelMint v$VERSION to $ENVIRONMENT"

# Pre-deployment checks
echo "📋 Running pre-deployment checks..."
./scripts/pre-deployment/checks.sh

# Backup current deployment
echo "💾 Creating deployment backup..."
./scripts/production/backup.sh

# Deploy
echo "🔄 Deploying application..."
kubectl apply -f infrastructure/k8s/$ENVIRONMENT/

# Wait for rollout
echo "⏳ Waiting for rollout completion..."
kubectl rollout status deployment/web-app -n labelmint-$ENVIRONMENT
kubectl rollout status deployment/api-server -n labelmint-$ENVIRONMENT

# Health checks
echo "🏥 Running health checks..."
./scripts/production/health-check.sh

# Smoke tests
echo "💨 Running smoke tests..."
./scripts/testing/smoke-tests.sh $ENVIRONMENT

# Performance validation
echo "📊 Validating performance..."
./scripts/production/performance-validation.sh

echo "✅ Deployment v$VERSION to $ENVIRONMENT completed successfully!"

# Post-deployment notification
./scripts/notifications/notify-success.sh $VERSION $ENVIRONMENT
```

## Infrastructure Deployment

### Terraform Infrastructure

#### Initialize Terraform

```bash
# Development infrastructure
cd infrastructure/terraform/development
terraform init
terraform plan
terraform apply

# Staging infrastructure
cd ../staging
terraform init
terraform plan
terraform apply

# Production infrastructure
cd ../production
terraform init
terraform plan
terraform apply
```

#### Infrastructure Configuration

```hcl
# infrastructure/terraform/production/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "labelmint-production"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  enable_vpn_gateway = true

  tags = {
    Environment = "production"
    Project     = "labelmint"
  }
}

module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  cluster_name    = "labelmint-production"
  cluster_version = "1.28"
  subnets         = module.vpc.private_subnets
  vpc_id          = module.vpc.vpc_id

  node_groups = {
    main = {
      desired_capacity = 3
      max_capacity     = 6
      min_capacity     = 2
      instance_types   = ["t3.large"]
      disk_size        = 50
      k8s_labels = {
        Environment = "production"
        Project     = "labelmint"
      }
    }
  }

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }
}
```

### Kubernetes Resources

#### Namespace Configuration

```yaml
# infrastructure/k8s/production/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: labelmint-prod
  labels:
    name: labelmint-prod
    environment: production
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: labelmint-prod-quota
  namespace: labelmint-prod
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    persistentvolumeclaims: "10"
    services: "10"
    secrets: "20"
    configmaps: "20"
```

#### Deployment Configuration

```yaml
# infrastructure/k8s/production/deployments/api-server.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: labelmint-prod
  labels:
    app: api-server
    version: "{{ .Values.version }}"
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
        version: "{{ .Values.version }}"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: api-server
        image: "{{ .Values.apiImage }}"
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 3001
          protocol: TCP
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: labelmint-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: labelmint-secrets
              key: redis-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: labelmint-secrets
              key: jwt-secret
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
          volumeMounts:
          - name: tmp
            mountPath: /tmp
          - name: uploads
            mountPath: /app/uploads
      volumes:
      - name: tmp
        emptyDir: {}
      - name: uploads
        persistentVolumeClaim:
          claimName: api-uploads-pvc
      imagePullSecrets:
      - name: ecr-pull-secret
```

## Database Deployment

### Database Setup

#### RDS Configuration

```hcl
# infrastructure/terraform/production/rds.tf
resource "aws_db_subnet_group" "labelmint" {
  name       = "labelmint-db-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "LabelMint DB subnet group"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "labelmint-rds-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "labelmint-rds-sg"
  }
}

resource "aws_db_instance" "labelmint" {
  identifier = "labelmint-prod"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.m6g.large"

  allocated_storage     = 500
  max_allocated_storage = 1000
  storage_encrypted     = true
  storage_type          = "gp2"
  iops                  = 3000

  db_name  = "labelmint"
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.labelmint.name

  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  skip_final_snapshot       = false
  final_snapshot_identifier = "labelmint-prod-final-snapshot"

  deletion_protection = true

  tags = {
    Name        = "labelmint-prod"
    Environment = "production"
  }
}
```

#### Database Migration

```bash
#!/bin/bash
# scripts/database/migrate.sh

ENVIRONMENT=$1
MIGRATION_PATH=${2:-"prisma/migrations"}

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment> [migration_path]"
    exit 1
fi

echo "🗃️ Running database migrations for $ENVIRONMENT"

# Set database connection
DB_URL=$(aws secretsmanager get-secret-value --secret-id "labelmint/$ENVIRONMENT/database" --query SecretString --output text | jq -r .url)
export DATABASE_URL="$DB_URL"

# Run migrations
cd services/labeling-backend
npx prisma migrate deploy

# Seed production data if needed
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🌱 Seeding production data..."
    npx prisma db seed -- --environment production
fi

echo "✅ Database migrations completed for $ENVIRONMENT"
```

### Redis Deployment

#### ElastiCache Configuration

```hcl
# infrastructure/terraform/production/redis.tf
resource "aws_elasticache_subnet_group" "labelmint" {
  name       = "labelmint-cache-subnet"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "redis" {
  name_prefix = "labelmint-redis-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "labelmint-redis-sg"
  }
}

resource "aws_elasticache_replication_group" "labelmint" {
  replication_group_id       = "labelmint-prod"
  description                = "LabelMint production Redis cluster"
  node_type                  = "cache.m6g.large"
  port                       = 6379
  parameter_group_name       = "default.redis7"
  automatic_failover_enabled = true
  multi_az_enabled           = true
  num_cache_clusters         = 2
  subnet_group_name          = aws_elasticache_subnet_group.labelmint.name
  security_group_ids         = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
  }

  tags = {
    Name        = "labelmint-prod"
    Environment = "production"
  }
}
```

## Monitoring & Observability

### Prometheus Monitoring

#### Prometheus Configuration

```yaml
# infrastructure/monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'labelmint-web'
    static_configs:
      - targets: ['web-app:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'labelmint-api'
    static_configs:
      - targets: ['api-server:3001']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'labelmint-payment'
    static_configs:
      - targets: ['payment-server:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
```

#### Alerting Rules

```yaml
# infrastructure/monitoring/rules/alerts.yml
groups:
  - name: labelmint.rules
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90%"

      - alert: DatabaseConnectionHigh
        expr: pg_stat_activity_count > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "Database has {{ $value }} active connections"

      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod is crash looping"
          description: "Pod {{ $labels.pod }} is crash looping"
```

### Grafana Dashboards

#### Dashboard Configuration

```json
{
  "dashboard": {
    "id": null,
    "title": "LabelMint Overview",
    "tags": ["labelmint", "production"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ],
        "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 }
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ],
        "gridPos": { "x": 12, "y": 0, "w": 12, "h": 8 }
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "gridPos": { "x": 0, "y": 8, "w": 6, "h": 8 }
      },
      {
        "title": "Active Users",
        "type": "singlestat",
        "targets": [
          {
            "expr": "active_users_total",
            "legendFormat": "Active Users"
          }
        ],
        "gridPos": { "x": 6, "y": 8, "w": 6, "h": 8 }
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_activity_count",
            "legendFormat": "Connections"
          }
        ],
        "gridPos": { "x": 12, "y": 8, "w": 12, "h": 8 }
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

### Log Aggregation

#### Loki Configuration

```yaml
# infrastructure/monitoring/loki/loki-config.yaml
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
    final_sleep: 0s
  chunk_idle_period: 1h
  max_chunk_age: 1h
  chunk_target_size: 1048576
  chunk_retain_period: 30s
  max_transfer_retries: 0

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: s3
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: s3
  s3:
    s3: http://minio:9000
    bucket_names: loki-chunks
    access_key_id: minioadmin
    secret_access_key: minioadmin123
    s3forcepathstyle: true

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
```

## Security & Compliance

### Security Hardening

#### Pod Security

```yaml
# infrastructure/k8s/production/pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: labelmint-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

#### Network Policies

```yaml
# infrastructure/k8s/production/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: labelmint-netpol
  namespace: labelmint-prod
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
      - namespaceSelector:
          matchLabels:
            name: ingress-nginx
      - namespaceSelector:
          matchLabels:
            name: monitoring
      ports:
      - protocol: TCP
        port: 3000
      - protocol: TCP
        port: 3001
  egress:
    - to:
      - namespaceSelector:
          matchLabels:
            name: kube-system
      ports:
      - protocol: TCP
        port: 53
      - protocol: UDP
        port: 53
    - to:
      - namespaceSelector:
          matchLabels:
            name: labelmint-prod
      ports:
      - protocol: TCP
        port: 5432
      - protocol: TCP
        port: 6379
```

### Compliance Monitoring

#### Security Scanning

```bash
#!/bin/bash
# scripts/security/security-scan.sh

echo "🔒 Running comprehensive security scan..."

# Static analysis
echo "📊 Running static code analysis..."
semgrep --config=auto --severity=ERROR ./services ./apps

# Dependency scanning
echo "📦 Scanning dependencies for vulnerabilities..."
npm audit --audit-level high
snyk test --severity-threshold=high

# Container scanning
echo "🐳 Scanning Docker images..."
trivy image --severity HIGH,CRITICAL labelmint/web:latest
trivy image --severity HIGH,CRITICAL labelmint/api:latest

# Infrastructure scanning
echo "🏗️ Scanning infrastructure as code..."
tfsec ./infrastructure/terraform/production
checkov ./infrastructure/kubernetes/production

# Secrets scanning
echo "🔑 Scanning for exposed secrets..."
gitleaks detect --source . --report-path security-report.json

echo "✅ Security scan completed. Report saved to security-report.json"
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: 123456789012.dkr.ecr.us-east-1.amazonaws.com
  IMAGE_NAME: labelmint

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test:ci

      - name: Security scan
        run: ./scripts/security/security-scan.sh

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push Docker images
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$IMAGE_NAME/web:$IMAGE_TAG ./apps/web
          docker build -t $ECR_REGISTRY/$IMAGE_NAME/api:$IMAGE_TAG ./services/labeling-backend
          docker build -t $ECR_REGISTRY/$IMAGE_NAME/payment:$IMAGE_TAG ./services/payment-backend

          docker push $ECR_REGISTRY/$IMAGE_NAME/web:$IMAGE_TAG
          docker push $ECR_REGISTRY/$IMAGE_NAME/api:$IMAGE_TAG
          docker push $ECR_REGISTRY/$IMAGE_NAME/payment:$IMAGE_TAG

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        run: aws eks update-kubeconfig --name labelmint-staging

      - name: Deploy to staging
        run: |
          sed -i "s|IMAGE_TAG|${{ github.sha }}|g" infrastructure/k8s/staging/deployments/*.yaml
          kubectl apply -f infrastructure/k8s/staging/

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/web-app -n labelmint-staging
          kubectl rollout status deployment/api-server -n labelmint-staging

      - name: Run smoke tests
        run: ./scripts/testing/smoke-tests.sh staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        run: aws eks update-kubeconfig --name labelmint-production

      - name: Deploy to production
        run: |
          sed -i "s|IMAGE_TAG|${{ github.sha }}|g" infrastructure/k8s/production/green/deployments/*.yaml
          kubectl apply -f infrastructure/k8s/production/green/

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/web-app-green -n labelmint-prod
          kubectl rollout status deployment/api-server-green -n labelmint-prod

      - name: Health checks
        run: ./scripts/production/health-check.sh green

      - name: Switch traffic to green
        run: |
          kubectl patch service web-app-service -p '{"spec":{"selector":{"version":"green"}}}'
          kubectl patch service api-service -p '{"spec":{"selector":{"version":"green"}}}'

      - name: Final validation
        run: |
          sleep 60  # Wait for DNS propagation
          ./scripts/production/final-validation.sh

  notify:
    needs: [deploy-production]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Notify Slack
        uses: rtCamp/action-slack-notify@v2
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
          SLACK_MESSAGE: |
            Deployment to production completed.
            Commit: ${{ github.sha }}
            Status: ${{ job.status }}
```

## Rollback Procedures

### Automated Rollback

```bash
#!/bin/bash
# scripts/production/rollback.sh

VERSION=$1
ENVIRONMENT=${2:-production}

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version> [environment]"
    exit 1
fi

echo "🔄 Rolling back LabelMint to version $VERSION in $ENVIRONMENT"

# Get current deployment
CURRENT_VERSION=$(kubectl get deployment web-app -n labelmint-$ENVIRONMENT -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)
echo "Current version: $CURRENT_VERSION"

# Rollback deployment
echo "Rolling back to version $VERSION..."
kubectl set image deployment/web-app web-app=$ECR_REGISTRY/labelmint/web:$VERSION -n labelmint-$ENVIRONMENT
kubectl set image deployment/api-server api-server=$ECR_REGISTRY/labelmint/api:$VERSION -n labelmint-$ENVIRONMENT

# Wait for rollout
echo "Waiting for rollback completion..."
kubectl rollout status deployment/web-app -n labelmint-$ENVIRONMENT
kubectl rollout status deployment/api-server -n labelmint-$ENVIRONMENT

# Health checks
echo "Running health checks..."
./scripts/production/health-check.sh

# Validation
echo "Running validation tests..."
./scripts/testing/smoke-tests.sh $ENVIRONMENT

echo "✅ Rollback to version $VERSION completed successfully!"

# Notification
./scripts/notifications/notify-rollback.sh $VERSION $CURRENT_VERSION $ENVIRONMENT
```

### Emergency Rollback

```bash
#!/bin/bash
# scripts/production/emergency-rollback.sh

echo "🚨 EMERGENCY ROLLBACK INITIATED"

# Identify last known good deployment
LAST_GOOD_TAG=$(git tag --sort=-version:refname | head -1)
echo "Last known good version: $LAST_GOOD_TAG"

# Immediate rollback to last known good
kubectl rollout undo deployment/web-app -n labelmint-prod
kubectl rollout undo deployment/api-server -n labelmint-prod

# Scale up for stability
kubectl scale deployment web-app --replicas=5 -n labelmint-prod
kubectl scale deployment api-server --replicas=5 -n labelmint-prod

# Health checks
./scripts/production/emergency-health-check.sh

# Notify team
./scripts/notifications/emergency-notify.sh "Emergency rollback completed to $LAST_GOOD_TAG"

echo "🚨 Emergency rollback completed. System should be stable."
```

## Troubleshooting

### Common Issues

#### Deployment Failures

```bash
# Check deployment status
kubectl get deployments -n labelmint-prod
kubectl describe deployment web-app -n labelmint-prod

# Check pod logs
kubectl logs -f deployment/web-app -n labelmint-prod

# Check events
kubectl get events -n labelmint-prod --sort-by=.metadata.creationTimestamp

# Check resource usage
kubectl top pods -n labelmint-prod
kubectl top nodes
```

#### Database Issues

```bash
# Check database connection
kubectl exec -it deployment/api-server -n labelmint-prod -- psql $DATABASE_URL -c "SELECT 1;"

# Check database logs
kubectl logs deployment/postgres -n labelmint-prod

# Check slow queries
kubectl exec -it deployment/postgres -n labelmint-prod -- psql $DATABASE_URL -c "
  SELECT query, mean_time, calls
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;
"
```

#### Performance Issues

```bash
# Check resource utilization
kubectl top pods -n labelmint-prod
kubectl top nodes

# Check network latency
kubectl exec -it deployment/web-app -n labelmint-prod -- ping api-server

# Check load balancer health
kubectl get ingress -n labelmint-prod
kubectl describe ingress web-app-ingress -n labelmint-prod
```

### Debug Scripts

```bash
#!/bin/bash
# scripts/production/debug.sh

ENVIRONMENT=$1
COMPONENT=${2:-"all"}

echo "🔍 Debugging $ENVIRONMENT environment, component: $COMPONENT"

case $COMPONENT in
  "web")
    echo "Debugging web application..."
    kubectl logs -f deployment/web-app -n labelmint-$ENVIRONMENT
    ;;
  "api")
    echo "Debugging API server..."
    kubectl logs -f deployment/api-server -n labelmint-$ENVIRONMENT
    ;;
  "database")
    echo "Debugging database..."
    kubectl exec -it deployment/postgres -n labelmint-$ENVIRONMENT -- psql $DATABASE_URL
    ;;
  "redis")
    echo "Debugging Redis..."
    kubectl exec -it deployment/redis -n labelmint-$ENVIRONMENT -- redis-cli
    ;;
  "all")
    echo "Debugging all components..."
    kubectl get pods -n labelmint-$ENVIRONMENT
    kubectl get services -n labelmint-$ENVIRONMENT
    kubectl get events -n labelmint-$ENVIRONMENT --sort-by=.metadata.creationTimestamp
    ;;
  *)
    echo "Unknown component: $COMPONENT"
    echo "Available components: web, api, database, redis, all"
    exit 1
    ;;
esac
```

## Maintenance

### Regular Maintenance Tasks

#### Daily

```bash
#!/bin/bash
# scripts/maintenance/daily.sh

echo "📅 Running daily maintenance tasks..."

# Check system health
./scripts/production/health-check.sh

# Rotate logs
kubectl logs --since=24h deployment/web-app -n labelmint-prod > /logs/web-app-$(date +%Y%m%d).log
kubectl logs --since=24h deployment/api-server -n labelmint-prod > /logs/api-server-$(date +%Y%m%d).log

# Check disk usage
df -h

# Check memory usage
free -h

# Update monitoring dashboards
./scripts/monitoring/update-dashboards.sh

echo "✅ Daily maintenance completed"
```

#### Weekly

```bash
#!/bin/bash
# scripts/maintenance/weekly.sh

echo "📅 Running weekly maintenance tasks..."

# Security updates
yum update -y  # On EC2 instances
kubectl rollout restart deployment/web-app -n labelmint-prod
kubectl rollout restart deployment/api-server -n labelmint-prod

# Database maintenance
./scripts/database/vacuum.sh
./scripts/database/analyze.sh

# Backup verification
./scripts/backup/verify-backups.sh

# Performance tuning
./scripts/performance/tune-indexes.sh

# Clean up old Docker images
docker system prune -f

echo "✅ Weekly maintenance completed"
```

#### Monthly

```bash
#!/bin/bash
# scripts/maintenance/monthly.sh

echo "📅 Running monthly maintenance tasks..."

# Security audit
./scripts/security/security-audit.sh

# Performance review
./scripts/performance/performance-review.sh

# Capacity planning
./scripts/infrastructure/capacity-planning.sh

# Disaster recovery test
./scripts/disaster-recovery/test.sh

# Documentation update
./scripts/docs/update-documentation.sh

echo "✅ Monthly maintenance completed"
```

### Backup Procedures

#### Database Backup

```bash
#!/bin/bash
# scripts/backup/database-backup.sh

ENVIRONMENT=$1
BACKUP_TYPE=${2:-"full"}

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment> [backup_type]"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="labelmint-$ENVIRONMENT-$BACKUP_TYPE-$TIMESTAMP.sql"

echo "💾 Creating $BACKUP_TYPE backup for $ENVIRONMENT..."

# Get database connection
DB_URL=$(aws secretsmanager get-secret-value --secret-id "labelmint/$ENVIRONMENT/database" --query SecretString --output text | jq -r .url)

# Create backup
pg_dump $DB_URL > /backups/$BACKUP_FILE

# Compress backup
gzip /backups/$BACKUP_FILE

# Upload to S3
aws s3 cp /backups/$BACKUP_FILE.gz s3://labelmint-backups/$ENVIRONMENT/

# Clean up local file
rm /backups/$BACKUP_FILE.gz

echo "✅ Backup completed: $BACKUP_FILE.gz"
```

#### Application Backup

```bash
#!/bin/bash
# scripts/backup/application-backup.sh

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment>"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/labelmint-$ENVIRONMENT-$TIMESTAMP"

echo "💾 Creating application backup for $ENVIRONMENT..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup Kubernetes manifests
kubectl get all -n labelmint-$ENVIRONMENT -o yaml > $BACKUP_DIR/kubernetes-manifests.yaml

# Backup ConfigMaps and Secrets
kubectl get configmaps -n labelmint-$ENVIRONMENT -o yaml > $BACKUP_DIR/configmaps.yaml
kubectl get secrets -n labelmint-$ENVIRONMENT -o yaml > $BACKUP_DIR/secrets.yaml

# Backup application data
kubectl exec -it deployment/api-server -n labelmint-$ENVIRONMENT -- tar czf - /app/data > $BACKUP_DIR/application-data.tar.gz

# Compress backup
tar czf /backups/labelmint-$ENVIRONMENT-$TIMESTAMP.tar.gz $BACKUP_DIR

# Upload to S3
aws s3 cp /backups/labelmint-$ENVIRONMENT-$TIMESTAMP.tar.gz s3://labelmint-backups/$ENVIRONMENT/

# Clean up
rm -rf $BACKUP_DIR
rm /backups/labelmint-$ENVIRONMENT-$TIMESTAMP.tar.gz

echo "✅ Application backup completed"
```

## Conclusion

This deployment guide provides comprehensive procedures for deploying LabelMint across all environments. Key points to remember:

1. **Always test in staging** before deploying to production
2. **Monitor deployments** closely during and after rollout
3. **Have rollback procedures** ready and tested
4. **Follow security best practices** for all deployments
5. **Maintain comprehensive monitoring** and alerting
6. **Document all changes** and maintain version control
7. **Regular maintenance** is essential for system health
8. **Backup frequently** and test restoration procedures

### Deployment Success Criteria

- [ ] All health checks pass
- [ ] Performance metrics within acceptable ranges
- [ ] Security scans pass
- [ ] Monitoring and alerting active
- [ ] Backup procedures verified
- [ ] Documentation updated
- [ ] Team notified

### Contact Information

- **DevOps Team**: ops@labelmint.it
- **Emergency Hotline**: +1-XXX-XXX-XXXX
- **Deployment Status**: https://deployments.labelmint.it

---

**Last Updated**: 2024-10-24
**Version**: 2.0

This deployment guide should be updated whenever infrastructure changes, new deployment procedures are implemented, or lessons are learned from deployments.