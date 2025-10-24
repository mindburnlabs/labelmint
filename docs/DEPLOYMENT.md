# 🚀 DEPLOYMENT - Production & Staging Procedures

Comprehensive deployment guide for LabelMint platform, covering all environments, infrastructure setup, and operational procedures.

## 📋 Table of Contents

- [🎯 Deployment Overview](#-deployment-overview)
- [🌐 Environment Strategy](#-environment-strategy)
- [🏗️ Infrastructure Setup](#️-infrastructure-setup)
- [🚀 Application Deployment](#-application-deployment)
- [📊 Monitoring & Observability](#-monitoring--observability)
- [🔄 CI/CD Pipeline](#-cicd-pipeline)
- [🚨 Rollback Procedures](#-rollback-procedures)
- [📋 Deployment Checklists](#-deployment-checklists)
- [🔧 Maintenance Procedures](#-maintenance-procedures)
- [📖 Troubleshooting](#-troubleshooting)

---

## 🎯 Deployment Overview

### 🎯 Deployment Goals

- **Zero Downtime** deployments for production
- **Automated Rollback** on failure detection
- **Blue-Green Deployment** for safe releases
- **Infrastructure as Code** for reproducible environments
- **Security First** approach with compliance validation
- **Monitoring & Alerting** for operational excellence

### 📊 Deployment Metrics

- **Deployment Time**: < 15 minutes for full stack
- **Rollback Time**: < 5 minutes to previous version
- **Downtime**: < 30 seconds for database migrations
- **Success Rate**: 99.9% automated deployment success
- **Recovery Time**: < 2 minutes for incident response

### 🌟 Deployment Strategy

```mermaid
graph LR
    A[Development] --> B[Staging]
    B --> C[Production]
    C --> D[Monitoring]
    D --> E[Feedback]
    E --> A

    subgraph "Deployment Process"
        F[Build] --> G[Test]
        G --> H[Security Scan]
        H --> I[Deploy]
        I --> J[Verify]
    end
```

---

## 🌐 Environment Strategy

### 📋 Environment Configuration

| Environment | Purpose | URL | Database | Monitoring |
|-------------|---------|-----|----------|------------|
| **Development** | Local development | `localhost:3000` | Local PostgreSQL | Local Grafana |
| **Staging** | Pre-production validation | `staging.labelmint.com` | Staging RDS | Staging Grafana |
| **Production** | Live production | `labelmint.com` | Production RDS | Production Grafana |
| **Disaster Recovery** | Backup site | `dr.labelmint.com` | DR RDS | DR Grafana |

### 🔧 Environment Variables

#### Production Environment

```bash
# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
API_VERSION=v1

# Database Configuration
DATABASE_URL=postgresql://user:pass@prod-db:5432/labelmint
REDIS_URL=redis://prod-redis:6379
DATABASE_POOL_SIZE=20
DATABASE_SSL=true

# Authentication & Security
NEXTAUTH_URL=https://labelmint.com
NEXTAUTH_SECRET=production-secret
JWT_ACCESS_SECRET=jwt-access-secret
JWT_REFRESH_SECRET=jwt-refresh-secret

# External Services
TELEGRAM_BOT_TOKEN=production-bot-token
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
TON_CONTRACT_ADDRESS=production-contract

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=production-access-key
AWS_SECRET_ACCESS_KEY=production-secret-key
S3_BUCKET_NAME=labelmint-prod-assets
S3_CDN_DOMAIN=cdn.labelmint.com

# Monitoring & Analytics
SENTRY_DSN=production-sentry-dsn
NEW_RELIC_LICENSE_KEY=production-newrelic-key
GOOGLE_ANALYTICS_ID=production-ga-id

# Security
CORS_ORIGIN=https://labelmint.com
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=15m
```

#### Staging Environment

```bash
# Similar to production with staging-specific values
NODE_ENV=staging
API_VERSION=v1
NEXTAUTH_URL=https://staging.labelmint.com
DATABASE_URL=postgresql://user:pass@staging-db:5432/labelmint_staging
SENTRY_DSN=staging-sentry-dsn
```

---

## 🏗️ Infrastructure Setup

### ☁️ AWS Architecture

```mermaid
graph TB
    subgraph "AWS Cloud"
        subgraph "VPC - us-east-1"
            subgraph "Public Subnets"
                ALB[Application Load Balancer]
                NAT[NAT Gateway]
            end

            subgraph "Private Subnets - App Tier"
                EKS1[EKS Worker Node 1]
                EKS2[EKS Worker Node 2]
                EKS3[EKS Worker Node 3]
            end

            subgraph "Private Subnets - Data Tier"
                RDS[RDS PostgreSQL]
                REDIS[ElastiCache Redis]
            end
        end

        subgraph "Services"
            S3[S3 Bucket]
            CF[CloudFront]
            R53[Route 53]
            SM[Secrets Manager]
        end
    end

    CF --> ALB
    ALB --> EKS1
    ALB --> EKS2
    ALB --> EKS3
    EKS1 --> RDS
    EKS1 --> REDIS
    EKS2 --> RDS
    EKS2 --> REDIS
    EKS3 --> RDS
    EKS3 --> REDIS
```

### 🏗️ Terraform Infrastructure

#### Main Terraform Configuration

```hcl
# terraform/main.tf

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }

    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.9"
    }
  }

  backend "s3" {
    bucket = "labelmint-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "LabelMint"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"

  environment = var.environment
  vpc_cidr    = var.vpc_cidr

  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs

  availability_zones = var.availability_zones
}

# EKS Cluster
module "eks" {
  source = "./modules/eks"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids

  cluster_name    = "${var.project_name}-${var.environment}"
  cluster_version = var.kubernetes_version

  node_groups = {
    main = {
      desired_capacity = 3
      max_capacity     = 10
      min_capacity     = 3

      instance_types = ["t3.medium", "t3.large"]

      k8s_labels = {
        role = "worker"
      }
    }
  }
}

# RDS Database
module "rds" {
  source = "./modules/rds"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.database_subnet_ids

  identifier = "${var.project_name}-${var.environment}-db"

  engine         = "postgres"
  engine_version = "15.3"
  instance_class = "db.t3.medium"

  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true

  database_name = var.database_name
  username     = var.database_username
  password     = var.database_password

  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  skip_final_snapshot = var.environment == "development" ? true : false
}

# ElastiCache Redis
module "redis" {
  source = "./modules/redis"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids

  replication_group_id = "${var.project_name}-${var.environment}-redis"

  node_type = "cache.t3.micro"

  num_cache_clusters = 2

  automatic_failover_enabled = true
  multi_az_enabled          = true

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  auth_token = var.redis_auth_token
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.public_subnet_ids

  certificate_arn = var.ssl_certificate_arn

  target_groups = {
    web = {
      port     = 3000
      protocol = "HTTP"
      path     = "/health"
    }

    api = {
      port     = 3002
      protocol = "HTTP"
      path     = "/api/health"
    }
  }
}
```

#### Kubernetes Deployment Configuration

```yaml
# k8s/deployments/labelmint-web.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: labelmint-web
  namespace: labelmint
  labels:
    app: labelmint-web
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: labelmint-web
  template:
    metadata:
      labels:
        app: labelmint-web
        version: v1
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: web
        image: labelmint/web:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: labelmint-secrets
              key: database-url
        - name: NEXTAUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: labelmint-secrets
              key: nextauth-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
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
      volumes:
      - name: tmp
        emptyDir: {}
      imagePullSecrets:
      - name: registry-secret
---
apiVersion: v1
kind: Service
metadata:
  name: labelmint-web-service
  namespace: labelmint
  labels:
    app: labelmint-web
spec:
  selector:
    app: labelmint-web
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
  type: ClusterIP
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: labelmint-web-pdb
  namespace: labelmint
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: labelmint-web
```

---

## 🚀 Application Deployment

### 🔄 Blue-Green Deployment Strategy

#### Deployment Script

```bash
#!/bin/bash
# scripts/deploy-blue-green.sh

set -e

# Configuration
NAMESPACE="labelmint"
NEW_VERSION=$1
CURRENT_VERSION=$(kubectl get deployment labelmint-web -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <version>"
    exit 1
fi

echo "Deploying LabelMint version $NEW_VERSION (current: $CURRENT_VERSION)"

# Build and push new image
echo "Building new Docker image..."
docker build -t labelmint/web:$NEW_VERSION .
docker push labelmint/web:$NEW_VERSION

# Create new deployment (green)
echo "Creating green deployment..."
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: labelmint-web-green
  namespace: $NAMESPACE
  labels:
    app: labelmint-web-green
    version: $NEW_VERSION
spec:
  replicas: 3
  selector:
    matchLabels:
      app: labelmint-web-green
  template:
    metadata:
      labels:
        app: labelmint-web-green
        version: $NEW_VERSION
    spec:
      containers:
      - name: web
        image: labelmint/web:$NEW_VERSION
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: labelmint-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
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
EOF

# Wait for green deployment to be ready
echo "Waiting for green deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/labelmint-web-green -n $NAMESPACE

# Health check on green deployment
echo "Running health checks..."
GREEN_POD=$(kubectl get pods -n $NAMESPACE -l app=labelmint-web-green -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n $NAMESPACE $GREEN_POD -- curl -f http://localhost:3000/health

# Run smoke tests
echo "Running smoke tests..."
./scripts/smoke-tests.sh $GREEN_POD

# Switch traffic to green
echo "Switching traffic to green deployment..."
kubectl patch service labelmint-web-service -n $NAMESPACE -p '{"spec":{"selector":{"app":"labelmint-web-green"}}}'

# Wait for traffic switch
sleep 30

# Verify new deployment is handling traffic
echo "Verifying traffic switch..."
curl -f https://labelmint.com/health

# Clean up old deployment (blue)
echo "Cleaning up old deployment..."
kubectl delete deployment labelmint-web -n $NAMESPACE || true

# Rename green deployment to production name
kubectl patch deployment labelmint-web-green -n $NAMESPACE -p '{"metadata":{"name":"labelmint-web"}}'

echo "Deployment completed successfully! Version $NEW_VERSION is now live."
```

### 🚀 Database Migration

#### Migration Script

```bash
#!/bin/bash
# scripts/migrate-database.sh

set -e

# Configuration
DATABASE_URL=$1
MIGRATION_PATH="./migrations"

if [ -z "$DATABASE_URL" ]; then
    echo "Usage: $0 <database-url>"
    exit 1
fi

echo "Starting database migration..."

# Backup database before migration
echo "Creating database backup..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump $DATABASE_URL > $BACKUP_FILE
echo "Backup created: $BACKUP_FILE"

# Run migrations
echo "Running database migrations..."
cd $MIGRATION_PATH

for migration in *.sql; do
    echo "Running migration: $migration"
    psql $DATABASE_URL < $migration

    # Mark migration as applied
    echo "Marking migration as applied..."
    psql $DATABASE_URL -c "INSERT INTO schema_migrations (version, filename) VALUES ($(date +%s), '$migration') ON CONFLICT DO NOTHING;"
done

echo "Database migration completed successfully!"

# Verify migration
echo "Verifying migration..."
psql $DATABASE_URL -c "SELECT version, filename, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;"

echo "Migration verification completed."
```

#### Database Migration Service

```typescript
// services/database/src/migration.service.ts
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export class MigrationService {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async runMigrations(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Ensure migrations table exists
      await this.ensureMigrationsTable(client);

      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations(client);

      // Get pending migrations
      const migrationFiles = await this.getMigrationFiles();
      const pendingMigrations = migrationFiles.filter(
        file => !appliedMigrations.includes(file)
      );

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations to run.');
        return;
      }

      console.log(`Running ${pendingMigrations.length} migrations...`);

      // Run each migration
      for (const migrationFile of pendingMigrations) {
        await this.runMigration(client, migrationFile);
      }

      await client.query('COMMIT');
      console.log('All migrations completed successfully!');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureMigrationsTable(client: any): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW(),
        checksum VARCHAR(255)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
    `);
  }

  private async getAppliedMigrations(client: any): Promise<string[]> {
    const result = await client.query('SELECT filename FROM schema_migrations ORDER BY applied_at');
    return result.rows.map((row: any) => row.filename);
  }

  private async getMigrationFiles(): Promise<string[]> {
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir);
    return files.filter(file => file.endsWith('.sql')).sort();
  }

  private async runMigration(client: any, migrationFile: string): Promise<void> {
    const migrationPath = path.join(__dirname, '../migrations', migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log(`Running migration: ${migrationFile}`);

    await client.query(migrationSQL);

    // Record migration
    await client.query(`
      INSERT INTO schema_migrations (version, filename, checksum)
      VALUES ($1, $2, $3)
    `, [
      Date.now().toString(),
      migrationFile,
      this.calculateChecksum(migrationSQL)
    ]);

    console.log(`Migration ${migrationFile} completed successfully.`);
  }

  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }
}
```

---

## 📊 Monitoring & Observability

### 📈 Prometheus Configuration

```yaml
# monitoring/prometheus.yml
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
  # LabelMint applications
  - job_name: 'labelmint-web'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - labelmint
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__

  # Kubernetes nodes
  - job_name: 'kubernetes-nodes'
    kubernetes_sd_configs:
      - role: node
    relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)

  # PostgreSQL exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Node exporter
  - job_name: 'node-exporter'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: node-exporter
      - source_labels: [__meta_kubernetes_pod_ip]
        target_label: __address__
        replacement: ${1}:9100
```

### 📊 Grafana Dashboards

```json
{
  "dashboard": {
    "title": "LabelMint Application Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "gridPos": {
          "x": 0,
          "y": 0,
          "w": 12,
          "h": 8
        }
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "gridPos": {
          "x": 12,
          "y": 0,
          "w": 12,
          "h": 8
        }
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
        "gridPos": {
          "x": 0,
          "y": 8,
          "w": 12,
          "h": 8
        }
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "Active Connections"
          }
        ],
        "gridPos": {
          "x": 12,
          "y": 8,
          "w": 12,
          "h": 8
        }
      }
    ]
  }
}
```

### 🚨 Alerting Rules

```yaml
# monitoring/rules/alerts.yml
groups:
  - name: labelmint-alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.job }}"

      # High response time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s for {{ $labels.job }}"

      # Database connections high
      - alert: DatabaseConnectionsHigh
        expr: pg_stat_database_numbackends > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "Database has {{ $value }} active connections"

      # Pod restarts
      - alert: PodRestartHigh
        expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Pod restarting frequently"
          description: "Pod {{ $labels.pod }} in namespace {{ $labels.namespace }} is restarting"

      # Node memory high
      - alert: NodeMemoryHigh
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Node memory usage high"
          description: "Node {{ $labels.instance }} memory usage is {{ $value | humanizePercentage }}"
