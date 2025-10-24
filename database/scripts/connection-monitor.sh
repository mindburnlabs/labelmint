#!/bin/bash

# Database connection monitoring script
# Monitors connection pools, slow queries, and performance metrics

set -euo pipefail

PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres}
PGDATABASE=${PGDATABASE:-labelmint_prod}
ALERT_THRESHOLD=${ALERT_THRESHOLD:-80}  # Alert when connection usage > 80%
SLOW_QUERY_THRESHOLD=${SLOW_QUERY_THRESHOLD:-1000}  # ms

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
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Check connection pool status
check_connection_pool() {
    log "Checking connection pool status"

    # pgBouncer stats (if available)
    if command -v pgbouncer >/dev/null 2>&1; then
        echo "=== pgBouncer Pool Statistics ==="
        psql -h localhost -p 6432 -U postgres -d pgbouncer -c "SHOW STATS;" || warn "pgBouncer not accessible"
        echo
    fi

    # PostgreSQL connection stats
    echo "=== PostgreSQL Connection Status ==="
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT
            state,
            count(*) AS connections,
            round(100.0 * count(*) / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 2) AS percentage
        FROM pg_stat_activity
        WHERE datname = '$PGDATABASE'
        GROUP BY state
        ORDER BY connections DESC;
    "

    # Check if we're approaching connection limit
    local active_connections=$(psql -t -A -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT count(*) FROM pg_stat_activity WHERE datname = '$PGDATABASE' AND state = 'active';
    ")
    local max_connections=$(psql -t -A -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT setting::int FROM pg_settings WHERE name = 'max_connections';
    ")
    local usage_percent=$((active_connections * 100 / max_connections))

    if [[ $usage_percent -gt $ALERT_THRESHOLD ]]; then
        error "High connection usage: $active_connections/$max_connections ($usage_percent%)"
        # Send alert
        send_alert "High connection usage" "Database is using $usage_percent% of connections ($active_connections/$max_connections)"
    else
        log "Connection usage: $active_connections/$max_connections ($usage_percent%)"
    fi
}

# Check for slow queries
check_slow_queries() {
    log "Checking for slow queries"

    echo "=== Slow Queries (> ${SLOW_QUERY_THRESHOLD}ms average) ==="
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT
            LEFT(query, 80) AS query_preview,
            calls,
            round(mean_time::numeric, 2) AS avg_time_ms,
            round(total_time::numeric, 2) AS total_time_s,
            rows
        FROM pg_stat_statements
        WHERE mean_time > $SLOW_QUERY_THRESHOLD
        ORDER BY mean_time DESC
        LIMIT 10;
    " || warn "pg_stat_statements not available"

    # Check currently running slow queries
    echo -e "\n=== Currently Running Queries ==="
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT
            pid,
            now() - query_start AS duration,
            LEFT(query, 100) AS query_preview,
            state,
            wait_event_type,
            wait_event
        FROM pg_stat_activity
        WHERE state = 'active'
          AND now() - query_start > interval '5 seconds'
          AND pid != pg_backend_pid()
        ORDER BY duration DESC;
    "

    # Check for blocked queries
    echo -e "\n=== Blocked Queries ==="
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT
            blocked_locks.pid AS blocked_pid,
            blocked_activity.usename AS blocked_user,
            blocking_locks.pid AS blocking_pid,
            blocking_activity.usename AS blocking_user,
            blocked_activity.query AS blocked_statement,
            blocking_activity.query AS current_statement_in_blocking_process
        FROM pg_catalog.pg_locks blocked_locks
            JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
            JOIN pg_catalog.pg_locks blocking_locks
                ON blocking_locks.locktype = blocked_locks.locktype
                AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
                AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
                AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
                AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
                AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
                AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
                AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
                AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
                AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
                AND blocking_locks.pid != blocked_locks.pid
            JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
        WHERE NOT blocked_locks.GRANTED;
    " || info "No blocked queries found"
}

# Check vacuum and analyze status
check_vacuum_status() {
    log "Checking vacuum and analyze status"

    echo "=== Tables Needing Vacuum ==="
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT
            schemaname,
            tablename,
            last_vacuum,
            last_autovacuum,
            last_analyze,
            last_autoanalyze,
            vacuum_count,
            autovacuum_count,
            n_dead_tup,
            n_live_tup,
            round(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 2) AS dead_tuple_percent
        FROM pg_stat_user_tables
        WHERE (n_dead_tup > 1000 AND round(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 2) > 10)
           OR last_vacuum IS NULL
           OR last_autovacuum IS NULL
        ORDER BY dead_tuple_percent DESC
        LIMIT 10;
    "

    echo -e "\n=== Bloat Analysis ==="
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT
            schemaname,
            tablename,
            pg_size_pretty(bs * tbl.relpages) AS size,
            CASE WHEN tbl.relpages > otta THEN
                pg_size_pretty(bs * (tbl.relpages - otta))
            ELSE
                '0'
            END AS wasted_space,
            CASE WHEN tbl.relpages > otta THEN
                round(100 * (tbl.relpages - otta) / tbl.relpages::numeric, 2)
            ELSE
                0
            END AS bloat_percentage
        FROM (
            SELECT
                s.schemaname,
                s.tablename,
                greatest(s.relpages, otta) AS relpages,
                bs,
                otta
            FROM (
                SELECT
                    schemaname,
                    tablename,
                    cc.relpages,
                    ceil((cc.reltuples * ((datahdr + ma -
                        CASE WHEN datahdr % ma = 0 THEN ma ELSE datahdr % ma END) +
                        nullhdr + 4)) / (bs - 20::float)) AS otta,
                    (SELECT max(tlen) FROM pg_type WHERE typname = 'text') AS ma,
                    bs,
                    datahdr,
                    (SELECT max(null_frac) FROM pg_stats WHERE schemaname = s.schemaname AND tablename = s.tablename) * 100 AS nullhdr
                FROM pg_stat_all_tables s
                JOIN pg_class cc ON cc.relname = s.tablename
                JOIN pg_namespace nn ON cc.relnamespace = nn.oid AND nn.nspname = s.schemaname
                CROSS JOIN (SELECT
                    (SELECT current_setting('block_size')::integer) AS bs,
                    CASE WHEN version() ~ 'mingw32' THEN 8 ELSE 4 END AS ma,
                    CASE WHEN version() ~ 'PostgreSQL 8.' THEN 27 ELSE 23 END AS datahdr
                ) AS constants
                WHERE s.schemaname = 'public'
            ) AS s
        ) AS tbl
        WHERE tbl.relpages > otta
        ORDER BY bloat_percentage DESC
        LIMIT 10;
    " || warn "Bloat analysis failed"
}

# Check replication lag (if replica)
check_replication_lag() {
    log "Checking replication status"

    # Check if we're in recovery
    local in_recovery=$(psql -t -A -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT pg_is_in_recovery();")

    if [[ "$in_recovery" == "t" ]]; then
        echo "=== Replica Status ==="
        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
            SELECT
                pg_is_in_recovery() AS is_replica,
                pg_last_wal_receive_lsn() AS last_received_lsn,
                pg_last_wal_replay_lsn() AS last_replayed_lsn,
                pg_last_xact_replay_timestamp() AS last_replayed_time,
                EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS replication_lag_seconds;
        "

        local lag_seconds=$(psql -t -A -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
            SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()));
        ")

        if (( $(echo "$lag_seconds > 60" | bc -l) )); then
            warn "High replication lag: ${lag_seconds}s"
            send_alert "High replication lag" "Replica is lagging by ${lag_seconds} seconds"
        fi
    else
        echo "=== Primary Status ==="
        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
            SELECT
                application_name,
                state,
                sync_state,
                pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn)) AS sent_diff,
                pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), write_lsn)) AS write_diff,
                pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn)) AS flush_diff,
                pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_diff,
                EXTRACT(EPOCH FROM (now() - backend_start)) AS connected_seconds
            FROM pg_stat_replication
            ORDER BY sync_state, backend_start;
        " || info "No replicas connected"
    fi
}

