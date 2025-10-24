# Backup and Restoration Runbook

## Overview

This runbook covers backup strategies, restoration procedures, and disaster recovery for the Telegram Labeling Platform.

## Backup Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Primary Data  │────│   Backup Agent  │────│   Local Backup  │
│   (Database)    │    │                 │    │    Storage      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌─────────────────┐           │
                       │  Cloud Storage  │───────────┘
                       │   (S3/Glacier)  │
                       └─────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │────│   File Backup   │────│   Version Control│
│   Data/Config   │    │                 │    │   (Git)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Backup Strategy

### 1. Database Backups

#### Automated Daily Backups

```bash
#!/bin/bash
# /scripts/backup-database.sh

set -euo pipefail

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/database"
RETENTION_DAYS=30
S3_BUCKET="s3://labelmint-backups/database"
DB_NAME="labeling_platform"
DB_USER="labeling_user"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "=== Starting Database Backup: $TIMESTAMP ==="

# Create compressed custom format backup
docker-compose exec -T postgres pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --compress=9 \
  --verbose \
  --jobs=4 \
  --file="/backups/db_backup_${TIMESTAMP}.dump"

# Verify backup integrity
echo "Verifying backup integrity..."
docker-compose exec postgres pg_restore \
  --list "/backups/db_backup_${TIMESTAMP}.dump" \
  > "${BACKUP_DIR}/backup_list_${TIMESTAMP}.txt" 2>&1

# Check backup file exists and is not empty
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.dump"
if [ ! -s "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file is empty or missing!"
    exit 1
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created successfully: $BACKUP_SIZE"

# Upload to S3
echo "Uploading to S3..."
aws s3 cp "$BACKUP_FILE" "${S3_BUCKET}/${TIMESTAMP}/" \
  --storage-class STANDARD_IA \
  --metadata backup-timestamp="$TIMESTAMP"

# Upload backup list
aws s3 cp "${BACKUP_DIR}/backup_list_${TIMESTAMP}.txt" "${S3_BUCKET}/${TIMESTAMP}/"

# Create S3 glacier copy for long-term storage
if [ $(date +%u) -eq 0 ]; then  # Sunday
    aws s3 cp "$BACKUP_FILE" "${S3_BUCKET}-glacier/${TIMESTAMP}/" \
      --storage-class GLACIER
fi

# Clean local backups (keep last 7 days)
find "$BACKUP_DIR" -name "db_backup_*.dump" -mtime +7 -delete
find "$BACKUP_DIR" -name "backup_list_*.txt" -mtime +7 -delete

# Clean S3 (apply lifecycle policy)
aws s3api put-bucket-lifecycle-configuration \
  --bucket labelmint-backups \
  --lifecycle-configuration file://s3-lifecycle.json

# Send notification
curl -X POST https://hooks.slack.com/services/xxx/yyy/zzz \
  -H 'Content-type: application/json' \
  --data "{\"text\":\"✅ Database backup completed: $BACKUP_SIZE\"}"

echo "=== Database Backup Complete: $TIMESTAMP ==="
```

#### Continuous WAL Archiving

```sql
-- postgresql.conf configuration
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://labelmint-backups/wal/%f --storage-class STANDARD_IA'
archive_timeout = 300
max_wal_senders = 3
wal_keep_segments = 64
wal_compression = on
```

#### Point-in-Time Recovery Setup

```bash
#!/bin/bash
# /scripts/setup-pitr.sh

echo "Setting up Point-in-Time Recovery..."

# Create recovery configuration
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'aws s3 cp s3://labelmint-backups/wal/%f %p'
recovery_target_time = ''
standby_mode = on
primary_conninfo = 'host=primary-db port=5432 user=replicator'
EOF

# Test recovery configuration
docker-compose exec postgres pg_ctl start -D /var/lib/postgresql/data

echo "PITR setup complete"
```

### 2. Application Backups

#### File System Backup

```bash
#!/bin/bash
# /scripts/backup-files.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/files"

# Backup user uploads
echo "Backing up user uploads..."
tar -czf "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" \
  /app/uploads/ \
  --exclude='*.tmp' \
  --exclude='cache/*'

# Backup configuration
echo "Backing up configuration..."
tar -czf "${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz" \
  .env \
  docker-compose.yml \
  nginx/ \
  monitoring/ \
  scripts/

# Backup SSL certificates
echo "Backing up SSL certificates..."
tar -czf "${BACKUP_DIR}/ssl_${TIMESTAMP}.tar.gz" \
  /etc/nginx/ssl/ \
  /etc/letsencrypt/

# Upload to S3
aws s3 sync "${BACKUP_DIR}/" "s3://labelmint-backups/files/${TIMESTAMP}/"

# Clean old backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
```

#### Code Repository Backup

