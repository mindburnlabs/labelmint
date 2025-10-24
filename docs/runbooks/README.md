# Operations Runbooks

This repository contains operational runbooks for the Telegram Labeling Platform. These runbooks provide step-by-step procedures for handling common operational tasks, incidents, and maintenance activities.

## Table of Contents

1. [Incident Response](./incident-response.md)
2. [Database Maintenance](./database-maintenance.md)
3. [Scaling Procedures](./scaling-procedures.md)
4. [Backup Restoration](./backup-restoration.md)
5. [Security Incident Response](./security-incidents.md)
6. [Performance Troubleshooting](./performance-troubleshooting.md)
7. [Bot Management](./bot-management.md)
8. [Payment System Issues](./payment-issues.md)

## Quick Reference

### Critical Contacts

- **On-call Engineer**: +1-XXX-XXX-XXXX
- **Engineering Manager**: +1-XXX-XXX-XXXX
- **CTO**: +1-XXX-XXX-XXXX
- **Support Lead**: support@labelmint.it
- **Infrastructure Lead**: infra@labelmint.it

### Emergency Procedures

1. **Service Down**: [Service Outage Runbook](./incident-response.md#service-outage)
2. **Database Down**: [Database Recovery](./database-maintenance.md#emergency-recovery)
3. **Security Incident**: [Security Response](./security-incidents.md#immediate-response)
4. **Payment Issues**: [Payment System Recovery](./payment-issues.md#payment-failures)

### Critical System Access

| System | URL | Access Method |
|--------|-----|---------------|
| Production API | https://api.labelmint.it | VPN + SSH |
| Monitoring | https://grafana.labelmint.it | SSO |
| Logs | https://logs.labelmint.it | SSO |
| Database | psql://prod-db | VPN + SSH |
| Infrastructure | https://console.aws.com | MFA |

## Runbook Structure

Each runbook follows this structure:

- **Overview**: Brief description of the scenario
- **Prerequisites**: Required tools and permissions
- **Symptoms**: How to identify the issue
- **Impact**: Potential impact on users/business
- **Triage**: Initial diagnostic steps
- **Resolution**: Step-by-step resolution
- **Verification**: How to confirm the issue is resolved
- **Post-mortem**: Follow-up actions

## Using These Runbooks

1. **During an Incident**:
   - Stay calm and follow the steps
   - Communicate progress regularly
   - Document actions taken
   - Ask for help if stuck

2. **During Maintenance**:
   - Schedule in advance
   - Send notifications
   - Create backup points
   - Test after changes

3. **For Training**:
   - Review runbooks regularly
   - Practice common scenarios
   - Update based on lessons learned

## Runbook Categories

### 🔴 Critical (P0)
- Service complete outage
- Data loss or corruption
- Security breach
- Payment system failure

### 🟠 High (P1)
- Service degradation
- Feature unavailable
- Database performance issues
- Bot not responding

### 🟡 Medium (P2)
- Partial functionality loss
- Performance degradation
- Non-critical bugs
- Maintenance tasks

### 🟢 Low (P3)
- Documentation updates
- Optimization
- Monitoring improvements
- Feature requests

## Incident Severity Levels

| Severity | Description | Response Time |
|----------|-------------|---------------|
| SEV-0 | Critical - Complete outage | 5 minutes |
| SEV-1 | High - Major impact | 15 minutes |
| SEV-2 | Medium - Partial impact | 1 hour |
| SEV-3 | Low - Minor impact | 4 hours |
| SEV-4 | Informational | 24 hours |

## Escalation Policy

1. **First Responder**: Initial triage and assessment
2. **On-call Engineer**: Implementation of fixes
3. **Engineering Manager**: Escalation and coordination
4. **CTO**: Critical incidents and major decisions

## Communication Templates

### SEV-0/SEV-1 Incident

```
🚨 INCIDENT: [Brief Description]

Status: Investigating
Started: [Time]
Impact: [Affected services]
ETA: Unknown

Next update in 15 minutes
```

### Resolution Update

```
✅ INCIDENT RESOLVED: [Brief Description]

Duration: [Total time]
Root Cause: [Summary]
Affected Users: [Number]
Next Steps: [Prevention measures]

Thank you for your patience.
```

## Tools Required

- **Access**: SSH keys, VPN, MFA tokens
- **Monitoring**: Grafana, Prometheus, Sentry
- **Communication**: Slack, PagerDuty
- **Infrastructure**: Docker, Kubernetes, AWS Console
- **Database**: psql, Redis CLI
- **Logs**: ELK Stack, CloudWatch

## Checklist Before Starting

- [ ] You have necessary permissions
- [ ] You understand the impact
- [ ] You have notified stakeholders
- [ ] You have a backup plan
- [ ] You know how to rollback

## Contributing to Runbooks

To update or add runbooks:

1. Follow the established template
2. Test procedures in staging
3. Get peer review
4. Update documentation
5. Train the team

## Recent Updates

- 2024-01-15: Added payment system runbook
- 2024-01-10: Updated database recovery procedures
- 2024-01-05: Added scaling procedures
- 2024-01-01: Initial runbook creation

## Contact

- **Runbook Owner**: ops@labelmint.it
- **Documentation**: docs@labelmint.it
- **Issues**: Create GitHub issue

---

Remember: These runbooks are living documents. They should be updated regularly based on real incidents and lessons learned.