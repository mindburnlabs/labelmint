# Branch Protection Rules Configuration

## 🔒 **Branch Protection for Unified CI/CD Pipeline**

This document provides the recommended branch protection rules for the LabelMint repository after migrating to the unified CI/CD workflow.

---

## 🎯 **Required Branch Protection Rules**

### **Main Branch Protection**
**Branch**: `main`

#### **Basic Protection Settings**
- ❌ **Require pull request reviews before merging**: **DISABLED** (solo agent)
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**
- ❌ **Require conversation resolution before merging**: **DISABLED** (solo agent)
- ✅ **Limit who can push to matching branches**: Repository owner only

#### **Status Checks**
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**

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

#### **Additional Protections**
- ✅ **Limit who can push to matching branches**: Repository owner only
- ✅ **Allow force pushes**: Repository owner only (for emergency rollbacks)

### **Develop Branch Protection**
**Branch**: `develop`

#### **Basic Protection Settings**
- ❌ **Require pull request reviews before merging**: **DISABLED** (solo agent)
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**

#### **Status Checks**
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**

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

#### **Push Restrictions**
- ✅ **Limit who can push to matching branches**: Repository owner only

### **Staging Branch Protection**
**Branch**: `staging`

#### **Basic Protection Settings**
- ❌ **Do not require pull request reviews** (direct push allowed for hotfixes)
- ✅ **Require status checks to pass before merging**

#### **Required Status Checks**
```
labelmint-ci-cd.yml / code-quality
labelmint-ci-cd.yml / test-matrix (Unit Tests)
labelmint-ci-cd.yml / build-and-push (web)
labelmint-ci-cd.yml / build-and-push (api)
```

#### **Push Restrictions**
- ✅ **Limit who can push to matching branches**: Repository owner only

---

## 🛠️ **Configuration Steps**

### **Via GitHub UI**

1. **Navigate to Repository Settings**
   - Go to repository main page
   - Click **Settings** tab
   - Navigate to **Branches** section

2. **Add Branch Protection Rule**
   - Click **Add rule**
   - Enter branch name pattern (`main`, `develop`, `staging`)
   - Configure settings as detailed above
   - Click **Create** to save

3. **Repeat for Each Branch**
   - Create separate rules for `main`, `develop`, and `staging`

### **Via GitHub CLI**

```bash
# Set up main branch protection
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["labelmint-ci-cd.yml / code-quality","labelmint-ci-cd.yml / test-matrix (Unit Tests)","labelmint-ci-cd.yml / test-matrix (Integration Tests)","labelmint-ci-cd.yml / test-matrix (E2E Tests)","labelmint-ci-cd.yml / test-matrix (Smart Contract Tests)","labelmint-ci-cd.yml / security-scan","labelmint-ci-cd.yml / build-and-push (web)","labelmint-ci-cd.yml / build-and-push (api)","labelmint-ci-cd.yml / build-and-push (labeling-backend)","labelmint-ci-cd.yml / build-and-push (payment-backend)","labelmint-ci-cd.yml / build-and-push (telegram-mini-app)"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions='{"users":[],"teams":["labelmint/core-team"]}'

# Set up develop branch protection
gh api repos/:owner/:repo/branches/develop/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["labelmint-ci-cd.yml / code-quality","labelmint-ci-cd.yml / test-matrix (Unit Tests)","labelmint-ci-cd.yml / test-matrix (Integration Tests)","labelmint-ci-cd.yml / test-matrix (E2E Tests)","labelmint-ci-cd.yml / test-matrix (Smart Contract Tests)","labelmint-ci-cd.yml / security-scan","labelmint-ci-cd.yml / build-and-push (web)","labelmint-ci-cd.yml / build-and-push (api)"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false}' \
  --field restrictions='{"users":[],"teams":["labelmint/developers"]}'
```

---

## 👥 **Team Configuration**

### **Solo Developer Setup (Claude Code Agent)**

Since this project is developed exclusively by Claude Code agents, the configuration is simplified:

| Configuration | Traditional | Solo Developer (Current) |
|---------------|-------------|--------------------------|
| Team Structure | Multiple teams required | No teams needed |
| Code Reviews | Required from team members | Not required (solo agent) |
| Approvals | Multi-person approval | Status check enforcement only |
| Access Control | Team-based permissions | Repository owner access |

### **CODEOWNERS Configuration**

