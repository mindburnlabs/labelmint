# Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to service incidents, from initial detection through resolution and post-mortem.

## Quick Links

- [Service Outage](#service-outage)
- [Performance Degradation](#performance-degradation)
- [Database Issues](#database-issues)
- [Bot Malfunction](#bot-malfunction)
- [Payment Failures](#payment-failures)

## Incident Response Flow

```
Detection → Triage → Communication → Investigation → Resolution → Recovery → Post-mortem
```

## Service Outage

### Symptoms
- API returns 5xx errors
- All endpoints unresponsive
- Health checks failing
- User complaints spike
- Monitoring alerts firing

### Impact
- Complete service interruption
- Users cannot submit/complete tasks
- Bot not responding
- Potential revenue loss

### Triage (First 5 minutes)

1. **Confirm Outage**
   ```bash
   # Check health endpoints
   curl https://api.labelmint.it/health
   curl https://api.labelmint.it/api/v1/status

   # Check service status
   docker-compose ps
   pm2 status
   ```

2. **Check Monitoring**
   - Grafana dashboards
   - Sentry error reports
   - PagerDuty alerts
   - CloudWatch metrics

3. **Initial Assessment**
   ```bash
   # Recent deployments?
   git log --oneline -5

   # Recent changes?
   docker-compose logs --tail=100

   # System resources?
   top
   df -h
   free -h
   ```

### Immediate Actions

1. **Declare Incident**
   ```bash
   # Slack
   /incident SEV-0: API Service Outage - Investigating

   # PagerDuty
   Trigger incident with SEV-0 severity
   ```

2. **Form Response Team**
   - On-call engineer (lead)
   - Backend engineer
   - Infrastructure engineer
   - Engineering manager

3. **Create Incident Channel**
   ```
   #incident-2024-01-15-api-outage
   @oncall @backend-team @infra-team
   ```

### Investigation Steps

1. **Check Services**
   ```bash
   # Docker services
   docker-compose logs -f backend
   docker-compose logs -f postgres
   docker-compose logs -f redis
   docker-compose logs -f nginx

   # Process status
   ps aux | grep node
   netstat -tulpn | grep :3001
   ```

2. **Check Database**
   ```bash
   # Connection test
   docker-compose exec postgres pg_isready

   # Active connections
   docker-compose exec postgres psql -U labeling_user -c "SELECT count(*) FROM pg_stat_activity;"

   # Long queries
   docker-compose exec postgres psql -U labeling_user -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 minutes';"
   ```

3. **Check Infrastructure**
   ```bash
   # Disk space
   df -h

   # Memory usage
   free -h
   docker stats

   # Network
   ping google.com
   nslookup api.labelmint.it
   ```

### Resolution Strategies

#### Option 1: Restart Services
```bash
# Graceful restart
docker-compose restart backend
docker-compose restart nginx

# If needed, full restart
docker-compose down
docker-compose up -d

# Verify
curl https://api.labelmint.it/health
```

#### Option 2: Rollback Deployment
```bash
# Check last deployment
git log --oneline -10

# Rollback
git checkout previous-stable-tag
docker-compose build --no-cache
docker-compose up -d

# Verify
pm2 list
docker-compose ps
```

#### Option 3: Scale Resources
```bash
# Scale up services
docker-compose up -d --scale backend=3

# Add more resources if needed
# (Cloud-specific commands)
```

#### Option 4: Database Recovery
```bash
# If database corruption
docker-compose stop backend
docker-compose exec postgres pg_dump -U labeling_user labeling_platform > backup.sql
# Restore from backup if needed
```

### Verification

1. **Health Checks**
   ```bash
   # All services healthy
   curl https://api.labelmint.it/health

   # API responding
   curl -X POST https://api.labelmint.it/api/v1/tasks \
     -H "X-API-Key: test" \
     -H "Content-Type: application/json" \
     -d '{"test": true}'

   # Bot responding
   curl https://api.telegram.org/bot$BOT_TOKEN/getMe
   ```

2. **Monitoring Verification**
   - Error rates normal
   - Response times acceptable
   - No active alerts
   - User complaints resolved

3. **End-to-End Test**
   ```bash
   # Create test task
   # Process through system
   # Verify completion
   ```

### Communication Updates

**Initial (5 minutes)**:
```
🚨 INVESTIGATING: API Service Outage

We're investigating reports of API service issues.
Users may experience errors or slow response times.
Started: 14:30 UTC
Next update: 14:45 UTC
```

**Update (30 minutes)**:
```
🔧 IN PROGRESS: API Service Outage

We've identified the issue and are working on a fix.
Root cause: [Brief description]
ETA: 30 minutes
Started: 14:30 UTC
Next update: 15:00 UTC
```

**Resolution**:
```
✅ RESOLVED: API Service Outage

The issue has been resolved and all services are operational.
Root cause: [Detailed description]
Duration: 2 hours
Impact: X users affected for Y minutes

We apologize for the inconvenience.
```

## Performance Degradation

### Symptoms
- Slow API response times
- Timeouts on some endpoints
- Intermittent errors
- User complaints about slowness

### Triage

1. **Measure Impact**
   ```bash
   # Response times
   curl -w "@curl-format.txt" -o /dev/null -s https://api.labelmint.it/api/v1/tasks

   # Load testing
   hey -n 100 -c 10 https://api.labelmint.it/health

   # Check APM tools
   # New Relic, DataDog, etc.
   ```

2. **Identify Bottlenecks**
   ```bash
   # Database queries
   docker-compose exec postgres psql -U labeling_user -c "
     SELECT query, mean_time, calls
     FROM pg_stat_statements
     ORDER BY mean_time DESC
     LIMIT 10;
   "

   # Slow endpoints
   docker-compose logs backend | grep "slow request"

   # Resource usage
   docker stats --no-stream
   ```

### Resolution

1. **Database Optimization**
   ```sql
   -- Kill long-running queries
   SELECT pg_cancel_backend(pid);

   -- Update statistics
   ANALYZE;

   -- Rebuild indexes
   REINDEX DATABASE labeling_platform;
   ```

2. **Application Optimization**
   ```bash
   # Clear cache
   docker-compose exec redis redis-cli FLUSHALL

   # Restart with more memory
   docker-compose up -d --memory=4g backend

   # Enable debug mode
   docker-compose exec backend NODE_OPTIONS='--inspect' pm2 restart
   ```

3. **Infrastructure Scaling**
   ```bash
   # Horizontal scaling
   docker-compose up -d --scale backend=5

   # Vertical scaling (if needed)
   # Increase instance size via cloud console
   ```

## Database Issues

### Common Database Incidents

1. **Connection Pool Exhausted**
   ```bash
   # Check connections
   docker-compose exec postgres psql -U labeling_user -c "
     SELECT state, count(*)
     FROM pg_stat_activity
     GROUP BY state;
   "

   # Increase max connections
   # Edit postgresql.conf
   max_connections = 300

   # Restart PostgreSQL
   docker-compose restart postgres
   ```

2. **Slow Queries**
   ```bash
   # Identify slow queries
   docker-compose exec postgres psql -U labeling_user -c "
     SELECT query, mean_time, calls, total_time
     FROM pg_stat_statements
     WHERE mean_time > 1000
     ORDER BY mean_time DESC;
   "

   # Kill long-running query
   SELECT pg_terminate_backend(pid);
   ```

3. **Disk Space Full**
   ```bash
   # Check disk usage
   df -h

   # Clean up old logs
   docker-compose exec postgres psql -U labeling_user -c "
     SELECT pg_size_pretty(pg_database_size('labeling_platform'));
   "

   # Vacuum full
   docker-compose exec postgres psql -U labeling_user -c "VACUUM FULL;"
   ```

## Bot Malfunction

### Symptoms
- Bot not responding to commands
- Messages not being processed
- Webhook delivery failures
- Telegram API errors

### Troubleshooting

1. **Check Bot Status**
   ```bash
   # Verify bot token
   curl https://api.telegram.org/bot$BOT_TOKEN/getMe

   # Check webhook
   curl https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo

   # Test webhook URL
   curl -X POST https://api.labelmint.it/bot/webhook \
     -H "Content-Type: application/json" \
     -d '{"update_id": 12345}'
   ```

2. **Check Bot Service**
   ```bash
   # Service status
   docker-compose ps bot
   docker-compose logs -f bot

   # Restart if needed
   docker-compose restart bot
   ```

3. **Fix Webhook Issues**
   ```bash
   # Reset webhook
   curl -X POST https://api.telegram.org/bot$BOT_TOKEN/setWebhook \
     -d "url=https://api.labelmint.it/bot/webhook"

   # Delete webhook (fallback to polling)
   curl -X POST https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook
   ```

## Payment Failures

### Symptoms
- Payment processing errors
- TON transaction failures
- USDT transfer issues
- Worker withdrawal problems

### Immediate Actions

1. **Check Payment Service**
   ```bash
   # Check TON node status
   curl https://toncenter.com/api/v2/getInformation

   # Check wallet balance
   curl -X POST https://toncenter.com/api/v2/getAddressBalance \
     -d '{"address": "YOUR_WALLET_ADDRESS"}'

   # Check transaction status
   curl -X POST https://toncenter.com/api/v2/getTransactionInformation \
     -d '{"address": "...", "hash": "..."}'
   ```

2. **Verify Configuration**
   ```bash
   # Check environment variables
   docker-compose exec bot printenv | grep TON
   docker-compose exec backend printenv | grep PAYMENT

   # Test API keys
   curl -H "X-API-Key: $API_KEY" https://toncenter.com/api/v2/test
   ```

3. **Manual Intervention**
   ```bash
   # Pause automated payments
   docker-compose exec backend npm run payments:pause

   # Process manually if needed
   docker-compose exec backend npm run payments:process -- --manual

   # Resume after fix
   docker-compose exec backend npm run payments:resume
   ```

## Post-Incident Procedures

### 1. Create Post-Mortem

Template:
```
# Post-Mortem: [Incident Title]

Date:
Severity:
Duration:
Lead Investigator:

## Summary
[Brief description of what happened]

## Timeline
- 14:30: First alert received
- 14:32: Investigation started
- 14:45: Root cause identified
- 15:30: Fix implemented
- 15:45: Service restored

## Root Cause
[Detailed analysis of what went wrong]

## Impact
- Number of users affected
- Duration of impact
- Business impact (revenue, reputation)

## Resolution
[Steps taken to fix the issue]

## Detection and Response
- How we detected the issue
- Time to detect
- Time to respond

## Prevention Measures
- Short-term fixes
- Long-term improvements
- Monitoring enhancements
- Process changes

## Lessons Learned
- What went well
- What could be improved
- Action items
```

### 2. Follow-up Actions

1. **Immediate (24 hours)**
   - [ ] Complete post-mortem document
   - [ ] Share with team
   - [ ] Create action items
   - [ ] Update monitoring

2. **Short-term (1 week)**
   - [ ] Implement preventive fixes
   - [ ] Update runbooks
   - [ ] Add automated alerts
   - [ ] Train team on lessons

3. **Long-term (1 month)**
   - [ ] Architectural improvements
   - [ ] Process improvements
   - [ ] Tool enhancements
   - [ ] Review and update

### 3. Action Item Tracking

Create GitHub issues for all action items:
- Label: `post-mortem`
- Assign to: appropriate team member
- Due date: based on priority
- Link to: post-mortem document

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| On-call Engineer | | +1-XXX-XXX-XXXX | oncall@labelmint.it |
| Engineering Manager | | +1-XXX-XXX-XXXX | eng-manager@labelmint.it |
| CTO | | +1-XXX-XXX-XXXX | cto@labelmint.it |
| Infrastructure Lead | | +1-XXX-XXX-XXXX | infra@labelmint.it |
| Security Lead | | +1-XXX-XXX-XXXX | security@labelmint.it |

## Related Runbooks

- [Database Maintenance](./database-maintenance.md)
- [Security Incidents](./security-incidents.md)
- [Backup Restoration](./backup-restoration.md)
- [Performance Troubleshooting](./performance-troubleshooting.md)