#!/bin/bash

# Production backup strategy implementation
# Features: automated daily backups, point-in-time recovery, cross-region replication

set -euo pipefail

# Configuration
BACKUP_DIR=${BACKUP_DIR:-/var/lib/postgresql/backups}
RETENTION_DAYS=${RETENTION_DAYS:-30}
S3_BUCKET=${S3_BUCKET:-labelmint-backups}
S3_REPLICATION_BUCKET=${S3_REPLICATION_BUCKET:-labelmint-backups-dr}
POSTGRES_DB=${POSTGRES_DB:-labelmint_prod}
POSTGRES_USER=${POSTGRES_USER:-postgres}
BACKUP_TYPE=${BACKUP_TYPE:-full} # full, incremental, differential
REGION_PRIMARY=${AWS_REGION_PRIMARY:-us-east-1}
REGION_DR=${AWS_REGION_DR:-us-west-2}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Initialize backup directory
init_backup_env() {
    log "Initializing backup environment"

    mkdir -p "$BACKUP_DIR"/{full,incremental,differential,wal,metadata}
    mkdir -p "$BACKUP_DIR/tmp"

    # Create backup manifest
    cat > "$BACKUP_DIR/metadata/backup_manifest.json" <<EOF
{
    "initialized": "$(date -Iseconds)",
    "version": "1.0",
    "database": "$POSTGRES_DB",
    "retention_days": $RETENTION_DAYS,
    "s3_bucket": "$S3_BUCKET",
    "dr_bucket": "$S3_REPLICATION_BUCKET"
}
EOF

    log "Backup environment initialized"
}