```

---

## 🔄 CI/CD Pipeline

### 🔄 GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: labelmint_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run type checking
      run: npm run type-check

    - name: Run unit tests
      run: npm run test:unit
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/labelmint_test
        REDIS_URL: redis://localhost:6379

    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/labelmint_test
        REDIS_URL: redis://localhost:6379

    - name: Run E2E tests
      run: npm run test:e2e

  security-scan:
    runs-on: ubuntu-latest
    needs: test

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high

  build:
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main'

    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
      image-tag: ${{ steps.meta.outputs.tags }}

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push Docker image
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: staging

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name labelmint-staging

    - name: Deploy to staging
      run: |
        # Deploy new version to staging
        helm upgrade --install labelmint-staging ./helm/labelmint \
          --namespace staging \
          --create-namespace \
          --set image.tag=${{ needs.build.outputs.image-tag }} \
          --set environment=staging \
          --wait \
          --timeout=10m

    - name: Run smoke tests
      run: |
        # Wait for deployment to be ready
        kubectl wait --for=condition=available --timeout=300s deployment/labelmint-web -n staging

        # Run smoke tests
        ./scripts/smoke-tests-staging.sh

  deploy-production:
    runs-on: ubuntu-latest
    needs: [build, deploy-staging]
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID_PROD }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY_PROD }}
        aws-region: us-east-1

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name labelmint-production

    - name: Deploy to production
      run: |
        # Blue-green deployment to production
        ./scripts/deploy-blue-green.sh ${{ needs.build.outputs.image-tag }}

    - name: Run production smoke tests
      run: |
        # Verify deployment is healthy
        ./scripts/smoke-tests-production.sh

    - name: Notify deployment success
      if: success()
      run: |
        # Send Slack notification
        curl -X POST -H 'Content-type: application/json' \
          --data '{"text":"✅ LabelMint v${{ needs.build.outputs.image-tag }} deployed successfully to production!"}' \
          ${{ secrets.SLACK_WEBHOOK_URL }}

    - name: Notify deployment failure
      if: failure()
      run: |
        # Send Slack notification
        curl -X POST -H 'Content-type: application/json' \
          --data '{"text":"❌ LabelMint deployment failed! Please investigate immediately."}' \
          ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 🚨 Rollback Procedures

### 🔄 Automated Rollback Script

```bash
#!/bin/bash
# scripts/rollback.sh

