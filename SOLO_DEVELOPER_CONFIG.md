# 🤖 Solo Developer (Claude Code) Configuration

## 🔧 **Adjusted Configuration for Single-Agent Development**

Since this project is developed exclusively by Claude Code agents with no human team, the standard multi-user configurations need to be simplified.

---

## 👥 **Team Structure Adjustment**

### **Traditional vs Solo Developer Setup**

**Traditional Multi-Team Setup:**
- `@labelmint/admins` - Human administrators
- `@labelmint/core-team` - Senior developers
- `@labelmint/developers` - All developers

**Solo Developer (Claude Code) Setup:**
- Single agent with full repository access
- No human team coordination needed
- Simplified approval workflows
- Automated decision making

---

## 🔒 **Simplified Branch Protection Rules**

### **Main Branch Protection**
**Branch**: `main`

#### **Basic Protection Settings**
- ✅ **Require pull request reviews before merging**: **DISABLED** (solo agent)
- ✅ **Require status checks to pass before merging**: **ENABLED**
- ✅ **Require branches to be up to date before merging**: **ENABLED**
- ❌ **Require conversation resolution before merging**: **DISABLED** (solo agent)
- ❌ **Require signed commits**: **DISABLED** (agent commits)
- ✅ **Limit who can push to matching branches**: **ENABLED** (repository owner)

#### **Required Status Checks**
```
labelmint-ci-cd.yml / code-quality
labelmint-ci-cd.yml / test-matrix (Unit Tests)
labelmint-ci-cd.yml / test-matrix (Integration Tests)
labelmint-ci-cd.yml / test-matrix (E2E Tests)
labelmint-ci-cd.yml / test-matrix (Smart Contract Tests)
labelmint-ci-cd.yml / security-scan
labelmint-ci-cd.yml / build-and-push (web)
labelmint-ci-cd.yml / build-and-push (api)
labelmint-ci-cd.yml / build-and-push (labeling-backend)
labelmint-ci-cd.yml / build-and-push (payment-backend)
labelmint-ci-cd.yml / build-and-push (telegram-mini-app)
```

### **Develop Branch Protection**
**Branch**: `develop`

#### **Basic Protection Settings**
- ❌ **Require pull request reviews before merging**: **DISABLED** (solo agent)
- ✅ **Require status checks to pass before merging**: **ENABLED**
- ✅ **Require branches to be up to date before merging**: **ENABLED**
- ✅ **Limit who can push to matching branches**: **ENABLED** (repository owner)

#### **Required Status Checks**
```
labelmint-ci-cd.yml / code-quality
labelmint-ci-cd.yml / test-matrix (Unit Tests)
labelmint-ci-cd.yml / test-matrix (Integration Tests)
labelmint-ci-cd.yml / test-matrix (E2E Tests)
labelmint-ci-cd.yml / test-matrix (Smart Contract Tests)
labelmint-ci-cd.yml / security-scan
labelmint-ci-cd.yml / build-and-push (web)
labelmint-ci-cd.yml / build-and-push (api)
```

### **Staging Branch Protection**
**Branch**: `staging`

#### **Basic Protection Settings**
- ❌ **Require pull request reviews before merging**: **DISABLED** (direct push allowed)
- ✅ **Require status checks to pass before merging**: **ENABLED**
- ✅ **Limit who can push to matching branches**: **ENABLED** (repository owner)

#### **Required Status Checks**
```
labelmint-ci-cd.yml / code-quality
labelmint-ci-cd.yml / test-matrix (Unit Tests)
labelmint-ci-cd.yml / build-and-push (web)
labelmint-ci-cd.yml / build-and-push (api)
```

---

## 🏷️ **Simplified CODEOWNERS Configuration**

Since there's no human team, create `.github/CODEOWNERS`:

```
# Solo Developer (Claude Code Agent) - Full Repository Access
* @claude-code-agent

# No team-based restrictions needed
# All files owned by the single developing agent
```

**Alternative**: If no specific GitHub user for the agent:
```
# No specific CODEOWNERS required for solo agent development
# Repository owner has full access
```

---

## 🔐 **Simplified Permissions Setup**

