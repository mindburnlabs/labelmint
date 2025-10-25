# LabelMint Production Deployment Design

**Date:** 2025-10-25
**Type:** First-time production deployment
**Target Environment:** labelmint.dev / staging.labelmint.dev
**Deployment Strategy:** Hybrid Terraform + Script Automation

## Overview

This document outlines the complete production deployment design for LabelMint, a data labeling platform with TON blockchain payment integration. This is a first-time deployment to AWS infrastructure with minimal scale targeting (no users yet).

## Deployment Context

### Requirements
- **Scale:** Minimum viable infrastructure (budget-conscious)
- **Region:** AWS us-east-1 (N. Virginia)
- **Domains:** labelmint.dev (production), staging.labelmint.dev (staging)
- **Blockchain:** TON Mainnet with USDT payments
- **Secrets:** AWS Secrets Manager for all sensitive data

### Deployment Approach
**Hybrid - Terraform + Script Automation** provides the best balance of:
- Visibility into each deployment phase
- Ability to pause and validate between steps
- Recovery from failures without full restart
- Reusable scripts for future deployments

## Infrastructure Architecture

### AWS Foundation (Terraform-Managed)

#### Networking Layer
- **VPC:** Custom VPC with CIDR 10.0.0.0/16
- **Subnets:** Public and private subnets across 2 availability zones
- **NAT Gateway:** Single NAT for private subnet internet access
- **Load Balancer:** Application Load Balancer for HTTPS traffic distribution
- **Security Groups:** Least-privilege access rules per service

#### Data Layer
- **RDS PostgreSQL:**
  - Instance: db.t4g.micro (burstable, ARM-based for cost efficiency)
  - Storage: 20GB GP3 with auto-scaling to 100GB
  - Multi-AZ: No (cost optimization for initial deployment)
  - Automated backups: 7-day retention
  - Encryption: At rest using KMS key (arn:aws:kms:us-east-1:288761728065:key/mrk-b1e5ada80b98414bbc9fa22714be885c)

- **ElastiCache Redis:**
  - Instance: cache.t3.micro
  - Node count: 1 (single node for cost optimization)
  - Persistence: AOF enabled for data durability
  - Use cases: Session storage, caching, bot state management

- **S3 Storage:**
  - Bucket: labelmint-production-assets
  - Purpose: Static assets, task images, labeled data
  - Lifecycle policies: Archive to Glacier after 90 days
  - Versioning: Enabled for critical data

#### Compute Layer
- **EKS Cluster:**
  - Kubernetes version: 1.28+
  - Control plane: Managed by AWS
  - Node group: 2 t3.small instances (2 vCPU, 2GB RAM each)
  - Auto-scaling: Min 2, max 4 nodes
  - Spot instances: Use where possible for worker nodes

#### Security & Secrets
- **AWS Secrets Manager:**
  - Store all production secrets (DB passwords, JWT secrets, API keys, TON private keys)
  - Automatic rotation for database credentials
  - Integration with Kubernetes via External Secrets Operator

- **KMS Encryption:**
  - Use existing key for all encryption needs
  - RDS encryption at rest
  - S3 bucket encryption
  - Secrets Manager encryption

- **IAM & IRSA:**
  - Service accounts with IAM roles for pod-level permissions
  - Least-privilege access policies
  - No long-lived credentials in pods

#### Cost Estimate
- **RDS PostgreSQL:** ~$15/month
- **ElastiCache Redis:** ~$12/month
- **EKS Cluster:** ~$75/month (control plane + nodes)
- **Load Balancer:** ~$20/month
- **NAT Gateway:** ~$35/month
- **Secrets Manager:** ~$5/month
- **Data transfer & misc:** ~$20/month
- **Total:** ~$180-200/month

## Application Deployment Strategy

### Kubernetes Architecture

#### Namespace Organization
```
labelmint-production/    # Main application services
monitoring/              # Prometheus, Grafana, AlertManager, Loki
ingress-nginx/          # NGINX Ingress Controller
cert-manager/           # SSL certificate management
external-secrets/       # AWS Secrets Manager integration
```

#### Application Services

