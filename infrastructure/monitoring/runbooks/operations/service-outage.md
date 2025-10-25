# Service Outage Response Playbook
# ================================

## Overview
This playbook provides step-by-step instructions for responding to service outages in the LabelMint production environment.

## Alert Categories

### 1. Complete Service Outage

#### Service Down
**Alert**: `ServiceDown`

**Severity**: Critical
**Team**: DevOps, Backend

**Immediate Actions**:
1. **Acknowledge the alert** in AlertManager
2. **Check service status** on all instances
3. **Identify affected services** and their dependencies
4. **Check recent deployments** or configuration changes
5. **Verify infrastructure health** (network, storage, etc.)

**Initial Investigation Steps**:
```bash
# Check service status
systemctl status labelmint-web
systemctl status labelmint-backend
systemctl status api-gateway

# Check recent logs
journalctl -u labelmint-web -n 100 --no-pager
journalctl -u labelmint-backend -n 100 --no-pager

# Check system resources
top
free -h
df -h
```

**Kubernetes Environment**:
```bash
# Check pod status
kubectl get pods -n production
kubectl describe pod <pod-name> -n production

# Check service status
kubectl get svc -n production
kubectl describe svc <service-name> -n production

# Check events
kubectl get events -n production --sort-by='.lastTimestamp'
```

**Infrastructure Checks**:
```bash
# Check database connectivity
pg_isready -h $DB_HOST -p $DB_PORT

# Check Redis connectivity
redis-cli -h $REDIS_HOST ping

# Check external services
curl -I https://api.labelmint.it/health
curl -I https://toncenter.com/api/v2/getAddressInformation
```

**Quick Recovery Actions**:
1. **Restart affected services**:
   ```bash
   systemctl restart labelmint-web
   systemctl restart labelmint-backend
   ```

2. **Kubernetes restart**:
   ```bash
   kubectl rollout restart deployment/<deployment-name> -n production
   ```

3. **Check for recent deployments**:
   ```bash
   kubectl rollout history deployment/<deployment-name> -n production
   kubectl rollout undo deployment/<deployment-name> -n production
   ```

### 2. Database Outages

#### Database Connection Issues
**Alert**: `HighDatabaseConnections`, `DatabaseDown`

**Severity**: Critical
**Team**: DevOps, DBA

**Immediate Actions**:
1. **Check database status** and connectivity
2. **Monitor connection pool** utilization
3. **Check database logs** for errors
4. **Verify storage capacity** and performance

**Database Investigation**:
```sql
-- Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Check long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Check database size
SELECT pg_size_pretty(pg_database_size('labelmint'));

-- Check table locks
SELECT * FROM pg_locks WHERE NOT granted;
```

**Database Recovery**:
```bash
# Restart PostgreSQL if needed
systemctl restart postgresql

# Check configuration
psql -h localhost -U postgres -c "SHOW config_file;"

# Monitor performance
top -p $(pgrep postgres)
iotop -p $(pgrep postgres)
```

### 3. Cache Outages

#### Redis Issues
**Alert**: `LowRedisHitRate`, `RedisDown`

**Severity**: Warning/Critical
**Team**: DevOps

**Investigation**:
```bash
# Check Redis status
redis-cli info server
redis-cli info memory
redis-cli info stats

# Check connectivity
redis-cli ping

# Monitor memory usage
redis-cli info memory | grep used_memory_human
```

**Recovery Actions**:
```bash
# Restart Redis
systemctl restart redis

# Clear cache if memory issues
redis-cli FLUSHALL

# Monitor performance
redis-cli --latency-history -i 1
```

### 4. Network Issues

#### High Latency / Connection Issues
**Alert**: `HighResponseTime`, `NetworkLatency`

**Severity**: Warning
**Team**: DevOps, Network

**Network Diagnosis**:
```bash
# Check network connectivity
ping labelmint.it
traceroute labelmint.it

# Check DNS resolution
nslookup labelmint.it
dig labelmint.it

# Check bandwidth
iftop -i eth0
nethogs
```

**Load Balancer Health**:
```bash
# Check AWS ALB health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>

# Check Nginx status
nginx -t
systemctl status nginx
```

## Communication Procedures

### Internal Communication
1. **Immediate Notification**: Slack #incidents channel
2. **Status Updates**: Every 15 minutes for critical outages
3. **Resolution**: Update all stakeholders when resolved

### Status Page Updates
1. **Initial Incident**: Post to status page within 5 minutes
2. **Updates**: Every 15-30 minutes during incident
3. **Resolution**: Final status update with post-mortem link

### Customer Communication
1. **Service Disruption**: Email notification if > 15 minutes
2. **Extended Outage**: Social media updates
3. **Resolution**: Email with incident summary

