# DevOps Engineer – LabelMint Project Tasks

You are the DevOps specialist for LabelMint. The stack already ships with Docker Compose, Kubernetes manifests, Terraform modules, monitoring, and GitHub Actions pipelines.

## Project Status (October 2025)
- **Current State**: ✅ ~90% complete – infra scaffolding is comprehensive.
- **Priority**: LOW-to-MEDIUM – focus on TON node operations, secret rotation, and observability polish.
- **Estimated Focused Tasks**: ~5-8.
- **Last Audited**: October 24, 2025 (inspection of `infrastructure/`, `config/`, GitHub Actions).

## Verified Infrastructure Snapshot
- Docker Compose orchestrates all services (`infrastructure/docker/`, `services/*/Dockerfile`).
- Kubernetes manifests + Helm values present under `infrastructure/k8s/`.
- Terraform modules for AWS/cloud footprint exist (`infrastructure/terraform/`).
- Monitoring stack (Prometheus, Grafana, Loki, Tempo, Alertmanager) defined in `infrastructure/monitoring/`.
- CI/CD pipelines configured via `.github/workflows/`.
- TON deployment skeleton available (`infrastructure/ton-deployment.yaml`).

## Critical Tasks (Do These First)

1. **Production TON node + RPC provisioning**  
   - Files: `infrastructure/ton-deployment.yaml`, `infrastructure/monitoring/ton`, Terraform modules.  
   - Deliverable: Production-ready TON node (or external provider integration), secrets management for RPC keys, health probes, and alerting.

2. **Secret rotation + vault strategy**  
   - Files: `config/environments/*.env`, `infrastructure/security/`, `scripts/setup-secrets.sh`.  
  - Replace `.env`-style placeholders with secret manager/KMS integration. Document rotation cadence for TON keys, DB credentials, and webhook tokens.

3. **Production deployment hardening**  
   - Files: `infrastructure/environments/production/`, `nginx/`, `infrastructure/security`  
   - Tasks: TLS termination, WAF/firewall rules, load balancer setup, backup/restore automation, disaster recovery rehearsal.

## High-Priority Follow-Ups

4. **Observability alignment for new features**  
   - Add dashboards + alert rules for:  
     - TON payout helper metrics (`services/labeling-backend/src/services/tonPaymentService.optimized.ts`).  
     - Enterprise analytics API latency (`services/enterprise-api/src/controllers/AnalyticsController.ts`).  
     - Wallet API throughput (`services/payment-backend/src/api/payments`).  
   - Update Grafana dashboards + Alertmanager routes.

5. **CI/CD environment promotion**  
   - Files: `.github/workflows/`, `scripts/`  
   - Implement per-env deploy workflows, manual approvals, security scanning (SAST/DAST), and TON contract deployment jobs.

6. **Runtime configuration governance**  
   - Standardise environment variables across services (ApiService base URLs, TON endpoints).  
   - Provide config maps + secrets for Kubernetes deployments; keep documentation in `docs/DEPLOYMENT.md`.

## Medium Priority / Polish
- Cost optimisation: evaluate instance sizing, storage tiers, and monitoring retention.  
- Introduce chaos testing / load validation for TON payouts and analytics bursts.  
- Harden SSH/bastion access; ensure audit trails land in central logging (`infrastructure/security-monitoring/`).  
- Prepare incident runbooks for payout failures, TON node outages, and analytics lag.

## Coordination Notes
- **Blockchain Dev**: confirm TON node endpoints, RPC limits, and contract deployment pipeline.  
- **Backend Dev**: ensure payout helper metrics/logs feed into monitoring.  
- **Frontend Dev**: provide CDN + static asset deployment strategy once ApiService bootstrapping lands.  
- **Testing Engineer**: integrate infrastructure smoke tests into CI/CD.

## Deliverables
1. TON node (or provider contract) with monitoring + alerting.  
2. Secrets managed via vault/KMS, rotation policy documented.  
3. Hardened production deployment guides + automation.  
4. Observability dashboards + alerts covering TON payouts, analytics, wallet APIs.  
5. CI/CD promotion pipeline with security scanning and rollback strategy.

## Success Criteria
- ✅ TON infrastructure resilient, monitored, and documented.  
- ✅ Secrets rotated automatically with least-privilege access enforced.  
- ✅ Production deployment reproducible via IaC + runbooks.  
- ✅ Dashboards/alerts catch payout or analytics regressions quickly.  
- ✅ Security scanning integrated and passing before promotion.

## Working Guidelines
- Keep everything as code (Terraform, Helm, GitHub Actions).  
- Enforce immutable builds and provenance for container images.  
- Add operational checklists/runbooks to `docs/` for every new platform capability.  
- Coordinate release windows with engineering + blockchain teams when contracts or endpoints change.