**1. Frontend (labelmint-web)**
- **Technology:** Next.js 15 with React 19
- **Replicas:** 2
- **Resources:** 256Mi memory, 200m CPU (request), 512Mi memory, 500m CPU (limit)
- **Container:** Built from `infrastructure/docker/labelmint-frontend-optimized.dockerfile`
- **Port:** 3000
- **Health checks:** HTTP GET /api/health
- **Ingress:** labelmint.dev → service

**2. API Gateway**
- **Technology:** Node.js Express
- **Replicas:** 2
- **Resources:** 256Mi memory, 200m CPU (request), 512Mi memory, 500m CPU (limit)
- **Port:** 3104
- **Purpose:** Authentication, routing, rate limiting
- **Ingress:** api.labelmint.dev → service

**3. Labeling Backend**
- **Technology:** Node.js Express
- **Replicas:** 2
- **Resources:** 512Mi memory, 300m CPU (request), 1Gi memory, 700m CPU (limit)
- **Port:** 3101
- **Purpose:** Core task management, project logic, submissions

**4. Payment Backend**
- **Technology:** Node.js Express with TON SDK
- **Replicas:** 2
- **Resources:** 512Mi memory, 300m CPU (request), 1Gi memory, 700m CPU (limit)
- **Port:** 3103
- **Purpose:** TON/USDT payment processing, smart contract interaction

**5. Telegram Bots**
- **Client Bot:** User-facing bot (1 replica)
- **Worker Bot:** Task worker bot (1 replica)
- **Resources:** 256Mi memory, 100m CPU each
- **Ports:** 3105 (client), 3106 (worker)
- **Mode:** Webhook-based for reliability

### Container Strategy

#### Image Building
- **Multi-stage builds:** Optimize image sizes (frontend ~150MB, backend ~100MB)
- **Base images:** node:20-alpine for minimal footprint
- **Registry:** Amazon ECR (Elastic Container Registry)
- **Tagging strategy:** Git commit SHA + semantic version
  - Example: `288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-web:9382583`
  - Also tag: `latest` for convenience

#### Dockerfiles
- Frontend: `infrastructure/docker/labelmint-frontend-optimized.dockerfile`
- Backend services: `infrastructure/docker/labelmint-backend-optimized.dockerfile`
- Optimizations: Layer caching, minimal dependencies, security scanning

### Ingress & SSL

#### NGINX Ingress Controller
- **Installation:** Via Helm chart
- **Service type:** LoadBalancer (creates AWS ALB)
- **Configuration:** Rate limiting, request size limits, timeouts

#### SSL Certificates
- **Provider:** Let's Encrypt via Cert-Manager
- **Issuer:** ACME HTTP-01 challenge
- **Renewal:** Automatic (30 days before expiry)
- **Certificates:**
  - labelmint.dev
  - api.labelmint.dev
  - staging.labelmint.dev

#### Routing Rules
```
labelmint.dev         → labelmint-web:3000
api.labelmint.dev     → api-gateway:3104
*.labelmint.dev       → Default backend (404)
```

### Configuration Management

#### ConfigMaps (Non-Sensitive)
```yaml
NODE_ENV=production
LOG_LEVEL=info
FEATURE_PAYMENTS=true
FEATURE_BOTS=true
CORS_ORIGIN=https://labelmint.dev
```

#### Secrets (via AWS Secrets Manager)
- Database connection strings
- Redis URLs with passwords
- JWT signing secrets
- Telegram bot tokens
- TON wallet private keys
- API keys (TON API, monitoring services)

#### External Secrets Operator
- Syncs secrets from AWS Secrets Manager to Kubernetes Secrets
- Refresh interval: 5 minutes
- Automatic rotation when secrets change in AWS

#### Kustomize Overlays
```
infrastructure/k8s/
├── base/              # Base manifests (deployments, services)
└── overlays/
    ├── production/    # Production-specific configs
    └── staging/       # Staging-specific configs
```

## Blockchain & Payment Integration

### TON Smart Contract Deployment

#### Contracts to Deploy
1. **Payment Escrow Contract**
   - Purpose: Hold USDT until task completion
   - Features: Multi-signature release, timeout refunds
   - Gas estimate: ~0.5 TON per deployment

2. **USDT Integration Contract**
   - Purpose: Interface with TON USDT master contract
   - Master contract: `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`
   - Features: Transfer, balance checks, allowances

