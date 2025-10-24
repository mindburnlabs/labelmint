# LabelMint GitHub Configuration

> **Complete guide to GitHub workflows, templates, and development processes**

## 📚 Overview

This directory contains all GitHub-specific configuration for the LabelMint project, including:
- **CI/CD Workflows**: Automated testing, building, and deployment pipelines
- **Issue Templates**: Standardized templates for bug reports and feature requests
- **Pull Request Templates**: Standardized PR submission format
- **Branch Protection**: Rules and policies for code quality
- **Security Scanning**: Automated security and vulnerability checks

---

## 🚀 CI/CD Workflows

### Workflow Architecture

```
.github/workflows/
├── labelmint-ci-cd.yml      # 🎯 Main unified pipeline
├── security.yml              # 🔒 Security scanning
├── pull-request.yml          # 📝 PR validation
├── dependabot.yml           # 🔄 Dependency updates
├── backup.yml               # 💾 Data backups
├── rollback.yml             # ⏮️  Emergency rollback
└── cleanup-cache.yml        # 🧹 Cache maintenance
```

---

## 🎯 Main Unified Pipeline

### [`labelmint-ci-cd.yml`](./workflows/labelmint-ci-cd.yml)

**The primary CI/CD workflow that replaced 5+ legacy workflows**

#### Triggers
```yaml
on:
  push:
    branches: [main, develop, staging]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:     # Manual trigger
```

#### Pipeline Stages

```
┌─────────────────────────────────────────────────────────┐
│  1. CODE QUALITY (Parallel with Security)               │
│     • ESLint, Prettier                                  │
│     • TypeScript compilation                            │
│     • Basic security checks                             │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. TEST MATRIX (Parallel execution)                    │
│     • Unit Tests (Jest/Vitest)                          │
│     • Integration Tests                                 │
│     • E2E Tests (Playwright)                            │
│     • Contract Tests (TON blockchain)                   │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. SECURITY SCAN (Parallel)                            │
│     • CodeQL (semantic analysis)                        │
│     • Semgrep (SAST)                                    │
│     • Snyk (dependencies)                               │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. BUILD & PUSH (Multi-platform Docker)                │
│     • Backend service                                   │
│     • Labeling backend                                  │
│     • Payment backend                                   │
│     • Web app                                           │
│     • Telegram mini app                                 │
│     Platforms: linux/amd64, linux/arm64                 │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  5. PERFORMANCE TEST (Staging only)                     │
│     • Lighthouse CI (web vitals)                        │
│     • k6 load testing                                   │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  6. DEPLOY (Branch-specific)                            │
│     • main → Production                                 │
│     • develop/staging → Staging                         │
│     • Terraform-based IaC                               │
│     • Health checks                                     │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  7. AUTO-ROLLBACK (Production only, on failure)         │
│     • Automatic rollback to previous version            │
│     • Alert team                                        │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  8. CLEANUP                                             │
│     • Remove old artifacts                              │
│     • Update deployment status                          │
│     • Send notifications                                │
└─────────────────────────────────────────────────────────┘
```

#### Key Features

✅ **Standardization**
- Node.js 20 LTS across all jobs
- PNPM 9.15.1 for package management
- Consistent environment variables

✅ **Performance**
- Parallel job execution
- Smart caching (pnpm store, node_modules, Docker layers)
- Multi-platform builds (amd64, arm64)

✅ **Quality Gates**
- Code linting and formatting
- TypeScript compilation checks
- Comprehensive test coverage
- Security vulnerability scanning

✅ **Deployment Safety**
- Environment-specific deployments
- Health checks after deployment
- Automatic rollback on failure
- Manual rollback capability

✅ **Monitoring**
- Slack notifications
- GitHub status checks
- Performance metrics
- Test coverage reports

---

## 🔒 Security Workflows

### [`security.yml`](./workflows/security.yml)

**Dedicated security scanning with advanced tools**

#### Security Layers

| Tool | Type | Purpose | Frequency |
|------|------|---------|-----------|
| **CodeQL** | SAST | Semantic code analysis | Every push + Daily |
| **Semgrep** | SAST | Pattern-based security rules | Every push + Daily |
| **Snyk** | SCA | Dependency vulnerabilities | Every push + Daily |
| **Trivy** | Container | Docker image scanning | Every build |
| **Gitleaks** | Secrets | Secret detection | Every push |
| **OSSF Scorecard** | Supply Chain | Project security health | Weekly |

#### Security Reporting

