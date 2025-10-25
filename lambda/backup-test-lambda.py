import json
import boto3
import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """Lambda handler for automated backup testing"""

    try:
        # Environment variables
        project_name = os.getenv('PROJECT_NAME', 'labelmintit')
        environment = os.getenv('ENVIRONMENT', 'production')
        sns_topic_arn = os.getenv('SNS_TOPIC_ARN')

        # Initialize AWS clients
        backup_client = boto3.client('backup')
        rds_client = boto3.client('rds')
        elasticache_client = boto3.client('elasticache')
        cloudwatch_client = boto3.client('cloudwatch')

        # Run backup tests
        test_results = {}

        # Test PostgreSQL backups
        test_results['postgresql'] = test_postgresql_backups(
            backup_client, rds_client, project_name, environment
        )

        # Test Redis backups
        test_results['redis'] = test_redis_backups(
            backup_client, elasticache_client, project_name, environment
        )

        # Generate summary
        total_tests = len(test_results)
        passed_tests = sum(1 for result in test_results.values() if result['status'] == 'PASSED')
        failed_tests = total_tests - passed_tests

        # Send notification if there are failures
        if failed_tests > 0 and sns_topic_arn:
            send_failure_notification(sns_topic_arn, test_results, project_name, environment)

        # Publish metrics to CloudWatch
        publish_cloudwatch_metrics(cloudwatch_client, test_results, project_name, environment)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Backup testing completed. {passed_tests}/{total_tests} tests passed.',
                'results': test_results
            })
        }

    except Exception as e:
        logger.error(f'Backup testing failed: {str(e)}')

        # Send error notification
        if os.getenv('SNS_TOPIC_ARN'):
            send_error_notification(os.getenv('SNS_TOPIC_ARN'), str(e), project_name, environment)

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }

def test_postgresql_backups(backup_client, rds_client, project_name, environment):
    """Test PostgreSQL backup functionality"""

    logger.info("Testing PostgreSQL backups...")

    try:
        backup_vault_name = f"{project_name}-{environment}-postgres-backup-vault"

        # Check if backup vault exists and has recent backups
        response = backup_client.list_recovery_points_by_backup_vault(
            BackupVaultName=backup_vault_name,
            MaxResults=10
        )

        if not response['RecoveryPoints']:
            return {
                'status': 'FAILED',
                'error': 'No recovery points found in PostgreSQL backup vault'
            }

        # Check latest backup
        latest_backup = max(response['RecoveryPoints'], key=lambda x: x['CreationDate'])

        # Verify backup status
        if latest_backup['Status'] != 'COMPLETED':
            return {
                'status': 'FAILED',
                'error': f"Latest backup status is {latest_backup['Status']}"
            }

        # Check backup age (should be within 24 hours)
        backup_age = datetime.now(latest_backup['CreationDate'].tzinfo) - latest_backup['CreationDate']
        if backup_age > timedelta(hours=24):
            return {
                'status': 'FAILED',
                'error': f"Latest backup is {backup_age} old, exceeding 24-hour threshold"
            }

        # Verify RDS automated backups are enabled
        db_identifier = f"{project_name}-{environment}-db-enhanced"

        try:
            db_response = rds_client.describe_db_instances(DBInstanceIdentifier=db_identifier)
            db_instance = db_response['DBInstances'][0]

            if not db_instance['BackupRetentionPeriod'] or db_instance['BackupRetentionPeriod'] < 7:
                return {
                    'status': 'FAILED',
                    'error': 'RDS backup retention period is less than 7 days'
                }

        except Exception as e:
            return {
                'status': 'FAILED',
                'error': f'Failed to verify RDS backup configuration: {str(e)}'
            }

        return {
            'status': 'PASSED',
            'details': {
                'latest_backup_time': latest_backup['CreationDate'].isoformat(),
                'backup_age_hours': backup_age.total_seconds() / 3600,
                'backup_retention_days': db_instance['BackupRetentionPeriod']
            }
        }

    except Exception as e:
        logger.error(f"PostgreSQL backup test failed: {str(e)}")
        return {
            'status': 'FAILED',
            'error': str(e)
        }