3. **Consensus Contract**
   - Purpose: Dispute resolution via worker consensus
   - Features: Vote aggregation, automated payouts
   - Threshold: Configurable consensus percentage

#### Deployment Process
- **Script:** `scripts/deploy-smart-contracts.ts`
- **Network:** TON Mainnet (`https://toncenter.com/api/v2/jsonRPC`)
- **Deployer wallet:** Provided wallet with private key stored in AWS Secrets Manager
- **Post-deployment:** Store contract addresses in Secrets Manager

#### Wallet Configuration
- **Merchant wallet:** Your provided TON wallet
- **Purpose:** Receive platform fees, pay gas costs
- **Security:** Private key never in code, only in AWS Secrets Manager
- **Funding:** Ensure sufficient TON for gas (~10 TON initial balance)

#### Payment Flow
1. Project owner deposits USDT to escrow contract
2. Escrow emits event → Payment backend listens
3. Worker completes task → Submits via Labeling backend
4. Consensus validation → Quality threshold met
5. Escrow releases USDT → Worker wallet
6. Transaction confirmed → Update database status

#### Monitoring
- **Transaction tracking:** Poll TON API for contract events
- **Alerts:** Failed payments, low gas balance, stuck transactions
- **Metrics:** Payment volume, success rate, gas costs
- **Explorer integration:** Link to tonscan.org for transparency

## Monitoring & Observability Stack

### Core Components

#### Prometheus (Metrics)
- **Deployment:** StatefulSet with persistent volume
- **Retention:** 15 days
- **Scrape interval:** 30 seconds
- **Targets:**
  - Kubernetes nodes and pods (via cAdvisor)
  - Application /metrics endpoints
  - PostgreSQL exporter
  - Redis exporter
  - NGINX Ingress metrics

#### Grafana (Visualization)
- **Deployment:** Deployment with 1 replica
- **Data sources:** Prometheus, Loki, Tempo
- **Dashboards:** Pre-configured from `infrastructure/monitoring/grafana/dashboards/`
  - `labelmint-overview.json`: System overview
  - `backend-overview.json`: Backend service metrics
  - `security-overview.json`: Security monitoring
- **Access:** grafana.labelmint.dev (internal only, requires VPN or IP whitelist)

#### Loki (Logs)
- **Deployment:** StatefulSet with S3 storage backend
- **Retention:** 7 days in S3, 1 day in memory
- **Log sources:** All Kubernetes pods via Promtail
- **Query capabilities:** Full-text search, label filtering

#### Tempo (Distributed Tracing)
- **Deployment:** StatefulSet with S3 storage backend
- **Sampling:** 10% of requests
- **Integration:** Automatic trace propagation via OpenTelemetry

#### AlertManager (Alerting)
- **Deployment:** StatefulSet with HA setup (2 replicas)
- **Notification channels:** Email (initial), Slack/Discord (configurable)
- **Alert routing:** Severity-based (critical, warning, info)

### Health Checks

#### Kubernetes Probes
**Liveness probes:** Restart pod if unhealthy
- HTTP GET /health every 10s
- Failure threshold: 3 consecutive failures

**Readiness probes:** Remove from service if not ready
- HTTP GET /ready every 5s
- Initial delay: 10s

#### Service Health Endpoints
- `/health`: Basic health check (200 OK if service running)
- `/ready`: Ready to serve traffic (checks dependencies)
  - Database connection
  - Redis connection
  - External API availability

#### External Dependencies
- **Database:** Connection pool monitoring, query latency
- **Redis:** Ping/pong checks, memory usage
- **TON RPC:** API response time, block sync status
- **Telegram API:** Webhook delivery status

### Alert Rules

#### Critical Alerts (Immediate Action)
- Service down (all replicas unhealthy) → Page on-call
- Database connection lost → Page on-call
- Payment processing failure rate >10% → Page on-call
- Disk space >90% → Page on-call

#### Warning Alerts (Investigate Soon)
- High error rate (>5% of requests) → Slack notification
- High response time (p95 >2s) → Slack notification
- Memory usage >80% → Slack notification
- Low TON wallet balance (<5 TON) → Email notification

#### Info Alerts (Awareness)
- Deployment started/completed → Slack notification
- Certificate renewal → Email notification
- Backup completed → Email notification

### Pre-Configured Dashboards