All security findings are:
- Uploaded to GitHub Security tab (SARIF format)
- Commented on pull requests
- Sent to Slack for critical issues
- Tracked in security dashboard

#### Manual Security Scans

```bash
# Run security scans locally
npm run security:scan

# Check dependencies
npm audit
snyk test

# Check for secrets
gitleaks detect --source .

# Container scanning
trivy image labelmint/backend:latest
```

### [`security-scan.yml`](./workflows/security-scan.yml)

**Scheduled security scanning workflow**

- Runs daily at midnight UTC
- Scans all Docker images
- Checks for CVEs in dependencies
- Generates security reports

### [`security-monitoring.yml`](./workflows/security-monitoring.yml)

**Real-time security monitoring**

- Monitors suspicious activities
- Tracks authentication failures
- Alerts on unusual patterns
- Integrates with SIEM

### [`security-incident.yml`](./workflows/security-incident.yml)

**Security incident response automation**

- Triggered manually during incidents
- Collects forensic evidence
- Preserves logs and state
- Notifies security team

---

## 📝 Pull Request Workflow

### [`pull-request.yml`](./workflows/pull-request.yml)

**Additional validation for pull requests**

#### PR Checks

```yaml
✓ Title format validation
✓ Description completeness
✓ Linked issue verification
✓ Changelog update check
✓ Breaking change detection
✓ Test coverage requirements
✓ Security scan results
✓ Performance impact analysis
```

#### PR Requirements

**Before Merge**:
- [ ] All CI/CD checks pass
- [ ] Code review approved by 2+ reviewers
- [ ] No merge conflicts
- [ ] Branch up-to-date with base
- [ ] All conversations resolved
- [ ] Documentation updated

**Automated Checks**:
- [ ] Tests pass (100% on new code)
- [ ] Linting passes
- [ ] No security vulnerabilities
- [ ] Build succeeds
- [ ] No breaking changes (without approval)

---

## 🔄 Dependency Management

### [`dependabot.yml`](./workflows/dependabot.yml)

**Automated dependency updates**

#### Configuration

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "devops-team"
    assignees:
      - "backend-team"
```

#### Update Strategy

| Type | Frequency | Auto-merge |
|------|-----------|------------|
| **Security patches** | Immediate | Yes (after tests) |
| **Minor updates** | Weekly | Yes (after tests) |
| **Major updates** | Weekly | No (manual review) |
| **Dev dependencies** | Weekly | Yes (after tests) |

#### Handling Dependabot PRs

```bash
# Check Dependabot PR
gh pr list --label "dependencies"

# Review changes
gh pr view <PR-number>

# If tests pass, merge
gh pr merge <PR-number> --squash
```

---

## 💾 Backup & Recovery Workflows

### [`backup.yml`](./workflows/backup.yml)

**Automated backup creation**

#### Backup Schedule

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| **Database** | Daily (1 AM UTC) | 30 days | S3 + Glacier |
| **File uploads** | Daily (2 AM UTC) | 30 days | S3 |
| **Configuration** | On change | 90 days | Git + S3 |
| **Docker images** | On build | 14 days | GitHub Container Registry |
| **Secrets** | Weekly | 180 days | HashiCorp Vault |

#### Manual Backup

```bash
# Trigger manual backup
gh workflow run backup.yml

# Check backup status
gh run list --workflow backup.yml

# Download backup artifacts
gh run download <run-id>
```

### [`rollback.yml`](./workflows/rollback.yml)

**Emergency rollback workflow**

#### When to Use

- Critical production bug
- Security vulnerability
- Data corruption risk
- Performance degradation
- Failed deployment

#### Rollback Process

```bash
# Trigger rollback to previous version
gh workflow run rollback.yml \
  --field environment=production \
  --field version=previous

# Rollback to specific version
gh workflow run rollback.yml \
  --field environment=production \
  --field version=v1.2.3

# Verify rollback
curl https://api.labelmint.it/health
```

#### Automatic Rollback

The main CI/CD pipeline includes automatic rollback:
- Triggered if health checks fail after deployment
- Reverts to last known good version
- Notifies team via Slack
- Creates incident in PagerDuty

---

## 🧹 Maintenance Workflows

### [`cleanup-cache.yml`](./workflows/cleanup-cache.yml)

**Automated cache cleanup**

**Schedule**: Weekly on Sundays at 3 AM UTC

**Cleanup Actions**:
- Remove caches older than 7 days
- Clean up old workflow runs (>90 days)
- Remove unused Docker images
- Archive old artifacts

### [`unified-ci.yml`](./workflows/unified-ci.yml)

**Legacy unified CI workflow**

⚠️ **Deprecated**: Use `labelmint-ci-cd.yml` instead

This workflow is maintained for backwards compatibility but will be removed in a future release.

---

## 📋 Issue Templates

### [Bug Report](./.github/ISSUE_TEMPLATE/bug_report.md)

**Use when**: Reporting a software defect or error

#### Template Structure

```markdown
## Describe the Bug
Clear description of the issue