def test_redis_backups(backup_client, elasticache_client, project_name, environment):
    """Test Redis backup functionality"""

    logger.info("Testing Redis backups...")

    try:
        replication_group_id = f"{project_name}-{environment}-redis-enhanced"

        # Check if replication group exists
        response = elasticache_client.describe_replication_groups(
            ReplicationGroupId=replication_group_id
        )

        if not response['ReplicationGroups']:
            return {
                'status': 'FAILED',
                'error': 'Redis replication group not found'
            }

        replication_group = response['ReplicationGroups'][0]

        # Verify snapshot retention
        if replication_group.get('SnapshotRetentionLimit', 0) < 7:
            return {
                'status': 'FAILED',
                'error': 'Redis snapshot retention is less than 7 days'
            }

        # Check for recent snapshots
        snapshots_response = elasticache_client.describe_snapshots(
            ReplicationGroupId=replication_group_id,
            MaxResults=10
        )

        if not snapshots_response['Snapshots']:
            return {
                'status': 'FAILED',
                'error': 'No Redis snapshots found'
            }

        # Check latest snapshot
        latest_snapshot = max(snapshots_response['Snapshots'], key=lambda x: x['SnapshotCreateTime'])

        if latest_snapshot['SnapshotStatus'] != 'available':
            return {
                'status': 'FAILED',
                'error': f"Latest snapshot status is {latest_snapshot['SnapshotStatus']}"
            }

        # Check snapshot age
        snapshot_age = datetime.now(latest_snapshot['SnapshotCreateTime'].tzinfo) - latest_snapshot['SnapshotCreateTime']
        if snapshot_age > timedelta(hours=25):
            return {
                'status': 'FAILED',
                'error': f"Latest snapshot is {snapshot_age} old, exceeding 25-hour threshold"
            }

        return {
            'status': 'PASSED',
            'details': {
                'latest_snapshot_time': latest_snapshot['SnapshotCreateTime'].isoformat(),
                'snapshot_age_hours': snapshot_age.total_seconds() / 3600,
                'snapshot_retention_days': replication_group['SnapshotRetentionLimit']
            }
        }

    except Exception as e:
        logger.error(f"Redis backup test failed: {str(e)}")
        return {
            'status': 'FAILED',
            'error': str(e)
        }

def send_failure_notification(sns_topic_arn, test_results, project_name, environment):
    """Send SNS notification for test failures"""

    try:
        sns_client = boto3.client('sns')

        failed_tests = {name: result for name, result in test_results.items() if result['status'] == 'FAILED'}

        message = f"""
🚨 BACKUP TESTING FAILURES DETECTED

Project: {project_name}
Environment: {environment}
Timestamp: {datetime.now().isoformat()}

Failed Tests:
{chr(10).join(f"- {name}: {result['error']}" for name, result in failed_tests.items())}

Please investigate and resolve these backup issues immediately.
"""

        sns_client.publish(
            TopicArn=sns_topic_arn,
            Subject=f"BACKUP TESTING ALERT - {environment.upper()}",
            Message=message
        )

        logger.info("Failure notification sent via SNS")

    except Exception as e:
        logger.error(f"Failed to send failure notification: {str(e)}")

def send_error_notification(sns_topic_arn, error_message, project_name, environment):
    """Send SNS notification for system errors"""

    try:
        sns_client = boto3.client('sns')

        message = f"""
🚨 BACKUP TESTING SYSTEM ERROR

Project: {project_name}
Environment: {environment}
Timestamp: {datetime.now().isoformat()}

Error: {error_message}

The backup testing system encountered an error and could not complete tests.
Please investigate the system configuration.
"""

        sns_client.publish(
            TopicArn=sns_topic_arn,
            Subject=f"BACKUP TESTING SYSTEM ERROR - {environment.upper()}",
            Message=message
        )

        logger.info("Error notification sent via SNS")

    except Exception as e:
        logger.error(f"Failed to send error notification: {str(e)}")

def publish_cloudwatch_metrics(cloudwatch_client, test_results, project_name, environment):
    """Publish backup testing metrics to CloudWatch"""

    try:
        namespace = f"{project_name}/{environment}/backup-testing"

        for test_name, result in test_results.items():
            # Publish test result metric (1 for passed, 0 for failed)
            cloudwatch_client.put_metric_data(
                Namespace=namespace,
                MetricData=[
                    {
                        'MetricName': 'BackupTestResult',
                        'Dimensions': [
                            {
                                'Name': 'TestType',
                                'Value': test_name
                            },
                            {
                                'Name': 'Environment',
                                'Value': environment
                            }
                        ],
                        'Value': 1 if result['status'] == 'PASSED' else 0,
                        'Unit': 'None',
                        'Timestamp': datetime.now()
                    }
                ]
            )

            # Publish RPO/RTO metrics if available
            if 'details' in result:
                details = result['details']

                if 'backup_age_hours' in details:
                    cloudwatch_client.put_metric_data(
                        Namespace=namespace,
                        MetricData=[
                            {
                                'MetricName': 'BackupAgeHours',
                                'Dimensions': [
                                    {
                                        'Name': 'TestType',
                                        'Value': test_name
                                    },
                                    {
                                        'Name': 'Environment',
                                        'Value': environment
                                    }
                                ],
                                'Value': details['backup_age_hours'],
                                'Unit': 'Hours',
                                'Timestamp': datetime.now()
                            }
                        ]
                    )

        logger.info("CloudWatch metrics published successfully")

    except Exception as e:
        logger.error(f"Failed to publish CloudWatch metrics: {str(e)}")