#### System Overview (`labelmint-overview.json`)
- Request rate, error rate, response time (RED metrics)
- CPU and memory usage per service
- Database connection pool stats
- Active user count
- Payment transaction volume

#### Backend Overview (`backend-overview.json`)
- API endpoint performance breakdown
- Database query performance
- Redis cache hit rate
- Background job queue depth
- Error logs (last 100)

#### Security Overview (`security-overview.json`)
- Failed authentication attempts
- Rate limit violations
- Suspicious IP activity
- Certificate expiry status
- Security scan results

## Deployment Execution Sequence

### Phase 1: Pre-Deployment Setup

**Actions:**
1. Verify AWS CLI access and credentials
2. Create production environment variable file
3. Store all secrets in AWS Secrets Manager:
   - Database credentials
   - JWT secrets
   - Telegram bot tokens
   - TON wallet private key
   - API keys
4. Configure DNS nameservers for labelmint.dev to AWS Route53

**Validation:**
- `aws sts get-caller-identity` returns correct account
- All required secrets exist in Secrets Manager
- DNS propagation complete (test with `dig labelmint.dev`)

### Phase 2: Infrastructure Provisioning

**Actions:**
1. Initialize Terraform state backend (S3 + DynamoDB)
2. Run `terraform plan` with production variables
3. Run `terraform apply` to create:
   - VPC, subnets, routing tables, NAT gateway
   - Security groups and network ACLs
   - RDS PostgreSQL instance
   - ElastiCache Redis cluster
   - EKS cluster and node groups
   - S3 buckets with lifecycle policies
   - IAM roles and policies
4. Configure kubectl to access EKS cluster

**Commands:**
```bash
cd infrastructure/terraform
terraform init -backend-config=environments/production.backend.tfvars
terraform plan -var-file=environments/production.tfvars
terraform apply -var-file=environments/production.tfvars -auto-approve
aws eks update-kubeconfig --region us-east-1 --name labelmint-production
```

**Validation:**
- `kubectl get nodes` shows 2 ready nodes
- `psql -h <rds-endpoint>` connects successfully
- `redis-cli -h <redis-endpoint>` connects successfully

### Phase 3: Kubernetes Bootstrap

**Actions:**
1. Install NGINX Ingress Controller (creates AWS ALB)
2. Install Cert-Manager for SSL certificates
3. Install External Secrets Operator
4. Create namespaces and RBAC policies
5. Configure ExternalSecrets to sync from AWS Secrets Manager
6. Install Prometheus Operator and monitoring stack

**Commands:**
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace

helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set installCRDs=true

helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace

kubectl create namespace labelmint-production
kubectl create namespace monitoring

kubectl apply -f infrastructure/k8s/base/external-secrets/
kubectl apply -f infrastructure/monitoring/prometheus/
```

**Validation:**
- `kubectl get pods -n ingress-nginx` all running
- `kubectl get pods -n cert-manager` all running
- `kubectl get externalsecrets -n labelmint-production` all synced
- `kubectl get pods -n monitoring` all running

### Phase 4: Container Images

**Actions:**
1. Authenticate Docker to Amazon ECR
2. Build frontend Docker image
3. Build backend Docker image
4. Tag images with git commit SHA and latest
5. Push images to ECR

**Commands:**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 288761728065.dkr.ecr.us-east-1.amazonaws.com

# Build frontend
docker build -f infrastructure/docker/labelmint-frontend-optimized.dockerfile -t labelmint-web:9382583 .
docker tag labelmint-web:9382583 288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-web:9382583
docker tag labelmint-web:9382583 288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-web:latest
docker push 288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-web:9382583
docker push 288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-web:latest

# Build backend (used for all backend services)
docker build -f infrastructure/docker/labelmint-backend-optimized.dockerfile -t labelmint-backend:9382583 .
docker tag labelmint-backend:9382583 288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-backend:9382583
docker tag labelmint-backend:9382583 288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-backend:latest
docker push 288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-backend:9382583
docker push 288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-backend:latest
```

**Validation:**
- `aws ecr describe-images --repository-name labelmint-web` shows pushed images
- `aws ecr describe-images --repository-name labelmint-backend` shows pushed images

### Phase 5: Smart Contract Deployment