set -e

# Configuration
NAMESPACE="labelmint"
TARGET_VERSION=$1

if [ -z "$TARGET_VERSION" ]; then
    echo "Usage: $0 <version>"
    echo "Available versions:"
    kubectl get deployments -n $NAMESPACE -l app=labelmint-web -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}'
    exit 1
fi

echo "Rolling back to version $TARGET_VERSION"

# Get current deployment info
CURRENT_DEPLOYMENT=$(kubectl get deployment -n $NAMESPACE -l app=labelmint-web -o jsonpath='{.items[0].metadata.name}')
echo "Current deployment: $CURRENT_DEPLOYMENT"

# Rollback using kubectl
if command -v kubectl &> /dev/null; then
    echo "Rolling back using kubectl..."
    kubectl rollout undo deployment/$CURRENT_DEPLOYMENT -n $NAMESPACE

    # Wait for rollback to complete
    kubectl rollout status deployment/$CURRENT_DEPLOYMENT -n $NAMESPACE --timeout=300s

    echo "Rollback completed successfully!"
else
    echo "kubectl not found. Manual rollback required."
    exit 1
fi

# Verify rollback
echo "Verifying rollback..."
sleep 30

# Health check
if curl -f http://labelmint.com/health; then
    echo "✅ Rollback verification successful!"