```bash
#!/bin/bash
# /scripts/backup-code.sh

REPO_DIR="/opt/telegram-labeling-platform"
BACKUP_DIR="/backups/code"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create bare backup
cd "$REPO_DIR"
git bundle create "${BACKUP_DIR}/repo_${TIMESTAMP}.bundle" --all

# Tag backup
git tag -a "backup-${TIMESTAMP}" -m "Automatic backup ${TIMESTAMP}"

# Push tags to remote
git push origin --tags

# Archive branches
git branch -a > "${BACKUP_DIR}/branches_${TIMESTAMP}.txt"
git log --oneline --graph --all > "${BACKUP_DIR}/commits_${TIMESTAMP}.txt"
```

### 3. System State Backup

```bash
#!/bin/bash
# /scripts/backup-system.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/system"

# Backup Docker volumes
echo "Backing up Docker volumes..."
docker run --rm -v postgres_data:/data -v "$BACKUP_DIR":/backup \
  alpine tar czf /backup/postgres_volume_${TIMESTAMP}.tar.gz -C /data .

docker run --rm -v redis_data:/data -v "$BACKUP_DIR":/backup \
  alpine tar czf /backup/redis_volume_${TIMESTAMP}.tar.gz -C /data .

# Backup running containers state
docker-compose ps > "${BACKUP_DIR}/containers_${TIMESTAMP}.txt"
docker stats --no-stream > "${BACKUP_DIR}/stats_${TIMESTAMP}.txt"

# Backup system configuration
cp -r /etc/nginx/ "${BACKUP_DIR}/nginx_${TIMESTAMP}/"
cp -r /etc/systemd/system/ "${BACKUP_DIR}/systemd_${TIMESTAMP}/"
```

## Restoration Procedures

### 1. Full System Restoration

#### Emergency Recovery from Scratch

```bash
#!/bin/bash
# /scripts/emergency-restore.sh

BACKUP_TIMESTAMP=$1
BACKUP_DIR="/backups"

if [ -z "$BACKUP_TIMESTAMP" ]; then
    echo "Usage: $0 <backup_timestamp>"
    echo "Available backups:"
    aws s3 ls s3://labelmint-backups/database/ | grep PRE
    exit 1
fi

echo "=== EMERGENCY RESTORATION: $BACKUP_TIMESTAMP ==="

# 1. Stop all services
echo "Stopping all services..."
docker-compose down

# 2. Restore system state
echo "Restoring system configuration..."
tar -xzf "${BACKUP_DIR}/system/nginx_${BACKUP_TIMESTAMP}.tar.gz" -C /
systemctl daemon-reload

# 3. Restore Docker volumes
echo "Restoring Docker volumes..."
docker run --rm -v postgres_data:/data -v "${BACKUP_DIR}":/backup \
  alpine tar xzf /backup/postgres_volume_${BACKUP_TIMESTAMP}.tar.gz -C /data

docker run --rm -v redis_data:/data -v "${BACKUP_DIR}":/backup \
  alpine tar xzf /backup/redis_volume_${BACKUP_TIMESTAMP}.tar.gz -C /data

# 4. Restore configuration
echo "Restoring application configuration..."
tar -xzf "${BACKUP_DIR}/config_${BACKUP_TIMESTAMP}.tar.gz"

# 5. Start database services
echo "Starting database services..."
docker-compose up -d postgres redis

# Wait for database to be ready
sleep 30

# 6. Restore database
echo "Restoring database..."
aws s3 cp "s3://labelmint-backups/database/${BACKUP_TIMESTAMP}/db_backup_${BACKUP_TIMESTAMP}.dump" \
  /tmp/restore.dump

docker-compose exec -T postgres pg_restore \
  -U labeling_user \
  -d labeling_platform \
  --clean --if-exists \
  --verbose \
  /tmp/restore.dump

# 7. Restore file uploads
echo "Restoring file uploads..."
aws s3 cp "s3://labelmint-backups/files/${BACKUP_TIMESTAMP}/uploads_${BACKUP_TIMESTAMP}.tar.gz" \
  /tmp/uploads.tar.gz
tar -xzf /tmp/uploads.tar.gz -C /

# 8. Restore SSL certificates
echo "Restoring SSL certificates..."
aws s3 cp "s3://labelmint-backups/files/${BACKUP_TIMESTAMP}/ssl_${BACKUP_TIMESTAMP}.tar.gz" \
  /tmp/ssl.tar.gz
tar -xzf /tmp/ssl.tar.gz -C /

# 9. Start all services
echo "Starting all services..."
docker-compose up -d

# 10. Verify restoration
echo "Verifying restoration..."
sleep 60

# Check database
docker-compose exec postgres pg_isready

# Check API
curl -f https://api.labelmint.it/health

# Check bot
curl https://api.telegram.org/bot$BOT_TOKEN/getMe

# 11. Send notification
curl -X POST https://hooks.slack.com/services/xxx/yyy/zzz \
  -H 'Content-type: application/json' \
  --data "{\"text\":\"🚨 Emergency restoration completed: $BACKUP_TIMESTAMP\"}"

echo "=== EMERGENCY RESTORATION COMPLETE ==="
```