## To Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Environment
- Browser/Device
- Version
- Operating System

## Logs
Error messages and stack traces

## Possible Solution
Ideas for fixing (optional)
```

#### Priority Labels

- `p0-critical`: Complete outage, data loss
- `p1-high`: Major feature broken, significant impact
- `p2-medium`: Feature impaired, workaround exists
- `p3-low`: Minor issue, cosmetic problem

### [Feature Request](./.github/ISSUE_TEMPLATE/feature_request.md)

**Use when**: Proposing new functionality

#### Template Structure

```markdown
## Problem Statement
What problem does this solve?

## Proposed Solution
Detailed description of feature

## Alternatives Considered
Other approaches evaluated

## Implementation Details
- API changes
- Database changes
- UI/UX changes
- Dependencies

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Priority
- [ ] High
- [ ] Medium
- [ ] Low
```

#### Feature Labels

- `feature`: New feature or enhancement
- `enhancement`: Improvement to existing feature
- `ux`: User experience improvement
- `api`: API changes
- `blockchain`: TON blockchain related
- `performance`: Performance optimization

---

## 📝 Pull Request Template

### [Pull Request Template](./.github/PULL_REQUEST_TEMPLATE.md)

**Standardized format for all pull requests**

#### PR Checklist

```markdown
## Description
Clear description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added tests
- [ ] All tests pass

## Quality Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Added comments for complex logic
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Tests prove fix/feature works

## Screenshots
Visual changes (if applicable)

## Deployment Notes
Special deployment instructions

## Related Issues
Closes #123, Fixes #456
```

#### PR Review Process

```
┌─────────────────────────────────────────┐
│  1. Create PR                           │
│     • Fill template                     │
│     • Link issues                       │
│     • Add labels                        │
└───────────────┬─────────────────────────┘
                ▼
┌─────────────────────────────────────────┐
│  2. Automated Checks                    │
│     • CI/CD pipeline runs               │
│     • Security scans                    │
│     • Test coverage                     │
└───────────────┬─────────────────────────┘
                ▼
┌─────────────────────────────────────────┐
│  3. Code Review                         │
│     • 2+ approvals required             │
│     • Address feedback                  │
│     • Update as needed                  │
└───────────────┬─────────────────────────┘
                ▼
┌─────────────────────────────────────────┐
│  4. Final Checks                        │
│     • All conversations resolved        │
│     • Branch up-to-date                 │
│     • No merge conflicts                │
└───────────────┬─────────────────────────┘
                ▼