# Perform full backup
perform_full_backup() {
    log "Starting full database backup"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/full/labelmint_full_$timestamp.dump"
    local backup_manifest="$BACKUP_DIR/full/labelmint_full_$timestamp.json"

    # Create backup
    pg_dump \
        --username="$POSTGRES_USER" \
        --dbname="$POSTGRES_DB" \
        --format=custom \
        --compress=9 \
        --verbose \
        --file="$backup_file"

    # Create backup manifest
    local backup_size=$(du -h "$backup_file" | cut -f1)
    local backup_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
    local wal_start=$(psql -t -A -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_walfile_name(pg_current_wal_lsn());")
    local wal_end=$(psql -t -A -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_walfile_name(pg_current_wal_lsn());")

    cat > "$backup_manifest" <<EOF
{
    "type": "full",
    "timestamp": "$(date -Iseconds)",
    "file": "$(basename "$backup_file")",
    "size": "$backup_size",
    "checksum": "$backup_checksum",
    "wal_start": "$wal_start",
    "wal_end": "$wal_end",
    "database": "$POSTGRES_DB",
    "postgres_version": "$(psql -t -A -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version();")"
}
EOF

    # Upload to S3 (primary region)
    log "Uploading backup to S3 primary region ($REGION_PRIMARY)"
    aws s3 cp "$backup_file" "s3://$S3_BUCKET/full/" --storage-class STANDARD_IA
    aws s3 cp "$backup_manifest" "s3://$S3_BUCKET/full/" --storage-class STANDARD_IA

    # Replicate to DR region
    log "Replicating backup to DR region ($REGION_DR)"
    aws s3 cp "$backup_file" "s3://$S3_REPLICATION_BUCKET/full/" --storage-class GLACIER_IR --region "$REGION_DR"
    aws s3 cp "$backup_manifest" "s3://$S3_REPLICATION_BUCKET/full/" --storage-class GLACIER_IR --region "$REGION_DR"

    # Verify backup integrity
    verify_backup "$backup_file" "$backup_checksum"

    log "Full backup completed successfully: $backup_file ($backup_size)"

    # Clean up local file (keep only latest)
    find "$BACKUP_DIR/full" -name "*.dump" -mtime +1 -delete
    find "$BACKUP_DIR/full" -name "*.json" -mtime +1 -delete

    # Update latest backup symlink
    ln -sf "$backup_file" "$BACKUP_DIR/latest.dump"
    ln -sf "$backup_manifest" "$BACKUP_DIR/latest.json"
}

# Perform incremental backup (using WAL archiving)
perform_incremental_backup() {
    log "Starting incremental backup (WAL archiving)"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local wal_dir="$BACKUP_DIR/wal/$timestamp"
    mkdir -p "$wal_dir"

    # Force WAL switch
    local wal_file=$(psql -t -A -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_walfile_name(pg_switch_wal());")

    # Archive WAL files
    pg_receivewal \
        --directory="$wal_dir" \
        --username="$REPLICA_USER" \
        --host=localhost \
        --port=5432 \
        --verbose \
        --compress=9 \
        --slot=backup_slot \
        --create-slot

    # Create tarball
    local wal_archive="$BACKUP_DIR/incremental/labelmint_wal_$timestamp.tar.gz"
    tar -czf "$wal_archive" -C "$BACKUP_DIR/wal" "$timestamp"

    # Upload to S3
    aws s3 cp "$wal_archive" "s3://$S3_BUCKET/incremental/" --storage-class STANDARD_IA

    # Clean up
    rm -rf "$wal_dir"

    log "Incremental backup completed: $wal_archive"
}

# Point-in-time recovery
perform_pitr() {
    local target_time=${1:-$(date -d '1 hour ago' -Iseconds)}
    local recovery_dir="$BACKUP_DIR/tmp/recovery_$(date +%s)"

    log "Starting point-in-time recovery to: $target_time"

    mkdir -p "$recovery_dir"

    # Find latest full backup before target time
    local latest_backup=$(aws s3 ls "s3://$S3_BUCKET/full/" | grep '\.dump$' | sort -r | head -n1 | awk '{print $4}')

    if [[ -z "$latest_backup" ]]; then
        error "No suitable backup found for recovery"
    fi

    # Download full backup
    log "Downloading backup: $latest_backup"
    aws s3 cp "s3://$S3_BUCKET/full/$latest_backup" "$recovery_dir/"

    # Restore backup
    pg_restore \
        --username="$POSTGRES_USER" \
        --dbname="labelmint_recovery" \
        --verbose \
        --clean \
        --if-exists \
        "$recovery_dir/$latest_backup"

    # Apply WAL files for point-in-time recovery
    cat > "$recovery_dir/recovery.conf" <<EOF
restore_command = 'aws s3 cp s3://$S3_BUCKET/wal/%f %p'
recovery_target_time = '$target_time'
recovery_target_action = 'promote'
EOF

    log "Recovery prepared. Review data in 'labelmint_recovery' database before promoting."
    log "Recovery command: SELECT pg_promote();"
}

# Verify backup integrity
verify_backup() {
    local backup_file=$1
    local expected_checksum=$2

    log "Verifying backup integrity: $backup_file"

    # Check file exists and is not empty
    if [[ ! -s "$backup_file" ]]; then
        error "Backup file is empty or missing"
    fi

    # Verify checksum
    local actual_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
    if [[ "$actual_checksum" != "$expected_checksum" ]]; then
        error "Backup checksum mismatch: expected $expected_checksum, got $actual_checksum"
    fi

    # Test restoreability (dry run)
    pg_restore \
        --username="$POSTGRES_USER" \
        --list \
        "$backup_file" > /dev/null 2>&1

    if [[ $? -ne 0 ]]; then
        error "Backup file is not restorable"
    fi

    log "Backup integrity verified"
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days"

    # Clean S3 primary
    aws s3 ls "s3://$S3_BUCKET/full/" | while read -r line; do
        local date=$(echo "$line" | awk '{print $1" "$2}')
        local filename=$(echo "$line" | awk '{print $4}')

        local file_date=$(date -d "$date" +%s)
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%s)

        if [[ $file_date -lt $cutoff_date ]]; then
            log "Deleting old backup: $filename"
            aws s3 rm "s3://$S3_BUCKET/full/$filename"
        fi
    done

    # Clean S3 DR (move to Glacier)
    aws s3 ls "s3://$S3_REPLICATION_BUCKET/full/" | while read -r line; do
        local date=$(echo "$line" | awk '{print $1" "$2}')
        local filename=$(echo "$line" | awk '{print $4}')

        local file_date=$(date -d "$date" +%s)
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%s)

        if [[ $file_date -lt $cutoff_date ]]; then
            log "Archiving old backup to Glacier: $filename"
            aws s3 mv "s3://$S3_REPLICATION_BUCKET/full/$filename" "s3://$S3_REPLICATION_BUCKET/full/archive/$filename" --storage-class GLACIER
        fi
    done

    log "Backup cleanup completed"
}