### 2. Point-in-Time Recovery

#### Restore to Specific Time

```bash
#!/bin/bash
# /scripts/pitr-restore.sh

RECOVERY_TIME=$1  # Format: "2024-01-15 14:30:00 UTC"

if [ -z "$RECOVERY_TIME" ]; then
    echo "Usage: $0 'YYYY-MM-DD HH:MM:SS UTC'"
    exit 1
fi

echo "Starting Point-in-Time Recovery to: $RECOVERY_TIME"

# 1. Stop applications
docker-compose stop backend bot

# 2. Restore base backup
LATEST_BACKUP=$(aws s3 ls s3://labelmint-backups/database/ \
  | grep PRE | sort | tail -1 | awk '{print $2}')

echo "Using base backup: $LATEST_BACKUP"

aws s3 cp "s3://labelmint-backups/database/${LATEST_BACKUP}db_backup_*.dump" \
  /tmp/base_backup.dump

docker-compose exec postgres pg_restore \
  -U labeling_user \
  -d labeling_platform \
  --clean --if-exists \
  /tmp/base_backup.dump

# 3. Configure recovery
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'aws s3 cp s3://labelmint-backups/wal/%f %p'
recovery_target_time = '$RECOVERY_TIME'
recovery_target_action = 'promote'
EOF

# 4. Start PostgreSQL in recovery mode
docker-compose restart postgres

# 5. Monitor recovery progress
while true; do
    if docker-compose exec postgres pg_isready -q; then
        echo "Recovery completed"
        break
    fi
    echo "Recovery in progress..."
    sleep 10
done

# 6. Verify recovery
docker-compose exec postgres psql -U labeling_user -c "SELECT NOW();"

# 7. Start applications
docker-compose start backend bot

echo "Point-in-Time Recovery completed"
```

### 3. Selective Restoration

#### Restore Single Table

```sql
-- Create temporary database
CREATE DATABASE temp_restore;

-- Restore backup to temp database
pg_restore -U labeling_user -d temp_restore \
  --clean --if-exists /backups/db_backup_20240115.dump

-- Copy specific table
CREATE TABLE tasks_backup AS TABLE temp_restore.tasks;

-- Drop temporary database
DROP DATABASE temp_restore;

-- Restore data to original table
INSERT INTO tasks SELECT * FROM tasks_backup
WHERE id NOT IN (SELECT id FROM tasks);

DROP TABLE tasks_backup;
```

#### Restore User Data

```bash
#!/bin/bash
# /scripts/restore-user-data.sh

USER_ID=$1

echo "Restoring data for user: $USER_ID"

# Restore from database
docker-compose exec postgres psql -U labeling_user -d labeling_platform << EOF
-- Restore tasks
DELETE FROM tasks WHERE user_id = $USER_ID;
INSERT INTO tasks SELECT * FROM temp_tasks WHERE user_id = $USER_ID;

-- Restore results
DELETE FROM task_results WHERE worker_id = $USER_ID;
INSERT INTO task_results SELECT * FROM temp_results WHERE worker_id = $USER_ID;

-- Restore transactions
DELETE FROM worker_transactions WHERE worker_id = $USER_ID;
INSERT INTO worker_transactions SELECT * FROM temp_transactions WHERE worker_id = $USER_ID;
EOF

# Restore file uploads
aws s3 sync "s3://labelmint-backups/user-data/$USER_ID/" \
  "/app/uploads/user_$USER_ID/"
```

## Disaster Recovery Testing

### Monthly DR Drill

