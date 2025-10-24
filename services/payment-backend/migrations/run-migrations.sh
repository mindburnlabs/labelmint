#!/bin/bash

set -euo pipefail

echo "🚀 Starting production database migrations..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this from the project root."
    exit 1
fi

# Check if PostgreSQL is accessible
if ! command -v psql >/dev/null 2>&1; then
    echo "❌ Error: PostgreSQL is not accessible. Please ensure PostgreSQL is installed and running."
    exit 1
fi

# Check if Redis is accessible
if ! command -v redis-cli >/dev/null 2>&1; then
    echo "❌ Error: Redis is not accessible. Please ensure Redis is installed and running."
    exit 1
fi

# Migration files in order of execution
MIGRATIONS=(
    "001_create_tables.sql"
    "002_add_indexes.sql"
    "010_add_user_columns.sql"
    "020_add_notifications.sql"
    "030_add_audit_log.sql"
    "040_add_api_usage.sql"
    "050_add_quality_metrics.sql"
    "060_add_worker_stats.sql"
    "070_add_email_verifications.sql"
    "080_add_payment_channels.sql"
    "090_add_project_members.sql"
    "100_add_delegates.sql"
    "110_add_projects.sql"
    "120_add_tasks.sql"
    "130_add_task_submissions.sql"
    "140_add_worker_payouts.sql"
    "001_complete_ton_integration.sql"
    "002_production_ready.sql"
    "003_connection_pool_setup.sql"
    "004_row_level_security.sql"
)

    # Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-deligate}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_SSL="${DB_SSL:-false}"

echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  SSL: $DB_SSL"
echo ""

# Create a temporary migration tracking table
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        checksum VARCHAR(64),
        version VARCHAR(20)
    );
" || {
    echo "❌ Failed to create migration tracking table"
    exit 1
}

SUCCESS_MIGRATIONS=0
FAILED_MIGRATIONS=()

echo ""
echo "Running migrations..."

for MIGRATION in "${MIGRATIONS[@]}"; do
    echo "Running: $MIGRATION"

    # Calculate checksum of migration file
    MIGRATION_CHECKSUM=$(md5sum "migrations/$MIGRATION" | awk '{print $1}')

    # Check if migration was already executed
    ALREADY_EXECUTED=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT EXISTS(
            SELECT 1 FROM schema_migrations
            WHERE migration_id = '$MIGRATION'
            AND checksum = '$MIGRATION_CHECKSUM'
            AND status = 'success'
        )
    " || {
        echo "  Migration $MIGRATION already executed successfully"
        ((SUCCESS_MIGRATIONS++))
        continue
    }

    # Execute migration
    MIGRATION_START=$(date +%s)

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "migrations/$MIGRATION" 2>&1; then
        echo "❌ Migration $MIGRATION failed!"
        FAILED_MIGRATIONS=$((FAILED_MIGRATIONS + 1))

        # Log error
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            INSERT INTO schema_migrations
            (migration_id, executed_at, status, error_message, checksum, version)
            VALUES (
              '$MIGRATION',
              to_timestamp(to_timestamp('$MIGRATION_START', 'YYYY-MM-DD HH24:SS')),
              'failed',
              'Migration failed',
              NULL,
              '$MIGRATION_CHECKSUM',
              '1.0.0'
            );
        " || {
            echo "  ✅ Migration $MIGRATION executed successfully in $(($(date +%s) - MIGRATION_START)) seconds"

            # Record successful migration
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
                INSERT INTO schema_migrations
                (migration_id, executed_at, status, error_message, checksum, version)
                VALUES (
                  '$MIGRATION',
                  to_timestamp(to_timestamp('$MIGRATION_START', 'YYYY-MM-DD HH24:SS')),
                  'success',
                  NULL,
                  '$MIGRATION_CHECKSUM',
                  '1.0.0'
                );
            " || {
                echo "  ⚠️ Warning: Migration succeeded but may have issues"
            }

            ((SUCCESS_MIGRATIONS++))
        }
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "migrations/$MIGRATION" 2>&1 | \
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
            -f "migrations/$MIGRATION" \
            -f "migrations/$MIGRATION" 2>&1 > \
                "scripts/migrations/error_migrations.sql"
                2>&1 || true
            "
    fi

    echo ""
done

echo ""
echo "Migration Summary:"
echo "  ✅ Successful: $SUCCESS_MIGRATIONS"
echo "  ❌ Failed: $FAILED_MIGRATIONS"

if [ "$FAILED_MIGRATIONS" -gt 0 ]; then
    echo "❌ Some migrations failed. Please check the errors above."
    echo ""
    exit 1
fi

echo "All migrations completed successfully! 🎉"

# Optimize database
echo "Optimizing database..."

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    -e "ANALYZE $DB_NAME;"
    -e "REINDEX SCHEMA public;"
    -f "scripts/migrations/optimize_database.sql"
" || {
    echo "❌ Database optimization failed"
    exit 1
}

echo "Database optimized successfully! ✅"

# Update connection pool settings
echo "Updating connection pool settings..."

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    -e "ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';"
    -e "ALTER SYSTEM SET effective_cache_size = '256MB';"
    -e "ALTER SYSTEM SET work_mem = '64MB';"
    -e "ALTER SYSTEM SET maintenance_work_mem = '128MB';"
    -e "ALTER SYSTEM SET max_connections = 200;"
    -e "ALTER SYSTEM SET shared_buffers = '32MB';"
    -e "ALTER SYSTEM SET effective_io_concurrency = 200;"
    -e "ALTER SYSTEM SET random_page_cost = 1.1;"
    -e "ALTER SYSTEM SET checkpoint_completion_target = 0.9;"
    "e "ALTER SYSTEM SET wal_buffers = '16MB';"
    -e "ALTER SYSTEM SET commit_delay = '1000ms';"
    -e "ALTER SYSTEM SET wal_writer_delay = '2000ms';"
    "e "ALTER SYSTEM SET synchronous_commit = 'local';"
    -e "ALTER SYSTEM SET fsync = 'on';"
    "e "VACUUM $DB_NAME;"
    "e "ANALYZE $DB_NAME;"
    -e "REINDEX SCHEMA public;"
    -f "scripts/migrations/optimize_indexes.sql"
" || {
    echo "❌ Connection pool optimization failed"
        exit 1
    }
}

echo "Connection pool settings updated! ✅"

echo "🎉 Production database setup complete!"
echo ""
echo "Next steps:"
echo "1. Ensure Redis is running on port $REDIS_PORT"
echo "2. Start application services"
echo "3. Configure load balancer"
echo "4. Monitor application health"
echo ""
echo "✅ Database migration and setup complete!"