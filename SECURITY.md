# LabelMint Security & Secrets Management Guide

## 🚨 CRITICAL SECURITY NOTICE

This repository has undergone a security cleanup to remove exposed credentials. All real API keys, tokens, and secrets have been replaced with placeholder values.

## Table of Contents

1. [Security Incident Report](#security-incident-report)
2. [Secrets Management Policy](#secrets-management-policy)
3. [Environment Configuration Guide](#environment-configuration-guide)
4. [Security Best Practices](#security-best-practices)
5. [Required Actions for Development Team](#required-actions-for-development-team)

## Security Incident Report

### Exposed Credentials (Now Remediated)
The following credentials were exposed and have been cleaned up:

#### Supabase Credentials
- **URL**: `https://bf71rs1supabase.co`
- **Anon Key**: JWT tokens exposed in .env and .env.production
- **Service Role Key**: `sbp_fbf451aa485559cb62e97609ba65697d7f68e0c0`
- **Database URL**: Complete connection string with credentials

#### Telegram Bot Tokens
- **Client Bot**: `8338364850:AAHvSihgG0F3I0NTsDr1SOwTVr8wMQ5BA14`
- **Worker Bot**: `8287639801:AAFWuyqoDINBukvJRraOH1eazk0mLI60xQs`

### Immediate Actions Taken
1. ✅ All real credentials replaced with placeholder values
2. ✅ Updated .gitignore to prevent future commits
3. ✅ Created this security documentation
4. ✅ Flagged for credential rotation

## Secrets Management Policy

### 1. Never Commit Real Credentials
- **RULE**: No real API keys, tokens, or secrets in version control
- **EXCEPTION**: Public keys (non-sensitive) are acceptable
- **ENFORCEMENT**: Automated scanning and .gitignore rules

### 2. Environment File Hierarchy
```
.env                    # Never commit (local development)
.env.development        # Never commit (dev environment)
.env.staging           # Never commit (staging environment)
.env.production        # Never commit (production environment)
.env.example           # ✅ Safe to commit (templates only)
.env.template         # ✅ Safe to commit (templates only)
```

### 3. Credential Rotation Schedule
- **API Keys**: Every 90 days
- **Database Passwords**: Every 180 days
- **JWT Secrets**: Immediately if exposed
- **Bot Tokens**: Immediately if exposed

## Environment Configuration Guide

### Development Setup

1. **Copy Environment Template**:
   ```bash
   cp .env.example .env
   ```

2. **Update with Real Values**:
   - Obtain from secure credential manager
   - Use development-specific credentials
   - Never use production credentials in development

3. **Secure Local Storage**:
   ```bash
   chmod 600 .env
   ```

### Production Deployment

1. **Use Environment Variables**: Set directly in hosting platform
2. **Secret Management Services**:
   - AWS Secrets Manager
   - Google Secret Manager
   - Azure Key Vault
   - HashiCorp Vault

3. **Never Store .env Files** in production containers

## Security Best Practices

### 1. Git Security
```gitignore
# Environment files
.env
.env.local
.env.development
.env.staging
.env.production

# Secret files
*.key
*.pem
*.p12
secrets/
credentials/

# Database files
*.db
*.sqlite
*.sqlite3

# IDE files with secrets
.vscode/settings.json  # May contain API keys
```

### 2. Code Security
- ✅ Use environment variable validation
- ✅ Implement proper secret rotation
- ✅ Log security events (without exposing secrets)
- ✅ Use secure defaults for all configurations

### 3. Infrastructure Security
- ✅ Encrypt data at rest and in transit
- ✅ Use IAM roles instead of access keys when possible
- ✅ Implement network segmentation
- ✅ Regular security audits and penetration testing

## Required Actions for Development Team

### IMMEDIATE (Within 24 hours)

1. **Rotate All Exposed Credentials**:
   - Supabase: Generate new API keys and tokens
   - Telegram: Create new bot tokens
   - Update any additional services that used these credentials

2. **Update Production Environment**:
   - Replace old credentials in production
   - Verify all services are functioning
   - Monitor for unusual activity

3. **Team Security Briefing**:
   - Review this security incident
   - Reinforce secrets management policies
   - Implement mandatory security training

### SHORT TERM (Within 1 week)

1. **Implement Automated Security Scanning**:
   ```yaml
   # GitHub Actions Example
   - name: Scan for secrets
     uses: trufflesecurity/trufflehog@main
     with:
       path: ./
       base: main
       head: HEAD
   ```

2. **Set Up Secret Management**:
   - Choose a secret management solution
   - Migrate all production secrets
   - Update deployment scripts

3. **Update CI/CD Pipeline**:
   - Add secret scanning to all PRs
   - Block commits with exposed credentials
   - Implement automated security testing

### Ongoing

1. **Regular Security Audits**
   - Monthly secret scanning
   - Quarterly penetration testing
   - Annual security assessment

2. **Team Training**
   - Quarterly security awareness training
   - Regular policy updates
   - Incident response drills

## Emergency Contact

If you suspect a security incident:

1. **Immediate Actions**:
   - Revoke exposed credentials
   - Notify security team
   - Document timeline

2. **Report To**:
   - Security Lead: [security@labelmint.it]
   - Development Team Lead: [dev-lead@labelmint.it]

## Security Resources

- [OWASP Secrets Management Guide](https://owasp.org/www-project-secrets-management/)
- [Git Secrets Tool](https://github.com/awslabs/git-secrets)
- [TruffleHog Secret Scanner](https://github.com/trufflesecurity/trufflehog)

---

**Last Updated**: 2024-10-24
**Security Version**: 1.0
**Next Review**: 2024-11-24

**IMPORTANT**: This document must be reviewed and updated whenever:
- New services are added
- Security incidents occur
- Development practices change
- New team members onboard