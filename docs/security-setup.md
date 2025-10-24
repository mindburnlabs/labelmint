# Production Security Setup Guide

This guide provides comprehensive security setup instructions for DeligeIT production environment.

## Table of Contents

1. [Security Middleware](#security-middleware)
2. [Secrets Management](#secrets-management)
3. [WAF Configuration](#waf-configuration)
4. [Database Security](#database-security)
5. [Monitoring & Scanning](#monitoring-scanning)
6. [CI/CD Security](#cicd-security)
7. [Infrastructure Security](#infrastructure-security)
8. [Response Plan](#response-plan)

## Security Middleware

### Implementation

The application includes comprehensive security middleware (`src/middleware/security.ts`):

- **Helmet.js**: Security headers (CSP, HSTS, XSS Protection)
- **Rate Limiting**: Redis-based with multiple strategies
- **SQL Injection Protection**: Pattern-based detection
- **XSS Protection**: Pattern-based sanitization
- **Request Validation**: Size limits, suspicious patterns
- **IP Blacklisting**: Known malicious IPs
- **Bot Detection**: User-Agent analysis
- **CSRF Protection**: Token-based validation
- **CORS**: Configurable origins

### Configuration

```typescript
// app.ts
import SecurityMiddleware from './middleware/security';

app.use(SecurityMiddleware.helmetMiddleware());
app.use(SecurityMiddleware.rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
app.use(SecurityMiddleware.requestValidation());
app.use(SecurityMiddleware.sqlInjectionProtection());
app.use(SecurityMiddleware.xssProtection());
```

## Secrets Management

### AWS Secrets Manager

Using AWS Secrets Manager for production secrets (`src/services/secrets.ts`):

```typescript
import SecretsService from './services/secrets';

// Get database credentials
const dbCreds = await SecretsService.getSecret('labelmintit/database');

// Rotate secrets
await SecretsService.rotateSecret('labelmintit/jwt-secret');
```

### Environment Variables

Critical secrets to manage:

```env
# Database
DB_PASSWORD=ENCRYPTED_PASSWORD_HERE
DB_USERNAME=labelmintit_user
DB_HOST=labelmintit-db.cluster-xyz.us-east-1.rds.amazonaws.com

# JWT
JWT_SECRET=BASE64_ENCODED_SECRET_HERE
JWT_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d

# API Keys
OPENAI_API_KEY=sk-prod-KEY_HERE
STRIPE_SECRET_KEY=sk_live-KEY_HERE
TWILIO_API_KEY=BASE64_ENCODED_KEY_HERE

# Encryption
KMS_ENCRYPTION_KEY_ID=arn:aws:kms:us-east-1:12345678:key/abcd-efgh
```

### Secret Rotation

Automated rotation schedule:
- **Database passwords**: Every 90 days
- **JWT secrets**: Every 30 days
- **API keys**: Every 180 days
- **TLS certificates**: 30 days before expiry

## WAF Configuration

### CloudFlare WAF

Rules implemented in `.github/workflows/cloudflare-waf.yml`:

- **Rate Limiting**: 100 requests/15 minutes
- **SQL Injection**: Pattern-based blocking
- **XSS Protection**: Script tag detection
- **Path Traversal**: Directory traversal patterns
- **IP Reputation**: Known malicious IP blocking
- **Geo-blocking**: High-risk countries
- **Size Limits**: Maximum request size 10MB

### AWS WAF

CloudFormation template (`infrastructure/waf/aws-waf.yml`):

- **Rate-based Rules**: DDoS protection
- **SQLi Match Statements**: SQL injection detection
- **XSS Match Statements**: XSS attack detection
- **IP Block Lists**: Blacklisted IPs
- **Geo Match Statements**: Country-based blocking
- **Size Constraint**: Request size limits

### WAF Rulesets

Active rulesets:
- OWASP Core Rule Set
- Known Exploits
- Rate Limiting
- Reputation Lists
- Anomaly Scoring

## Database Security

### PostgreSQL Configuration

**PgBouncer** configuration (`database/config/pgbouncer.ini`):

```ini
[pgbouncer]
# Connection pooling
pool_mode = transaction
max_client_conn = 200
default_pool_size = 25
min_pool_size = 10

# Security
auth_type = md5
client_tls_sslmode = require
server_tls_sslmode = verify-ca

# Query protection
query_blocklist = UPDATE users SET password = '' WHERE id =
query_blocklist_regexp = (SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)
```

### Database Access Control

1. **Least Privilege Principle**: Specific users, minimal permissions
2. **Network Isolation**: Private subnets only
3. **Encryption at Rest**: AES-256 encryption enabled
4. **Encryption in Transit**: TLS 1.2/1.3 required
5. **Connection Limits**: PgBouncer pooling and limits

### Security Groups

Production database security groups:

```yaml
DatabaseSecurityGroup:
  - Ingress:
      - IpProtocol: tcp
      FromPort: 5432
      ToPort: 5432
      SourceSecurityGroupId: !Ref ApplicationSecurityGroup
  - Egress:
      - IpProtocol: tcp
      FromPort: 0
      ToPort: 65535
      DestinationPrefix: "0.0.0.0/0"
      Description: Allow all outbound
```

## Monitoring & Scanning

### Automated Scanning

GitHub Actions workflow (`.github/workflows/security.yml`):

- **CodeQL**: Static analysis for security vulnerabilities
- **Semgrep**: SAST scanning with custom rules
- **Snyk**: Dependency vulnerability scanning
- **Trivy**: Container image vulnerability scanning
- **npm Audit**: Package vulnerability checks
- **Gitleaks**: Secret scanning in code
- **OWASP ZAP**: Dynamic application security testing
- **OSSF Scorecard**: Supply chain security assessment

### Scanning Schedule

- **Daily**: Full security scan
- **On PR**: Differential security analysis
- **Weekly**: Deep scan of critical components
- **Monthly**: Third-party security audit

### Alerting

Security alerts configured for:
- High severity vulnerabilities (CVSS > 7.0)
- New critical vulnerabilities
- Failed security tests
- WAF blocks exceeding threshold
- Anomalous access patterns

## CI/CD Security

### Pipeline Security

1. **Secure Checkout**: No credentials in checkout
2. **Secret Injection**: From GitHub secrets, never hardcoded
3. **Artifact Scanning**: All artifacts scanned before deployment
4. **Approval Required**: Manual approval for production
5. **Rollback Plan**: Automated rollback on security failure

### Environment Protection

- **Staging**: Isolated environment with limited data
- **Production**: Full security controls, read-only access to many resources
- **Development**: Development-only security measures
- **Audit Logs**: All environments logged for audit

## Infrastructure Security

### Network Security

1. **VPC Isolation**: Private subnets for application and database
2. **Security Groups**: Principle of least privilege
3. **NACLs**: Network-level allow lists
4. **VPN Only**: Direct RDS access via VPN only
5. **Bastion Host**: Jump server for admin access

### Encryption

- **Data at Rest**: All data encrypted using KMS
- **Data in Transit**: TLS 1.2/1.3 everywhere
- **EBS Volumes**: Encrypted with CMK
- **S3 Buckets**: Server-side encryption enabled
- **RDS**: Encryption at rest and in transit

### Access Control

```yaml
IAM Policy Example:
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "rds:DescribeDBInstances",
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:ec2:*:instance:i-*",
        "arn:aws:rds:*:db:*",
        "arn:aws:s3:::bucket:deligeit-*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:PrincipalTag/Team": "Backend"
        }
      }
    }
  ]
}
```

## Response Plan

### Incident Response Team

**Primary**: 24/7 on-call rotation
**Secondary**: Backup team members
**Escalation**: Management team for critical incidents

### Incident Types

1. **P1 - Critical**: Data breach, service completely down
2. **P2 - High**: Security vulnerability exploited, partial outage
3. **P3 - Medium**: Potential security issue, degradation
4. **P4 - Low**: Security best practice violation

### Response Procedures

1. **Detection**: Automated monitoring and alerts
2. **Assessment**: 1 hour triage and impact analysis
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threat, patch vulnerabilities
5. **Recovery**: Restore services, verify security
6. **Post-Mortem**: Learn and improve

### Communication

- **Internal**: Slack channel `#security-incidents`
- **External**: Email alerts to security@labelmintit.com
- **Public**: Security advisory within 72 hours for P1/P2

## Security Best Practices

### Application Security

1. **Input Validation**: Validate all inputs on server side
2. **Output Encoding**: Encode all dynamic output
3. **Parameterized Queries**: Never concatenate SQL
4. **Error Handling**: Generic error messages only
5. **Session Security**: Secure, HttpOnly, SameSite cookies
6. **Password Policies**: Minimum 12 chars, complexity required

### Infrastructure Security

1. **Regular Updates**: Keep all systems patched
2. **Backup Strategy**: 3-2-1 backup rule
3. **Disaster Recovery**: Regular testing and documentation
4. **Change Management**: Approved changes only
5. **Access Reviews**: Quarterly access reviews

### Compliance

- **SOC 2**: Type II compliance controls
- **GDPR**: Data protection for EU users
- **PCI DSS**: Payment card security (if applicable)
- **HIPAA**: Healthcare data protection (if applicable)
- **ISO 27001**: Information security management

## Security Checklist

### Pre-Deployment Checklist

- [ ] All security tests passing
- [ ] Vulnerability scan complete (no critical)
- [ ] Secrets properly stored
- [ ] Security configurations reviewed
- [ ] Access controls verified
- [ ] Backup procedures tested
- [ ] Incident response team notified
- [ ] Documentation updated

### Post-Deployment Checklist

- [ ] WAF rules active and monitoring
- [ ] Security logging enabled and collecting
- [ ] Rate limits tested under load
- [ ] Database security measures active
- [ ] SSL certificates valid and renewing
- [ ] Monitoring dashboards configured
- [ ] Alerting notifications tested

## Security Tools

### Recommended Tools

1. **Static Analysis**: SonarQube, Checkmarx, Veracode
2. **Dynamic Analysis**: OWASP ZAP, Burp Suite, Nessus
3. **Container Security: Trivy, Clair, Aqua
4. **Dependency Scanning**: Snyk, Dependabot, WhiteSource
5. **Infrastructure**: Prowler, ScoutSuite, CloudMapper

### Services

- **Bug Bounty**: Program managed by security team
- **Penetration Testing**: Quarterly external assessment
- **Security Training**: Regular security awareness training
- **Consulting**: Third-party security assessment

## Emergency Procedures

### Data Breach Response

1. **Immediate Actions**:
   - Identify scope of breach
   - Isolate affected systems
   - Notify legal and compliance teams
   - Preserve forensic evidence

2. **Within 1 Hour**:
   - Execute incident response plan
   - Begin forensic analysis
   - Notify affected customers if required
   - Prepare public communication

3. **Within 24 Hours**:
   - Complete forensic analysis
   - Patch all vulnerabilities
   - Validate remediation
   - Plan comprehensive testing

4. **Ongoing**:
   - Monitor for further issues
   - Provide regular status updates
   - Learn from incident
   - Update security procedures

## Contact Information

### Security Team
- **Email**: security@labelmintit.com
- **Slack**: #security-team
- **Phone**: +1-555-SECURE (24/7)
- **PagerDuty**: DeligeIT-Security

### External Resources
- **Report Security Issues**: security@labelmintit.com
- **Bug Bounty**: https://hackerone.com/labelmintit
- **Security Updates**: https://labelmintit.com/security

## Documentation Updates

This document should be updated when:
- New security controls are implemented
- Security configurations are modified
- New threats are identified
- Procedures are improved
- Lessons are learned from incidents

Last updated: 2024-01-15
Version: 2.0