**Actions:**
1. Verify TON wallet has sufficient balance (>10 TON)
2. Run contract deployment script
3. Wait for contract deployment confirmations
4. Store contract addresses in AWS Secrets Manager
5. Verify contracts on TON explorer

**Commands:**
```bash
# Set TON private key from environment
export TON_PRIVATE_KEY="1279e5094e0561c37f118cf02e06bfe21eacf77dfdca67f26f5e1657a3f7bf47"
export TON_NETWORK="mainnet"

# Run deployment script
node scripts/deploy-smart-contracts.ts

# Store addresses in Secrets Manager
aws secretsmanager update-secret \
  --secret-id labelmint/production/ton-contract-address \
  --secret-string "0:<escrow-contract-address>"

aws secretsmanager update-secret \
  --secret-id labelmint/production/usdt-contract-address \
  --secret-string "0:<usdt-integration-address>"
```

**Validation:**
- Script outputs "Deployment successful" with contract addresses
- Contracts visible on https://tonscan.org
- Test contract call succeeds (e.g., check balance)

### Phase 6: Application Deployment

**Actions:**
1. Run database migrations
2. Apply Kubernetes manifests using Kustomize
3. Deploy all services (web, api-gateway, backends, bots)
4. Configure ingress rules with SSL
5. Update DNS to point to load balancer

**Commands:**
```bash
# Run database migrations
kubectl run -it --rm migration --image=288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-backend:9382583 \
  --restart=Never --env-from=configmap/app-config --env-from=secret/app-secrets \
  -- npm run db:migrate

# Deploy applications
kubectl apply -k infrastructure/k8s/overlays/production/

# Wait for rollout
kubectl rollout status deployment/labelmint-web -n labelmint-production
kubectl rollout status deployment/api-gateway -n labelmint-production
kubectl rollout status deployment/labeling-backend -n labelmint-production
kubectl rollout status deployment/payment-backend -n labelmint-production
kubectl rollout status deployment/client-bot -n labelmint-production
kubectl rollout status deployment/worker-bot -n labelmint-production

# Get load balancer DNS
kubectl get ingress -n labelmint-production
```

**DNS Update:**
- Create A/CNAME records in DNS provider:
  - `labelmint.dev` → Load balancer DNS
  - `api.labelmint.dev` → Load balancer DNS

**Validation:**
- `kubectl get pods -n labelmint-production` all running
- `curl https://labelmint.dev/api/health` returns 200 OK
- `curl https://api.labelmint.dev/health` returns 200 OK

### Phase 7: Monitoring Deployment

**Actions:**
1. Verify Prometheus is scraping all targets
2. Import Grafana dashboards
3. Configure AlertManager notification channels
4. Test alert delivery

**Commands:**
```bash
# Access Grafana (port-forward for initial setup)
kubectl port-forward -n monitoring svc/grafana 3000:80

# Import dashboards
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @infrastructure/monitoring/grafana/dashboards/labelmint-overview.json

# Configure alerts
kubectl apply -f infrastructure/monitoring/prometheus/alerts/
```

**Validation:**
- Prometheus UI shows all targets as "UP"
- Grafana dashboards display metrics
- Test alert fires and notification received

### Phase 8: Final Validation

**Actions:**
1. Run comprehensive health checks
2. Test end-to-end user flow
3. Verify Telegram bot webhooks
4. Test payment integration
5. Check monitoring and alerts

**Smoke Tests:**
```bash
# Run smoke test script
bash scripts/smoke-tests.sh https://labelmint.dev

# Manual tests:
# 1. Register new user via web app
# 2. Create project via API
# 3. Submit task via Telegram bot
# 4. Process payment (testnet USDT first)
# 5. Verify consensus and payout
```

**Validation Checklist:**
- [ ] Web app loads and user can register
- [ ] API endpoints respond correctly
- [ ] Database queries succeed
- [ ] Redis caching works
- [ ] Telegram bots respond to messages
- [ ] TON payment flow completes
- [ ] Monitoring dashboards show data
- [ ] Alerts fire correctly
- [ ] SSL certificates valid
- [ ] All pods healthy

## Rollback Strategy

### Infrastructure Rollback
**If Terraform apply fails:**
```bash
terraform destroy -var-file=environments/production.tfvars -auto-approve
# Fix issues, then reapply
terraform apply -var-file=environments/production.tfvars -auto-approve
```