else
    echo "❌ Rollback verification failed!"
    exit 1
fi

# Send notification
echo "Sending rollback notification..."
curl -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\"🔄 LabelMint rolled back to previous version due to deployment issues.\"}" \
  $SLACK_WEBHOOK_URL

echo "Rollback process completed."
```

### 🔄 Manual Rollback Procedures

#### Step 1: Identify the Issue

```bash
# Check deployment status
kubectl get deployments -n labelmint
kubectl rollout status deployment/labelmint-web -n labelmint

# Check pod logs
kubectl logs -f deployment/labelmint-web -n labelmint

# Check recent changes
kubectl rollout history deployment/labelmint-web -n labelmint
```

#### Step 2: Verify Rollback Target

```bash
# List previous revisions
kubectl rollout history deployment/labelmint-web -n labelmint --revision=2

# Test previous version in staging first
kubectl set image deployment/labelmint-web-staging \
  web=labelmint/web:previous-version \
  -n staging
```

#### Step 3: Execute Rollback

```bash
# Rollback to previous revision
kubectl rollout undo deployment/labelmint-web -n labelmint

# Or rollback to specific revision
kubectl rollout undo deployment/labelmint-web --to-revision=2 -n labelmint

# Wait for rollback to complete
kubectl rollout status deployment/labelmint-web -n labelmint --timeout=300s
```

#### Step 4: Verify Rollback

```bash
# Check pod status
kubectl get pods -n labelmint -l app=labelmint-web