# Test backup restoration
test_backup_restoration() {
    log "Testing backup restoration"

    local test_db="labelmint_test_$(date +%s)"
    local test_backup=$(ls -t "$BACKUP_DIR/full"/*.dump | head -n1)

    if [[ -z "$test_backup" ]]; then
        error "No backup found for testing"
    fi

    # Create test database
    createdb -U "$POSTGRES_USER" "$test_db"

    # Restore backup
    pg_restore \
        --username="$POSTGRES_USER" \
        --dbname="$test_db" \
        --verbose \
        --clean \
        --if-exists \
        "$test_backup"

    # Verify data integrity
    local table_count=$(psql -t -A -U "$POSTGRES_USER" -d "$test_db" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

    if [[ $table_count -gt 0 ]]; then
        log "Backup test successful: $table_count tables restored"
    else
        error "Backup test failed: no tables restored"
    fi

    # Clean up test database
    dropdb -U "$POSTGRES_USER" "$test_db"

    log "Backup restoration test completed successfully"
}

# Setup cron jobs for automated backups
setup_backup_cron() {
    log "Setting up automated backup cron jobs"

    # Daily full backup at 2 AM
    (crontab -l 2>/dev/null; echo "0 2 * * * $0 full >> /var/log/postgres_backup.log 2>&1") | crontab -

    # Hourly incremental backup
    (crontab -l 2>/dev/null; echo "0 * * * * $0 incremental >> /var/log/postgres_backup.log 2>&1") | crontab -

    # Weekly backup testing
    (crontab -l 2>/dev/null; echo "0 3 * * 0 $0 test >> /var/log/postgres_backup.log 2>&1") | crontab -

    # Daily cleanup
    (crontab -l 2>/dev/null; echo "0 4 * * * $0 cleanup >> /var/log/postgres_backup.log 2>&1") | crontab -

    log "Cron jobs configured successfully"
}

# Send backup status notification
send_notification() {
    local status=$1
    local message=$2

    # Send to Slack
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        [[ $status == "error" ]] && color="danger"
        [[ $status == "warning" ]] && color="warning"

        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"PostgreSQL Backup: $status\",\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$SLACK_WEBHOOK_URL"
    fi

    # Send email
    if [[ -n "${ALERT_EMAIL:-}" ]]; then
        echo "$message" | mail -s "PostgreSQL Backup: $status" "$ALERT_EMAIL"
    fi
}

# Main execution
case ${1:-help} in
    init)
        init_backup_env
        ;;
    full)
        init_backup_env
        perform_full_backup
        send_notification "success" "Full backup completed successfully"
        ;;
    incremental)
        perform_incremental_backup
        send_notification "success" "Incremental backup completed successfully"
        ;;
    pitr)
        perform_pitr "${2:-}"
        ;;
    test)
        test_backup_restoration
        send_notification "success" "Backup restoration test passed"
        ;;
    cleanup)
        cleanup_old_backups
        ;;
    setup)
        setup_backup_cron
        ;;
    verify)
        verify_backup "${2:-$BACKUP_DIR/latest.dump}" "${3:-}"
        ;;
    *)
        echo "Usage: $0 {init|full|incremental|pitr [time]|test|cleanup|setup|verify [file] [checksum]}"
        echo ""
        echo "Commands:"
        echo "  init          Initialize backup environment"
        echo "  full          Perform full backup"
        echo "  incremental  Perform incremental backup (WAL)"
        echo "  pitr [time]   Point-in-time recovery"
        echo "  test          Test backup restoration"
        echo "  cleanup       Clean up old backups"
        echo "  setup         Setup automated cron jobs"
        echo "  verify        Verify backup integrity"
        exit 1
        ;;
esac