### Application Rollback
**If deployment fails or causes issues:**
```bash
# Rollback specific deployment
kubectl rollout undo deployment/labelmint-web -n labelmint-production

# Rollback all deployments to previous version
kubectl rollout undo deployment --all -n labelmint-production

# Or redeploy previous image tag
kubectl set image deployment/labelmint-web labelmint-web=288761728065.dkr.ecr.us-east-1.amazonaws.com/labelmint-web:<previous-sha> -n labelmint-production
```

### Database Rollback
**If migrations cause issues:**
```bash
# Restore from automated RDS snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier labelmint-production-restored \
  --db-snapshot-identifier <snapshot-id>

# Or rollback migrations (if reversible)
kubectl run -it --rm migration --image=... -- npm run db:migrate:rollback
```

### Smart Contract Rollback
**Note:** Smart contracts are immutable once deployed. Cannot rollback.
**Mitigation:** Deploy new contract version if bugs found, update addresses in Secrets Manager

### Emergency Procedures
**Complete system failure:**
1. Scale deployments to 0 replicas (stop all traffic)
2. Investigate root cause
3. Fix issue
4. Scale back up gradually
5. Monitor closely

**Partial outage:**
1. Identify failing service
2. Check logs: `kubectl logs -n labelmint-production deployment/<service>`
3. Rollback only affected service
4. Scale up replicas if needed

## DNS Configuration

### Required DNS Records

**Production:**
```
labelmint.dev           A/CNAME  → <load-balancer-dns>
api.labelmint.dev       A/CNAME  → <load-balancer-dns>
*.labelmint.dev         A/CNAME  → <load-balancer-dns> (wildcard for future subdomains)
```

**Staging:**
```
staging.labelmint.dev   A/CNAME  → <staging-load-balancer-dns>
```

**TTL:** 300 seconds (5 minutes) for quick updates during initial deployment

### SSL Certificates

**Cert-Manager Configuration:**
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@labelmint.dev
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

**Certificate Resources:**
- Automatic creation via ingress annotations
- Renewal 30 days before expiry
- Alert if renewal fails

## Security Hardening

### Pod Security Standards
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: labelmint-production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

**Enforced policies:**
- No privileged containers
- No host network/PID/IPC access
- Drop all capabilities, add only required
- Run as non-root user
- Read-only root filesystem where possible

### Network Policies
```yaml
# Default deny all ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: labelmint-production
spec:
  podSelector: {}
  policyTypes:
  - Ingress

# Allow specific service-to-service communication
# Allow ingress controller → frontend
# Allow frontend → api-gateway
# Allow api-gateway → backends
# Allow backends → database/redis
```

### Rate Limiting
**NGINX Ingress:**
- 100 requests/minute per IP (web endpoints)
- 1000 requests/minute per IP (API endpoints)
- Burst: 20 requests
- Return 429 Too Many Requests when exceeded

### CORS Configuration
```
CORS_ORIGIN=https://labelmint.dev
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400
```

### Security Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

### WAF Rules (AWS WAF)
- SQL injection protection
- XSS protection
- Known bad IPs blocklist
- Rate-based rules (10000 req/5min per IP)
- Geographic restrictions (optional)

## Backup & Disaster Recovery

### Database Backups
**Automated RDS Snapshots:**
- Frequency: Daily at 03:00 UTC
- Retention: 7 days
- Cross-region copy: Enabled (to us-west-2 for DR)

**Manual Backups:**
- Before major migrations
- Before production deployments
- Retention: 30 days

### Redis Persistence
**AOF (Append-Only File):**
- Enabled with `appendfsync everysec`
- Backup AOF to S3 daily
- Retention: 7 days

### Application Data
**S3 Versioning:**
- Enabled on all buckets
- Lifecycle policy: Keep 30 versions
- Cross-region replication to us-west-2

### Configuration Backups
- All Kubernetes manifests in git
- Terraform state in S3 with versioning
- Secrets documented (not stored in git)

### Disaster Recovery Plan
**RPO (Recovery Point Objective):** 1 hour
**RTO (Recovery Time Objective):** 4 hours