┌─────────────────────────────────────────┐
│  5. Merge                               │
│     • Squash and merge                  │
│     • Delete branch                     │
│     • Auto-deploy (if applicable)       │
└─────────────────────────────────────────┘
```

---

## 🔐 Branch Protection Rules

### Main Branch (`main`)

**Protection Rules**:
- ✅ Require pull request reviews (2 approvals)
- ✅ Dismiss stale reviews on new commits
- ✅ Require review from code owners
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Require conversation resolution
- ✅ Require signed commits
- ✅ Include administrators
- ✅ Restrict pushes (admins only)
- ✅ Restrict force pushes
- ✅ Restrict deletions

**Required Status Checks**:
- `code-quality` - Linting and formatting
- `test-matrix` - All test suites
- `security-scan` - Security validation
- `build-and-push` - Build verification

### Develop Branch (`develop`)

**Protection Rules**:
- ✅ Require pull request reviews (1 approval)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Include administrators
- ⚠️ Allow force pushes (with lease)
- ✅ Restrict deletions

**Required Status Checks**:
- `code-quality` - Linting and formatting
- `test-matrix` - All test suites

### Staging Branch (`staging`)

**Protection Rules**:
- ✅ Require pull request reviews (1 approval)
- ✅ Require status checks to pass
- ⚠️ Allow force pushes
- ✅ Restrict deletions

### Feature Branches

**Naming Convention**:
- `feature/ISSUE-123-description` - New features
- `fix/ISSUE-123-description` - Bug fixes
- `hotfix/ISSUE-123-description` - Critical fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test improvements

**Lifecycle**:
1. Branch from `develop`
2. Develop feature/fix
3. Create PR to `develop`
4. Pass all checks
5. Get reviews
6. Merge and delete

---

## 🔧 Configuration Files

### Workflow Environment Variables

```yaml
NODE_VERSION: '20'           # Node.js LTS
PNPM_VERSION: '9.15.1'       # Package manager
REGISTRY: 'ghcr.io'          # Container registry
CACHE_VERSION: 'v3'          # Cache invalidation
```

### Required Secrets

#### General Secrets

| Secret | Purpose | Required For |
|--------|---------|--------------|
| `GITHUB_TOKEN` | GitHub API access | All workflows (auto-provided) |
| `CODECOV_TOKEN` | Code coverage reporting | Testing workflows |
| `SLACK_WEBHOOK_URL` | Deployment notifications | Deploy workflows |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI | Performance testing |

#### AWS Secrets

| Secret | Purpose | Environment |
|--------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access | Staging |
| `AWS_SECRET_ACCESS_KEY` | AWS secret | Staging |
| `AWS_ROLE_ARN` | AWS IAM role | Staging |
| `AWS_PROD_ACCESS_KEY_ID` | AWS access | Production |
| `AWS_PROD_SECRET_ACCESS_KEY` | AWS secret | Production |

#### Security Secrets

| Secret | Purpose | Tool |
|--------|---------|------|
| `SNYK_TOKEN` | Vulnerability scanning | Snyk |
| `SEMGREP_APP_TOKEN` | SAST scanning | Semgrep |

### Setting Secrets

```bash
# Via GitHub CLI
gh secret set SECRET_NAME --body "secret_value"

# Via GitHub UI
Settings → Secrets and variables → Actions → New repository secret

# Environment-specific secrets
Settings → Environments → [env] → Add secret
```

---

## 🚀 Deployment Process

### Deployment Environments

| Environment | Branch | URL | Auto-deploy |
|-------------|--------|-----|-------------|
| **Development** | Any | Local | No |
| **Staging** | `develop`, `staging` | https://staging.labelmint.it | Yes |
| **Production** | `main` | https://labelmint.it | Yes |

### Deployment Flow

```
┌──────────────┐
│  Developer   │
└──────┬───────┘
       │ git push
       ▼
┌──────────────┐     ┌──────────────┐
│   GitHub     │────▶│  CI/CD Run   │
└──────────────┘     └──────┬───────┘
                            │
       ┌────────────────────┴────────────────────┐
       ▼                                         ▼
┌──────────────┐                         ┌──────────────┐
│   Staging    │ ◀─── develop/staging    │  Production  │ ◀─── main
│ Deployment   │                         │  Deployment  │
└──────┬───────┘                         └──────┬───────┘
       │                                        │
       ▼                                        ▼
┌──────────────┐                         ┌──────────────┐
│ Health Check │                         │ Health Check │
└──────┬───────┘                         └──────┬───────┘
       │                                        │
       ▼                                        ▼
┌──────────────┐                         ┌──────────────┐
│  Notify Team │                         │ Auto-rollback│
└──────────────┘                         │ (on failure) │
                                         └──────────────┘
```

### Manual Deployment

```bash
# Deploy to staging
gh workflow run labelmint-ci-cd.yml \
  --ref develop \
  --field environment=staging

# Deploy to production (from main)
gh workflow run labelmint-ci-cd.yml \
  --ref main \
  --field environment=production

# Emergency deployment (skip tests - use with caution!)
gh workflow run labelmint-ci-cd.yml \
  --ref main \
  --field environment=production \
  --field skip-tests=true
```

### Post-Deployment Verification

```bash
# Check deployment status
gh run list --workflow labelmint-ci-cd.yml --limit 5

# Health checks
curl https://api.labelmint.it/health
curl https://labelmint.it/api/health

# Monitor logs
aws logs tail /aws/ecs/labelmint-backend --follow