# Health checks
curl -f https://labelmint.com/health
curl -f https://labelmint.com/api/health

# Run smoke tests
./scripts/smoke-tests-production.sh
```

---

## 📋 Deployment Checklists

### 🚀 Pre-Deployment Checklist

#### Code Quality
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code coverage ≥ 80%
- [ ] Linting passes with no errors
- [ ] Type checking passes
- [ ] Security scan passes (no critical vulnerabilities)
- [ ] Dependency audit passes
- [ ] Documentation updated

#### Environment Preparation
- [ ] Environment variables configured
- [ ] Secrets updated and tested
- [ ] Database backups created
- [ ] Monitoring dashboards prepared
- [ ] Alert rules configured
- [ ] Rollback procedures tested
- [ ] Communication plan prepared

#### Testing
- [ ] Manual testing completed
- [ ] Performance testing completed
- [ ] Load testing completed
- [ ] Security testing completed
- [ ] Accessibility testing completed
- [ ] Cross-browser testing completed
- [ ] Mobile testing completed

### 🎯 Deployment Checklist

#### Deployment Execution
- [ ] Blue-green deployment initiated
- [ ] Health checks passing on green environment
- [ ] Smoke tests passing
- [ ] Database migrations completed successfully
- [ ] Traffic switched to new version
- [ ] Monitoring shows healthy metrics
- [ ] No errors in application logs

#### Post-Deployment Verification
- [ ] Application responding normally
- [ ] All user journeys working
- [ ] Database operations normal
- [ ] Payment processing working
- [ ] Telegram bot functioning
- [ ] API endpoints responding
- [ ] Performance metrics within limits

### 🚨 Post-Deployment Checklist

#### Monitoring
- [ ] Error rates within normal limits
- [ ] Response times within SLA
- [ ] Database performance normal
- [ ] Resource utilization normal
- [ ] No security alerts triggered
- [ ] No anomalous user behavior detected

#### Communication
- [ ] Team notified of deployment
- [ ] Stakeholders updated
- [ ] Status page updated if needed
- [ ] Release notes published
- [ ] User announcements sent
- [ ] Incident response team on alert

#### Documentation
- [ ] Deployment documented
- [ ] Issues recorded
- [ ] Lessons learned captured
- [ ] Playbooks updated
- [ ] Runbooks updated if needed
- [ ] Architecture diagrams updated

---

## 🔧 Maintenance Procedures

### 🔄 Regular Maintenance Tasks

#### Daily Tasks

```bash
#!/bin/bash
# scripts/daily-maintenance.sh

