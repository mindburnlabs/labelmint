import json
import boto3
import os
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """Lambda handler for RTO/RPO monitoring"""

    try:
        # Environment variables
        project_name = os.getenv('PROJECT_NAME', 'labelmintit')
        environment = os.getenv('ENVIRONMENT', 'production')
        rpo_threshold_minutes = int(os.getenv('RPO_THRESHOLD_MINUTES', '60'))
        rto_threshold_minutes = int(os.getenv('RTO_THRESHOLD_MINUTES', '240'))
        sns_topic_arn = os.getenv('SNS_TOPIC_ARN')

        # Initialize AWS clients
        backup_client = boto3.client('backup')
        rds_client = boto3.client('rds')
        elasticache_client = boto3.client('elasticache')
        cloudwatch_client = boto3.client('cloudwatch')

        # Monitor backup RPO
        postgres_rpo = monitor_postgresql_rpo(
            backup_client, rds_client, project_name, environment, rpo_threshold_minutes
        )

        redis_rpo = monitor_redis_rpo(
            backup_client, elasticache_client, project_name, environment, rpo_threshold_minutes
        )

        # Monitor cross-region replication
        replication_status = monitor_cross_region_replication(
            backup_client, project_name, environment
        )

        # Calculate backup health score
        health_score = calculate_backup_health_score(
            postgres_rpo, redis_rpo, replication_status, rpo_threshold_minutes
        )

        # Publish metrics to CloudWatch
        publish_metrics_to_cloudwatch(
            cloudwatch_client, project_name, environment,
            postgres_rpo, redis_rpo, replication_status, health_score
        )

        # Send alerts if thresholds exceeded
        if sns_topic_arn:
            send_alerts_if_needed(
                sns_topic_arn, project_name, environment,
                postgres_rpo, redis_rpo, replication_status,
                rpo_threshold_minutes, health_score
            )

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'RTO/RPO monitoring completed',
                'postgres_rpo_minutes': postgres_rpo,
                'redis_rpo_minutes': redis_rpo,
                'replication_status': replication_status,
                'health_score': health_score
            })
        }

    except Exception as e:
        logger.error(f'RTO/RPO monitoring failed: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }

def monitor_postgresql_rpo(backup_client, rds_client, project_name, environment, rpo_threshold):
    """Monitor PostgreSQL backup RPO"""

    try:
        backup_vault_name = f"{project_name}-{environment}-postgres-backup-vault"

        # Get latest recovery points
        response = backup_client.list_recovery_points_by_backup_vault(
            BackupVaultName=backup_vault_name,
            MaxResults=10
        )

        if not response['RecoveryPoints']:
            logger.warning("No PostgreSQL recovery points found")
            return float('inf')

        # Find latest completed backup
        latest_backup = None
        for rp in response['RecoveryPoints']:
            if rp['Status'] == 'COMPLETED':
                latest_backup = rp
                break

        if not latest_backup:
            logger.warning("No completed PostgreSQL backups found")
            return float('inf')

        # Calculate RPO in minutes
        backup_time = latest_backup['CreationDate']
        current_time = datetime.now(timezone.utc)
        rpo_minutes = (current_time - backup_time).total_seconds() / 60

        logger.info(f"PostgreSQL RPO: {rpo_minutes:.2f} minutes")

        return rpo_minutes

    except Exception as e:
        logger.error(f"Failed to monitor PostgreSQL RPO: {str(e)}")
        return float('inf')

def monitor_redis_rpo(backup_client, elasticache_client, project_name, environment, rpo_threshold):
    """Monitor Redis backup RPO"""

    try:
        replication_group_id = f"{project_name}-{environment}-redis-enhanced"

        # Get latest Redis snapshots
        response = elasticache_client.describe_snapshots(
            ReplicationGroupId=replication_group_id,
            MaxRecords=10
        )

        if not response['Snapshots']:
            logger.warning("No Redis snapshots found")
            return float('inf')

        # Find latest available snapshot
        latest_snapshot = None
        for snapshot in response['Snapshots']:
            if snapshot['SnapshotStatus'] == 'available':
                if latest_snapshot is None or snapshot['SnapshotCreateTime'] > latest_snapshot['SnapshotCreateTime']:
                    latest_snapshot = snapshot

        if not latest_snapshot:
            logger.warning("No available Redis snapshots found")
            return float('inf')

        # Calculate RPO in minutes
        snapshot_time = latest_snapshot['SnapshotCreateTime']
        current_time = datetime.now(timezone.utc)
        rpo_minutes = (current_time - snapshot_time).total_seconds() / 60

        logger.info(f"Redis RPO: {rpo_minutes:.2f} minutes")

        return rpo_minutes

    except Exception as e:
        logger.error(f"Failed to monitor Redis RPO: {str(e)}")
        return float('inf')

def monitor_cross_region_replication(backup_client, project_name, environment):
    """Monitor cross-region backup replication status"""

    try:
        primary_vault = f"{project_name}-{environment}-postgres-backup-vault"
        dr_vault = f"{project_name}-{environment}-postgres-backup-vault-dr"

        # Get latest primary backup
        primary_response = backup_client.list_recovery_points_by_backup_vault(
            BackupVaultName=primary_vault,
            MaxResults=1
        )

        # Get latest DR backup
        dr_response = backup_client.list_recovery_points_by_backup_vault(
            BackupVaultName=dr_vault,
            MaxResults=1
        )

        if not primary_response['RecoveryPoints']:
            return {'status': 'NO_PRIMARY_BACKUPS', 'lag_minutes': float('inf')}

        if not dr_response['RecoveryPoints']:
            return {'status': 'NO_DR_BACKUPS', 'lag_minutes': float('inf')}

        primary_time = primary_response['RecoveryPoints'][0]['CreationDate']
        dr_time = dr_response['RecoveryPoints'][0]['CreationDate']

        # Calculate replication lag
        replication_lag = (dr_time - primary_time).total_seconds() / 60

        status = 'HEALTHY' if replication_lag < 60 else 'LAGGING'

        logger.info(f"Cross-region replication status: {status}, lag: {replication_lag:.2f} minutes")

        return {
            'status': status,
            'lag_minutes': replication_lag,
            'primary_backup_time': primary_time.isoformat(),
            'dr_backup_time': dr_time.isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to monitor cross-region replication: {str(e)}")
        return {'status': 'ERROR', 'lag_minutes': float('inf')}

def calculate_backup_health_score(postgres_rpo, redis_rpo, replication_status, rpo_threshold):
    """Calculate overall backup health score (0-100)"""

    try:
        # PostgreSQL RPO score (40% weight)
        postgres_score = max(0, 100 - (postgres_rpo / rpo_threshold) * 100) if postgres_rpo != float('inf') else 0

        # Redis RPO score (30% weight)
        redis_score = max(0, 100 - (redis_rpo / rpo_threshold) * 100) if redis_rpo != float('inf') else 0

        # Replication score (30% weight)
        if replication_status['status'] == 'HEALTHY':
            replication_score = 100
        elif replication_status['status'] == 'LAGGING':
            replication_score = max(0, 100 - (replication_status['lag_minutes'] / 60) * 100)
        else:
            replication_score = 0

        # Weighted average
        health_score = (postgres_score * 0.4) + (redis_score * 0.3) + (replication_score * 0.3)

        logger.info(f"Backup health score: {health_score:.2f}")

        return health_score

    except Exception as e:
        logger.error(f"Failed to calculate backup health score: {str(e)}")
        return 0

def publish_metrics_to_cloudwatch(cloudwatch_client, project_name, environment,
                                 postgres_rpo, redis_rpo, replication_status, health_score):
    """Publish RTO/RPO metrics to CloudWatch"""

    try:
        namespace = f"{project_name}/{environment}/backup-monitoring"
        timestamp = datetime.now(timezone.utc)

        metrics = []

        # PostgreSQL RPO
        if postgres_rpo != float('inf'):
            metrics.append({
                'MetricName': 'PostgreSQLRPO',
                'Value': postgres_rpo,
                'Unit': 'Minutes',
                'Timestamp': timestamp,
                'Dimensions': [
                    {'Name': 'Environment', 'Value': environment}
                ]
            })

        # Redis RPO
        if redis_rpo != float('inf'):
            metrics.append({
                'MetricName': 'RedisRPO',
                'Value': redis_rpo,
                'Unit': 'Minutes',
                'Timestamp': timestamp,
                'Dimensions': [
                    {'Name': 'Environment', 'Value': environment}
                ]
            })

        # Replication Lag
        if replication_status['lag_minutes'] != float('inf'):
            metrics.append({
                'MetricName': 'ReplicationLag',
                'Value': replication_status['lag_minutes'],
                'Unit': 'Minutes',
                'Timestamp': timestamp,
                'Dimensions': [
                    {'Name': 'Environment', 'Value': environment}
                ]
            })

        # Health Score
        metrics.append({
            'MetricName': 'BackupHealthScore',
            'Value': health_score,
            'Unit': 'None',
            'Timestamp': timestamp,
            'Dimensions': [
                {'Name': 'Environment', 'Value': environment}
            ]
        })

        # Replication Status (as numeric: 1=HEALTHY, 0.5=LAGGING, 0=ERROR/NO_BACKUPS)
        replication_status_numeric = {
            'HEALTHY': 1,
            'LAGGING': 0.5,
            'NO_PRIMARY_BACKUPS': 0,
            'NO_DR_BACKUPS': 0,
            'ERROR': 0
        }.get(replication_status['status'], 0)

        metrics.append({
            'MetricName': 'ReplicationStatus',
            'Value': replication_status_numeric,
            'Unit': 'None',
            'Timestamp': timestamp,
            'Dimensions': [
                {'Name': 'Environment', 'Value': environment}
            ]
        })

        # Publish metrics
        if metrics:
            cloudwatch_client.put_metric_data(Namespace=namespace, MetricData=metrics)
            logger.info(f"Published {len(metrics)} metrics to CloudWatch")

    except Exception as e:
        logger.error(f"Failed to publish metrics to CloudWatch: {str(e)}")

def send_alerts_if_needed(sns_topic_arn, project_name, environment,
                         postgres_rpo, redis_rpo, replication_status,
                         rpo_threshold, health_score):
    """Send alerts if RPO/RTO thresholds are exceeded"""

    try:
        alerts = []

        # Check PostgreSQL RPO
        if postgres_rpo > rpo_threshold:
            alerts.append(f"PostgreSQL RPO exceeded: {postgres_rpo:.2f} minutes (threshold: {rpo_threshold} minutes)")

        # Check Redis RPO (use higher threshold for Redis - 24 hours)
        redis_rpo_threshold = 24 * 60  # 24 hours in minutes
        if redis_rpo > redis_rpo_threshold:
            alerts.append(f"Redis RPO exceeded: {redis_rpo:.2f} minutes (threshold: {redis_rpo_threshold} minutes)")

        # Check replication status
        if replication_status['status'] in ['NO_PRIMARY_BACKUPS', 'NO_DR_BACKUPS', 'ERROR']:
            alerts.append(f"Cross-region replication issue: {replication_status['status']}")
        elif replication_status['status'] == 'LAGGING' and replication_status['lag_minutes'] > 120:
            alerts.append(f"High cross-region replication lag: {replication_status['lag_minutes']:.2f} minutes")

        # Check health score
        if health_score < 80:
            alerts.append(f"Low backup health score: {health_score:.2f}/100")

        # Send alert if any issues detected
        if alerts:
            sns_client = boto3.client('sns')

            message = f"""
🚨 BACKUP MONITORING ALERTS

Project: {project_name}
Environment: {environment}
Timestamp: {datetime.now().isoformat()}

Issues Detected:
{chr(10).join(f"- {alert}" for alert in alerts)}

Current Status:
- PostgreSQL RPO: {postgres_rpo:.2f} minutes
- Redis RPO: {redis_rpo:.2f} minutes
- Replication Status: {replication_status['status']}
- Replication Lag: {replication_status['lag_minutes']:.2f} minutes
- Health Score: {health_score:.2f}/100

Please investigate and address these backup issues promptly.
"""

            sns_client.publish(
                TopicArn=sns_topic_arn,
                Subject=f"BACKUP MONITORING ALERT - {environment.upper()}",
                Message=message
            )

            logger.warning(f"Backup monitoring alerts sent: {len(alerts)} issues detected")

    except Exception as e:
        logger.error(f"Failed to send backup monitoring alerts: {str(e)}")