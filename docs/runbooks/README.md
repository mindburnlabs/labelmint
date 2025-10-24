# LabelMint Operations Runbooks

> **Comprehensive operational procedures for incident response, maintenance, and system administration**

## 📚 Overview

This directory contains operational runbooks for the LabelMint platform. These runbooks provide step-by-step procedures for handling common operational tasks, incidents, and maintenance activities. All runbooks follow a standardized structure for consistency and ease of use during high-pressure situations.

---

## 🚨 Quick Emergency Reference

### Critical Contacts

| Role | Contact | Response Time |
|------|---------|---------------|
| **On-call Engineer** | oncall@labelmint.it | 5 minutes |
| **Engineering Manager** | eng-manager@labelmint.it | 15 minutes |
| **CTO** | cto@labelmint.it | 30 minutes (critical only) |
| **Security Lead** | security-lead@labelmint.it | 15 minutes |
| **Infrastructure Lead** | infra@labelmint.it | 15 minutes |
| **Support Lead** | support@labelmint.it | Business hours |

### Emergency Procedures (Quick Access)

| Scenario | Runbook | First Action |
|----------|---------|--------------|
| 🔴 **Complete Service Outage** | [incident-response.md](./incident-response.md#service-outage) | Check health endpoints, declare SEV-0 |
| 🔴 **Database Down** | [database-maintenance.md](./database-maintenance.md#emergency-recovery) | Stop apps, verify backup availability |
| 🔴 **Security Breach** | [security-incidents.md](./security-incidents.md#initial-response) | Isolate systems, preserve evidence |
| 🟠 **Performance Degradation** | [incident-response.md](./incident-response.md#performance-degradation) | Check metrics, identify bottlenecks |
| 🟠 **Bot Not Responding** | [incident-response.md](./incident-response.md#bot-malfunction) | Verify Telegram API, check webhook |
| 🟠 **Payment System Issues** | [incident-response.md](./incident-response.md#payment-failures) | Check TON node, pause automated payments |
| 🟡 **Need to Scale** | [scaling-procedures.md](./scaling-procedures.md) | Check load metrics, execute scaling plan |
| 🟢 **Restore from Backup** | [backup-restoration.md](./backup-restoration.md) | Identify backup timestamp, verify integrity |

### Critical System Access

| System | URL | Access Method | Purpose |
|--------|-----|---------------|---------|
| **Production API** | https://api.labelmint.it | VPN + SSH | Application backend |
| **Web App** | https://labelmint.it | Public | User interface |
| **Monitoring** | https://grafana.labelmint.it | SSO | Metrics & dashboards |
| **Logs** | https://logs.labelmint.it | SSO | Centralized logging |
| **Database** | postgres.internal.labelmint.it:5432 | VPN + SSH | PostgreSQL primary |
| **AWS Console** | https://console.aws.com | MFA | Infrastructure management |

---

## 📖 Available Runbooks

### 🔴 Critical Operations (SEV-0)

#### [Incident Response](./incident-response.md)
**Use when**: Service outage, critical errors, system-wide issues

**Contents**:
- Service outage procedures
- Performance degradation troubleshooting
- Database issue resolution
- Bot malfunction fixes
- Payment failure handling
- Post-incident procedures
- Communication templates

**Key Sections**:
- Initial triage (first 5 minutes)
- Communication updates
- Resolution strategies
- Verification procedures
- Post-mortem template

#### [Security Incidents](./security-incidents.md)
**Use when**: Security breach, unauthorized access, DDoS attack, malware

**Contents**:
- Incident classification (SEV-0 to SEV-3)
- Data breach response
- DDoS mitigation
- Ransomware/malware procedures
- Insider threat detection
- Forensic evidence collection
- GDPR compliance
- Credential rotation

**Key Sections**:
- Initial response (first 15 minutes)
- Evidence preservation
- Containment procedures
- Log analysis
- Post-incident hardening

#### [Backup & Restoration](./backup-restoration.md)
**Use when**: Data loss, corruption, disaster recovery, system rebuild

**Contents**:
- Backup architecture
- Automated backup procedures
- Full system restoration
- Point-in-Time Recovery (PITR)
- Selective restoration
- Disaster recovery testing
- Backup verification
- Recovery metrics (RTO/RPO)

**Key Sections**:
- Emergency recovery from scratch
- Database restoration
- File system restoration
- Monthly DR drills

---

### 🟠 High Priority Operations (SEV-1)

#### [Database Maintenance](./database-maintenance.md)
**Use when**: Regular maintenance, performance issues, capacity planning

**Contents**:
- Daily, weekly, monthly maintenance tasks
- Query optimization
- Index management
- Connection pooling (PgBouncer)
- Vacuum and analyze procedures
- Performance tuning
- Failover procedures
- Security tasks

**Key Sections**:
- Routine maintenance schedules
- Emergency procedures
- Performance optimization
- Monitoring and alerting
- Backup procedures

#### [Scaling Procedures](./scaling-procedures.md)
**Use when**: High load expected, performance issues, capacity expansion

**Contents**:
- Horizontal scaling (API, database, cache)
- Vertical scaling (resources, optimization)
- Auto-scaling configuration
- Load testing procedures
- Emergency scaling
- Post-event scale-down
- Cost optimization

**Key Sections**:
- Scaling triggers and metrics
- Docker/Kubernetes scaling
- Database read replicas
- Redis clustering
- Event preparation
- Monitoring scaled infrastructure

---

## 📋 Runbook Structure

Each runbook follows this standardized structure:

```markdown
# [Runbook Title]

## Overview
Brief description of scenarios covered

## Prerequisites
- Required tools and access
- Necessary permissions
- Team roles involved

## Symptoms
How to identify the issue
- Observable indicators
- Alert conditions
- User reports

## Impact
Potential impact on:
- Users
- Business operations
- Data integrity
- System stability

## Triage
Initial diagnostic steps
- Quick checks
- Data gathering
- Severity assessment

## Resolution
Step-by-step resolution procedures
- Immediate actions
- Investigation steps
- Fix implementation
- Verification

## Verification
How to confirm resolution
- Health checks
- Smoke tests
- Monitoring validation

## Post-mortem
Follow-up actions
- Root cause analysis
- Prevention measures
- Documentation updates
```

---

## 🎯 Using These Runbooks

### During an Incident

1. **Stay Calm**: Follow the steps methodically
2. **Declare Incident**: Use appropriate severity level
3. **Communicate**: Regular updates to stakeholders
4. **Document**: Record all actions taken in incident channel
5. **Ask for Help**: Don't hesitate to escalate
6. **Follow Up**: Complete post-mortem within 24 hours

### Communication Protocol

#### Initial Incident Declaration (SEV-0/SEV-1)
```
🚨 INCIDENT: [Brief Description]

Status: Investigating
Severity: [SEV-0/1/2/3]
Started: [UTC Time]
Impact: [Affected services/users]
Lead: [@responder]
Channel: #incident-YYYYMMDD-HHMM

Next update in 15 minutes
```

#### Update Template
```
📢 UPDATE: [Incident Title]

Status: [Investigating/In Progress/Monitoring]
Duration: [XX minutes]
Progress: [What we've done/found]
Next Steps: [What's being done next]
ETA: [Expected resolution time]

Next update in [X] minutes
```

#### Resolution Template
```
✅ RESOLVED: [Incident Title]

Duration: [Total time from start to resolution]
Root Cause: [Brief summary]
Affected Users: [Number/percentage]
Resolution: [What fixed it]
Prevention: [Steps to prevent recurrence]

Post-mortem: [Link to document]

Thank you for your patience.
```

### During Maintenance

1. **Schedule in Advance**: Notify stakeholders 24-48 hours ahead
2. **Send Notifications**: Use status page and communication channels
3. **Create Backup Points**: Always backup before changes
4. **Test After Changes**: Verify system health post-maintenance
5. **Document Changes**: Update configuration management

### For Training

1. **Regular Review**: Review runbooks quarterly
2. **Practice Scenarios**: Run game days monthly
3. **Update Based on Lessons**: Incorporate learnings from real incidents
4. **Knowledge Sharing**: Conduct runbook walkthroughs with team

---

## 🎚️ Incident Severity Levels

| Severity | Description | Examples | Response Time | Update Frequency |
|----------|-------------|----------|---------------|------------------|
| **SEV-0** | **Critical** - Complete outage | All services down, database unavailable, data breach | 5 minutes | Every 15 minutes |
| **SEV-1** | **High** - Major impact | Service degradation, feature unavailable, payment issues | 15 minutes | Every 30 minutes |
| **SEV-2** | **Medium** - Partial impact | Single feature broken, performance issues, bot errors | 1 hour | Every 2 hours |
| **SEV-3** | **Low** - Minor impact | Non-critical bugs, UI issues, documentation errors | 4 hours | Daily |
| **SEV-4** | **Informational** - No impact | Monitoring alerts, potential future issues | 24 hours | As needed |

---

## 📞 Escalation Policy

```
┌─────────────────────────────────────┐
│    First Responder (On-call)        │
│    - Initial triage                 │
│    - Assessment                     │
│    - Basic troubleshooting          │
└──────────────┬──────────────────────┘
               │ If no progress in 15 min
               ▼
┌─────────────────────────────────────┐
│    On-call Engineer                 │
│    - Deep investigation             │
│    - Implementation of fixes        │
│    - Coordination with team         │
└──────────────┬──────────────────────┘
               │ If complex or no progress in 30 min
               ▼
┌─────────────────────────────────────┐
│    Engineering Manager              │
│    - Resource coordination          │
│    - Stakeholder communication      │
│    - Decision making                │
└──────────────┬──────────────────────┘
               │ If critical or business impact
               ▼
┌─────────────────────────────────────┐
│    CTO                              │
│    - Executive decisions            │
│    - External communication         │
│    - Major architectural changes    │
└─────────────────────────────────────┘
```

**Escalation Triggers**:
- No progress after 30 minutes
- Incident severity increases
- Multiple systems affected
- Data loss or security breach
- Need for external vendor engagement
- Major business impact

---

## 🧰 Required Tools & Access

### Essential Tools

| Category | Tool | Purpose | Installation |
|----------|------|---------|--------------|
| **SSH/VPN** | OpenVPN, Tailscale | Secure server access | `brew install openvpn` |
| **Database** | psql, pgAdmin | Database management | `brew install postgresql` |
| **Container** | Docker, docker-compose | Container operations | `brew install docker` |
| **Cloud** | AWS CLI | Infrastructure management | `brew install awscli` |
| **Monitoring** | Grafana, Prometheus | Metrics and dashboards | Web-based |
| **Logs** | ELK Stack, CloudWatch | Log analysis | Web-based |
| **Communication** | Slack, PagerDuty | Incident coordination | Mobile + Desktop |
| **Testing** | curl, k6, hey | API testing & load testing | `brew install curl k6` |

### Required Permissions

Before starting any operational task:

- [ ] SSH access to production servers
- [ ] VPN connection established
- [ ] Database credentials (read/write based on task)
- [ ] AWS IAM permissions
- [ ] Monitoring dashboard access
- [ ] Slack incident channels access
- [ ] PagerDuty responder role

---

## 📊 Key Metrics to Monitor

### Service Health Metrics

| Metric | Normal Range | Warning | Critical | Action |
|--------|--------------|---------|----------|--------|
| **API Response Time (P95)** | < 500ms | 500-1000ms | > 1000ms | Scale out |
| **Error Rate** | < 0.1% | 0.1-1% | > 1% | Investigate logs |
| **CPU Usage** | < 60% | 60-80% | > 80% | Scale out |
| **Memory Usage** | < 70% | 70-85% | > 85% | Scale out |
| **Database Connections** | < 100 | 100-150 | > 150 | Check for leaks |
| **Disk Space** | < 70% | 70-85% | > 85% | Clean up logs |
| **Queue Depth** | < 500 | 500-1000 | > 1000 | Scale workers |

### Database Metrics

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| **Connection Count** | < 80 | 80-150 | > 150 |
| **Query Duration (P95)** | < 100ms | 100-500ms | > 500ms |
| **Cache Hit Ratio** | > 90% | 80-90% | < 80% |
| **Replication Lag** | < 10s | 10-60s | > 60s |
| **Dead Tuples** | < 1000 | 1000-10000 | > 10000 |

---

## 🔧 Pre-Incident Checklist

Before any major operation or deployment:

### System State
- [ ] All monitoring systems operational
- [ ] Recent backup verified (< 24 hours old)
- [ ] No active incidents or alerts
- [ ] All team members available
- [ ] Communication channels ready

### Documentation
- [ ] Runbook reviewed and understood
- [ ] Roll back plan documented
- [ ] Emergency contacts verified
- [ ] Stakeholder notification prepared

### Access & Permissions
- [ ] All necessary access confirmed
- [ ] VPN connection tested
- [ ] Database access verified
- [ ] AWS credentials valid
- [ ] Backup restore tested recently

### Change Management
- [ ] Change ticket created
- [ ] Peer review completed
- [ ] Deployment window scheduled
- [ ] Stakeholders notified
- [ ] Rollback criteria defined

---

## 📈 Performance Benchmarks

### Target SLOs (Service Level Objectives)

| Service | Metric | Target | Measurement |
|---------|--------|--------|-------------|
| **API Availability** | Uptime | 99.9% | Monthly |
| **API Response Time** | P95 Latency | < 500ms | Per request |
| **API Response Time** | P99 Latency | < 1s | Per request |
| **Database Availability** | Uptime | 99.95% | Monthly |
| **Database Query** | P95 Duration | < 100ms | Per query |
| **Bot Response** | Time to response | < 2s | Per message |
| **Data Durability** | RPO | < 15 min | Per backup |
| **Recovery Time** | RTO | < 1 hour | Per incident |

### Disaster Recovery Objectives

| Service Type | RTO Target | RPO Target | Backup Frequency |
|--------------|------------|------------|------------------|
| **Database** | 1 hour | 15 minutes | Continuous WAL + Daily full |
| **Application** | 30 minutes | 4 hours | Daily Docker images |
| **File Storage** | 2 hours | 24 hours | Daily to S3 |
| **Configuration** | 15 minutes | 1 hour | Git + Terraform |

---

## 🎓 Training & Knowledge Transfer

### New Team Member Onboarding

**Week 1: Read & Understand**
- [ ] Read all runbooks thoroughly
- [ ] Review past incident reports
- [ ] Understand architecture and dependencies
- [ ] Set up all required tools and access

**Week 2: Shadow Operations**
- [ ] Shadow on-call engineer
- [ ] Observe incident response
- [ ] Attend maintenance windows
- [ ] Practice in staging environment

**Week 3: Hands-on Practice**
- [ ] Execute routine maintenance tasks
- [ ] Participate in game day exercises
- [ ] Review and provide feedback on runbooks
- [ ] Conduct mock incident response

**Week 4: On-call Ready**
- [ ] Solo maintenance task execution
- [ ] Lead mock incident response
- [ ] Get certified by team lead
- [ ] Join on-call rotation

### Game Day Exercises (Monthly)

**Format**: Simulated incidents in staging environment

**Scenarios**:
1. Database failure and recovery
2. DDoS attack mitigation
3. Application deployment rollback
4. Security breach response
5. Multi-service cascade failure

**Goals**:
- Practice runbook procedures
- Identify gaps in documentation
- Build team confidence
- Improve response times

---

## 📝 Contributing to Runbooks

### When to Update

- **After Every Incident**: Incorporate lessons learned
- **After Successful Maintenance**: Document any deviations
- **When Tools Change**: Update commands and procedures
- **When Architecture Evolves**: Reflect new systems
- **Quarterly Reviews**: Verify accuracy and relevance

### Update Process

1. **Identify Need**: Note gaps during actual usage
2. **Draft Changes**: Use standard runbook structure
3. **Test Procedures**: Verify in staging environment
4. **Peer Review**: Get review from 2+ team members
5. **Update Documentation**: Commit to repository
6. **Communicate Changes**: Announce in team channels
7. **Train Team**: Walk through updates

### Runbook Quality Standards

✅ **Good Runbook**:
- Step-by-step procedures
- Copy-paste commands
- Clear expected outcomes
- Verification steps
- Rollback procedures
- Estimated time for each step

❌ **Poor Runbook**:
- Vague instructions
- Missing commands
- No verification steps
- Assumes expert knowledge
- No troubleshooting section

---

## 🔗 Related Documentation

### Internal Documentation
- [Architecture Overview](../architecture/overview.md)
- [Deployment Guide](../DEPLOYMENT.md)
- [Security Guide](../SECURITY.md)
- [Development Guide](../DEVELOPMENT.md)
- [API Documentation](../api/README.md)

### External Resources
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [AWS Documentation](https://docs.aws.amazon.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Terraform Documentation](https://www.terraform.io/docs/)

---

## 📚 Additional Resources

### Monitoring Dashboards
- **Service Health**: https://grafana.labelmint.it/d/service-health
- **Database Metrics**: https://grafana.labelmint.it/d/database
- **API Performance**: https://grafana.labelmint.it/d/api-performance
- **Security Events**: https://grafana.labelmint.it/d/security

### Incident Management
- **PagerDuty**: https://labelmint.pagerduty.com
- **Status Page**: https://status.labelmint.it
- **Incident History**: https://github.com/labelmint/incidents

### Cost Monitoring
- **AWS Cost Explorer**: Track infrastructure costs
- **CloudHealth**: Multi-cloud cost optimization
- **Infrastructure Dashboard**: Real-time cost tracking

---

## 📅 Maintenance Schedule

### Daily (Automated)
- 01:00 UTC: Database backup
- 02:00 UTC: Vacuum analyze
- 08:00 UTC: Health checks
- 12:00 UTC: Log rotation
- 18:00 UTC: Metrics aggregation

### Weekly
- Sunday 02:00 UTC: Full vacuum
- Sunday 03:00 UTC: Index maintenance
- Monday 09:00 UTC: Performance review
- Friday 16:00 UTC: Security scans

### Monthly
- 1st Sunday: Full system backup
- 1st Monday: Update statistics
- 2nd Sunday: Disaster recovery drill
- 3rd Monday: Security audit
- Last Friday: Capacity planning review

### Quarterly
- Security training
- Credential rotation
- Runbook review
- Game day exercises
- Vendor account reviews

---

## 🆘 Getting Help

### During Business Hours (9 AM - 5 PM UTC)
1. **Slack**: Post in `#ops` or `#engineering`
2. **Email**: ops@labelmint.it
3. **Documentation**: Review this README and specific runbooks

### After Hours / Emergencies
1. **PagerDuty**: Trigger incident (auto-pages on-call)
2. **Slack**: Post in `#incidents` with @oncall mention
3. **Phone**: Use emergency contact list (SEV-0 only)

### For Runbook Issues
- **Missing Information**: Create issue with "runbook-gap" label
- **Incorrect Procedure**: Create PR with correction
- **New Runbook Needed**: Discuss in `#ops` channel

---

## 📖 Version History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2024-01-20 | 3.0 | Consolidated runbooks README | DevOps Team |
| 2024-01-15 | 2.5 | Added payment system runbook | Backend Team |
| 2024-01-10 | 2.4 | Updated database recovery procedures | DBA Team |
| 2024-01-05 | 2.3 | Added scaling procedures | Infrastructure Team |
| 2024-01-01 | 2.0 | Runbook structure standardization | Operations Team |

---

## 📞 Contact Information

| Role | Contact | Hours |
|------|---------|-------|
| **Runbook Owner** | ops@labelmint.it | 24/7 |
| **Documentation Team** | docs@labelmint.it | Business hours |
| **Operations Team** | operations@labelmint.it | 24/7 |
| **Security Team** | security@labelmint.it | 24/7 |
| **DBA Team** | dba@labelmint.it | Business hours + on-call |

---

**Remember**: These runbooks are living documents. They should be continuously updated based on real incidents, lessons learned, and system evolution. When in doubt, document it!

**Last Updated**: October 24, 2025