**For Solo Developer (Claude Code):**
```
# Solo Developer (Claude Code Agent) - Full Repository Access
*

# No team-based restrictions needed
# Repository owner has full access to all files
```

**Alternative (if specific GitHub user is associated):**
```
# Solo Developer Configuration
* @claude-code-agent
```

**Note**: See `SOLO_DEVELOPER_CONFIG.md` for detailed solo developer setup instructions.

---

## 📋 **Migration Checklist**

### **Before Applying Rules**
- [ ] Identify and create required GitHub teams
- [ ] Add team members with appropriate permissions
- [ ] Create CODEOWNERS file
- [ ] Test unified workflow runs successfully
- [ ] Verify all status checks are working

### **Applying Branch Protection**
- [ ] Configure main branch protection first
- [ ] Verify PR flow works correctly
- [ ] Configure develop branch protection
- [ ] Test develop branch PR flow
- [ ] Configure staging branch protection
- [ ] Test direct push to staging
- [ ] Verify all required status checks are enforced

### **Post-Configuration**
- [ ] Test PR creation and approval process
- [ ] Verify team restrictions work correctly
- [ ] Test emergency push procedures
- [ ] Document override procedures for emergencies
- [ ] Train team on new workflow

---

## 🚨 **Emergency Procedures**

### **Bypassing Branch Protection**

#### **Temporary Bypass (Admins Only)**
```bash
# Force push to main (emergency only)
git push --force-with-lease origin main

# Note: This requires admin permissions and should be documented
```

#### **Using Workflow Dispatch**
For emergency deployments without full checks:
1. Go to **Actions** → **LabelMint Unified CI/CD Pipeline**
2. Click **Run workflow**
3. Select environment: `production`
4. Enable `skip_tests` and `force_deploy` options
5. Click **Run workflow**

### **Rollback Procedures**
```bash
# Emergency rollback using previous tag
git checkout rollback-YYYYMMDD-HHMMSS-commit-hash
git push origin rollback-YYYYMMDD-HHMMSS-commit-hash:main --force
```

---

## 🔍 **Monitoring and Auditing**

### **Audit Trail Monitoring**
- Monitor branch protection bypass events
- Track admin force pushes
- Review emergency deployment usage
- Monitor PR approval patterns

### **Alerts Setup**
- Create Slack alerts for:
  - Branch protection bypass events
  - Emergency workflow executions
  - Failed deployments to production
  - Admin privilege usage

### **Regular Reviews**
- **Monthly**: Review team membership and permissions
- **Quarterly**: Audit branch protection effectiveness
- **Bi-annually**: Review and update required status checks

---

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Status Check Not Found**
```
Error: Required status check "labelmint-ci-cd.yml / test-matrix (Unit Tests)" not found
```
**Solution:**
1. Run the workflow at least once to generate status checks
2. Check exact status check names in workflow run results
3. Update branch protection with correct names

#### **PR Approval Issues**
```
Error: Required approving reviews not satisfied
```
**Solution:**
1. Verify reviewers are on approved teams
2. Check if CODEOWNERS reviews are required
3. Ensure reviewers have push access to repository

#### **Merge Conflicts with Protection**
```
Error: Branch is not up to date with main
```
**Solution:**
1. Enable "Require branches to be up to date before merging"
2. Update local branch with latest changes
3. Rebase feature branch on target branch

### **Debug Commands**
```bash
# Check branch protection rules
gh api repos/:owner/:repo/branches/main/protection

# List team members
gh api orgs/labelmint/teams

# Check required status checks
gh api repos/:owner/:repo/branches/main/protection/required_status_checks
```

---

## 📊 **Success Metrics**

Track these metrics to ensure branch protection is effective:

### **Security Metrics**
- [ ] Zero unauthorized pushes to protected branches
- [ ] All production changes go through PR process
- [ ] 100% compliance with required approvals

### **Development Metrics**
- [ ] PR merge time < 2 business days
- [ ] < 5% of PRs require manual intervention
- [ ] Zero failed deployments due to missing checks

### **Compliance Metrics**
- [ ] All code changes have appropriate review
- [ ] Audit trail is complete and accurate
- [ ] Emergency procedures are documented and tested

---

**Implementation Date**: October 24, 2025
**Review Date**: November 1, 2025 (30-day post-implementation review)
**Owner**: DevOps Team
**Approval Required**: @labelmint/core-team