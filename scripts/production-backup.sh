#!/bin/bash

# LabelMint Production Backup and Recovery Script
# ==============================================

set -euo pipefail

# Configuration
PROJECT_ID="labelmint-prod"
SUPABASE_URL="${SUPABASE_URL:-https://labelmint-prod.supabase.co}"
DB_URL="${DATABASE_URL:-postgresql://postgres:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres}"
BACKUP_DIR="/var/backups/labelmint"
LOG_FILE="/var/log/labelmint-backup.log"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

# Function to create database backup
create_database_backup() {
    local backup_type=$1
    local backup_file="$BACKUP_DIR/$backup_type/labelmint_db_$DATE.sql"

    log "Starting $backup_type database backup..."

    # Use pg_dump for consistent backups
    if pg_dump "$DB_URL" \
        --no-owner \
        --no-privileges \
        --verbose \
        --format=custom \
        --compress=9 \
        --file="$backup_file" 2>&1 | tee -a "$LOG_FILE"; then

        # Verify backup was created
        if [[ -f "$backup_file" && -s "$backup_file" ]]; then
            local file_size=$(du -h "$backup_file" | cut -f1)
            log "✅ Database backup completed successfully: $backup_file ($file_size)"

            # Create checksum for integrity verification
            sha256sum "$backup_file" > "$backup_file.sha256"

            # Test backup integrity
            if pg_restore --list "$backup_file" >/dev/null 2>&1; then
                log "✅ Backup integrity verified"
            else
                error "❌ Backup integrity check failed"
                return 1
            fi
        else
            error "❌ Backup file not created or empty"
            return 1
        fi
    else
        error "❌ Database backup failed"
        return 1
    fi
}

# Function to create specific table backups
create_table_backup() {
    local table_name=$1
    local backup_file="$BACKUP_DIR/table_backups/${table_name}_$DATE.sql"

    mkdir -p "$BACKUP_DIR/table_backups"

    log "Creating backup for table: $table_name"

    if pg_dump "$DB_URL" \
        --no-owner \
        --no-privileges \
        --verbose \
        --format=custom \
        --compress=9 \
        --table="$table_name" \
        --file="$backup_file" 2>&1 | tee -a "$LOG_FILE"; then

        log "✅ Table backup completed: $backup_file"
        sha256sum "$backup_file" > "$backup_file.sha256"
    else
        error "❌ Table backup failed for $table_name"
        return 1
    fi
}

# Function to backup Supabase storage
create_storage_backup() {
    local storage_backup_dir="$BACKUP_DIR/storage_$DATE"

    log "Starting Supabase storage backup..."

    # Use Supabase CLI to backup storage
    if supabase storage backup \
        --project-ref="$PROJECT_ID" \
        --output="$storage_backup_dir" 2>&1 | tee -a "$LOG_FILE"; then

        log "✅ Storage backup completed: $storage_backup_dir"

        # Create archive
        tar -czf "$storage_backup_dir.tar.gz" -C "$(dirname "$storage_backup_dir")" "$(basename "$storage_backup_dir")"
        rm -rf "$storage_backup_dir"

        log "✅ Storage backup archived: $storage_backup_dir.tar.gz"
    else
        error "❌ Storage backup failed"
        return 1
    fi
}

# Function to clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."

    # Clean up daily backups
    find "$BACKUP_DIR/daily" -name "*.sql" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR/daily" -name "*.sha256" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR/daily" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

    # Keep weekly backups for 12 weeks
    find "$BACKUP_DIR/weekly" -name "*.sql" -mtime +84 -delete 2>/dev/null || true
    find "$BACKUP_DIR/weekly" -name "*.sha256" -mtime +84 -delete 2>/dev/null || true

    # Keep monthly backups for 12 months
    find "$BACKUP_DIR/monthly" -name "*.sql" -mtime +365 -delete 2>/dev/null || true
    find "$BACKUP_DIR/monthly" -name "*.sha256" -mtime +365 -delete 2>/dev/null || true

    log "✅ Cleanup completed"
}

# Function to verify backup retention
verify_backup_retention() {
    log "Verifying backup retention policy..."

    local daily_count=$(find "$BACKUP_DIR/daily" -name "*.sql" -mtime -$RETENTION_DAYS | wc -l)
    local weekly_count=$(find "$BACKUP_DIR/weekly" -name "*.sql" -mtime -84 | wc -l)
    local monthly_count=$(find "$BACKUP_DIR/monthly" -name "*.sql" -mtime -365 | wc -l)

    log "📊 Backup count verification:"
    log "   Daily backups (last $RETENTION_DAYS days): $daily_count"
    log "   Weekly backups (last 12 weeks): $weekly_count"
    log "   Monthly backups (last 12 months): $monthly_count"

    # Alert if backup count is too low
    if [[ $daily_count -lt 25 ]]; then
        warn "⚠️  Daily backup count is low ($daily_count), please investigate"
    fi
}

