# LabelMint Disaster Recovery Runbooks

## Table of Contents
1. [Overview](#overview)
2. [Emergency Contacts](#emergency-contacts)
3. [Severity Classification](#severity-classification)
4. [Database Disaster Recovery](#database-disaster-recovery)
5. [Redis Cache Recovery](#redis-cache-recovery)
6. [Application Layer Failover](#application-layer-failover)
7. [Full Infrastructure Failover](#full-infrastructure-failover)
8. [Data Restoration Procedures](#data-restoration-procedures)
9. [Post-Incident Activities](#post-incident-activities)
10. [Testing and Validation](#testing-and-validation)

## Overview

This document provides step-by-step procedures for handling disaster recovery scenarios for the LabelMint platform. These runbooks are designed to be followed during emergencies to restore service operations within the established Recovery Time Objectives (RTOs) and Recovery Point Objectives (RPOs).

### Key Metrics
- **RTO (Recovery Time Objective)**: < 4 hours for critical services
- **RPO (Recovery Point Objective)**: < 1 hour for data loss
- **Availability Target**: 99.9% uptime
- **Disaster Recovery Regions**: us-east-1 (Primary), us-west-2 (DR)

## Emergency Contacts

### Primary Incident Response Team
- **Incident Commander**: [Name] - [Phone] - [Email]
- **Technical Lead**: [Name] - [Phone] - [Email]
- **DevOps Lead**: [Name] - [Phone] - [Email]
- **Database Administrator**: [Name] - [Phone] - [Email]

### Management and Communications
- **VP Engineering**: [Name] - [Phone] - [Email]
- **Head of Operations**: [Name] - [Phone] - [Email]
- **Customer Support Lead**: [Name] - [Phone] - [Email]

### External Vendors
- **AWS Support**: [Phone] - [Account ID]
- **Cloudflare Support**: [Phone] - [Account ID]
- **Monitoring Service**: [Phone] - [Account ID]

## Severity Classification

### SEV-0 - Critical
- Complete service outage
- Data loss or corruption
- Security breach affecting customer data
- Estimated recovery time: > 4 hours

### SEV-1 - High
- Major service degradation
- Significant feature unavailable
- Partial data access issues
- Estimated recovery time: 1-4 hours

### SEV-2 - Medium
- Minor service degradation
- Non-critical features unavailable
- Performance issues
- Estimated recovery time: 30 minutes - 1 hour

### SEV-3 - Low
- Minor issues
- Documentation or reporting problems
- Estimated recovery time: < 30 minutes

## Database Disaster Recovery

### Scenario 1: Primary RDS Instance Failure

#### Detection
- Database connection timeouts
- RDS CloudWatch alarms (CPU, Memory, Storage)
- Application errors related to database connectivity
- Route53 health check failures

#### Impact Assessment
1. **Verify Primary Database Status**
   ```bash
   aws rds describe-db-instances --db-instance-identifier labelmintit-production-db-enhanced
   aws rds describe-db-clusters --db-cluster-identifier labelmintit-production-db-cluster
   ```

2. **Check Read Replica Status**
   ```bash
   aws rds describe-db-instances --db-instance-identifier labelmintit-production-db-read-replica
   ```

3. **Review CloudWatch Metrics**
   - DatabaseConnections
   - CPUUtilization
   - FreeStorageSpace
   - ReadLatency/WriteLatency

#### Recovery Procedures

**Option A: Failover to Read Replica (Fastest)**
1. **Promote Read Replica**
   ```bash
   aws rds promote-read-replica \
     --db-instance-identifier labelmintit-production-db-read-replica \
     --backup-retention-period 35 \
     --multi-az \
     --apply-immediately
   ```

2. **Update Application Configuration**
   - Update database endpoint in application configuration
   - Update environment variables in ECS tasks
   - Deploy updated application configuration

3. **Update Route53 Records**
   ```bash
   aws route53 change-resource-record-sets \
     --hosted-zone-id [ZONE_ID] \
     --change-batch file://db-failover.json
   ```

4. **Verify Application Connectivity**
   - Test database connections
   - Verify application functionality
   - Monitor error rates

**Option B: Restore from Backup (Longer)**
1. **Identify Latest Backup**
   ```bash
   aws backup list-recovery-points-by-backup-vault \
     --backup-vault-name labelmintit-production-postgres-backup-vault
   ```

2. **Initiate Restore**
   ```bash
   aws backup start-restore-job \
     --recovery-point-arn [RECOVERY_POINT_ARN] \
     --metadata '{"restore-testing":"false"}' \
     --iam-role-arn [IAM_ROLE_ARN]
   ```

3. **Monitor Restore Progress**
   ```bash
   aws backup describe-restore-job --restore-job-id [JOB_ID]
   ```

4. **Update Application Configuration** (same as Option A)

#### Validation Steps
1. **Database Connectivity Test**
   ```bash
   psql -h [NEW_ENDPOINT] -U [USERNAME] -d [DATABASE] -c "SELECT 1;"
   ```

2. **Application Health Check**
   ```bash
   curl -f https://labelmintit.com/health
   ```

3. **Data Integrity Check**
   ```sql
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM projects;
   SELECT MAX(created_at) FROM task_submissions;
   ```

#### Rollback Procedures
1. **If failover fails:**
   - Revert DNS changes
   - Restore original configuration
   - Investigate root cause
   - Attempt alternative recovery method

### Scenario 2: Database Corruption

#### Detection
- Database error logs indicating corruption
- Query failures with corruption messages
- Inconsistent data results

#### Recovery Procedures

**Point-in-Time Recovery (PITR)**
1. **Identify Safe Recovery Point**
   ```bash
   aws rds describe-db-snapshots \
     --db-instance-identifier labelmintit-production-db-enhanced \
     --snapshot-type automated \
     --query "reverse(sort_by(DBSnapshots, &SnapshotCreateTime))[0]"
   ```

2. **Create New Instance from Snapshot**
   ```bash
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier labelmintit-production-db-restored \
     --db-snapshot-identifier [SNAPSHOT_ID] \
     --db-instance-class db.r6g.large \
     --multi-az \
     --publicly-accessible false \
     --vpc-security-group-ids [SG_IDS] \
     --db-subnet-group-name labelmintit-production-db-subnet-group
   ```

3. **Verify Data Integrity**
   - Connect to restored instance
   - Run data consistency checks
   - Verify recent transactions

4. **Update Application Configuration**
   - Point applications to restored instance
   - Update DNS records if needed

## Redis Cache Recovery

### Scenario 1: Redis Cluster Failure

#### Detection
- Cache connection timeouts
- Increased database load (cache misses)
- Application performance degradation

#### Recovery Procedures

**Option A: Failover to DR Redis**
1. **Check DR Replica Status**
   ```bash
   aws elasticache describe-replication-groups \
     --replication-group-id labelmintit-production-redis-dr-replica
   ```

2. **Update Application Configuration**
   - Update Redis endpoint in application
   - Deploy configuration changes

3. **Verify Cache Functionality**
   - Test cache operations
   - Monitor performance metrics

**Option B: Restore from Snapshot**
1. **Create New Cluster from Snapshot**
   ```bash
   aws elasticache create-replication-group \
     --replication-group-id labelmintit-production-redis-restored \
     --replication-group-description "Restored Redis cluster" \
     --engine redis \
     --engine-version 7.0 \
     --cache-node-type cache.r6g.large \
     --cache-parameter-group-name labelmintit-production-redis-enhanced-params \
     --num-cache-clusters 3 \
     --snapshot-name [SNAPSHOT_NAME] \
     --security-group-ids [SG_IDS] \
     --subnet-group-name labelmintit-production-cache-subnet
   ```

2. **Monitor Cluster Creation**
   ```bash
   aws elasticache describe-replication-groups \
     --replication-group-id labelmintit-production-redis-restored
   ```

3. **Update Application Configuration**
   - Update Redis endpoint
   - Deploy configuration changes

4. **Warm Up Cache**
   - Trigger cache population processes
   - Monitor cache hit rates

## Application Layer Failover

### Scenario 1: ECS Service Failure

#### Detection
- ECS task failures
- Application health check failures
- ALB 5XX errors

#### Recovery Procedures

1. **Check ECS Service Status**
   ```bash
   aws ecs describe-services \
     --cluster labelmintit-production-cluster \
     --services labelmintit-production-service
   ```

2. **Check Task Health**
   ```bash
   aws ecs list-tasks \
     --cluster labelmintit-production-cluster \
     --service-name labelmintit-production-service
   ```

3. **Force New Deployment**
   ```bash
   aws ecs update-service \
     --cluster labelmintit-production-cluster \
     --service labelmintit-production-service \
     --force-new-deployment
   ```

4. **Scale Out Tasks**
   ```bash
   aws ecs update-service \
     --cluster labelmintit-production-cluster \
     --service labelmintit-production-service \
     --desired-count 6
   ```

5. **Monitor Recovery**
   - Watch task deployment progress
   - Check health check status
   - Monitor error rates

### Scenario 2: ALB Failure

#### Detection
- 5XX errors from ALB
- Connection timeouts
- Route53 health check failures

#### Recovery Procedures

1. **Check ALB Status**
   ```bash
   aws elbv2 describe-load-balancers \
     --names labelmintit-production-alb
   ```

2. **Check Target Groups**
   ```bash
   aws elbv2 describe-target-groups \
     --load-balancer-arn [ALB_ARN]
   ```

3. **Register Healthy Targets**
   ```bash
   aws elbv2 register-targets \
     --target-group-arn [TG_ARN] \
     --targets Id=[TARGET_ID],Port=3000
   ```

4. **Deregister Unhealthy Targets**
   ```bash
   aws elbv2 deregister-targets \
     --target-group-arn [TG_ARN] \
     --targets Id=[UNHEALTHY_TARGET_ID]
   ```

## Full Infrastructure Failover

### Scenario: Complete Region Outage

#### Trigger Conditions
- AWS region service health dashboard shows multiple service failures
- Multiple critical components failing simultaneously
- No access to primary region management console

#### Pre-Failover Checklist
- [ ] Confirm primary region is unavailable
- [ ] Verify DR region status
- [ ] Communicate with stakeholders
- [ ] Prepare for DNS failover
- [ ] Verify DR backups are current

#### Failover Procedures

1. **Activate DR Environment**
   ```bash
   # Update ECS service count in DR region
   aws ecs update-service \
     --cluster labelmintit-production-dr-cluster \
     --service labelmintit-production-dr-service \
     --desired-count 3 \
     --region us-west-2
   ```

2. **Update DNS Records**
   ```bash
   aws route53 change-resource-record-sets \
     --hosted-zone-id [ZONE_ID] \
     --change-batch file://dr-failover.json
   ```

   Example DR failover JSON:
   ```json
   {
     "Comment": "Failover to DR region",
     "Changes": [
       {
         "Action": "UPSERT",
         "ResourceRecordSet": {
           "Name": "labelmintit.com",
           "Type": "A",
           "SetIdentifier": "dr",
           "Failover": "PRIMARY",
           "AliasTarget": {
             "HostedZoneId": "Z35SXDOTRQ7X7K",
             "DNSName": "labelmintit-production-dr-alb-123456.us-west-2.elb.amazonaws.com",
             "EvaluateTargetHealth": true
           }
         }
       }
     ]
   }
   ```

3. **Update Application Configuration**
   - Deploy with DR region endpoints
   - Update database connections
   - Update Redis connections
   - Update S3 bucket endpoints

4. **Verify Service Recovery**
   ```bash
   # Test DR environment
   curl -f https://labelmintit.com/health
   ```

5. **Monitor DR Environment**
   - CloudWatch metrics in DR region
   - Application performance
   - Error rates
   - User reports

#### Post-Failover Activities
1. **Stabilize DR Environment**
   - Scale resources as needed
   - Optimize performance
   - Address any issues

2. **Communicate Status**
   - Update stakeholders
   - Post status page updates
   - Notify customers

3. **Plan Return to Primary**
   - Assess primary region status
   - Plan migration back
   - Schedule maintenance window

## Data Restoration Procedures

### Database Restoration

1. **Identify Recovery Point**
   ```bash
   aws backup list-recovery-points-by-backup-vault \
     --backup-vault-name labelmintit-production-postgres-backup-vault \
     --by-backup-plan-id labelmintit-production-postgres-backup-plan
   ```

2. **Initiate Restore**
   ```bash
   aws backup start-restore-job \
     --recovery-point-arn [RECOVERY_POINT_ARN] \
     --metadata '{"restore-testing":"false"}' \
     --iam-role-arn [IAM_ROLE_ARN] \
     --resource-arn [TARGET_RESOURCE_ARN]
   ```

3. **Monitor Restore Progress**
   ```bash
   aws backup describe-restore-job --restore-job-id [JOB_ID]
   ```

4. **Validate Restored Data**
   - Connect to restored database
   - Run data consistency checks
   - Verify recent transactions
   - Test application functionality

### Redis Restoration

1. **Create from Snapshot**
   ```bash
   aws elasticache create-replication-group \
     --replication-group-id labelmintit-production-redis-restored \
     --replication-group-description "Restored from snapshot" \
     --engine redis \
     --engine-version 7.0 \
     --cache-node-type cache.r6g.large \
     --snapshot-name [SNAPSHOT_NAME] \
     --security-group-ids [SG_IDS] \
     --subnet-group-name labelmintit-production-cache-subnet
   ```

2. **Verify Restore**
   ```bash
   aws elasticache describe-replication-groups \
     --replication-group-id labelmintit-production-redis-restored
   ```

3. **Test Cache Operations**
   - Connect to restored Redis
   - Test basic operations
   - Verify data consistency

## Post-Incident Activities

### Incident Documentation

1. **Create Incident Report**
   - Timeline of events
   - Root cause analysis
   - Impact assessment
   - Resolution steps
   - Lessons learned

2. **Update Monitoring**
   - Add new alarms if needed
   - Adjust thresholds
   - Improve detection

3. **Review and Improve**
   - Review runbook effectiveness
   - Update procedures
   - Schedule additional training

### Communication Template

**Service Incident - Initial Notification**
```
Subject: SERVICE INCIDENT - [SEVERITY] - [SERVICE]

Status: Investigating
Impact: [DESCRIBE IMPACT]
Started: [TIMESTAMP]
Next Update: [TIME]

We are currently investigating a service incident affecting [SERVICE].
We will provide updates as more information becomes available.
```

**Service Incident - Resolution**
```
Subject: RESOLVED: SERVICE INCIDENT - [SEVERITY] - [SERVICE]

Status: Resolved
Impact: [DESCRIBE IMPACT]
Duration: [DURATION]
Resolution: [DESCRIBE RESOLUTION]

The incident has been resolved. We are monitoring the situation closely
and will provide a post-incident analysis within 24 hours.
```

## Testing and Validation

### Monthly DR Tests

1. **Backup Verification**
   - Verify recent backups exist
   - Test restore procedures
   - Validate data integrity

2. **Failover Drills**
   - Test DNS failover
   - Verify DR environment
   - Practice recovery procedures

3. **Documentation Review**
   - Update contact information
   - Review procedures
   - Identify improvements

### Quarterly Full DR Exercise

1. **Complete Failover Test**
   - Failover to DR environment
   - Test all services
   - Validate functionality

2. **Performance Testing**
   - Load testing in DR environment
   - Identify bottlenecks
   - Optimize configuration

3. **Security Validation**
   - Test security controls
   - Verify access controls
   - Validate compliance

### Annual DR Review

1. **Comprehensive Assessment**
   - Review all DR procedures
   - Update documentation
   - Plan improvements

2. **Budget Review**
   - Assess DR costs
   - Plan future investments
   - Optimize spending

## Appendix

### Useful Commands

**Check AWS Service Health**
```bash
aws health describe-events --filter "eventStatusCodes=open,upcoming"
```

**Check Route53 Health Checks**
```bash
aws route53 get-health-check-status --health-check-id [HEALTH_CHECK_ID]
```

**List S3 Backups**
```bash
aws s3 ls s3://labelmintit-production-backups/
```

**Check CloudWatch Alarms**
```bash
aws cloudwatch describe-alarms --state-value ALARM
```

### Emergency Access

**Break Glass IAM Role**
- Role ARN: [ROLE_ARN]
- MFA required: Yes
- Duration: 1 hour
- Approval needed: Yes

**Emergency Console Access**
- URL: https://[ACCOUNT_ID].signin.aws.amazon.com/console
- Emergency user: emergency-user
- Password: Stored in secure vault

### Backup Storage Locations

**Primary Region S3 Buckets**
- labelmintit-production-backups
- labelmintit-production-assets
- labelmintit-production-uploads

**DR Region S3 Buckets**
- labelmintit-production-dr-backups
- labelmintit-production-dr-assets
- labelmintit-production-dr-uploads

**AWS Backup Vaults**
- Primary: labelmintit-production-postgres-backup-vault
- DR: labelmintit-production-postgres-backup-vault-dr

---

**Document Version**: 1.0
**Last Updated**: [DATE]
**Next Review Date**: [DATE + 6 months]
**Owner**: DevOps Team