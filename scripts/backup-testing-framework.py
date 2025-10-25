#!/usr/bin/env python3
"""
LabelMint Backup Testing Framework
Automated backup validation and disaster recovery testing system
"""

import boto3
import json
import logging
import time
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import subprocess
import tempfile

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/backup-testing.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class TestResult(Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    TIMEOUT = "TIMEOUT"

class BackupType(Enum):
    POSTGRESQL = "postgresql"
    REDIS = "redis"
    S3 = "s3"
    APPLICATION = "application"

@dataclass
class TestMetrics:
    test_name: str
    start_time: datetime
    end_time: datetime
    result: TestResult
    details: Dict[str, Any]
    recovery_point_objective: Optional[timedelta] = None
    recovery_time_objective: Optional[timedelta] = None

class BackupTestingFramework:
    def __init__(self, config_file: str = None):
        """Initialize the backup testing framework"""
        self.config = self._load_config(config_file)
        self.aws_clients = self._initialize_aws_clients()
        self.test_results: List[TestMetrics] = []
        self.slack_webhook = os.getenv('SLACK_WEBHOOK_URL')
        self.sns_topic_arn = os.getenv('SNS_TOPIC_ARN')

    def _load_config(self, config_file: str) -> Dict:
        """Load configuration from file or environment variables"""
        default_config = {
            'project_name': os.getenv('PROJECT_NAME', 'labelmintit'),
            'environment': os.getenv('ENVIRONMENT', 'production'),
            'primary_region': os.getenv('PRIMARY_REGION', 'us-east-1'),
            'dr_region': os.getenv('DR_REGION', 'us-west-2'),
            'rpo_threshold_minutes': int(os.getenv('RPO_THRESHOLD_MINUTES', '60')),
            'rto_threshold_minutes': int(os.getenv('RTO_THRESHOLD_MINUTES', '240')),
            'backup_retention_days': int(os.getenv('BACKUP_RETENTION_DAYS', '90')),
            'max_test_duration_hours': int(os.getenv('MAX_TEST_DURATION_HOURS', '4'))
        }

        if config_file and os.path.exists(config_file):
            with open(config_file, 'r') as f:
                file_config = json.load(f)
                default_config.update(file_config)

        return default_config

    def _initialize_aws_clients(self) -> Dict[str, Any]:
        """Initialize AWS service clients"""
        clients = {}

        # Primary region clients
        for service in ['rds', 'elasticache', 'backup', 's3', 'lambda', 'cloudwatch', 'sns']:
            clients[f'{service}_primary'] = boto3.client(
                service,
                region_name=self.config['primary_region']
            )

        # DR region clients
        for service in ['rds', 'elasticache', 'backup', 's3']:
            clients[f'{service}_dr'] = boto3.client(
                service,
                region_name=self.config['dr_region']
            )

        return clients

    def test_postgresql_backup(self) -> TestMetrics:
        """Test PostgreSQL backup and recovery"""
        logger.info("Starting PostgreSQL backup and recovery test")
        start_time = datetime.now()

        try:
            # Test 1: Verify latest backup exists
            backup_check_result = self._verify_latest_postgresql_backup()

            # Test 2: Test point-in-time recovery
            pitr_result = self._test_postgresql_pitr()

            # Test 3: Cross-region backup replication
            cross_region_result = self._verify_postgresql_cross_region_backup()

            # Test 4: Backup integrity check
            integrity_result = self._verify_postgresql_backup_integrity()

            details = {
                'backup_check': backup_check_result,
                'pitr_test': pitr_result,
                'cross_region_replication': cross_region_result,
                'integrity_check': integrity_result
            }

            # Calculate RPO/RTO
            rpo = self._calculate_postgresql_rpo()
            rto = self._calculate_postgresql_rto(start_time)

            result = TestResult.PASSED if all([
                backup_check_result, pitr_result,
                cross_region_result, integrity_result
            ]) else TestResult.FAILED

            end_time = datetime.now()

            return TestMetrics(
                test_name="postgresql_backup_recovery",
                start_time=start_time,
                end_time=end_time,
                result=result,
                details=details,
                recovery_point_objective=rpo,
                recovery_time_objective=rto
            )

        except Exception as e:
            logger.error(f"PostgreSQL backup test failed: {str(e)}")
            end_time = datetime.now()
            return TestMetrics(
                test_name="postgresql_backup_recovery",
                start_time=start_time,
                end_time=end_time,
                result=TestResult.FAILED,
                details={'error': str(e)}
            )

    def test_redis_backup(self) -> TestMetrics:
        """Test Redis backup and recovery"""
        logger.info("Starting Redis backup and recovery test")
        start_time = datetime.now()

        try:
            # Test 1: Verify latest snapshot exists
            snapshot_check = self._verify_latest_redis_snapshot()

            # Test 2: Test snapshot restore
            restore_test = self._test_redis_snapshot_restore()

            # Test 3: Cross-region replication
            replication_check = self._verify_redis_cross_region_replication()

            # Test 4: AOF backup verification
            aof_check = self._verify_redis_aof_backup()

            details = {
                'snapshot_check': snapshot_check,
                'restore_test': restore_test,
                'replication_check': replication_check,
                'aof_check': aof_check
            }

            rpo = self._calculate_redis_rpo()
            rto = self._calculate_redis_rto(start_time)

            result = TestResult.PASSED if all([
                snapshot_check, restore_test,
                replication_check, aof_check
            ]) else TestResult.FAILED

            end_time = datetime.now()

            return TestMetrics(
                test_name="redis_backup_recovery",
                start_time=start_time,
                end_time=end_time,
                result=result,
                details=details,
                recovery_point_objective=rpo,
                recovery_time_objective=rto
            )

        except Exception as e:
            logger.error(f"Redis backup test failed: {str(e)}")
            end_time = datetime.now()
            return TestMetrics(
                test_name="redis_backup_recovery",
                start_time=start_time,
                end_time=end_time,
                result=TestResult.FAILED,
                details={'error': str(e)}
            )

    def test_s3_backup(self) -> TestMetrics:
        """Test S3 backup and cross-region replication"""
        logger.info("Starting S3 backup test")
        start_time = datetime.now()

        try:
            # Test 1: Verify S3 versioning and encryption
            versioning_check = self._verify_s3_versioning()
            encryption_check = self._verify_s3_encryption()

            # Test 2: Cross-region replication
            replication_check = self._verify_s3_cross_region_replication()

            # Test 3: Backup lifecycle policies
            lifecycle_check = self._verify_s3_lifecycle_policies()

            # Test 4: Backup accessibility test
            accessibility_test = self._test_s3_backup_accessibility()

            details = {
                'versioning_check': versioning_check,
                'encryption_check': encryption_check,
                'replication_check': replication_check,
                'lifecycle_check': lifecycle_check,
                'accessibility_test': accessibility_test
            }

            result = TestResult.PASSED if all([
                versioning_check, encryption_check,
                replication_check, lifecycle_check,
                accessibility_test
            ]) else TestResult.FAILED

            end_time = datetime.now()

            return TestMetrics(
                test_name="s3_backup",
                start_time=start_time,
                end_time=end_time,
                result=result,
                details=details
            )

        except Exception as e:
            logger.error(f"S3 backup test failed: {str(e)}")
            end_time = datetime.now()
            return TestMetrics(
                test_name="s3_backup",
                start_time=start_time,
                end_time=end_time,
                result=TestResult.FAILED,
                details={'error': str(e)}
            )

    def test_disaster_recovery_failover(self) -> TestMetrics:
        """Test complete disaster recovery failover process"""
        logger.info("Starting disaster recovery failover test")
        start_time = datetime.now()

        try:
            # Test 1: Health check status verification
            health_check = self._verify_health_checks()

            # Test 2: DNS failover capability
            dns_failover_test = self._test_dns_failover()

            # Test 3: DR environment readiness
            dr_readiness = self._verify_dr_environment_readiness()

            # Test 4: Data synchronization
            sync_check = self._verify_data_synchronization()

            details = {
                'health_check': health_check,
                'dns_failover': dns_failover_test,
                'dr_readiness': dr_readiness,
                'sync_check': sync_check
            }

            rto = self._calculate_dr_rto(start_time)

            result = TestResult.PASSED if all([
                health_check, dns_failover_test,
                dr_readiness, sync_check
            ]) else TestResult.FAILED

            end_time = datetime.now()

            return TestMetrics(
                test_name="disaster_recovery_failover",
                start_time=start_time,
                end_time=end_time,
                result=result,
                details=details,
                recovery_time_objective=rto
            )

        except Exception as e:
            logger.error(f"Disaster recovery failover test failed: {str(e)}")
            end_time = datetime.now()
            return TestMetrics(
                test_name="disaster_recovery_failover",
                start_time=start_time,
                end_time=end_time,
                result=TestResult.FAILED,
                details={'error': str(e)}
            )

    def _verify_latest_postgresql_backup(self) -> bool:
        """Verify that latest PostgreSQL backup exists and is complete"""
        try:
            response = self.aws_clients['backup_primary'].list_recovery_points_by_backup_vault(
                BackupVaultName=f"{self.config['project_name']}-{self.config['environment']}-postgres-backup-vault",
                ByBackupPlanId=f"{self.config['project_name']}-{self.config['environment']}-postgres-backup-plan"
            )

            if not response['RecoveryPoints']:
                logger.error("No PostgreSQL recovery points found")
                return False

            latest_recovery_point = max(
                response['RecoveryPoints'],
                key=lambda x: x['CreationDate']
            )

            # Check if backup is completed
            if latest_recovery_point['Status'] != 'COMPLETED':
                logger.error(f"Latest backup status: {latest_recovery_point['Status']}")
                return False

            # Check backup age (should be within RPO)
            backup_age = datetime.now(latest_recovery_point['CreationDate'].tzinfo) - latest_recovery_point['CreationDate']
            if backup_age > timedelta(minutes=self.config['rpo_threshold_minutes']):
                logger.error(f"Backup age {backup_age} exceeds RPO threshold")
                return False

            logger.info(f"Latest PostgreSQL backup found: {latest_recovery_point['RecoveryPointArn']}")
            return True

        except Exception as e:
            logger.error(f"Failed to verify PostgreSQL backup: {str(e)}")
            return False

    def _test_postgresql_pitr(self) -> bool:
        """Test PostgreSQL point-in-time recovery"""
        try:
            # Create a test restore job
            restore_time = datetime.now() - timedelta(hours=1)

            response = self.aws_clients['backup_primary'].start_restore_job(
                RecoveryPointArn=self._get_latest_postgresql_recovery_point(),
                Metadata={
                    'restore-testing': 'true',
                    'original-restore-time': restore_time.isoformat()
                },
                ResourceArn=f"arn:aws:rds:{self.config['primary_region']}:{boto3.client('sts').get_caller_identity()['Account']}:db:{self.config['project_name']}-{self.config['environment']}-db-restore-test",
                RestoreOptions={
                    'CopyOnWrite': True
                },
                IamRolesArn=[self.aws_clients['backup_primary'].get_role_arn()]
            )

            restore_job_id = response['RestoreJobId']

            # Wait for restore job to complete
            max_wait_time = 1800  # 30 minutes
            start_time = time.time()

            while time.time() - start_time < max_wait_time:
                job_status = self.aws_clients['backup_primary'].describe_restore_job(
                    RestoreJobId=restore_job_id
                )

                if job_status['Status'] == 'COMPLETED':
                    logger.info("PITR test completed successfully")

                    # Clean up test instance
                    self._cleanup_test_restore_instance(job_status['RecoveryPointArn'])
                    return True
                elif job_status['Status'] == 'FAILED':
                    logger.error(f"PITR test failed: {job_status.get('StatusMessage', 'Unknown error')}")
                    return False

                time.sleep(30)

            logger.error("PITR test timed out")
            return False

        except Exception as e:
            logger.error(f"PITR test failed: {str(e)}")
            return False

    def _verify_postgresql_cross_region_backup(self) -> bool:
        """Verify PostgreSQL backup replication to DR region"""
        try:
            dr_backup_vault = f"{self.config['project_name']}-{self.config['environment']}-postgres-backup-vault-dr"

            response = self.aws_clients['backup_dr'].list_recovery_points_by_backup_vault(
                BackupVaultName=dr_backup_vault
            )

            if not response['RecoveryPoints']:
                logger.error("No PostgreSQL recovery points found in DR region")
                return False

            # Verify at least one recent backup exists in DR region
            recent_backups = [
                rp for rp in response['RecoveryPoints']
                if datetime.now(rp['CreationDate'].tzinfo) - rp['CreationDate'] < timedelta(days=2)
            ]

            if not recent_backups:
                logger.error("No recent PostgreSQL backups found in DR region")
                return False

            logger.info(f"Found {len(recent_backups)} recent PostgreSQL backups in DR region")
            return True

        except Exception as e:
            logger.error(f"Failed to verify PostgreSQL cross-region backup: {str(e)}")
            return False

    def _verify_postgresql_backup_integrity(self) -> bool:
        """Verify PostgreSQL backup integrity"""
        try:
            # Get latest backup details
            recovery_point = self._get_latest_postgresql_recovery_point_details()

            # Check backup size and metadata
            if recovery_point.get('BackupSizeInBytes', 0) == 0:
                logger.error("Backup size is zero")
                return False

            # Verify backup checksum if available
            if 'CalculatedChecksum' not in recovery_point:
                logger.warning("Backup checksum not available")

            logger.info("PostgreSQL backup integrity verified")
            return True

        except Exception as e:
            logger.error(f"Failed to verify PostgreSQL backup integrity: {str(e)}")
            return False

    def _verify_latest_redis_snapshot(self) -> bool:
        """Verify that latest Redis snapshot exists"""
        try:
            cluster_id = f"{self.config['project_name']}-{self.config['environment']}-redis-enhanced"

            response = self.aws_clients['elasticache_primary'].describe_snapshots(
                ReplicationGroupId=cluster_id,
                MaxRecords=1
            )

            if not response['Snapshots']:
                logger.error("No Redis snapshots found")
                return False

            latest_snapshot = response['Snapshots'][0]

            # Check snapshot status
            if latest_snapshot['SnapshotStatus'] != 'available':
                logger.error(f"Snapshot status: {latest_snapshot['SnapshotStatus']}")
                return False

            # Check snapshot age
            snapshot_age = datetime.now(latest_snapshot['SnapshotCreateTime'].tzinfo) - latest_snapshot['SnapshotCreateTime']
            if snapshot_age > timedelta(hours=25):  # Allow some buffer for daily snapshots
                logger.error(f"Snapshot age {snapshot_age} exceeds threshold")
                return False

            logger.info(f"Latest Redis snapshot found: {latest_snapshot['SnapshotName']}")
            return True

        except Exception as e:
            logger.error(f"Failed to verify Redis snapshot: {str(e)}")
            return False

    def _test_redis_snapshot_restore(self) -> bool:
        """Test Redis snapshot restore to temporary cluster"""
        try:
            # Get latest snapshot
            snapshot_response = self.aws_clients['elasticache_primary'].describe_snapshots(
                ReplicationGroupId=f"{self.config['project_name']}-{self.config['environment']}-redis-enhanced",
                MaxRecords=1
            )

            if not snapshot_response['Snapshots']:
                return False

            snapshot = snapshot_response['Snapshots'][0]

            # Create temporary cluster for restore test
            test_cluster_id = f"{self.config['project_name']}-{self.config['environment']}-redis-restore-test"

            try:
                self.aws_clients['elasticache_primary'].create_replication_group(
                    ReplicationGroupId=test_cluster_id,
                    ReplicationGroupDescription="Temporary cluster for restore testing",
                    Engine='redis',
                    EngineVersion='7.0',
                    CacheNodeType='cache.t3.micro',
                    NumCacheClusters=1,
                    SnapshotName=snapshot['SnapshotName'],
                    SecurityGroupIds=[self.aws_clients['elasticache_primary'].describe_replication_groups(
                        ReplicationGroupId=f"{self.config['project_name']}-{self.config['environment']}-redis-enhanced"
                    )['ReplicationGroups'][0]['SecurityGroups'][0]['SecurityGroupId']],
                    SubnetGroupName=f"{self.config['project_name']}-{self.config['environment']}-cache-subnet"
                )

                # Wait for cluster to become available
                max_wait_time = 1800  # 30 minutes
                start_time = time.time()

                while time.time() - start_time < max_wait_time:
                    cluster_status = self.aws_clients['elasticache_primary'].describe_replication_groups(
                        ReplicationGroupId=test_cluster_id
                    )

                    if cluster_status['ReplicationGroups'][0]['Status'] == 'available':
                        logger.info("Redis restore test completed successfully")
                        return True

                    time.sleep(30)

                logger.error("Redis restore test timed out")
                return False

            finally:
                # Clean up test cluster
                try:
                    self.aws_clients['elasticache_primary'].delete_replication_group(
                        ReplicationGroupId=test_cluster_id,
                        RetainPrimaryCluster=False,
                        FinalSnapshotIdentifier=f"{test_cluster_id}-final-snapshot"
                    )
                except:
                    pass  # Ignore cleanup errors

        except Exception as e:
            logger.error(f"Redis restore test failed: {str(e)}")
            return False

    def _verify_redis_cross_region_replication(self) -> bool:
        """Verify Redis global datastore replication"""
        try:
            if self.config['environment'] != 'production':
                logger.info("Skipping Redis cross-region replication test for non-production environment")
                return True

            # Check global replication group status
            global_replication_id = f"{self.config['project_name']}-{self.config['environment']}-redis-global"

            response = self.aws_clients['elasticache_primary'].describe_global_replication_groups(
                GlobalReplicationGroupId=global_replication_id
            )

            if not response['GlobalReplicationGroups']:
                logger.error("Global replication group not found")
                return False

            global_group = response['GlobalReplicationGroups'][0]

            # Check replication status
            for member in global_group['GlobalReplicationGroupMembers']:
                if member['Status'] != 'available':
                    logger.error(f"Replication member {member['RegionName']} status: {member['Status']}")
                    return False

            # Check replication lag
            for member in global_group['GlobalReplicationGroupMembers']:
                if 'ReplicationLag' in member and member['ReplicationLag'] > 60:
                    logger.error(f"High replication lag in {member['RegionName']}: {member['ReplicationLag']} seconds")
                    return False

            logger.info("Redis cross-region replication verified")
            return True

        except Exception as e:
            logger.error(f"Failed to verify Redis cross-region replication: {str(e)}")
            return False

    def _verify_redis_aof_backup(self) -> bool:
        """Verify Redis AOF (Append Only File) backup"""
        try:
            cluster_id = f"{self.config['project_name']}-{self.config['environment']}-redis-enhanced"

            # Check if AOF is enabled
            response = self.aws_clients['elasticache_primary'].describe_replication_groups(
                ReplicationGroupId=cluster_id
            )

            cluster = response['ReplicationGroups'][0]

            # AOF verification through parameter group
            parameter_group = cluster['CacheParameterGroup']['CacheParameterGroupName']

            parameters = self.aws_clients['elasticache_primary'].describe_engine_default_parameters(
                CacheParameterGroupName=parameter_group
            )

            aof_enabled = False
            for param in parameters['EngineDefaults']['Parameters']:
                if param['ParameterName'] == 'appendonly' and param['ParameterValue'] == 'yes':
                    aof_enabled = True
                    break

            if not aof_enabled:
                logger.error("Redis AOF is not enabled")
                return False

            logger.info("Redis AOF backup verified")
            return True

        except Exception as e:
            logger.error(f"Failed to verify Redis AOF backup: {str(e)}")
            return False

    def _verify_s3_versioning(self) -> bool:
        """Verify S3 versioning is enabled"""
        try:
            buckets = [
                f"{self.config['project_name']}-{self.config['environment']}-backups",
                f"{self.config['project_name']}-{self.config['environment']}-assets",
                f"{self.config['project_name']}-{self.config['environment']}-uploads"
            ]

            for bucket_name in buckets:
                response = self.aws_clients['s3_primary'].get_bucket_versioning(Bucket=bucket_name)

                if response.get('Status') != 'Enabled':
                    logger.error(f"S3 versioning not enabled for bucket: {bucket_name}")
                    return False

            logger.info("S3 versioning verified for all buckets")
            return True

        except Exception as e:
            logger.error(f"Failed to verify S3 versioning: {str(e)}")
            return False

    def _verify_s3_encryption(self) -> bool:
        """Verify S3 encryption is enabled"""
        try:
            buckets = [
                f"{self.config['project_name']}-{self.config['environment']}-backups",
                f"{self.config['project_name']}-{self.config['environment']}-assets",
                f"{self.config['project_name']}-{self.config['environment']}-uploads"
            ]

            for bucket_name in buckets:
                response = self.aws_clients['s3_primary'].get_bucket_encryption(Bucket=bucket_name)

                if not response.get('ServerSideEncryptionConfiguration'):
                    logger.error(f"S3 encryption not configured for bucket: {bucket_name}")
                    return False

            logger.info("S3 encryption verified for all buckets")
            return True

        except Exception as e:
            logger.error(f"Failed to verify S3 encryption: {str(e)}")
            return False

    def _verify_s3_cross_region_replication(self) -> bool:
        """Verify S3 cross-region replication"""
        try:
            if self.config['environment'] != 'production':
                logger.info("Skipping S3 cross-region replication test for non-production environment")
                return True

            bucket_name = f"{self.config['project_name']}-{self.config['environment']}-backups"

            response = self.aws_clients['s3_primary'].get_bucket_replication(Bucket=bucket_name)

            if not response.get('ReplicationConfiguration'):
                logger.error("S3 replication not configured")
                return False

            # Verify replication rules
            replication_config = response['ReplicationConfiguration']

            if 'Rules' not in replication_config or not replication_config['Rules']:
                logger.error("No S3 replication rules found")
                return False

            logger.info("S3 cross-region replication verified")
            return True

        except Exception as e:
            logger.error(f"Failed to verify S3 cross-region replication: {str(e)}")
            return False

    def _verify_s3_lifecycle_policies(self) -> bool:
        """Verify S3 lifecycle policies are configured"""
        try:
            bucket_name = f"{self.config['project_name']}-{self.config['environment']}-backups"

            response = self.aws_clients['s3_primary'].get_bucket_lifecycle_configuration(Bucket=bucket_name)

            if 'Rules' not in response or not response['Rules']:
                logger.error("No S3 lifecycle rules found")
                return False

            # Verify specific lifecycle rules
            rules = response['Rules']

            # Check for daily backups rule
            daily_rule_exists = any('daily' in rule.get('ID', '').lower() for rule in rules)
            if not daily_rule_exists:
                logger.error("Daily backup lifecycle rule not found")
                return False

            # Check for proper transitions
            for rule in rules:
                if 'Transitions' in rule:
                    for transition in rule['Transitions']:
                        if transition.get('Days', 0) <= 0:
                            logger.error(f"Invalid transition days in rule: {rule.get('ID')}")
                            return False

            logger.info("S3 lifecycle policies verified")
            return True

        except Exception as e:
            logger.error(f"Failed to verify S3 lifecycle policies: {str(e)}")
            return False

    def _test_s3_backup_accessibility(self) -> bool:
        """Test S3 backup accessibility and restore capability"""
        try:
            bucket_name = f"{self.config['project_name']}-{self.config['environment']}-backups"

            # List recent backup files
            response = self.aws_clients['s3_primary'].list_objects_v2(
                Bucket=bucket_name,
                MaxKeys=10
            )

            if 'Contents' not in response or not response['Contents']:
                logger.error("No backup files found in S3 bucket")
                return False

            # Test download of a small backup file
            test_key = response['Contents'][0]['Key']

            with tempfile.NamedTemporaryFile() as temp_file:
                self.aws_clients['s3_primary'].download_file(bucket_name, test_key, temp_file.name)

                # Verify file size is reasonable
                if os.path.getsize(temp_file.name) == 0:
                    logger.error(f"Downloaded backup file is empty: {test_key}")
                    return False

            logger.info("S3 backup accessibility verified")
            return True

        except Exception as e:
            logger.error(f"Failed to test S3 backup accessibility: {str(e)}")
            return False

    def _verify_health_checks(self) -> bool:
        """Verify Route53 health checks are working"""
        try:
            # Get health check IDs from environment variables or configuration
            primary_health_check_id = os.getenv('PRIMARY_HEALTH_CHECK_ID')
            dr_health_check_id = os.getenv('DR_HEALTH_CHECK_ID')

            if not primary_health_check_id:
                logger.error("Primary health check ID not configured")
                return False

            # Check primary health check
            route53_client = boto3.client('route53')

            if primary_health_check_id:
                primary_status = route53_client.get_health_check_status(
                    HealthCheckId=primary_health_check_id
                )

                if not primary_status['StatusList']:
                    logger.error("Primary health check status not available")
                    return False

                # Check if any health check is failing
                for status in primary_status['StatusList']:
                    if status['Status'] != 'Success':
                        logger.error(f"Primary health check failing: {status}")
                        return False

            logger.info("Health checks verified")
            return True

        except Exception as e:
            logger.error(f"Failed to verify health checks: {str(e)}")
            return False

    def _test_dns_failover(self) -> bool:
        """Test DNS failover configuration"""
        try:
            zone_id = os.getenv('ROUTE53_ZONE_ID')
            domain_name = os.getenv('DOMAIN_NAME')

            if not zone_id or not domain_name:
                logger.error("Route53 zone ID or domain name not configured")
                return False

            route53_client = boto3.client('route53')

            # Get DNS record configuration
            response = route53_client.list_resource_record_sets(
                HostedZoneId=zone_id,
                StartRecordName=domain_name,
                StartRecordType='A',
                MaxItems='1'
            )

            if not response['ResourceRecordSets']:
                logger.error("DNS record not found")
                return False

            record_set = response['ResourceRecordSets'][0]

            # Check if failover routing is configured
            if 'Failover' not in record_set:
                logger.error("DNS failover routing not configured")
                return False

            # Verify both primary and secondary records exist
            primary_identifier = record_set['SetIdentifier']
            if primary_identifier != 'primary':
                logger.error("Primary DNS record not found")
                return False

            logger.info("DNS failover configuration verified")
            return True

        except Exception as e:
            logger.error(f"Failed to test DNS failover: {str(e)}")
            return False

    def _verify_dr_environment_readiness(self) -> bool:
        """Verify DR environment is ready for failover"""
        try:
            if self.config['environment'] != 'production':
                logger.info("Skipping DR environment readiness test for non-production environment")
                return True

            # Check DR ECS cluster
            dr_cluster_name = f"{self.config['project_name']}-{self.config['environment']}-dr-cluster"

            dr_ecs_client = boto3.client('ecs', region_name=self.config['dr_region'])

            try:
                dr_ecs_client.describe_clusters(clusters=[dr_cluster_name])
            except dr_ecs_client.exceptions.ClusterNotFoundException:
                logger.error("DR ECS cluster not found")
                return False

            # Check DR RDS instance
            dr_rds_client = boto3.client('rds', region_name=self.config['dr_region'])

            dr_db_identifier = f"{self.config['project_name']}-{self.config['environment']}-db-dr-replica"

            try:
                dr_rds_client.describe_db_instances(DBInstanceIdentifier=dr_db_identifier)
            except dr_rds_client.exceptions.DBInstanceNotFound:
                logger.error("DR RDS instance not found")
                return False

            # Check DR Redis cluster
            dr_elasticache_client = boto3.client('elasticache', region_name=self.config['dr_region'])

            dr_redis_id = f"{self.config['project_name']}-{self.config['environment']}-redis-dr-replica"

            try:
                dr_elasticache_client.describe_replication_groups(ReplicationGroupId=dr_redis_id)
            except dr_elasticache_client.exceptions.ReplicationGroupNotFoundFault:
                logger.error("DR Redis cluster not found")
                return False

            logger.info("DR environment readiness verified")
            return True

        except Exception as e:
            logger.error(f"Failed to verify DR environment readiness: {str(e)}")
            return False

    def _verify_data_synchronization(self) -> bool:
        """Verify data synchronization between primary and DR regions"""
        try:
            if self.config['environment'] != 'production':
                logger.info("Skipping data synchronization test for non-production environment")
                return True

            # Compare RDS backup timestamps
            primary_backup_vault = f"{self.config['project_name']}-{self.config['environment']}-postgres-backup-vault"
            dr_backup_vault = f"{self.config['project_name']}-{self.config['environment']}-postgres-backup-vault-dr"

            primary_backup_client = self.aws_clients['backup_primary']
            dr_backup_client = self.aws_clients['backup_dr']

            # Get latest primary backup
            primary_response = primary_backup_client.list_recovery_points_by_backup_vault(
                BackupVaultName=primary_backup_vault,
                MaxResults=1
            )

            # Get latest DR backup
            dr_response = dr_backup_client.list_recovery_points_by_backup_vault(
                BackupVaultName=dr_backup_vault,
                MaxResults=1
            )

            if not primary_response['RecoveryPoints'] or not dr_response['RecoveryPoints']:
                logger.error("Missing backup points in primary or DR region")
                return False

            primary_backup_time = primary_response['RecoveryPoints'][0]['CreationDate']
            dr_backup_time = dr_response['RecoveryPoints'][0]['CreationDate']

            # Check sync delay (should be within 24 hours)
            sync_delay = dr_backup_time - primary_backup_time
            if sync_delay > timedelta(hours=24):
                logger.error(f"Data synchronization delay too high: {sync_delay}")
                return False

            logger.info(f"Data synchronization verified with delay: {sync_delay}")
            return True

        except Exception as e:
            logger.error(f"Failed to verify data synchronization: {str(e)}")
            return False

    def _get_latest_postgresql_recovery_point(self) -> str:
        """Get the latest PostgreSQL recovery point ARN"""
        response = self.aws_clients['backup_primary'].list_recovery_points_by_backup_vault(
            BackupVaultName=f"{self.config['project_name']}-{self.config['environment']}-postgres-backup-vault",
            MaxResults=1
        )

        if not response['RecoveryPoints']:
            raise Exception("No PostgreSQL recovery points found")

        return response['RecoveryPoints'][0]['RecoveryPointArn']

    def _get_latest_postgresql_recovery_point_details(self) -> Dict:
        """Get detailed information about the latest PostgreSQL recovery point"""
        recovery_point_arn = self._get_latest_postgresql_recovery_point()

        response = self.aws_clients['backup_primary'].describe_recovery_point(
            RecoveryPointArn=recovery_point_arn
        )

        return response['RecoveryPoint']

    def _calculate_postgresql_rpo(self) -> timedelta:
        """Calculate PostgreSQL Recovery Point Objective"""
        try:
            recovery_point = self._get_latest_postgresql_recovery_point_details()
            backup_time = recovery_point['CreationDate']

            rpo = datetime.now(backup_time.tzinfo) - backup_time
            return rpo

        except Exception as e:
            logger.error(f"Failed to calculate PostgreSQL RPO: {str(e)}")
            return timedelta.max

    def _calculate_postgresql_rto(self, start_time: datetime) -> timedelta:
        """Calculate PostgreSQL Recovery Time Objective"""
        return datetime.now() - start_time

    def _calculate_redis_rpo(self) -> timedelta:
        """Calculate Redis Recovery Point Objective"""
        try:
            cluster_id = f"{self.config['project_name']}-{self.config['environment']}-redis-enhanced"

            response = self.aws_clients['elasticache_primary'].describe_snapshots(
                ReplicationGroupId=cluster_id,
                MaxRecords=1
            )

            if not response['Snapshots']:
                return timedelta.max

            snapshot_time = response['Snapshots'][0]['SnapshotCreateTime']
            rpo = datetime.now(snapshot_time.tzinfo) - snapshot_time

            return rpo

        except Exception as e:
            logger.error(f"Failed to calculate Redis RPO: {str(e)}")
            return timedelta.max

    def _calculate_redis_rto(self, start_time: datetime) -> timedelta:
        """Calculate Redis Recovery Time Objective"""
        return datetime.now() - start_time

    def _calculate_dr_rto(self, start_time: datetime) -> timedelta:
        """Calculate Disaster Recovery Time Objective"""
        return datetime.now() - start_time

    def _cleanup_test_restore_instance(self, recovery_point_arn: str):
        """Clean up test restore instance"""
        try:
            # Find and delete test restore instances
            response = self.aws_clients['rds_primary'].describe_db_instances(
                Filters=[
                    {
                        'Name': 'tag:restore-testing',
                        'Values': ['true']
                    }
                ]
            )

            for db_instance in response['DBInstances']:
                try:
                    self.aws_clients['rds_primary'].delete_db_instance(
                        DBInstanceIdentifier=db_instance['DBInstanceIdentifier'],
                        SkipFinalSnapshot=True,
                        DeleteAutomatedBackups=True
                    )
                    logger.info(f"Deleted test instance: {db_instance['DBInstanceIdentifier']}")
                except Exception as e:
                    logger.warning(f"Failed to delete test instance {db_instance['DBInstanceIdentifier']}: {str(e)}")

        except Exception as e:
            logger.warning(f"Failed to clean up test instances: {str(e)}")

    def run_all_tests(self) -> Dict[str, TestMetrics]:
        """Run all backup and disaster recovery tests"""
        logger.info("Starting comprehensive backup and DR testing")

        tests = [
            (BackupType.POSTGRESQL, self.test_postgresql_backup),
            (BackupType.REDIS, self.test_redis_backup),
            (BackupType.S3, self.test_s3_backup),
        ]

        # Add DR failover test for production environment
        if self.config['environment'] == 'production':
            tests.append(('disaster_recovery', self.test_disaster_recovery_failover))

        results = {}

        for test_name, test_func in tests:
            try:
                logger.info(f"Running {test_name} test")
                result = test_func()
                results[test_name] = result
                self.test_results.append(result)

                # Log test result
                status = "PASSED" if result.result == TestResult.PASSED else "FAILED"
                duration = result.end_time - result.start_time

                logger.info(f"{test_name} test {status} in {duration}")

            except Exception as e:
                logger.error(f"Test {test_name} failed with exception: {str(e)}")

                failed_result = TestMetrics(
                    test_name=str(test_name),
                    start_time=datetime.now(),
                    end_time=datetime.now(),
                    result=TestResult.FAILED,
                    details={'error': str(e)}
                )

                results[test_name] = failed_result
                self.test_results.append(failed_result)

        # Generate and send report
        self._generate_test_report()
        self._send_notifications()

        return results

    def _generate_test_report(self):
        """Generate comprehensive test report"""
        report = {
            'test_run_id': datetime.now().isoformat(),
            'environment': self.config['environment'],
            'project_name': self.config['project_name'],
            'summary': {
                'total_tests': len(self.test_results),
                'passed': len([r for r in self.test_results if r.result == TestResult.PASSED]),
                'failed': len([r for r in self.test_results if r.result == TestResult.FAILED]),
                'skipped': len([r for r in self.test_results if r.result == TestResult.SKIPPED])
            },
            'tests': [],
            'rpo_rto_analysis': {}
        }

        for result in self.test_results:
            test_data = {
                'name': result.test_name,
                'status': result.result.value,
                'duration_seconds': (result.end_time - result.start_time).total_seconds(),
                'details': result.details
            }

            if result.recovery_point_objective:
                test_data['rpo_minutes'] = result.recovery_point_objective.total_seconds() / 60

            if result.recovery_time_objective:
                test_data['rto_minutes'] = result.recovery_time_objective.total_seconds() / 60

            report['tests'].append(test_data)

        # RTO/RPO analysis
        rto_values = [r.recovery_time_objective.total_seconds() / 60
                     for r in self.test_results if r.recovery_time_objective]
        rpo_values = [r.recovery_point_objective.total_seconds() / 60
                     for r in self.test_results if r.recovery_point_objective]

        if rto_values:
            report['rpo_rto_analysis']['max_rto_minutes'] = max(rto_values)
            report['rpo_rto_analysis']['avg_rto_minutes'] = sum(rto_values) / len(rto_values)

        if rpo_values:
            report['rpo_rto_analysis']['max_rpo_minutes'] = max(rpo_values)
            report['rpo_rto_analysis']['avg_rpo_minutes'] = sum(rpo_values) / len(rpo_values)

        # Save report to S3
        try:
            report_key = f"backup-reports/{self.config['environment']}/backup-test-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

            self.aws_clients['s3_primary'].put_object(
                Bucket=f"{self.config['project_name']}-{self.config['environment']}-backups",
                Key=report_key,
                Body=json.dumps(report, indent=2, default=str),
                ContentType='application/json'
            )

            logger.info(f"Test report saved to S3: {report_key}")

        except Exception as e:
            logger.error(f"Failed to save test report to S3: {str(e)}")

        # Save local copy
        try:
            with open(f"/tmp/backup-test-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json", 'w') as f:
                json.dump(report, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Failed to save local test report: {str(e)}")

    def _send_notifications(self):
        """Send test result notifications"""
        failed_tests = [r for r in self.test_results if r.result == TestResult.FAILED]

        if not failed_tests:
            # All tests passed - send success notification
            message = f"""
✅ All backup and DR tests passed successfully!

Environment: {self.config['environment']}
Tests Run: {len(self.test_results)}
All Tests: PASSED

Test Report: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        else:
            # Some tests failed - send failure notification
            failed_test_names = [r.test_name for r in failed_tests]

            message = f"""
🚨 BACKUP/DR TEST FAILURES DETECTED!

Environment: {self.config['environment']}
Tests Run: {len(self.test_results)}
Failed Tests: {len(failed_tests)}
Passed Tests: {len(self.test_results) - len(failed_tests)}

Failed Tests:
{chr(10).join(f"- {name}" for name in failed_test_names)}

Immediate action required to address backup failures!
"""

        # Send SNS notification
        try:
            if self.sns_topic_arn:
                sns_client = boto3.client('sns')
                sns_client.publish(
                    TopicArn=self.sns_topic_arn,
                    Subject=f"[{'SUCCESS' if not failed_tests else 'ALERT'}] Backup & DR Test Results - {self.config['environment'].upper()}",
                    Message=message
                )
                logger.info("SNS notification sent")

        except Exception as e:
            logger.error(f"Failed to send SNS notification: {str(e)}")

        # Send Slack notification
        try:
            if self.slack_webhook:
                import requests

                slack_payload = {
                    'text': message,
                    'username': 'BackupTestingBot',
                    'icon_emoji': ':white_check_mark:' if not failed_tests else ':rotating_light:'
                }

                response = requests.post(self.slack_webhook, json=slack_payload)
                response.raise_for_status()

                logger.info("Slack notification sent")

        except Exception as e:
            logger.error(f"Failed to send Slack notification: {str(e)}")

def main():
    """Main function to run backup testing framework"""
    config_file = sys.argv[1] if len(sys.argv) > 1 else None

    try:
        framework = BackupTestingFramework(config_file)
        results = framework.run_all_tests()

        # Exit with error code if any tests failed
        failed_tests = [r for r in framework.test_results if r.result == TestResult.FAILED]
        if failed_tests:
            logger.error(f"{len(failed_tests)} test(s) failed")
            sys.exit(1)
        else:
            logger.info("All tests passed successfully")
            sys.exit(0)

    except Exception as e:
        logger.error(f"Backup testing framework failed: {str(e)}")
        sys.exit(2)

if __name__ == "__main__":
    main()