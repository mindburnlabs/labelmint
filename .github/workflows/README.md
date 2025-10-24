# LabelMint CI/CD Workflows

## Overview

This directory contains the GitHub Actions workflows that power the LabelMint development pipeline. We've consolidated multiple redundant workflows into a unified, efficient system.

## 🚀 **Primary Workflows**

### [`labelmint-ci-cd.yml`](./labelmint-ci-cd.yml) - **Main Unified Pipeline**
**Replaces**: `ci.yml`, `main.yml`, `test.yml`, `unified-ci-cd.yml`, `deploy-production.yml`

**Triggers**:
- Push to `main`, `develop`, `staging` branches
- Pull requests to `main`, `develop`
- Daily scheduled runs (2 AM UTC)
- Manual workflow dispatch

**Key Features**:
- ✅ **Node.js 20 LTS** standardization across all jobs
- 🏗️ **Parallel execution** for maximum efficiency
- 🔍 **Comprehensive testing** (unit, integration, E2E, contracts)
- 🔒 **Advanced security scanning** (CodeQL, Semgrep, Snyk, Trivy)
- 🐳 **Multi-platform Docker builds** (amd64, arm64)
- 🚀 **Automated deployments** with rollback capabilities
- 📊 **Performance testing** for staging environment
- 🧹 **Automated cleanup** of old artifacts

### [`security.yml`](./security.yml) - **Specialized Security Scanning**
**Purpose**: Dedicated security scanning with advanced tools

**Security Tools**:
- **CodeQL**: Semantic code analysis
- **Semgrep**: Static analysis (SAST)
- **Snyk**: Dependency vulnerability scanning
- **Trivy**: Container security scanning
- **Gitleaks**: Secret detection
- **OSSF Scorecard**: Security scorecard analysis

### [`cleanup-cache.yml`](./cleanup-cache.yml) - **Cache Maintenance**
**Purpose**: Automatic cleanup of GitHub Actions cache

**Schedule**: Weekly on Sundays at 3 AM UTC

## 🔄 **Supporting Workflows**

### [`dependabot.yml`](./dependabot.yml) - **Dependency Updates**
Automated dependency vulnerability scanning and updates.

### [`pull-request.yml`](./pull-request.yml) - **PR Validation**
Additional checks specific to pull requests.

### [`backup.yml`](./backup.yml) - **Data Backup**
Automated backup of production data and configurations.

### [`rollback.yml`](./rollback.yml) - **Manual Rollback**
Manual rollback procedure for emergency situations.

## 📊 **Unified Workflow Architecture**

```
labelmint-ci-cd.yml
├── code-quality           # Lint, format, TypeScript, basic security
├── test-matrix           # Unit, Integration, E2E, Contract tests
├── security-scan         # CodeQL, Semgrep, Snyk
├── build-and-push        # Multi-platform Docker builds
├── performance-test      # Lighthouse, k6 (staging only)
├── deploy               # Terraform-based deployment
├── auto-rollback        # Automatic rollback on failure (prod only)
└── cleanup              # Artifact cleanup and monitoring
```

## 🛠️ **Configuration Details**

### Environment Variables
- `NODE_VERSION`: `20` (standardized across all jobs)
- `PNPM_VERSION`: `9.15.1`
- `REGISTRY`: `ghcr.io`
- `CACHE_VERSION`: `v3`

### Required Secrets
```yaml
# General
CODECOV_TOKEN:              # Code coverage reporting
SLACK_WEBHOOK_URL:          # Deployment notifications
LHCI_GITHUB_APP_TOKEN:      # Lighthouse CI

# AWS/Infrastructure
AWS_ACCESS_KEY_ID:          # AWS access key
AWS_SECRET_ACCESS_KEY:      # AWS secret key
AWS_ROLE_ARN:              # AWS IAM role
AWS_PROD_ACCESS_KEY_ID:    # Production AWS access key
AWS_PROD_SECRET_ACCESS_KEY: # Production AWS secret key

# Security
SNYK_TOKEN:                # Snyk security scanning
SEMGREP_APP_TOKEN:         # Semgrep scanning
GITHUB_TOKEN:              # GitHub API access (automatically provided)
```

### Deployment Targets
- **Staging**: `develop` & `staging` branches → `https://staging.labelmint.it`
- **Production**: `main` branch → `https://labelmint.it`

## 🚦 **Workflow Triggers**

### Automated Triggers
| Branch | Event | Action |
|--------|-------|--------|
| `main` | Push | Full pipeline + Production deployment |
| `develop` | Push | Full pipeline + Staging deployment |
| `staging` | Push | Full pipeline + Staging deployment |
| Any | Pull Request | Full pipeline (no deployment) |
| Daily | Schedule | Security scans and tests |