```bash
#!/bin/bash
# /scripts/dr-drill.sh

DR_DATE=$(date +%Y%m%d)
DR_ENV="dr-$DR_DATE"
BACKUP_TIMESTAMP=$(aws s3 ls s3://labelmint-backups/database/ \
  | grep PRE | sort | tail -1 | awk '{print $2}')

echo "=== Disaster Recovery Drill: $DR_DATE ==="

# 1. Create DR environment
echo "Creating DR environment..."
docker network create "$DR_ENV"
docker-compose -p "$DR_ENV" -f docker-compose.dr.yml up -d

# 2. Restore latest backup to DR
echo "Restoring backup to DR environment..."
DR_ENV_BACKUP_DIR="/tmp/dr-$DR_DATE"
mkdir -p "$DR_ENV_BACKUP_DIR"

aws s3 cp "s3://labelmint-backups/database/${BACKUP_TIMESTAMP}db_backup_*.dump" \
  "$DR_ENV_BACKUP_DIR/"

docker-compose -p "$DR_ENV" exec postgres pg_restore \
  -U labeling_user \
  -d labeling_platform \
  --clean --if-exists \
  "$DR_ENV_BACKUP_DIR/db_backup_${BACKUP_TIMESTAMP}.dump"

# 3. Run smoke tests
echo "Running smoke tests..."
./scripts/smoke-tests.sh --env "$DR_ENV"

# 4. Measure RTO/RPO
echo "Measuring recovery metrics..."
START_TIME=$(date +%s)
# Recovery happens here
END_TIME=$(date +%s)
RTO=$((END_TIME - START_TIME))

echo "Recovery Time Objective (RTO): ${RTO} seconds"

# Calculate RPO (time since last backup)
BACKUP_TIME=$(date -d "${BACKUP_TIMESTAMP:0:8} ${BACKUP_TIMESTAMP:9:6}" +%s)
CURRENT_TIME=$(date +%s)
RPO=$((CURRENT_TIME - BACKUP_TIME))

echo "Recovery Point Objective (RPO): ${RPO} seconds"

# 5. Generate DR report
cat > "/reports/dr-report-$DR_DATE.md" << EOF
# Disaster Recovery Report - $DR_DATE

## Metrics
- RTO: ${RTO} seconds
- RPO: ${RPO} seconds
- Backup Used: $BACKUP_TIMESTAMP
- Tests Run: $(cat /tmp/test-results.json | jq '.total')
- Tests Passed: $(cat /tmp/test-results.json | jq '.passed')
- Success Rate: $(cat /tmp/test-results.json | jq '.success_rate')%

## Issues Found
$(cat /tmp/test-results.json | jq -r '.issues[]?')

## Recommendations
EOF

# 6. Clean up DR environment
echo "Cleaning up DR environment..."
docker-compose -p "$DR_ENV" down -v
docker network rm "$DR_ENV"

# 7. Send report
curl -X POST https://hooks.slack.com/services/xxx/yyy/zzz \
  -H 'Content-type: application/json' \
  --data "{\"text\":\"DR Drill completed. RTO: ${RTO}s, RPO: ${RPO}s\"}"

echo "=== Disaster Recovery Drill Complete ==="
```

## Backup Verification

### Daily Backup Validation

```bash
#!/bin/bash
# /scripts/verify-backups.sh

echo "Verifying backup integrity..."

# Check latest backup
LATEST_BACKUP=$(aws s3 ls s3://labelmint-backups/database/ \
  | grep PRE | sort | tail -1 | awk '{print $2}')

echo "Checking backup: $LATEST_BACKUP"

# Download backup for verification
aws s3 cp "s3://labelmint-backups/database/${LATEST_BACKUP}db_backup_*.dump" \
  /tmp/verify_backup.dump

# Verify backup can be restored
docker-compose exec -T postgres pg_restore \
  --list /tmp/verify_backup.dump \
  > /tmp/backup_list.txt 2>&1

# Check for errors
if grep -q "ERROR" /tmp/backup_list.txt; then
    echo "ERROR: Backup verification failed!"
    grep "ERROR" /tmp/backup_list.txt
    exit 1
fi

# Test restore to temporary database
docker-compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS verify_test;"
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE verify_test;"
docker-compose exec postgres pg_restore -U labeling_user -d verify_test /tmp/verify_backup.dump

# Verify data integrity
RESULT_COUNT=$(docker-compose exec postgres psql -U labeling_user -d verify_test -t -c "SELECT count(*) FROM tasks;")
echo "Tasks in backup: $RESULT_COUNT"

if [ "$RESULT_COUNT" -lt 1000 ]; then
    echo "WARNING: Backup seems incomplete (only $RESULT_COUNT tasks)"
fi

# Clean up
docker-compose exec postgres psql -U postgres -c "DROP DATABASE verify_test;"
rm /tmp/verify_backup.dump /tmp/backup_list.txt

echo "Backup verification completed successfully"
```

## Recovery Time Objectives

| Service Type | RTO Target | RPO Target |
|--------------|------------|------------|
| Database | 1 hour | 15 minutes |
| Application | 30 minutes | 4 hours |
| File Storage | 2 hours | 24 hours |
| Configuration | 15 minutes | 1 hour |

## Emergency Contact

For emergency restoration assistance:

- **Primary**: oncall@labelmint.it (Response: 15 min)
- **Secondary**: infra@labelmint.it (Response: 1 hour)
- **Tertiary**: cto@labelmint.it (Critical incidents only)

## Related Runbooks

- [Incident Response](./incident-response.md)
- [Database Maintenance](./database-maintenance.md)
- [Security Incidents](./security-incidents.md)