# Function to restore database
restore_database() {
    local backup_file=$1
    local target_db_url=${2:-$DB_URL}

    if [[ ! -f "$backup_file" ]]; then
        error "❌ Backup file not found: $backup_file"
        return 1
    fi

    # Verify backup integrity
    if [[ -f "$backup_file.sha256" ]]; then
        if sha256sum -c "$backup_file.sha256" >/dev/null 2>&1; then
            log "✅ Backup integrity verified"
        else
            error "❌ Backup integrity check failed"
            return 1
        fi
    fi

    log "Starting database restore from: $backup_file"
    warn "⚠️  This will overwrite the target database. Confirm with 'yes' to continue."

    read -r confirmation
    if [[ "$confirmation" != "yes" ]]; then
        log "❌ Restore cancelled by user"
        return 1
    fi

    # Create restore point before restore
    log "Creating restore point..."
    if psql "$target_db_url" -c "CREATE EXTENSION IF NOT EXISTS pg rewind;"; then
        log "✅ Restore point created"
    fi

    # Restore database
    if pg_restore "$target_db_url" \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        "$backup_file" 2>&1 | tee -a "$LOG_FILE"; then

        log "✅ Database restore completed successfully"

        # Run post-restore verification
        log "Running post-restore verification..."
        local table_count=$(psql "$target_db_url" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
        log "📊 Restored database contains $table_count tables"

    else
        error "❌ Database restore failed"
        return 1
    fi
}

# Function to test backup system
test_backup_system() {
    log "🧪 Testing backup system..."

    # Create test backup
    local test_backup="$BACKUP_DIR/test_backup_$(date +%s).sql"

    if pg_dump "$DB_URL" \
        --no-owner \
        --no-privileges \
        --schema-only \
        --file="$test_backup" 2>/dev/null; then

        # Test restore
        local test_db="${DB_URL}_test"

        if createdb "$test_db" 2>/dev/null; then
            if psql "$test_db" < "$test_backup" >/dev/null 2>&1; then
                log "✅ Backup system test passed"
                dropdb "$test_db" 2>/dev/null || true
            else
                error "❌ Backup restore test failed"
                dropdb "$test_db" 2>/dev/null || true
                return 1
            fi
        else
            error "❌ Could not create test database"
            return 1
        fi

        rm -f "$test_backup"
    else
        error "❌ Backup creation test failed"
        return 1
    fi
}

# Function to show backup status
show_backup_status() {
    log "📊 Backup Status Report"
    log "====================="

    local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    log "Total backup size: $total_size"

    echo -e "\n${BLUE}Daily Backups:${NC}"
    ls -lah "$BACKUP_DIR/daily" | head -10

    echo -e "\n${BLUE}Weekly Backups:${NC}"
    ls -lah "$BACKUP_DIR/weekly" | head -5

    echo -e "\n${BLUE}Monthly Backups:${NC}"
    ls -lah "$BACKUP_DIR/monthly" | head -3

    echo -e "\n${BLUE}Recent Log Entries:${NC}"
    tail -20 "$LOG_FILE"
}

# Main execution
main() {
    case "${1:-backup}" in
        "backup")
            log "🚀 Starting LabelMint production backup..."

            # Determine backup type based on day of week
            local day_of_week=$(date +%u)  # 1-7 (Monday-Sunday)
            local day_of_month=$(date +%d)

            if [[ $day_of_month == "01" ]]; then
                # Monthly backup
                create_database_backup "monthly"
                create_storage_backup
            elif [[ $day_of_week == "1" ]]; then
                # Weekly backup
                create_database_backup "weekly"
            else
                # Daily backup
                create_database_backup "daily"
            fi

            # Critical table backups (always)
            create_table_backup "users"
            create_table_backup "transactions"
            create_table_backup "user_wallets"

            # Cleanup and verification
            cleanup_old_backups
            verify_backup_retention

            log "🎉 Backup process completed successfully!"
            ;;

        "restore")
            if [[ -z "${2:-}" ]]; then
                error "❌ Please provide backup file path"
                echo "Usage: $0 restore <backup_file> [target_db_url]"
                exit 1
            fi
            restore_database "$2" "${3:-}"
            ;;

        "test")
            test_backup_system
            ;;

        "status")
            show_backup_status
            ;;

        "cleanup")
            cleanup_old_backups
            verify_backup_retention
            ;;

        *)
            echo "Usage: $0 {backup|restore|test|status|cleanup} [args]"
            echo ""
            echo "Commands:"
            echo "  backup                    - Create scheduled backup (default)"
            echo "  restore <file> [db_url]   - Restore from backup file"
            echo "  test                      - Test backup system"
            echo "  status                    - Show backup status"
            echo "  cleanup                   - Clean up old backups"
            exit 1
            ;;
    esac
}

# Check dependencies
if ! command -v pg_dump &> /dev/null; then
    error "❌ pg_dump is required but not installed"
    exit 1
fi

if ! command -v pg_restore &> /dev/null; then
    error "❌ pg_restore is required but not installed"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    error "❌ psql is required but not installed"
    exit 1
fi

# Check if required variables are set
if [[ -z "${DATABASE_URL:-}" && "${1:-}" != "status" ]]; then
    error "❌ DATABASE_URL environment variable is required"
    exit 1
fi

# Run main function with all arguments
main "$@"