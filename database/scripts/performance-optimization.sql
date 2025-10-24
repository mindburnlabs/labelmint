-- Performance optimization SQL script
-- Run this on the production database to add missing indexes and optimize queries

-- Set statement timeout for safety
SET statement_timeout = '300s';

-- Enable query logging for slow queries
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries taking >1s
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;

-- Performance tuning settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements,auto_explain';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET pg_stat_statements.track = all;

-- Memory optimization (adjust based on server RAM)
-- These values assume a server with 32GB RAM
ALTER SYSTEM SET shared_buffers = '8GB';
ALTER SYSTEM SET effective_cache_size = '24GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '2GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '64MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Vacuum tuning
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_max_workers = 4;
ALTER SYSTEM SET autovacuum_naptime = '30s';
ALTER SYSTEM SET autovacuum_vacuum_threshold = 50;
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.1;
ALTER SYSTEM SET autovacuum_analyze_threshold = 50;
ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.05;

-- Enable parallel query
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET max_parallel_maintenance_workers = 4;

-- Create extension for query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements_info;
CREATE EXTENSION IF NOT EXISTS pg_buffercache;

-- Indexes for common queries
-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status_created ON users(status, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users(last_login_at) WHERE last_login_at IS NOT NULL;

-- Tasks table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_created_status ON tasks(created_at DESC, status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_labels ON tasks USING GIN(labels);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_deadline ON tasks(deadline) WHERE deadline IS NOT NULL;

-- Payments table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_created ON payments(status, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_amount_status ON payments(amount, status) WHERE amount > 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_type_status ON payments(payment_type, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created_desc ON payments(created_at DESC);

-- API usage indexes (if exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_composite ON api_usage(api_key_id, created_at DESC, endpoint);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_hourly ON api_usage(date_trunc('hour', created_at)) WHERE created_at > now() - interval '24 hours';

-- Sessions table indexes (if exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at) WHERE expires_at > now();
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

-- Audit logs indexes (if exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_date_trunc ON audit_logs(date_trunc('day', created_at));

-- Create partitioned tables for high-volume data
-- API usage partitioning (if not already partitioned)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage_partitioned') THEN
        CREATE TABLE api_usage_partitioned (
            LIKE api_usage INCLUDING ALL
        ) PARTITION BY RANGE (created_at);

        -- Create monthly partitions for the next 12 months
        FOR i IN 0..11 LOOP
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS api_usage_%s PARTITION OF api_usage_partitioned
                FOR VALUES FROM (%L) TO (%L)',
                to_char(now() + interval '1 month' * i, 'YYYY_MM'),
                date_trunc('month', now() + interval '1 month' * i),
                date_trunc('month', now() + interval '1 month' * (i + 1))
            );
        END LOOP;
    END IF;
END $$;

-- Create partial indexes for common filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_users ON users(id) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_tasks ON tasks(id, priority DESC) WHERE status = 'pending';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_payments ON payments(created_at DESC) WHERE created_at > now() - interval '30 days';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unpaid_payments ON payments(id, created_at) WHERE status = 'pending';

-- Create composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_search ON tasks(status, created_at DESC, priority DESC)
    WHERE status IN ('pending', 'in_progress');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity ON users(id, last_login_at DESC)
    WHERE last_login_at > now() - interval '30 days';

-- Create statistics for better query planning
ANALYZE users;
ANALYZE tasks;
ANALYZE payments;
ANALYZE api_usage;

-- Create view for monitoring slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE mean_time > 100 -- queries taking >100ms on average
ORDER BY mean_time DESC;

-- Create view for database performance metrics
CREATE OR REPLACE VIEW database_performance AS
SELECT
    datname,
    numbackends,
    xact_commit,
    xact_rollback,
    blks_read,
    blks_hit,
    tup_returned,
    tup_fetched,
    tup_inserted,
    tup_updated,
    tup_deleted,
    conflicts,
    temp_files,
    temp_bytes,
    deadlocks
FROM pg_stat_database
WHERE datname = current_database();

-- Create function to update table statistics
CREATE OR REPLACE FUNCTION update_table_stats()
RETURNS void AS $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ANALYZE ' || quote_ident(tbl.schemaname) || '.' || quote_ident(tbl.tablename);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule statistics update (requires pg_cron extension)
-- SELECT cron.schedule('update-stats', '0 2 * * *', 'SELECT update_table_stats();');

-- Create monitoring queries
CREATE OR REPLACE VIEW connection_monitor AS
SELECT
    state,
    count(*) AS connections,
    max(now() - query_start) AS longest_query_duration
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
GROUP BY state
ORDER BY connections DESC;

-- Create bloat monitoring query
CREATE OR REPLACE VIEW table_bloat AS
SELECT
    schemaname,
    tablename,
    ROUND(CASE WHEN otta=0 THEN 0.0 ELSE sml.relpages/otta::numeric END,1) AS tbloat,
    CASE WHEN relpages < otta THEN 0 ELSE relpages::bigint - otta END AS wastedpages,
    CASE WHEN relpages < otta THEN 0 ELSE bs*(sml.relpages-otta)::bigint END AS wastedbytes,
    CASE WHEN relpages < otta THEN 0 ELSE (bs*(relpages-otta))::bigint END AS wastedsize
FROM (
    SELECT
        schemaname, tablename, cc.reltuples, cc.relpages, bs,
        CEIL((cc.reltuples*((datahdr+ma-
            (CASE WHEN datahdr%ma=0 THEN ma ELSE datahdr%ma END))+nullhdr2+4))/(bs-20::float)) AS otta
    FROM (
        SELECT
            ma,bs,schemaname,tablename,
            (datawidth+(hdr+ma-(CASE WHEN hdr%ma=0 THEN ma ELSE hdr%ma END)))::numeric AS datahdr,
            (maxfracsum*(nullhdr+ma-(CASE WHEN nullhdr%ma=0 THEN ma ELSE nullhdr%ma END))) AS nullhdr2
        FROM (
            SELECT
                schemaname, tablename, hdr, ma, bs,
                SUM((1-null_frac)*avg_width) AS datawidth,
                MAX(null_frac) AS maxfracsum,
                hdr+(
                    SELECT 1+COUNT(*)*(8-CASE WHEN avg_width<=248 THEN 1 ELSE 8 END)
                    FROM pg_stats s2
                    WHERE s2.schemaname=s.schemaname AND s2.tablename=s.tablename AND null_frac<>0
                ) AS nullhdr
            FROM pg_stats s, (
                SELECT
                    (SELECT current_setting('block_size')::numeric) AS bs,
                    CASE WHEN substring(v,12,3) IN ('8.0','8.1','8.2') THEN 27 ELSE 23 END AS hdr,
                    CASE WHEN v ~ 'mingw32' THEN 8 ELSE 4 END AS ma
                FROM (SELECT version() AS v) AS foo
            ) AS constants
            GROUP BY 1,2,3,4,5
        ) AS foo
    ) AS rs
    JOIN pg_class cc ON cc.relname = rs.tablename
    JOIN pg_namespace nn ON cc.relnamespace = nn.oid AND nn.nspname = rs.schemaname AND nn.nspname <> 'information_schema'
) AS sml
WHERE tbloat > 1.5; -- Only show tables with >50% bloat

-- Reload configuration
SELECT pg_reload_conf();

-- Report optimization results
DO $$
DECLARE
    index_count integer;
BEGIN
    SELECT count(*) INTO index_count FROM pg_indexes WHERE schemaname = 'public';
    RAISE NOTICE 'Performance optimization completed. Total indexes: %', index_count;
    RAISE NOTICE 'Configuration reloaded. Check PostgreSQL logs for slow queries.';
    RAISE NOTICE 'Monitor performance using views: slow_queries, database_performance, connection_monitor, table_bloat';
END $$;