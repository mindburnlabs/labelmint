# Required Secrets Configuration

## 🔐 **Required Secrets for Unified CI/CD Pipeline**

These secrets must be configured in your GitHub repository settings for the unified workflow to function properly.

### **How to Add Secrets:**
1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret listed below

---

## 📋 **Required Secrets List**

### **Core CI/CD Secrets**

| Secret Name | Purpose | Required For | Example/Format |
|-------------|---------|--------------|----------------|
| `CODECOV_TOKEN` | Code coverage reporting | Uploading test coverage to Codecov | `your_codecov_token_here` |
| `SLACK_WEBHOOK_URL` | Deployment notifications | Slack integration for deployment status | `https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK` |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI performance testing | Performance testing and reporting | `your_lhci_github_app_token` |

### **AWS Infrastructure Secrets**

| Secret Name | Purpose | Required For | Example/Format |
|-------------|---------|--------------|----------------|
| `AWS_ACCESS_KEY_ID` | AWS access key for staging | Staging deployment and resource management | `your_staging_aws_access_key_id` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for staging | Staging deployment and resource management | `your_staging_aws_secret_key` |
| `AWS_ROLE_ARN` | AWS IAM role for deployment | Cross-account deployment and elevated permissions | `arn:aws:iam::ACCOUNT:role/ROLE_NAME` |
| `AWS_PROD_ACCESS_KEY_ID` | Production AWS access key | Production deployment only | `your_production_aws_access_key_id` |
| `AWS_PROD_SECRET_ACCESS_KEY` | Production AWS secret key | Production deployment only | `your_production_aws_secret_key` |

### **Security Scanning Secrets**

| Secret Name | Purpose | Required For | Example/Format |
|-------------|---------|--------------|----------------|
| `SNYK_TOKEN` | Snyk vulnerability scanning | Dependency and code security analysis | `your_snyk_token` |
| `SEMGREP_APP_TOKEN` | Semgrep SAST scanning | Static application security testing | `your_semgrep_app_token` |

### **GitHub Tokens (Automatically Provided)**

| Secret Name | Purpose | Source | Notes |
|-------------|---------|--------|-------|
| `GITHUB_TOKEN` | GitHub API access | Automatically provided by GitHub Actions | Has limited permissions, configured in workflow permissions |
| `ACTIONS_RUNTIME_TOKEN` | Container registry authentication | Automatically provided | Used for GHCR authentication |

---

## 🔍 **Secret Verification Commands**

### **Check if Secrets Exist (GitHub CLI)**
```bash
# List repository secrets (requires admin access)
gh secret list --repo labelmint/labelmint

# Check specific secret exists
gh secret list --repo labelmint/labelmint | grep CODECOV_TOKEN
```

### **Test Secret Access in Workflow**
```yaml
- name: Test secret access
  run: |
    echo "Testing secret access..."
    if [ -z "$CODECOV_TOKEN" ]; then
      echo "❌ CODECOV_TOKEN not configured"
      exit 1
    else
      echo "✅ CODECOV_TOKEN configured"
    fi
  env:
    CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

---

## ⚠️ **Security Best Practices**

### **Secret Management Guidelines**

1. **Principle of Least Privilege**
   - Use separate keys for staging and production
   - Limit IAM role permissions to only what's necessary
   - Rotate secrets regularly (recommended every 90 days)

2. **Secret Naming Conventions**
   - Use descriptive names: `AWS_PROD_ACCESS_KEY_ID` vs `AWS_KEY1`
   - Environment-specific naming: `_PROD_`, `_STAGING_` suffixes
   - Consistent naming across environments

3. **Access Control**
   - Only repository administrators should manage secrets
   - Use GitHub Environments for environment-specific secrets
   - Enable dependency review for additional security

### **Secret Rotation Schedule**

| Secret | Rotation Frequency | Notes |
|--------|-------------------|-------|
| AWS Keys | Every 90 days | AWS IAM console |
| Snyk Token | Every 180 days | Snyk dashboard |
| Slack Webhook | As needed | Slack app settings |
| Codecov Token | As needed | Codecov settings |

---

## 🚨 **Troubleshooting Secret Issues**

### **Common Problems**

#### **Secret Not Found Error**
```
Error: secrets.CODECOV_TOKEN is not set
```
**Solution:**
1. Verify secret exists in repository settings
2. Check secret name spelling (case-sensitive)
3. Ensure workflow has permissions to access secrets

#### **AWS Permission Denied**
```
Error: User: arn:aws:iam::123456789012:user/github-actions is not authorized to perform: ecs:UpdateService
```
**Solution:**
1. Verify IAM role has correct permissions
2. Check role trust relationship allows GitHub Actions
3. Ensure AWS credentials are correct and active

#### **Snyk Authentication Failed**
```
Error: Your Snyk token is invalid or expired
```
**Solution:**
1. Regenerate Snyk token from dashboard
2. Update secret in GitHub repository
3. Verify Snyk account is active

### **Debug Commands**

```bash
# Test AWS credentials
aws sts get-caller-identity

# Test Snyk token
curl -H "Authorization: token $SNYK_TOKEN" https://api.snyk.io/v1/user/me

# Test Slack webhook
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message"}' \
  $SLACK_WEBHOOK_URL
```

---

## 📝 **Secret Setup Checklist**

### **Before Migration**
- [ ] Inventory existing secrets in current workflows
- [ ] Document secret purposes and usage
- [ ] Identify any missing secrets for unified workflow

### **After Migration**
- [ ] Add all required secrets to GitHub repository
- [ ] Test secret access in a draft workflow
- [ ] Verify AWS permissions are correct
- [ ] Test external service integrations (Slack, Codecov, Snyk)
- [ ] Document secret rotation schedule
- [ ] Set up alerts for secret expiration (if possible)

### **Ongoing Maintenance**
- [ ] Schedule regular secret rotation
- [ ] Monitor for secret-related workflow failures
- [ ] Update secrets when team members change
- [ ] Review and prune unused secrets

---

## 🆘 **Getting Help**

If you encounter issues with secret configuration:

1. **Check GitHub Actions Logs**: Look for specific error messages
2. **Verify Secret Names**: Ensure exact match between workflow and repository
3. **Test External Services**: Verify tokens work outside GitHub Actions
4. **Review IAM Permissions**: Ensure AWS roles have necessary permissions
5. **Contact Team**: Reach out to DevOps team in `#devops` Slack channel

### **Useful Resources**
- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Snyk Token Management](https://support.snyk.io/hc/en-us/articles/360003912438-Managing-your-Snyk-Tokens)

---

**Last Updated**: October 24, 2025
**Review Required**: Every 90 days or when team changes occur