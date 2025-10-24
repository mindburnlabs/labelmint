# 🤖 Solo Developer Deployment Instructions

## 🎯 **Quick Start Guide for Claude Code Agent**

Since you're the sole developer (Claude Code agent), here's the simplified deployment process:

---

## ⚡ **5-Minute Setup**

### **Step 1: Configure Secrets** (2 minutes)
Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these 10 secrets:
```
CODECOV_TOKEN=your_codecov_token
SLACK_WEBHOOK_URL=your_slack_webhook_url
LHCI_GITHUB_APP_TOKEN=your_lhci_token
AWS_ACCESS_KEY_ID=your_staging_aws_key
AWS_SECRET_ACCESS_KEY=your_staging_aws_secret
AWS_ROLE_ARN=your_aws_role_arn
AWS_PROD_ACCESS_KEY_ID=your_production_aws_key
AWS_PROD_SECRET_ACCESS_KEY=your_production_aws_secret
SNYK_TOKEN=your_snyk_token
SEMGREP_APP_TOKEN=your_semgrep_token
```

### **Step 2: Configure Branch Protection** (3 minutes)
Go to Settings → Branches → Add rule for each branch:

**Main Branch:**
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- ✅ Limit who can push to matching branches → Add your username
- Add all status checks from workflow

**Develop Branch:**
- ✅ Require status checks to pass before merging
- ✅ Limit who can push to matching branches → Add your username
- Add develop branch status checks

**Staging Branch:**
- ✅ Require status checks to pass before merging
- ✅ Limit who can push to matching branches → Add your username
- Add basic status checks

---

## 🚀 **Deployment Process**

### **Deploy to Staging**
```bash
# Make your changes
git add .
git commit -m "feat: your changes"
git push origin develop

# That's it! The workflow will automatically deploy to staging
# Monitor the GitHub Actions tab for progress
```

### **Deploy to Production**
```bash
# After staging looks good:
git checkout main
git merge develop
git push origin main

# Production deployment runs automatically
# Monitor for completion and health checks
```

### **Emergency Rollback**
```bash
# Find the last good commit
git log --oneline -10

# Rollback to it
git checkout main
git reset --hard <commit_hash>
git push --force-with-lease origin main

# Or use automated rollback tags
git checkout rollback-YYYYMMDD-HHMMSS-commit-hash
git push --force-with-lease origin main
```

---

## 📊 **What Happens Automatically**

### **When You Push to `develop`:**
1. ✅ Code quality checks (lint, format, TypeScript)
2. ✅ Full test suite (unit, integration, E2E, contracts)
3. ✅ Security scanning (CodeQL, Semgrep, Snyk)
4. ✅ Docker builds (multi-platform)
5. ✅ **Deployment to staging** (https://staging.labelmint.it)
6. ✅ Health checks and smoke tests
7. 📱 Slack notification

### **When You Push to `main`:**
1. ✅ All the same checks as develop
2. ✅ **Deployment to production** (https://labelmint.it)
3. ✅ Performance testing (Lighthouse, k6)
4. ✅ Automatic rollback point creation
5. ✅ Enhanced monitoring
6. 📱 Slack notification

### **If Something Goes Wrong:**
1. 🚨 **Automatic rollback** triggers on production failures
2. 📱 **Slack alert** sent immediately
3. 🔄 **Manual rollback** available via commands above
4. 📊 **Health monitoring** continues

---

## 🔍 **Monitoring Your Deployments**

### **GitHub Actions Tab**
- Watch workflow execution in real-time
- Check for any errors or warnings
- View logs for each job
- Download artifacts if needed

### **Slack Notifications**
You'll get messages like:
```
🚀 Deployment to staging completed successfully!

Commit: abc1234
Branch: develop
Agent: Claude Code
```

### **Health Checks**
The workflow automatically:
- Tests API endpoints
- Verifies database connectivity
- Checks application performance
- Runs smoke tests

---

## 🛠️ **Troubleshooting**

### **Workflow Fails**
1. Check GitHub Actions logs
2. Look for the specific error message
3. Fix the issue and push again
4. Common issues:
   - Missing secrets → Add them in repository settings
   - Syntax errors → Check your code
   - Test failures → Fix failing tests
   - Infrastructure issues → Check AWS credentials

### **Deployment Issues**
1. **Health check failure**:
   - Check application logs
   - Verify environment variables
   - Manual rollback if needed

2. **Build failure**:
   - Check Dockerfile syntax
   - Verify build context
   - Review build logs

3. **Security scan failures**:
   - Review security findings
   - Fix vulnerabilities
   - Update dependencies

### **Rollback Needed**
```bash
# Quick rollback
git checkout main
git reset --hard HEAD~1  # Go back one commit
git push --force-with-lease origin main
```

---

## 📈 **Performance Tips**

### **Speed Up Your Workflow**
- Keep `pnpm-lock.yaml` stable for better caching
- Write efficient tests (target < 10 minutes total)
- Use conditional deployments (skip tests when appropriate)

### **Monitor Performance**
- Target execution time: 25-35 minutes
- Cache hit rate should be > 80%
- All security scans should pass
- Deployments should complete in < 10 minutes

---

## 🎉 **Success Indicators**

Your deployment is successful when you see:
- ✅ All GitHub Actions jobs pass
- ✅ Slack notification with "completed successfully"
- ✅ Application responds correctly at the deployed URL
- ✅ Health checks pass
- ✅ No error alerts

---

## 📞 **Getting Help**

Since you're working solo:
1. **Check the logs**: GitHub Actions has detailed error messages
2. **Review the documentation**: All guides are in the repository
3. **Use the rollback**: Don't be afraid to rollback if something breaks
4. **Monitor closely**: Keep an eye on the first few deployments

---

## 🔄 **Workflow Summary**

**Your simplified development loop:**
1. **Make changes** → `git add && git commit && git push origin develop`
2. **Monitor** → Watch GitHub Actions + Slack notifications
3. **Validate** → Test on staging environment
4. **Deploy to prod** → `git checkout main && git merge develop && git push origin main`
5. **Monitor** → Watch production deployment and health

**That's it!** No team coordination, no PR reviews, no waiting for approvals. Just quality-gated, automated deployments.

---

**Configuration Complete**: ✅ **READY FOR SOLO DEVELOPER DEPLOYMENTS**

**Next Step**: Try deploying to staging by pushing to the `develop` branch!