# Check metrics
open https://grafana.labelmint.it/d/deployment
```

---

## 📊 Monitoring & Alerts

### CI/CD Metrics

#### Performance Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Pipeline Duration** | < 15 min | ~12 min | ✅ Good |
| **Test Execution** | < 5 min | ~4 min | ✅ Good |
| **Build Time** | < 3 min | ~2.5 min | ✅ Good |
| **Deploy Time** | < 5 min | ~4 min | ✅ Good |
| **Success Rate** | > 95% | 97% | ✅ Good |

#### Alert Conditions

| Condition | Severity | Action |
|-----------|----------|--------|
| Pipeline failure on `main` | Critical | Page on-call + Slack |
| Security scan finds critical CVE | High | Slack + Email |
| Test coverage drops below 80% | Medium | Block PR merge |
| Build cache miss rate > 50% | Low | Notify DevOps |
| Deploy fails 3 times in row | Critical | Page on-call + Auto-rollback |

### Slack Notifications

**Channels**:
- `#deployments` - All deployment activity
- `#ci-cd` - Pipeline status
- `#security-alerts` - Security findings
- `#incidents` - Critical failures

**Notification Format**:
```
🚀 Deployment: Production
Branch: main
Commit: abc1234
Author: @developer
Status: ✅ Success
Duration: 12m 34s
URL: https://labelmint.it
```

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Pipeline Failures

**Symptom**: CI/CD pipeline fails unexpectedly

**Diagnosis**:
```bash
# Check recent runs
gh run list --workflow labelmint-ci-cd.yml --limit 10

# View failed run
gh run view <run-id>

# Download logs
gh run download <run-id> --name logs
```

**Common Causes**:
- Test failures → Check test logs
- Build errors → Check Dockerfile changes
- Dependency issues → Check package.json changes
- Secrets missing → Verify GitHub secrets
- Resource limits → Check workflow quotas

#### 2. Cache Issues

**Symptom**: Slow builds, frequent cache misses

**Diagnosis**:
```bash
# List caches
gh cache list

# Check cache size
gh cache list --json | jq '.[] | .sizeInBytes' | awk '{s+=$1} END {print s/1024/1024 "MB"}'
```

**Solutions**:
```bash
# Delete all caches (force rebuild)
gh cache delete --all

# Delete specific cache
gh cache delete <cache-id>

# Run cleanup workflow
gh workflow run cleanup-cache.yml
```

#### 3. Deployment Failures

**Symptom**: Deployment fails or times out

**Diagnosis**:
```bash
# Check deployment logs
aws logs tail /aws/ecs/labelmint-backend --since 1h

# Check ECS task status
aws ecs list-tasks --cluster labelmint --service-name backend

# Check health endpoints
curl -v https://api.labelmint.it/health
```

**Solutions**:
```bash
# Rollback to previous version
gh workflow run rollback.yml --field environment=production

# Force redeploy
gh workflow run labelmint-ci-cd.yml --ref main --field force-deploy=true

# Check infrastructure
terraform plan -target=module.ecs
```

#### 4. Security Scan Failures

**Symptom**: Security scans block PR merge

**Diagnosis**:
```bash
# View security alerts
gh api /repos/labelmint/labelmint/code-scanning/alerts

# Check Dependabot alerts
gh api /repos/labelmint/labelmint/dependabot/alerts
```

**Solutions**:
```bash
# Update dependencies
pnpm update

# Run security fix
npm audit fix

# Check for false positives
# Add to .semgrepignore or .snyk file
```

### Debug Commands

```bash
# CI/CD Management
gh run list --workflow <workflow-name>     # List workflow runs
gh run view <run-id>                       # View run details
gh run rerun <run-id>                      # Rerun failed jobs
gh run cancel <run-id>                     # Cancel running workflow
gh run download <run-id>                   # Download artifacts

# Cache Management
gh cache list                              # List all caches
gh cache delete <cache-id>                 # Delete specific cache
gh cache delete --all                      # Delete all caches

# Secret Management
gh secret list                             # List all secrets
gh secret set <name>                       # Set secret value
gh secret remove <name>                    # Remove secret

# Workflow Management
gh workflow list                           # List workflows
gh workflow view <workflow>                # View workflow details
gh workflow run <workflow>                 # Trigger workflow
gh workflow enable/disable <workflow>      # Enable/disable workflow
```

---

## 📚 Best Practices

### Code Quality

✅ **Do**:
- Write tests for all new code
- Keep test coverage above 80%
- Run linters before committing
- Use meaningful commit messages
- Keep PRs small and focused
- Update documentation

❌ **Don't**:
- Commit commented-out code
- Skip tests to make CI pass
- Force push to protected branches
- Commit secrets or credentials
- Merge without review
- Deploy without testing

### CI/CD Best Practices