**Recovery steps:**
1. Spin up infrastructure in DR region using Terraform
2. Restore latest RDS snapshot
3. Restore Redis from AOF backup
4. Deploy application from ECR images
5. Update DNS to point to DR region
6. Validate functionality

## Environment Variables

### Production Configuration
```bash
NODE_ENV=production
ENVIRONMENT=production
APP_VERSION=1.0.0

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Feature Flags
FEATURE_PAYMENTS=true
FEATURE_BOTS=true
FEATURE_MONITORING=true
FEATURE_DEBUG_TOOLS=false
FEATURE_ANALYTICS=true

# Security
CORS_ORIGIN=https://labelmint.dev
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Performance
CACHE_TTL=600
SESSION_TTL=86400
MAX_UPLOAD_SIZE=10485760
CONCURRENT_TASKS_PER_USER=5

# TON Blockchain
TON_NETWORK=mainnet
TON_RPC_ENDPOINT=https://toncenter.com/api/v2/jsonRPC

# URLs (resolved via ingress)
NEXT_PUBLIC_API_URL=https://api.labelmint.dev
WEB_APP_URL=https://labelmint.dev
```

### Secrets (in AWS Secrets Manager)
```
labelmint/production/database-url
labelmint/production/redis-url
labelmint/production/jwt-secret
labelmint/production/session-secret
labelmint/production/telegram-client-bot-token
labelmint/production/telegram-worker-bot-token
labelmint/production/ton-private-key
labelmint/production/ton-contract-address
labelmint/production/usdt-contract-address
labelmint/production/ton-api-key
```

## Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Verify all services running and healthy
- [ ] Test complete user flows
- [ ] Configure alert notification channels
- [ ] Set up status page (e.g., status.labelmint.dev)
- [ ] Document production access procedures

### Week 1
- [ ] Monitor error rates and performance
- [ ] Tune resource limits based on actual usage
- [ ] Set up log retention policies
- [ ] Create runbooks for common issues
- [ ] Schedule first backup test restore

### Week 2
- [ ] Review security scan results
- [ ] Optimize database queries based on slow query log
- [ ] Set up synthetic monitoring (uptime checks)
- [ ] Document incident response procedures
- [ ] Plan capacity scaling triggers

### Ongoing
- [ ] Weekly infrastructure review
- [ ] Monthly disaster recovery drill
- [ ] Quarterly security audit
- [ ] Regular dependency updates
- [ ] Cost optimization review

## Success Criteria

Deployment is considered successful when:
1. ✅ All Kubernetes pods are running and healthy
2. ✅ Web application accessible at https://labelmint.dev
3. ✅ API endpoints responding correctly at https://api.labelmint.dev
4. ✅ SSL certificates valid and auto-renewing
5. ✅ Database migrations completed successfully
6. ✅ Redis caching operational
7. ✅ Telegram bots responding to commands
8. ✅ TON smart contracts deployed and functional on mainnet
9. ✅ Payment flow (deposit → task → payout) works end-to-end
10. ✅ Monitoring dashboards showing data
11. ✅ Alerts configured and tested
12. ✅ All health checks passing
13. ✅ No critical errors in logs
14. ✅ Backup systems operational

## Support & Escalation

### Internal Resources
- **Deployment logs:** CloudWatch, Kubernetes logs
- **Monitoring:** Grafana dashboards
- **Documentation:** This design doc, runbooks

### External Support
- **AWS Support:** Enterprise support plan (if subscribed)
- **TON Developer Community:** Telegram @ton_dev
- **Kubernetes Community:** GitHub, Slack

### Emergency Contacts
- **On-call engineer:** [To be defined]
- **Backup contact:** [To be defined]
- **Infrastructure lead:** [To be defined]

## Conclusion

This design provides a comprehensive, production-ready deployment strategy for LabelMint. The hybrid approach balances automation with visibility, allowing for careful validation at each step while leveraging scripts for repeatability.

Key strengths of this design:
- ✅ Cost-optimized for minimal initial scale
- ✅ Security-first with encryption and least-privilege access
- ✅ Observable with comprehensive monitoring
- ✅ Resilient with health checks and auto-recovery
- ✅ Scalable with auto-scaling and resource management
- ✅ Recoverable with automated backups and DR plan

Next steps: Proceed to Phase 5 (Worktree Setup) and Phase 6 (Implementation Planning) to execute this design.
