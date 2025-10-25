# LabelMint Backup and Disaster Recovery System

## Overview

This document describes the comprehensive backup and disaster recovery system implemented for LabelMint production infrastructure. The system ensures business continuity with automated backups, cross-region replication, and disaster recovery procedures.

## Architecture

### Primary Components

1. **Enhanced PostgreSQL Backup System**
   - Automated daily/weekly/monthly backups
   - Point-in-time recovery (PITR) capability
   - Cross-region backup replication
   - Backup retention: 35 days (daily), 1 year (weekly), 7 years (monthly)

2. **Redis Cache Backup and Recovery**
   - Automated snapshots every 6 hours
   - Cross-region global datastore replication
   - AOF (Append Only File) persistence
   - Backup retention: 30 days

3. **Multi-Region Disaster Recovery**
   - Primary region: us-east-1
   - DR region: us-west-2
   - Automated DNS failover via Route53
   - Full infrastructure duplication in DR region

4. **Backup Testing and Validation**
   - Automated backup integrity testing
   - Point-in-time recovery testing
   - Cross-region replication verification
   - Comprehensive reporting

5. **Monitoring and Alerting**
   - Real-time RPO/RPO monitoring
   - CloudWatch dashboards
   - Automated alerting via SNS and Slack
   - Backup health scoring

## Key Metrics

### Recovery Objectives
- **RTO (Recovery Time Objective)**: < 4 hours
- **RPO (Recovery Point Objective)**: < 1 hour (PostgreSQL), < 24 hours (Redis)

### Backup Retention Policy
- **PostgreSQL**: 35 days automated + 7 years AWS Backup
- **Redis**: 30 days automated snapshots
- **S3 Assets**: Versioning + lifecycle policies (30 days → 90 days → 1 year → 7 years)

### Availability
- **Primary Region**: 99.9% uptime target
- **DR Region**: Ready for immediate failover
- **Cross-Region Replication**: < 5 minute lag

## Quick Start

### Prerequisites

1. AWS CLI configured with appropriate permissions
2. Terraform >= 1.5.0
3. Python 3.11+ for Lambda functions
4. Sufficient IAM permissions for backup and DR resources

### Deployment

1. **Deploy Backup Infrastructure**
   ```bash
   # Set environment variables
   export ENVIRONMENT=production
   export PROJECT_NAME=labelmintit
   export PRIMARY_REGION=us-east-1
   export DR_REGION=us-west-2

   # Run deployment script
   ./scripts/deploy-backup-infrastructure.sh
   ```

2. **Verify Deployment**
   ```bash
   # Check backup vaults
   aws backup list-backup-vaults --region us-east-1

   # Verify monitoring
   aws cloudwatch get-dashboard --dashboard-name labelmintit-production-backup-monitoring --region us-east-1

   # Test backup framework
   python3 scripts/backup-testing-framework.py
   ```

### Configuration

#### Environment Variables
```bash
# Backup Configuration
BACKUP_RETENTION_DAYS=90
RPO_THRESHOLD_MINUTES=60
RTO_THRESHOLD_MINUTES=240

# Notification Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:account:topic-name

# DR Configuration
DR_REGION=us-west-2
CROSS_REGION_BACKUP_ENABLED=true
```

#### Terraform Variables
```hcl
# variables.tf
variable "dr_region" {
  description = "AWS region for disaster recovery"
  type        = string
  default     = "us-west-2"
}

variable "backup_retention_days" {
  description = "Default backup retention period in days"
  type        = number
  default     = 90
}

variable "rpo_threshold_minutes" {
  description = "Recovery Point Objective threshold in minutes"
  type        = number
  default     = 60
}
```

## Components

### 1. PostgreSQL Backup System

#### Features
- **Automated Backups**: Daily, weekly, and monthly schedules
- **Point-in-Time Recovery**: Restore to any point within retention period
- **Cross-Region Replication**: Automatic backup replication to DR region
- **Enhanced Monitoring**: Backup job status, duration, and success rates
- **Automated Testing**: Weekly restore testing and validation

#### Backup Schedules
- **Daily**: 2:00 AM UTC, retained for 90 days
- **Weekly**: Sundays 3:00 AM UTC, retained for 1 year
- **Monthly**: 1st of month 4:00 AM UTC, retained for 7 years