✅ **Do**:
- Let CI/CD run completely
- Fix broken builds immediately
- Monitor deployment status
- Use feature flags for big changes
- Test in staging first
- Keep workflows simple

❌ **Don't**:
- Skip CI checks
- Deploy on Fridays (unless necessary)
- Ignore security warnings
- Manually modify production
- Run untested code in production
- Disable required checks

### Git Workflow

```bash
# 1. Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/ISSUE-123-new-feature

# 2. Develop and commit
git add .
git commit -m "feat: add new feature (#123)"

# 3. Push and create PR
git push origin feature/ISSUE-123-new-feature
gh pr create --base develop --title "feat: add new feature" --body "Closes #123"

# 4. Address review feedback
git add .
git commit -m "fix: address review comments"
git push

# 5. Merge (via GitHub UI after approval)
# Branch is automatically deleted after merge
```

### Commit Message Convention

```
type(scope): subject

body (optional)

footer (optional)
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

**Examples**:
```
feat(api): add user authentication endpoint (#123)
fix(bot): handle telegram timeout errors (#456)
docs(readme): update deployment instructions
refactor(database): optimize query performance
test(api): add integration tests for payments
chore(deps): update dependencies
```

---

## 🆘 Getting Help

### During Development

**Questions about**:
- Workflows: `#devops` Slack channel
- Tests: `#testing` Slack channel
- Deployment: `#deployments` Slack channel
- Security: `#security` Slack channel

### During Incidents

**Severity based**:
- SEV-0 (Critical): Page on-call via PagerDuty
- SEV-1 (High): Post in `#incidents` with @oncall
- SEV-2 (Medium): Post in relevant team channel
- SEV-3 (Low): Create GitHub issue

### Documentation

**Resources**:
- [Development Guide](../docs/DEVELOPMENT.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)
- [Security Guide](../docs/SECURITY.md)
- [Architecture](../docs/ARCHITECTURE.md)
- [Runbooks](../docs/runbooks/README.md)

---

## 📝 Contributing

### Workflow Improvements

**To suggest workflow changes**:

1. Create issue with `ci-cd-improvement` label
2. Discuss in `#devops` channel
3. Test changes in feature branch
4. Create PR with detailed description
5. Get approval from DevOps team
6. Monitor after merge

### Template Updates

**To update templates**:

1. Edit template in `.github/ISSUE_TEMPLATE/` or `.github/`
2. Test template by creating sample issue/PR
3. Get feedback from team
4. Create PR with changes
5. Update this README if needed

---

## 📊 Statistics

### Current Pipeline Stats (Last 30 Days)

| Metric | Value |
|--------|-------|
| **Total Runs** | 450 |
| **Success Rate** | 97.3% |
| **Average Duration** | 12m 34s |
| **Total Build Time** | 94 hours |
| **Cache Hit Rate** | 87% |
| **Deploy Success** | 99.1% |

### Test Coverage

| Component | Coverage | Target |
|-----------|----------|--------|
| **Backend** | 85% | 80% |
| **Frontend** | 78% | 75% |
| **Bot** | 82% | 80% |
| **Contracts** | 92% | 90% |
| **Overall** | 84% | 80% |

---

## 🔗 Related Links

### External Resources
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [Terraform Documentation](https://www.terraform.io/docs/)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)

### Internal Resources
- [Infrastructure Repository](https://github.com/labelmint/infrastructure)
- [Deployment Scripts](../scripts/)
- [Docker Configurations](../infrastructure/docker/)
- [Terraform Modules](../infrastructure/terraform/)

---

## 📅 Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2024-10-24 | 3.0.0 | Consolidated GitHub documentation |
| 2024-01-20 | 2.5.0 | Added security-monitoring workflow |
| 2024-01-15 | 2.4.0 | Unified CI/CD pipeline |
| 2024-01-10 | 2.3.0 | Added auto-rollback capability |
| 2024-01-05 | 2.2.0 | Multi-platform Docker builds |
| 2024-01-01 | 2.0.0 | Major workflow restructuring |

---

## 📞 Contact

| Topic | Contact | Hours |
|-------|---------|-------|
| **CI/CD Issues** | devops@labelmint.it | 24/7 |
| **Security** | security@labelmint.it | 24/7 |
| **Deployment** | ops@labelmint.it | 24/7 |
| **Documentation** | docs@labelmint.it | Business hours |

---

**Last Updated**: October 24, 2025

**Maintained by**: DevOps Team

**Next Review**: January 2026