echo "Starting daily maintenance tasks..."

# Check system health
echo "Checking system health..."
kubectl get pods -n labelmint
kubectl get nodes

# Check disk space
echo "Checking disk space..."
df -h

# Check memory usage
echo "Checking memory usage..."
free -h

# Check application logs for errors
echo "Checking for application errors..."
kubectl logs -n labelmint --since=24h | grep -i error

# Backup database
echo "Creating database backup..."
./scripts/backup-database.sh

# Cleanup old logs
echo "Cleaning up old logs..."
find /var/log -name "*.log" -mtime +30 -delete

echo "Daily maintenance completed."
```

#### Weekly Tasks

```bash
#!/bin/bash
# scripts/weekly-maintenance.sh

echo "Starting weekly maintenance tasks..."

# Update dependencies
echo "Checking for dependency updates..."
npm outdated

# Security scan
echo "Running security scan..."
npm audit

# Performance monitoring review
echo "Reviewing performance metrics..."
./scripts/performance-review.sh

# Cleanup unused Docker images
echo "Cleaning up Docker images..."
docker system prune -f

# Check SSL certificates
echo "Checking SSL certificates..."
./scripts/check-ssl-certificates.sh

# Update monitoring dashboards
echo "Updating monitoring dashboards..."
./scripts/update-dashboards.sh