# Check cache hit ratio
check_cache_performance() {
    log "Checking cache performance"

    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
        WITH cache_stats AS (
            SELECT
                sum(heap_blks_read) AS heap_read,
                sum(heap_blks_hit) AS heap_hit,
                sum(idx_blks_read) AS idx_read,
                sum(idx_blks_hit) AS idx_hit
            FROM pg_statio_user_tables
        )
        SELECT
            'Heap Cache Hit Ratio' AS metric,
            round(
                CASE WHEN heap_read + heap_hit = 0 THEN 0
                ELSE heap_hit::numeric / (heap_read + heap_hit) * 100
                END, 2
            ) || '%' AS value
        FROM cache_stats
        UNION ALL
        SELECT
            'Index Cache Hit Ratio' AS metric,
            round(
                CASE WHEN idx_read + idx_hit = 0 THEN 0
                ELSE idx_hit::numeric / (idx_read + idx_hit) * 100
                END, 2
            ) || '%' AS value
        FROM cache_stats
        UNION ALL
        SELECT
            'Buffer Cache Hit Ratio' AS metric,
            round(
                CASE WHEN blks_read = 0 THEN 100
                ELSE blks_hit::numeric / (blks_read + blks_hit) * 100
                END, 2
            ) || '%' AS value
        FROM pg_stat_database
        WHERE datname = current_database();
    "

    # Check buffer cache usage
    echo -e "\n=== Buffer Cache Usage ==="
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT
            datname,
            numbackends,
            xact_commit,
            xact_rollback,
            blks_read,
            blks_hit,
            round(100.0 * blks_hit / nullif(blks_read + blks_hit, 0), 2) AS hit_percent,
            tup_returned,
            tup_fetched,
            tup_inserted,
            tup_updated,
            tup_deleted
        FROM pg_stat_database
        WHERE datname = current_database();
    "
}