#### Restore Procedures
```bash
# Restore from latest backup
aws backup start-restore-job \
  --recovery-point-arn arn:aws:backup:... \
  --iam-role-arn arn:aws:iam::...:role/backup-service-role

# Point-in-time recovery
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier labelmintit-production-db-enhanced \
  --target-db-instance-identifier labelmintit-production-db-restored \
  --restore-time 2024-01-15T10:00:00Z \
  --use-latest-restorable-time
```

### 2. Redis Cache Backup

#### Features
- **Automated Snapshots**: Every 6 hours
- **AOF Persistence**: Real-time append-only file backup
- **Global Datastore**: Cross-region replication for production
- **Snapshot Testing**: Monthly restore validation

#### Restore Procedures
```bash
# Create new cluster from snapshot
aws elasticache create-replication-group \
  --replication-group-id labelmintit-production-redis-restored \
  --snapshot-name snapshot-name \
  --cache-node-type cache.r6g.large \
  --num-cache-clusters 3

# Test snapshot integrity
aws elasticache describe-snapshots \
  --replication-group-id labelmintit-production-redis-enhanced
```

### 3. Cross-Region Disaster Recovery

#### Architecture
- **Primary Region**: us-east-1 (active)
- **DR Region**: us-west-2 (standby)
- **DNS Failover**: Route53 health checks
- **Data Replication**: Automated backup and cache replication

#### Failover Process
1. **Detection**: Health check failures trigger alerts
2. **Assessment**: Manual verification of outage
3. **Activation**: Scale up DR resources
4. **DNS Update**: Route traffic to DR region
5. **Validation**: Verify service functionality
6. **Communication**: Update stakeholders

#### Failback Process
1. **Stabilization**: Ensure primary region is healthy
2. **Data Sync**: Synchronize any recent changes
3. **Gradual Migration**: Move traffic back to primary
4. **Cleanup**: Decommission DR resources
5. **Post-Mortem**: Review and improve procedures

### 4. Monitoring and Alerting

#### CloudWatch Dashboards
- **Backup Monitoring**: Backup status, RPO/RPO metrics
- **DR Metrics**: Replication lag, health check status
- **Infrastructure Health**: Database and cache performance
- **Alert History**: Historical alert analysis

#### Alert Types
```bash
# Backup failures
aws sns publish \
  --topic-arn arn:aws:sns:... \
  --subject "BACKUP FAILURE ALERT" \
  --message "PostgreSQL backup failed at $(date)"

# RPO violations
aws sns publish \
  --topic-arn arn:aws:sns:... \
  --subject "RPO VIOLATION ALERT" \
  --message "PostgreSQL RPO exceeded: 90 minutes"

# DR environment issues
aws sns publish \
  --topic-arn arn:aws:sns:... \
  --subject "DR ENVIRONMENT ALERT" \
  --message "DR health check failing"
```

### 5. Backup Testing Framework

#### Automated Tests
```python
# Run comprehensive backup testing
python3 scripts/backup-testing-framework.py

# Individual test components
- PostgreSQL backup verification
- Redis snapshot testing
- S3 backup accessibility
- Cross-region replication validation
- DR environment readiness
```

#### Test Results
- **Success/Failure Status**: Detailed test outcomes
- **RPO/RPO Metrics**: Actual vs. target objectives
- **Performance Metrics**: Backup duration and size
- **Compliance Reports**: Regulatory compliance status

## Operational Procedures

### Daily Operations
1. **Monitor Backup Jobs**: Check CloudWatch dashboard
2. **Review Alerts**: Address any backup failures
3. **Verify Replication**: Confirm cross-region sync
4. **Update Documentation**: Record any changes

### Weekly Operations
1. **Backup Testing**: Run automated test framework
2. **Performance Review**: Analyze backup performance
3. **Capacity Planning**: Review storage requirements
4. **Security Audit**: Verify access controls

### Monthly Operations
1. **Full DR Drill**: Test complete failover process
2. **Compliance Review**: Verify retention policies
3. **Cost Analysis**: Review backup storage costs
4. **Documentation Update**: Update runbooks and procedures

### Quarterly Operations
1. **Disaster Recovery Exercise**: Full-scale DR test
2. **Security Assessment**: Comprehensive security review
3. **Infrastructure Review**: Evaluate architecture changes
4. **Training Update**: Team training and updates