### Manual Triggers
- **Workflow Dispatch**: Deploy to specific environment
- **Skip Tests**: Force deployment without running tests
- **Force Deploy**: Bypass all checks (emergency use only)

## 🔧 **Caching Strategy**

### Multi-level Caching
1. **pnpm Store Cache**: `pnpm-store-${{ env.CACHE_VERSION }}-${{ hashFiles('**/pnpm-lock.yaml') }}`
2. **Node Modules Cache**: `node-modules-${{ env.CACHE_VERSION }}-${{ hashFiles('**/pnpm-lock.yaml') }}`
3. **Docker Build Cache**: GitHub Actions cache with component-scoped storage
4. **Automatic Cleanup**: Weekly cache cleanup to prevent storage bloat

### Cache Invalidation
- **Primary**: Changes in `pnpm-lock.yaml`
- **Secondary**: Manual `CACHE_VERSION` bump
- **Emergency**: Delete cache via GitHub UI or `cleanup-cache.yml`

## 📈 **Performance Optimizations**

### Parallel Execution
- **Code Quality** runs in parallel with **Security Scanning**
- **Test Matrix** executes different test types simultaneously
- **Build Matrix** builds all container images in parallel

### Resource Efficiency
- **Conditional Jobs**: Skip unnecessary jobs based on branch/event
- **Fail-fast Disabled**: Continue testing even if some tests fail
- **Smart Caching**: Reuse dependencies and build artifacts
- **Timeout Management**: Per-job timeouts to prevent hanging

## 🛡️ **Security Features**

### Multi-layered Security
1. **Code Analysis**: CodeQL, Semgrep SAST
2. **Dependency Scanning**: Snyk, npm audit
3. **Container Security**: Trivy vulnerability scanning
4. **Secret Detection**: Gitleaks secret scanning
5. **Supply Chain**: OSSF Scorecard analysis

### Security Reporting
- **SARIF Upload**: All security findings uploaded to GitHub Security tab
- **PR Comments**: Security summaries on pull requests
- **Slack Notifications**: Critical security issues sent to Slack

## 📝 **Best Practices**

### Branch Protection Rules
1. **Main Branch**: Require PR review + status checks
2. **Develop Branch**: Require status checks
3. **Required Status Checks**: All CI/CD jobs must pass

### Deployment Safety
1. **Staging First**: Always deploy to staging before production
2. **Health Checks**: Comprehensive health checks after deployment
3. **Automatic Rollback**: Auto-rollback on deployment failure
4. **Manual Override**: Emergency manual rollback available

### Monitoring & Alerting
1. **Slack Integration**: Deployment notifications to `#deployments`
2. **GitHub Status Checks**: Real-time status on PRs and commits
3. **Performance Monitoring**: Lighthouse CI and k6 load testing
4. **Artifact Retention**: 7-day retention for test artifacts

## 🔄 **Migration Guide**

### From Old Workflows
The unified workflow replaces these legacy workflows:
- ❌ `ci.yml` → ✅ `labelmint-ci-cd.yml`
- ❌ `main.yml` → ✅ `labelmint-ci-cd.yml`
- ❌ `test.yml` → ✅ `labelmint-ci-cd.yml`
- ❌ `unified-ci-cd.yml` → ✅ `labelmint-ci-cd.yml`
- ❌ `deploy-production.yml` → ✅ `labelmint-ci-cd.yml`

### Keeping These Workflows
- ✅ `security.yml` (specialized security tools)
- ✅ `dependabot.yml` (dependency management)
- ✅ `pull-request.yml` (PR-specific checks)
- ✅ `backup.yml` (data backups)
- ✅ `rollback.yml` (manual rollback)

## 🐛 **Troubleshooting**

### Common Issues
1. **Cache Misses**: Check `pnpm-lock.yaml` changes or `CACHE_VERSION`
2. **Timeouts**: Increase job timeout or optimize test execution
3. **Permission Errors**: Verify secrets and IAM roles
4. **Build Failures**: Check Dockerfile syntax and build context

### Debug Commands
```bash
# Check workflow runs
gh run list --repo labelmint/labelmint

# View specific run
gh run view <run-id> --repo labelmint/labelmint

# Download artifacts
gh run download <run-id> --repo labelmint/labelmint

# Check cache usage
gh cache list --repo labelmint/labelmint
```

## 📞 **Support**

For issues with the CI/CD pipeline:
1. Check workflow logs in GitHub Actions tab
2. Review this documentation
3. Contact the DevOps team in `#devops` Slack channel
4. Create an issue with template "CI/CD Issue"