### **GitHub Repository Permissions**
- **Owner**: Claude Code (via repository owner's account)
- **Collaborators**: None needed
- **Teams**: No teams required

### **Workflow Permissions**
```yaml
# In labelmint-ci-cd.yml - these remain the same
permissions:
  contents: read
  packages: write
  pull-requests: write
  statuses: write
  actions: read
  checks: write
  security-events: write
  id-token: write
  deployments: write
```

---

## 📋 **Updated Deployment Procedures**

### **Simplified Deployment Flow**

#### **Development Workflow**
1. **Direct Development**: Claude Code can push directly to branches
2. **Automated Testing**: CI/CD pipeline validates all changes
3. **Status Check Enforcement**: Only quality gates prevent merges
4. **Direct Merges**: No approval process needed for solo agent

#### **Deployment Commands**
```bash
# Claude Code can directly push and deploy
git add .
git commit -m "feat: new feature implementation"
git push origin develop  # Triggers staging deployment

git checkout main
git merge develop
git push origin main     # Triggers production deployment
```

---

## 🚨 **Emergency Procedures for Solo Developer**

### **Self-Service Rollback**
Since there's no team coordination, the agent can handle rollbacks independently:

#### **Automatic Rollback**
- Still enabled for production failures
- Agent receives notifications via Slack
- Can execute manual rollback if needed

#### **Manual Rollback Commands**
```bash
# Agent can execute these directly
git tag rollback-$(date +%Y%m%d-%H%M%S)-previous-good-commit
git push origin rollback-YYYYMMDD-HHMMSS-commit-hash:main --force

# Or use workflow dispatch
gh workflow run "Rollback Production" \
  --field previous_tag=rollback-YYYYMMDD-HHMMSS-commit-hash
```

---

## 📊 **Monitoring Adjustments**

### **Slack Notifications**
Since there's no team, notifications should be:
- **Informational**: Keep agent informed of deployment status
- **Automated**: Self-monitoring and alerting
- **Actionable**: Clear instructions for any needed interventions

### **Notification Configuration**
```yaml
# In workflow - simplified messaging
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    channel: '#agent-notifications'  # Personal notification channel
    text: |
      🤖 Deployment ${{ job.status }} for LabelMint

      Branch: ${{ github.ref_name }}
      Commit: ${{ github.sha }}
      Agent: Claude Code
```

---

## 🔧 **Branch Protection Setup via GitHub UI**

### **Step-by-Step Instructions**

1. **Navigate to Repository Settings**
   - Go to repository main page
   - Click **Settings** tab
   - Navigate to **Branches** section

2. **Configure Main Branch**
   - Click **Add rule**
   - Branch name pattern: `main`
   - ✅ **Require status checks to pass before merging**
   - ✅ **Require branches to be up to date before merging**
   - Add all required status checks (listed above)
   - ✅ **Limit who can push to matching branches**
   - Add repository owner username
   - Click **Create**

3. **Configure Develop Branch**
   - Click **Add rule**
   - Branch name pattern: `develop`
   - ✅ **Require status checks to pass before merging**
   - ✅ **Require branches to be up to date before merging**
   - Add develop branch status checks (listed above)
   - ✅ **Limit who can push to matching branches**
   - Add repository owner username
   - Click **Create**

4. **Configure Staging Branch**
   - Click **Add rule**
   - Branch name pattern: `staging`
   - ✅ **Require status checks to pass before merging**
   - Add staging branch status checks (listed above)
   - ✅ **Limit who can push to matching branches**
   - Add repository owner username
   - Click **Create**

---

## 📝 **Updated Configuration Files**

### **Required Secrets (Unchanged)**
All 10 secrets are still required, but no team-based access controls needed:

1. `CODECOV_TOKEN`
2. `SLACK_WEBHOOK_URL`
3. `LHCI_GITHUB_APP_TOKEN`
4. `AWS_ACCESS_KEY_ID`
5. `AWS_SECRET_ACCESS_KEY`
6. `AWS_ROLE_ARN`
7. `AWS_PROD_ACCESS_KEY_ID`
8. `AWS_PROD_SECRET_ACCESS_KEY`
9. `SNYK_TOKEN`
10. `SEMGREP_APP_TOKEN`

### **No Additional Setup Required**
- No GitHub teams to create
- No team permissions to configure
- No CODEOWNERS approval needed
- Simplified approval workflows

---

## ✅ **Solo Developer Advantages**

### **Simplified Workflow Benefits**
- ✅ **No coordination delays**: Direct push and deploy
- ✅ **Faster iteration**: No waiting for approvals
- ✅ **Full autonomy**: Complete control over development process
- ✅ **Simplified permissions**: No complex team structures
- ✅ **Automated quality gates**: CI/CD ensures code quality

### **Maintained Quality Standards**
- ✅ **Automated testing**: Comprehensive test suite still runs
- ✅ **Security scanning**: All security checks still enforced
- ✅ **Code quality**: Linting and type-checking still required
- ✅ **Deployment safety**: Health checks and rollback still active

---

## 🎯 **Next Steps for Solo Developer**

### **Immediate Actions**
1. **Configure Branch Protection**: Use simplified rules above (no team approvals)
2. **Set Up Secrets**: Configure the 10 required secrets
3. **Test Direct Push**: Verify Claude Code can push directly to branches
4. **Validate Deployments**: Test automated deployments work correctly

### **Ongoing Operations**
1. **Monitor Notifications**: Set up Slack channel for agent notifications
2. **Automated Monitoring**: Rely on automated health checks and alerts
3. **Self-Service Rollback**: Agent can handle rollback procedures independently
4. **Continuous Improvement**: Agent can optimize workflows without team coordination

---

**Configuration Updated**: October 24, 2025
**Developer**: Claude Code Agent (Solo)
**Setup Complexity**: **SIMPLIFIED** (No team coordination required)
**Approval Process**: **AUTOMATED** (Status check enforcement only)