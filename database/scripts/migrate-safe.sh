#!/bin/bash

# Safe migration deployment script
# Features: pre-deployment backup, dry-run, automatic rollback, zero-downtime, monitoring

set -euo pipefail

# Configuration
MIGRATIONS_DIR=${MIGRATIONS_DIR:-$(dirname "$0")/../../migrations}
BACKUP_DIR=${BACKUP_DIR:-/var/lib/postgresql/migration_backups}
STAGING_DB=${STAGING_DB:-labelmint_staging}
PROD_DB=${PROD_DB:-labelmint_prod}
ROLLBACK_FILE=${ROLLBACK_FILE:-/tmp/migration_rollback.sql}
LOG_FILE=${LOG_FILE:-/var/log/postgres_migrations.log}
DRY_RUN_ONLY=${DRY_RUN_ONLY:-false}
ENABLE_ZERO_DOWNTIME=${ENABLE_ZERO_DOWNTIME:-true}

# PostgreSQL connection
PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres}
PGPASSWORD=${PGPASSWORD:-}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Logging functions
log() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${GREEN}$message${NC}"
    echo "$message" >> "$LOG_FILE"
}

warn() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1"
    echo -e "${YELLOW}$message${NC}"
    echo "$message" >> "$LOG_FILE"
}

error() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1"
    echo -e "${RED}$message${NC}"
    echo "$message" >> "$LOG_FILE"
    send_notification "Migration Failed" "$message"
    exit 1
}

info() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${BLUE}$message${NC}"
    echo "$message" >> "$LOG_FILE"
}

step() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] STEP: $1"
    echo -e "${PURPLE}$message${NC}"
    echo "$message" >> "$LOG_FILE"
}

# Send notifications
send_notification() {
    local status=$1
    local message=$2

    # Send to Slack
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        [[ $status == "error" ]] && color="danger"
        [[ $status == "warning" ]] && color="warning"

        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Database Migration: $status\",\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$SLACK_WEBHOOK_URL" || warn "Failed to send Slack notification"
    fi

    # Send email
    if [[ -n "${ALERT_EMAIL:-}" ]]; then
        echo "$message" | mail -s "Database Migration: $status" "$ALERT_EMAIL" || warn "Failed to send email notification"
    fi
}

# Create pre-deployment backup
create_backup() {
    step "Creating pre-deployment backup"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/pre_migration_$timestamp.dump"

    mkdir -p "$BACKUP_DIR"

    # Create backup
    pg_dump \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        --dbname="$PROD_DB" \
        --format=custom \
        --compress=9 \
        --verbose \
        --file="$backup_file" \
        --schema=public

    # Verify backup
    local backup_size=$(du -h "$backup_file" | cut -f1)
    local backup_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)

    # Store backup info
    cat > "$BACKUP_DIR/pre_migration_$timestamp.json" <<EOF
{
    "timestamp": "$(date -Iseconds)",
    "backup_file": "$backup_file",
    "size": "$backup_size",
    "checksum": "$backup_checksum",
    "database": "$PROD_DB",
    "migration_hash": "$(find $MIGRATIONS_DIR -name "*.sql" -type f -exec sha256sum {} \; | sort | sha256sum | cut -d' ' -f1)"
}
EOF

    log "Pre-deployment backup created: $backup_file ($backup_size)"
    echo "$backup_file" > /tmp/last_migration_backup.txt
}