## Escalation Procedures

### Level 1 (On-call DevOps Engineer)
- **Response Time**: 10 minutes
- **Authority**: Service restarts, basic diagnostics
- **Duration**: Handle incidents up to 1 hour

### Level 2 (DevOps Lead)
- **Response Time**: 30 minutes
- **Authority**: Infrastructure changes, deployment rollback
- **Duration**: Handle extended outages

### Level 3 (CTO/VP Engineering)
- **Response Time**: 1 hour
- **Authority**: Major architectural changes, external communications
- **Duration**: Critical business impact incidents

## Documentation Requirements

### Incident Timeline
1. **Initial Detection**: Time and method
2. **First Response**: Actions taken and results
3. **Investigation**: Findings and diagnostics
4. **Resolution**: Recovery steps and verification
5. **Post-Incident**: Follow-up actions

### Root Cause Analysis
1. **Triggering Event**: What started the outage
2. **Contributing Factors**: Related issues
3. **Impact Assessment**: What was affected and for how long
4. **Prevention Measures**: How to prevent recurrence

### Post-Mortem Template
```markdown
# Incident Post-Mortem: [Service] Outage

## Summary
- **Date**: [Date]
- **Duration**: [Start time] - [End time] ([Total duration])
- **Impact**: [Affected services and users]
- **Severity**: [Critical/Warning/Info]

## Timeline
- [Time]: [Event description]
- [Time]: [Action taken]
- [Time]: [Result]

## Root Cause
[Detailed explanation of what caused the incident]

## Impact
- **Users Affected**: [Number or percentage]
- **Services Affected**: [List of services]
- **Business Impact**: [Financial or operational impact]

## Resolution
[Steps taken to resolve the incident]

## Prevention
[Actions to prevent similar incidents]

## Lessons Learned
[Key takeaways from the incident]
```

## Prevention Measures

### Monitoring Improvements
1. **Enhanced Alerting**: Add more specific alerts
2. **Predictive Monitoring**: Implement anomaly detection
3. **Health Checks**: Add more comprehensive health endpoints
4. **Synthetic Monitoring**: External service monitoring

### Infrastructure Improvements
1. **High Availability**: Multi-AZ deployments
2. **Auto-scaling**: Automatic capacity management
3. **Circuit Breakers**: Prevent cascade failures
4. **Backup Systems**: Redundant service instances

### Process Improvements
1. **Deployment Procedures**: Safer deployment practices
2. **Change Management**: Better change approval process
3. **Training**: Regular incident response training
4. **Documentation**: Updated runbooks and procedures

## Tools and Resources

### Monitoring Dashboards
- **Grafana**: https://grafana.labelmint.it
- **AlertManager**: https://alertmanager.labelmint.it
- **Status Page**: https://status.labelmint.it

### Communication Channels
- **Incidents Slack**: #incidents
- **Engineering Slack**: #engineering
- **Management Slack**: #management-alerts

### Documentation
- **Runbooks**: https://runbooks.labelmint.it
- **Architecture**: https://docs.labelmint.it/architecture
- **Procedures**: https://docs.labelmint.it/procedures

## Testing and Drills

### Regular Testing
- **Monthly**: Alert validation
- **Quarterly**: Outage simulation
- **Annually**: Full disaster recovery test

### Drill Scenarios
1. **Database outage simulation**
2. **Network partition testing**
3. **Cache failure simulation**
4. **Load balancer failure testing"

## Service-Specific Procedures

### Web Application Outage
1. **Check CDN status** (CloudFlare)
2. **Verify DNS resolution**
3. **Check load balancer health**
4. **Restart web services**
5. **Verify SSL certificates**

### API Gateway Outage
1. **Check gateway health endpoints**
2. **Verify authentication service**
3. **Check rate limiting configuration**
4. **Monitor upstream service health**
5. **Restart gateway service**

### Payment Processing Outage
1. **Check TON node connectivity**
2. **Verify smart contract status**
3. **Check USDT token availability**
4. **Monitor transaction queue**
5. **Verify wallet balances**

### Database Outage
1. **Check primary database status**
2. **Verify read replicas**
3. **Check connection pool**
4. **Monitor query performance**
5. **Verify backup systems**

## Metrics and KPIs

### Incident Response Metrics
- **MTTR** (Mean Time to Resolution): Target < 1 hour
- **MTTD** (Mean Time to Detection): Target < 5 minutes
- **Incident Frequency**: Target < 1 per week
- **Availability**: Target > 99.9%

### Service Metrics
- **Uptime**: 99.9% target
- **Response Time**: < 200ms p95
- **Error Rate**: < 1%
- **Throughput**: Maintain baseline levels

This playbook should be reviewed and updated regularly based on incident outcomes and system changes.