# Send alert to monitoring system
send_alert() {
    local title=$1
    local message=$2

    # Log to alert file
    echo "$(date -Iseconds) [ALERT] $title: $message" >> /var/log/postgres_alerts.log

    # Send to Slack if webhook configured
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 PostgreSQL Alert: $title\",\"attachments\":[{\"color\":\"danger\",\"text\":\"$message\"}]}" \
            "$SLACK_WEBHOOK_URL" || warn "Failed to send Slack alert"
    fi

    # Send email if configured
    if [[ -n "${ALERT_EMAIL:-}" ]]; then
        echo "$message" | mail -s "PostgreSQL Alert: $title" "$ALERT_EMAIL" || warn "Failed to send email alert"
    fi
}

# Generate health report
generate_health_report() {
    local report_file="/tmp/postgres_health_report_$(date +%Y%m%d_%H%M%S).json"

    log "Generating health report: $report_file"

    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -AtX \
        -c "SELECT json_build_object(
            'timestamp', now(),
            'connections', (
                SELECT json_agg(json_build_object(
                    'state', state,
                    'count', count,
                    'percentage', percentage
                ))
                FROM (
                    SELECT
                        state,
                        count(*) AS count,
                        round(100.0 * count(*) / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 2) AS percentage
                    FROM pg_stat_activity
                    WHERE datname = '$PGDATABASE'
                    GROUP BY state
                ) s
            ),
            'slow_queries', (
                SELECT count(*) FROM pg_stat_statements WHERE mean_time > $SLOW_QUERY_THRESHOLD
            ),
            'replication_lag', (
                SELECT CASE WHEN pg_is_in_recovery() THEN
                    EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))
                ELSE 0 END
            ),
            'cache_hit_ratio', (
                SELECT round(
                    CASE WHEN blks_read = 0 THEN 100
                    ELSE blks_hit::numeric / (blks_read + blks_hit) * 100
                    END, 2
                )
                FROM pg_stat_database
                WHERE datname = current_database()
            )
        );" > "$report_file"

    # Upload to S3 if configured
    if [[ -n "${S3_BUCKET:-}" ]]; then
        aws s3 cp "$report_file" "s3://$S3_BUCKET/health-reports/" || warn "Failed to upload health report to S3"
    fi

    log "Health report generated: $report_file"
}

# Main execution
case ${1:-all} in
    connections|pool)
        check_connection_pool
        ;;
    slow|queries)
        check_slow_queries
        ;;
    vacuum)
        check_vacuum_status
        ;;
    replication|repl)
        check_replication_lag
        ;;
    cache)
        check_cache_performance
        ;;
    report)
        generate_health_report
        ;;
    all)
        echo "=== PostgreSQL Database Health Check ==="
        echo "Timestamp: $(date)"
        echo "Database: $PGDATABASE"
        echo "Host: $PGHOST:$PGPORT"
        echo
        check_connection_pool
        echo
        check_slow_queries
        echo
        check_vacuum_status
        echo
        check_replication_lag
        echo
        check_cache_performance
        echo
        generate_health_report
        ;;
    *)
        echo "Usage: $0 {connections|slow|vacuum|replication|cache|report|all}"
        exit 1
        ;;
esac

log "Database monitoring check completed"