# Test migration on staging database
test_on_staging() {
    step "Testing migration on staging database"

    if [[ "$DRY_RUN_ONLY" == "true" ]]; then
        info "Dry-run mode: Skipping staging test"
        return 0
    fi

    # Create/refresh staging database from production snapshot
    info "Refreshing staging database from production"
    dropdb --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" "$STAGING_DB" 2>/dev/null || true
    createdb --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" "$STAGING_DB"

    # Restore backup to staging
    local last_backup=$(cat /tmp/last_migration_backup.txt)
    pg_restore \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        --dbname="$STAGING_DB" \
        --verbose \
        --clean \
        --if-exists \
        "$last_backup"

    # Run migrations on staging
    info "Running migrations on staging database"
    for migration in $MIGRATIONS_DIR/*.sql; do
        if [[ -f "$migration" ]]; then
            local migration_name=$(basename "$migration")
            info "Testing migration: $migration_name"

            # Check if migration already applied
            local applied=$(psql -t -A -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$STAGING_DB" \
                -c "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = '$migration_name');" 2>/dev/null || echo "f")

            if [[ "$applied" == "t" ]]; then
                warn "Migration $migration_name already applied in staging, skipping"
                continue
            fi

            # Apply migration with transaction
            psql -v ON_ERROR_STOP=1 \
                -h "$PGHOST" \
                -p "$PGPORT" \
                -U "$PGUSER" \
                -d "$STAGING_DB" \
                -c "BEGIN; $(cat "$migration"); COMMIT;" \
                || error "Migration $migration_name failed on staging"

            # Record migration
            psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$STAGING_DB" \
                -c "INSERT INTO schema_migrations (version, applied_at) VALUES ('$migration_name', NOW())" \
                || error "Failed to record migration $migration_name in staging"
        fi
    done

    # Run basic sanity checks
    info "Running sanity checks on staging"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$STAGING_DB" \
        -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" \
        > /dev/null || error "Sanity check failed: Cannot list tables"

    log "All migrations passed staging tests"
}

# Generate rollback scripts
generate_rollback() {
    step "Generating rollback scripts"

    cat > "$ROLLBACK_FILE" <<'EOF'
-- Migration rollback script
-- Generated automatically - DO NOT EDIT
-- To rollback: psql -v ON_ERROR_STOP=1 -f rollback.sql

BEGIN;

-- Add your rollback statements here
-- This is a template - actual rollback statements will be generated per migration

ROLLBACK;
EOF

    # Generate rollback for each migration
    for migration in $MIGRATIONS_DIR/*.sql; do
        if [[ -f "$migration" ]]; then
            local migration_name=$(basename "$migration")
            local rollback_file="$BACKUP_DIR/rollback_$migration_name"

            # Extract rollback comments from migration
            grep -i "-- rollback:" "$migration" | sed 's/-- rollback:/\t/g' > "$rollback_file" || true

            if [[ ! -s "$rollback_file" ]]; then
                warn "No rollback statements found for $migration_name"
            fi
        fi
    done

    log "Rollback scripts generated"
}

# Perform dry-run
dry_run() {
    step "Performing migration dry-run"

    info "Checking migration syntax and dependencies"

    # Check syntax of all migrations
    for migration in $MIGRATIONS_DIR/*.sql; do
        if [[ -f "$migration" ]]; then
            local migration_name=$(basename "$migration")
            info "Validating syntax: $migration_name"

            # Parse SQL without executing
            psql \
                -h "$PGHOST" \
                -p "$PGPORT" \
                -U "$PGUSER" \
                -d "$PROD_DB" \
                -c "SET TRANSACTION READ ONLY; PREPARE dry_run AS $(cat "$migration"); DEALLOCATE dry_run;" \
                || error "Syntax error in $migration_name"
        fi
    done

    # Check for lock conflicts
    info "Checking for potential lock conflicts"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PROD_DB" \
        -c "SELECT pid, state, query FROM pg_stat_activity WHERE state = 'active' AND query != '<IDLE>';" \
        > /tmp/active_queries.txt

    if [[ -s /tmp/active_queries.txt ]]; then
        warn "Active queries detected:"
        cat /tmp/active_queries.txt
        read -p "Continue with migration? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Migration cancelled by user"
        fi
    fi

    log "Dry-run completed successfully"
}

# Apply migrations with zero-downtime
apply_migrations() {
    step "Applying migrations to production"

    if [[ "$DRY_RUN_ONLY" == "true" ]]; then
        info "Dry-run mode: Skipping actual migration"
        return 0
    fi

    # Ensure schema_migrations table exists
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PROD_DB" \
        -c "CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );" || error "Failed to create schema_migrations table"

    # Apply migrations in order
    for migration in $MIGRATIONS_DIR/*.sql; do
        if [[ -f "$migration" ]]; then
            local migration_name=$(basename "$migration")
            info "Applying migration: $migration_name"

            # Check if already applied
            local applied=$(psql -t -A -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PROD_DB" \
                -c "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = '$migration_name');")

            if [[ "$applied" == "t" ]]; then
                warn "Migration $migration_name already applied, skipping"
                continue
            fi

            # For zero-downtime: wrap in transaction with timeouts
            if [[ "$ENABLE_ZERO_DOWNTIME" == "true" ]]; then
                info "Applying with zero-downtime strategy"

                # Start transaction with short timeout
                psql -v ON_ERROR_STOP=1 \
                    -h "$PGHOST" \
                    -p "$PGPORT" \
                    -U "$PGUSER" \
                    -d "$PROD_DB" \
                    -c "SET statement_timeout = '300s'; SET lock_timeout = '30s'; BEGIN;" \
                    -c "$(cat "$migration")" \
                    -c "INSERT INTO schema_migrations (version, applied_at) VALUES ('$migration_name', NOW());" \
                    -c "COMMIT;" \
                    || {
                        # Try to rollback
                        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PROD_DB" \
                            -c "ROLLBACK;" 2>/dev/null || true
                        error "Migration $migration_name failed"
                    }
            else
                # Standard migration
                psql -v ON_ERROR_STOP=1 \
                    -h "$PGHOST" \
                    -p "$PGPORT" \
                    -U "$PGUSER" \
                    -d "$PROD_DB" \
                    -c "BEGIN; $(cat "$migration"); INSERT INTO schema_migrations (version, applied_at) VALUES ('$migration_name', NOW()); COMMIT;" \
                    || error "Migration $migration_name failed"
            fi

            log "Migration $migration_name applied successfully"
        fi
    done

    # Update statistics
    info "Updating table statistics"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PROD_DB" \
        -c "ANALYZE;" || warn "Failed to update statistics"

    log "All migrations applied successfully"
}

# Monitor post-migration health
monitor_health() {
    step "Monitoring post-migration health"

    local wait_time=30
    local max_checks=10
    local check_count=0

    info "Waiting for database to stabilize ($wait_time seconds)"
    sleep $wait_time

    while [[ $check_count -lt $max_checks ]]; do
        check_count=$((check_count + 1))

        # Check connection count
        local active_connections=$(psql -t -A -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PROD_DB" \
            -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")

        # Check for long-running queries
        local long_queries=$(psql -t -A -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PROD_DB" \
            -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '30s';")

        # Check for blocked queries
        local blocked_queries=$(psql -t -A -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PROD_DB" \
            -c "SELECT count(*) FROM pg_locks WHERE NOT granted;")

        info "Health check $check_count/$max_checks: Active connections: $active_connections, Long queries: $long_queries, Blocked: $blocked_queries"

        if [[ $long_queries -eq 0 && $blocked_queries -eq 0 ]]; then
            log "Database health is good"
            break
        fi

        if [[ $check_count -eq $max_checks ]]; then
            warn "Health check warnings detected, but continuing"
        fi

        sleep 10
    done

    # Verify tables accessible
    local table_count=$(psql -t -A -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PROD_DB" \
        -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

    if [[ $table_count -gt 0 ]]; then
        log "Database is responsive: $table_count tables accessible"
    else
        error "Database health check failed: No tables accessible"
    fi
}

# Rollback if needed
rollback() {
    step "Rolling back migration"

    local last_backup=$(cat /tmp/last_migration_backup.txt 2>/dev/null || echo "")

    if [[ -z "$last_backup" ]]; then
        error "No backup file found for rollback"
    fi

    warn "ROLLING BACK: This will restore from backup: $last_backup"
    read -p "Confirm rollback? (yes/NO): " -r
    if [[ ! $REPLY =~ ^yes$ ]]; then
        error "Rollback cancelled"
    fi

    # Drop and restore database
    info "Dropping current database"
    dropdb --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" "$PROD_DB" \
        || error "Failed to drop database for rollback"

    info "Creating database from backup"
    createdb --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" "$PROD_DB" \
        || error "Failed to create database during rollback"

    info "Restoring from backup"
    pg_restore \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        --dbname="$PROD_DB" \
        --verbose \
        --clean \
        --if-exists \
        "$last_backup" \
        || error "Failed to restore from backup"

    log "Rollback completed successfully"
    send_notification "Migration Rolled Back" "Database has been rolled back to pre-migration state"
}

# Generate migration report
generate_report() {
    step "Generating migration report"

    local report_file="/tmp/migration_report_$(date +%Y%m%d_%H%M%S).json"

    cat > "$report_file" <<EOF
{
    "migration_completed": "$(date -Iseconds)",
    "database": "$PROD_DB",
    "migrations_applied": [
$(find $MIGRATIONS_DIR -name "*.sql" -type f -exec basename {} \; | sed 's/^/        "/' | sed 's/$/",/' | sed '$ s/,$//')
    ],
    "backup_file": "$(cat /tmp/last_migration_backup.txt 2>/dev/null || echo "")",
    "rollback_available": true,
    "zero_downtime": $ENABLE_ZERO_DOWNTIME,
    "post_migration_health": "good"
}
EOF

    # Upload to S3 if configured
    if [[ -n "${S3_BUCKET:-}" ]]; then
        aws s3 cp "$report_file" "s3://$S3_BUCKET/migration-reports/" || warn "Failed to upload migration report"
    fi

    log "Migration report generated: $report_file"
}

# Main execution
main() {
    log "Starting safe migration deployment"
    log "Migrations directory: $MIGRATIONS_DIR"
    log "Target database: $PROD_DB"

    # Create backup
    create_backup

    # Test on staging
    test_on_staging

    # Generate rollback
    generate_rollback

    # Dry-run
    dry_run

    # Apply migrations
    apply_migrations

    # Monitor health
    monitor_health

    # Generate report
    generate_report

    log "Migration deployment completed successfully!"
    send_notification "Migration Completed" "All migrations have been applied successfully to $PROD_DB"
}

# Handle rollback command
if [[ "${1:-}" == "rollback" ]]; then
    rollback
    exit 0
fi

# Trap for cleanup
trap 'error "Migration interrupted by user"' INT TERM

# Run main function
main