## Security Considerations

### Backup Encryption
- **At Rest**: AWS KMS encryption for all backups
- **In Transit**: SSL/TLS for backup transfer
- **Key Management**: Regular key rotation
- **Access Control**: IAM role-based permissions

### Access Control
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "backup:CreateBackupVault",
        "backup:StartBackupJob",
        "backup:StartRestoreJob"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": ["us-east-1", "us-west-2"]
        }
      }
    }
  ]
}
```

### Compliance
- **Data Retention**: Meet regulatory requirements
- **Privacy**: PII protection and anonymization
- **Audit Trail**: Complete audit logging
- **Access Logging**: All backup operations logged

## Cost Optimization

### Storage Tiers
- **Standard**: Frequent access (first 30 days)
- **Standard-IA**: Infrequent access (30-90 days)
- **Glacier**: Long-term archival (90-365 days)
- **Deep Archive**: Compliance storage (1-7 years)

### Cost Monitoring
```bash
# Monitor backup costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --filter file://backup-cost-filter.json \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

### Optimization Strategies
- **Lifecycle Policies**: Automatic storage class transitions
- **Data Compression**: Reduce backup sizes
- **Deduplication**: Minimize redundant storage
- **Regional Pricing**: Optimize DR region selection

## Troubleshooting

### Common Issues

#### Backup Failures
```bash
# Check backup job status
aws backup list-backup-jobs --by-state FAILED

# Review error logs
aws logs describe-log-groups --log-group-name-prefix /aws/backup

# Check IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::...:role/backup-service-role \
  --action-names backup:StartBackupJob
```

#### Replication Lag
```bash
# Check replication status
aws elasticache describe-replication-groups \
  --replication-group-id labelmintit-production-redis-enhanced

# Monitor replication metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name ReplicationLag \
  --start-time $(date -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 --statistics Average
```

#### DR Failover Issues
```bash
# Check health check status
aws route53 get-health-check-status \
  --health-check-id health-check-id

# Verify DR resources
aws ecs describe-clusters --region us-west-2
aws rds describe-db-instances --region us-west-2

# Test DNS failover
dig labelmintit.com
```

### Performance Issues

#### Slow Backups
1. **Check Database Load**: Monitor CPU and I/O
2. **Optimize Backup Window**: Schedule during low activity
3. **Increase Resources**: Scale up backup performance
4. **Network Optimization**: Improve bandwidth allocation

#### High RPO
1. **Increase Backup Frequency**: More frequent backups
2. **Optimize Backup Size**: Exclude unnecessary data
3. **Parallel Processing**: Use parallel backup streams
4. **Performance Tuning**: Optimize database parameters

## Maintenance

### Regular Updates
1. **Terraform Updates**: Keep infrastructure code current
2. **Lambda Functions**: Update monitoring and testing functions
3. **AWS Services**: Stay current with AWS backup features
4. **Security Patches**: Apply security updates promptly

### Documentation Updates
1. **Runbook Reviews**: Monthly review and updates
2. **Contact Lists**: Keep emergency contacts current
3. **Architecture Diagrams**: Update with infrastructure changes
4. **Procedures**: Document lessons learned from incidents

### Testing Schedule
- **Daily**: Automated backup validation
- **Weekly**: Backup testing framework execution
- **Monthly**: DR environment readiness check
- **Quarterly**: Full disaster recovery drill
- **Annually**: Complete system review and updates

## Support and Contacts

### Emergency Contacts
- **Incident Commander**: [Name] - [Phone] - [Email]
- **Technical Lead**: [Name] - [Phone] - [Email]
- **DevOps Team**: [Email distribution list]
- **Management**: [ escalation contacts ]

### AWS Support
- **Support Plan**: Enterprise Support
- **Account Team**: [AWS account manager]
- **Technical Contacts**: [AWS TAM contacts]
- **Emergency Escalation**: [AWS emergency line]

### Documentation
- **Runbooks**: `/docs/disaster-recovery-runbooks.md`
- **Architecture**: `/docs/backup-architecture.md`
- **Procedures**: `/docs/operational-procedures.md`
- **Compliance**: `/docs/compliance-framework.md`

---

**Document Version**: 1.0
**Last Updated**: [Current Date]
**Next Review**: [Date + 6 months]
**Maintainers**: DevOps Team