echo "Weekly maintenance completed."
```

#### Monthly Tasks

```bash
#!/bin/bash
# scripts/monthly-maintenance.sh

echo "Starting monthly maintenance tasks..."

# Security audit
echo "Running security audit..."
./scripts/security-audit.sh

# Performance testing
echo "Running performance tests..."
./scripts/performance-tests.sh

# Disaster recovery test
echo "Testing disaster recovery..."
./scripts/disaster-recovery-test.sh

# Documentation review
echo "Reviewing documentation..."
./scripts/documentation-review.sh

# Team training review
echo "Reviewing team training..."
./scripts/training-review.sh

echo "Monthly maintenance completed."
```

### 🔧 Database Maintenance

#### Database Backup Script

```bash
#!/bin/bash
# scripts/backup-database.sh

set -e

# Configuration
DATABASE_URL=$1
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/labelmint_backup_$TIMESTAMP.sql"

if [ -z "$DATABASE_URL" ]; then
    echo "Usage: $0 <database-url>"
    exit 1
fi

echo "Starting database backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
echo "Creating backup: $BACKUP_FILE"
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
echo "Compressing backup..."
gzip $BACKUP_FILE

# Upload to S3
echo "Uploading to S3..."
aws s3 cp $BACKUP_FILE.gz s3://labelmint-database-backups/

# Cleanup local files older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Database backup completed: $BACKUP_FILE.gz"
```

#### Database Maintenance

```sql
-- scripts/database-maintenance.sql

-- Update table statistics
ANALYZE;

-- Reindex fragmented indexes
REINDEX DATABASE labelmint;

-- Cleanup old session data
DELETE FROM user_sessions
WHERE created_at < NOW() - INTERVAL '7 days';

-- Cleanup old audit logs
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- Update statistics
ANALYZE;

-- Check database size
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

---

## 📖 Troubleshooting

### 🚨 Common Deployment Issues

#### Database Migration Failures

```bash
# Check migration status
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;"

# Check for locked tables
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE granted = false;"

# Kill blocking sessions
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid();"

# Retry migration
./scripts/migrate-database.sh $DATABASE_URL
```

#### Pod Startup Issues

```bash
# Check pod status
kubectl get pods -n labelmint
kubectl describe pod <pod-name> -n labelmint

# Check pod logs
kubectl logs <pod-name> -n labelmint --previous

# Check resource constraints
kubectl top pods -n labelmint
kubectl describe node <node-name>

# Check events
kubectl get events -n labelmint --sort-by='.lastTimestamp'
```

#### Service Connection Issues

```bash
# Check service endpoints
kubectl get endpoints -n labelmint
kubectl describe service <service-name> -n labelmint

# Test connectivity
kubectl exec -it <pod-name> -n labelmint -- curl http://<service-name>:<port>/health

# Check network policies
kubectl get networkpolicies -n labelmint
kubectl describe networkpolicy <policy-name> -n labelmint
```

### 🔍 Performance Issues

#### High Response Times

```bash
# Check application metrics
curl -s http://localhost:3000/metrics | grep http_request_duration

# Check database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Check database locks
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE granted = false;"

# Check slow queries
psql $DATABASE_URL -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

#### High Memory Usage

```bash
# Check pod memory usage
kubectl top pods -n labelmint --sort-by=memory

# Check node memory usage
kubectl top nodes

# Check application memory leaks
kubectl exec -it <pod-name> -n labelmint -- node --inspect=0.0.0.0:9229 app.js

# Check for memory leaks in logs
kubectl logs <pod-name> -n labelmint | grep -i "memory\|heap"
```

### 📞 Getting Help

For deployment issues:

- **🚨 Production Issues**: oncall@labelmint.com
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/your-org/labelmint/issues)
- **💬 Deployment Questions**: #deployment Slack channel
- **📖 Documentation**: [docs/deployment/](./docs/deployment/)
- **🔧 Infrastructure Issues**: infra@labelmint.com

---

<div align="center">

**🚀 Deployment Excellence through Automation**

Made with ❤️ by the LabelMint DevOps Team

Last updated: October 2024

</div>