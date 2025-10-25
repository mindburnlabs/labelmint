-- ============================================================================
-- COMPREHENSIVE DATABASE MONITORING STRATEGY FOR LABELMINT
-- ============================================================================

-- Set statement timeout for safety
SET statement_timeout = '300s';

-- ============================================================================
-- PERFORMANCE MONITORING EXTENSIONS
-- ============================================================================

-- Enable monitoring extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements_info;
CREATE EXTENSION IF NOT EXISTS pg_buffercache;
CREATE EXTENSION IF NOT EXISTS pg_freespacemap;
CREATE EXTENSION IF NOT EXISTS pg_prewarm;

-- ============================================================================
-- QUERY PERFORMANCE MONITORING
-- ============================================================================

-- Enhanced query statistics view
CREATE OR REPLACE VIEW monitoring.query_performance AS
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent,
    shared_blks_hit,
    shared_blks_read,
    shared_blks_dirtied,
    shared_blks_written,
    local_blks_hit,
    local_blks_read,
    temp_blks_read,
    temp_blks_written,
    blk_read_time,
    blk_write_time,
    CASE
        WHEN mean_time < 10 THEN 'Excellent'
        WHEN mean_time < 100 THEN 'Good'
        WHEN mean_time < 1000 THEN 'Fair'
        WHEN mean_time < 5000 THEN 'Poor'
        ELSE 'Critical'
    END as performance_category,
    CASE
        WHEN calls > 1000 THEN 'High Frequency'
        WHEN calls > 100 THEN 'Medium Frequency'
        WHEN calls > 10 THEN 'Low Frequency'
        ELSE 'Very Low Frequency'
    END as frequency_category
FROM pg_stat_statements
ORDER BY total_time DESC;

-- Slow queries view (queries with mean execution time > 1 second)
CREATE OR REPLACE VIEW monitoring.slow_queries AS
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows,
    stddev_time,
    min_time,
    max_time,
    CASE
        WHEN mean_time > 10000 THEN 'Critical (>10s)'
        WHEN mean_time > 5000 THEN 'Severe (>5s)'
        WHEN mean_time > 2000 THEN 'High (>2s)'
        WHEN mean_time > 1000 THEN 'Medium (>1s)'
        ELSE 'Low (<1s)'
    END as severity_level,
    current_timestamp as last_analyzed
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC;

-- Query optimization opportunities view
CREATE OR REPLACE VIEW monitoring.optimization_opportunities AS
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows,
    (shared_blks_read::decimal / nullif(shared_blks_hit + shared_blks_read, 0)) * 100 AS miss_percent,
    temp_blks_read + temp_blks_written AS temp_blocks_used,
    CASE
        WHEN (shared_blks_read::decimal / nullif(shared_blks_hit + shared_blks_read, 0)) > 0.2 THEN 'Add Indexes'
        WHEN temp_blks_read + temp_blks_written > 1000 THEN 'Optimize Memory Usage'
        WHEN rows < 10 AND mean_time > 1000 THEN 'Rewrite Query'
        WHEN calls > 10000 AND mean_time > 100 THEN 'Consider Caching'
        ELSE 'Monitor'
    END as recommendation,
    CASE
        WHEN (shared_blks_read::decimal / nullif(shared_blks_hit + shared_blks_read, 0)) > 0.2 THEN 3
        WHEN temp_blks_read + temp_blks_written > 1000 THEN 2
        WHEN rows < 10 AND mean_time > 1000 THEN 2
        WHEN calls > 10000 AND mean_time > 100 THEN 1
        ELSE 0
    END as priority_score
FROM pg_stat_statements
WHERE (shared_blks_read > 0 OR temp_blks_read > 0 OR temp_blks_written > 0)
ORDER BY priority_score DESC, total_time DESC;

-- ============================================================================
-- DATABASE RESOURCE MONITORING
-- ============================================================================

-- Database-wide performance metrics
CREATE OR REPLACE VIEW monitoring.database_metrics AS
SELECT
    datname as database_name,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back,
    blks_read as blocks_read,
    blks_hit as blocks_hit,
    tup_returned as tuples_returned,
    tup_fetched as tuples_fetched,
    tup_inserted as tuples_inserted,
    tup_updated as tuples_updated,
    tup_deleted as tuples_deleted,
    conflicts as replication_conflicts,
    temp_files as temp_files_created,
    temp_bytes as temp_bytes_used,
    deadlocks as deadlock_count,
    CASE
        WHEN (blks_hit + blks_read) > 0
        THEN round((blks_hit::numeric / (blks_hit + blks_read)) * 100, 2)
        ELSE 0
    END as cache_hit_ratio_percent,
    CASE
        WHEN xact_commit + xact_rollback > 0
        THEN round((xact_rollback::numeric / (xact_commit + xact_rollback)) * 100, 2)
        ELSE 0
    END as rollback_ratio_percent,
    ROUND((blks_read * 8192)::numeric / 1024 / 1024, 2) as data_read_mb,
    ROUND((blks_hit * 8192)::numeric / 1024 / 1024, 2) as data_cache_mb,
    ROUND((temp_bytes)::numeric / 1024 / 1024, 2) as temp_usage_mb,
    stats_reset as last_stats_reset,
    current_timestamp as measurement_time
FROM pg_stat_database
WHERE datname NOT IN ('template0', 'template1', 'postgres')
ORDER BY active_connections DESC;

-- Table-level performance metrics
CREATE OR REPLACE VIEW monitoring.table_performance AS
SELECT
    schemaname || '.' || tablename as table_name,
    seq_scan as sequential_scans,
    seq_tup_read as seq_tuples_read,
    idx_scan as index_scans,
    idx_tup_fetch as idx_tuples_fetched,
    n_tup_ins as tuples_inserted,
    n_tup_upd as tuples_updated,
    n_tup_del as tuples_deleted,
    n_tup_hot_upd as hot_updates,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    ROUND((n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0)) * 100, 2) as dead_tuple_ratio_percent,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count,
    CASE
        WHEN seq_scan > idx_scan AND (seq_scan / nullif(idx_scan, 0)) > 5 THEN 'Needs Indexes'
        WHEN (n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0)) > 0.2 THEN 'Needs Vacuum'
        WHEN last_analyze IS NULL OR last_analyze < now() - interval '7 days' THEN 'Needs Analyze'
        ELSE 'Healthy'
    END as health_status
FROM pg_stat_user_tables
ORDER BY (n_live_tup + n_dead_tup) DESC;

-- Index usage statistics
CREATE OR REPLACE VIEW monitoring.index_usage AS
SELECT
    schemaname || '.' || tablename || '.' || indexname as index_name,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE
        WHEN idx_scan = 0 THEN 'Unused'
        WHEN idx_scan < 10 THEN 'Rarely Used'
        WHEN idx_scan < 100 THEN 'Occasionally Used'
        WHEN idx_scan < 1000 THEN 'Regularly Used'
        ELSE 'Frequently Used'
    END as usage_frequency,
    CASE
        WHEN idx_scan = 0 THEN 'DROP'
        WHEN idx_scan < 10 THEN 'REVIEW'
        WHEN idx_scan < 100 THEN 'MONITOR'
        ELSE 'KEEP'
    END as recommendation
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- ============================================================================
-- CONNECTION MONITORING
-- ============================================================================

-- Active connections view
CREATE OR REPLACE VIEW monitoring.active_connections AS
SELECT
    pid,
    datname as database_name,
    usename as username,
    application_name,
    client_addr as client_ip,
    state,
    CASE
        WHEN state = 'active' THEN age(now(), query_start)
        WHEN state = 'idle in transaction' THEN age(now(), xact_start)
        ELSE NULL
    END as connection_age,
    CASE
        WHEN state = 'active' THEN age(now(), query_start)
        ELSE NULL
    END as query_duration,
    wait_event_type,
    wait_event,
    backend_start as connection_start_time,
    xact_start as transaction_start_time,
    query_start as query_start_time,
    state_change as last_state_change,
    LEFT(query, 100) as current_query,
    CASE
        WHEN age(now(), query_start) > interval '5 minutes' THEN 'Long Running'
        WHEN age(now(), query_start) > interval '1 minute' THEN 'Potentially Long'
        ELSE 'Normal'
    END as duration_category
FROM pg_stat_activity
WHERE state IS NOT NULL
ORDER BY query_duration DESC NULLS LAST;

-- Connection pool monitoring
CREATE OR REPLACE VIEW monitoring.connection_pool_analysis AS
SELECT
    datname as database_name,
    COUNT(*) as total_connections,
    COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
    COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_connections,
    COUNT(CASE WHEN state = 'idle in transaction' THEN 1 END) as idle_in_transaction,
    COUNT(CASE WHEN state = 'waiting' THEN 1 END) as waiting_connections,
    AVG(EXTRACT(EPOCH FROM (CASE WHEN state = 'active' THEN age(now(), query_start) ELSE NULL END))) as avg_query_duration_seconds,
    MAX(EXTRACT(EPOCH FROM (CASE WHEN state = 'active' THEN age(now(), query_start) ELSE NULL END))) as max_query_duration_seconds,
    COUNT(CASE WHEN wait_event_type = 'Lock' THEN 1 END) as blocked_connections,
    ROUND(COUNT(CASE WHEN state = 'active' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as active_percentage,
    current_timestamp as analysis_time
FROM pg_stat_activity
WHERE datname NOT IN ('template0', 'template1', 'postgres')
GROUP BY datname
ORDER BY total_connections DESC;

-- Blocking queries view
CREATE OR REPLACE VIEW monitoring.blocking_queries AS
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process,
    blocked_activity.application_name AS blocked_application,
    blocking_activity.application_name AS blocking_application,
    age(now(), blocked_activity.query_start) as blocked_duration,
    age(now(), blocking_activity.query_start) as blocking_duration
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted
AND blocking_locks.granted
AND blocked_locks.pid != blocking_locks.pid
ORDER BY blocked_duration DESC;

-- ============================================================================
-- MEMORY AND BUFFER CACHE MONITORING
-- ============================================================================

-- Buffer cache analysis
CREATE OR REPLACE VIEW monitoring.buffer_cache_analysis AS
SELECT
    CASE
        WHEN relname IS NULL THEN 'Shared Buffers'
        ELSE schemaname || '.' || relname
    END as relation_name,
    COUNT(*) as buffer_count,
    ROUND(COUNT(*) * 8192::numeric / 1024 / 1024, 2) as size_mb,
    ROUND(COUNT(*) * 100.0 / (SELECT setting FROM pg_settings WHERE name = 'shared_buffers')::integer, 2) as percentage_of_shared_buffers,
    CASE
        WHEN relname IS NULL THEN 'System'
        WHEN COUNT(*) > 1000 THEN 'Hot Table'
        WHEN COUNT(*) > 100 THEN 'Warm Table'
        ELSE 'Cold Table'
    END as cache_temperature
FROM pg_buffercache
GROUP BY GROUPING SETS ((relname, schemaname), ())
ORDER BY buffer_count DESC;

-- Memory usage by database
CREATE OR REPLACE VIEW monitoring.memory_usage AS
SELECT
    datname as database_name,
    numbackends as connections,
    SUM(CASE WHEN query = '<IDLE>' THEN 0 ELSE 1 END) as active_queries,
    ROUND(AVG(
        CASE
            WHEN state = 'active'
            THEN EXTRACT(EPOCH FROM (now() - query_start))
            ELSE 0
        END
    )) as avg_query_time_seconds,
    ROUND(SUM(
        CASE
            WHEN state = 'active'
            THEN EXTRACT(EPOCH FROM (now() - query_start))
            ELSE 0
        END
    )) as total_query_time_seconds
FROM pg_stat_activity
WHERE datname NOT IN ('template0', 'template1', 'postgres')
GROUP BY datname, numbackends
ORDER BY total_query_time_seconds DESC;

-- ============================================================================
-- VACUUM AND MAINTENANCE MONITORING
-- ============================================================================

-- Vacuum analysis view
CREATE OR REPLACE VIEW monitoring.vacuum_analysis AS
SELECT
    schemaname || '.' || relname as table_name,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    ROUND((n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0)) * 100, 2) as dead_tuple_percentage,
    last_vacuum,
    last_autovacuum,
    vacuum_count,
    autovacuum_count,
    last_analyze,
    last_autoanalyze,
    analyze_count,
    autoanalyze_count,
    CASE
        WHEN n_dead_tup > 10000 OR (n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0)) > 0.2 THEN 'Critical - Needs Vacuum'
        WHEN n_dead_tup > 1000 OR (n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0)) > 0.1 THEN 'Warning - High Dead Tuples'
        WHEN last_vacuum IS NULL OR last_autovacuum < now() - interval '7 days' THEN 'Warning - Old Vacuum'
        ELSE 'Healthy'
    END as vacuum_status,
    CASE
        WHEN last_analyze IS NULL OR last_autoanalyze < now() - interval '7 days' THEN 'Needs Analyze'
        ELSE 'OK'
    END as analyze_status
FROM pg_stat_user_tables
WHERE n_live_tup > 0 OR n_dead_tup > 0
ORDER BY dead_tuple_percentage DESC, n_dead_tup DESC;

-- Bloat analysis view
CREATE OR REPLACE VIEW monitoring.table_bloat AS
SELECT
    current_database(),
    schemaname,
    tablename,
    ROUND(CASE WHEN otta=0 THEN 0.0 ELSE sml.relpages/otta::numeric END,1) AS tbloat,
    CASE WHEN relpages < otta THEN 0 ELSE relpages::bigint - otta END AS wastedpages,
    CASE WHEN relpages < otta THEN 0 ELSE bs*(sml.relpages-otta)::bigint END AS wastedbytes,
    CASE WHEN relpages < otta THEN 0 ELSE (bs*(relpages-otta))::bigint END AS wastedsize,
    CASE WHEN relpages < otta THEN 0 ELSE bs*(relpages-otta)::bigint END AS wastedsize,
    iname,
    ROUND(CASE WHEN itta=0 THEN 0.0 ELSE sml.indexpages/itta::numeric END,1) AS ibloat,
    CASE WHEN sml.indexpages < itta THEN 0 ELSE sml.indexpages::bigint - itta END AS wastedipages,
    CASE WHEN sml.indexpages < itta THEN 0 ELSE bs*(sml.indexpages-itta)::bigint END AS wastedibytes
FROM (
    SELECT
        current_database() AS curr_db,
        schemaname, tablename, cc.reltuples, cc.relpages, bs,
        CEIL((cc.reltuples*((datahdr+ma-
            (CASE WHEN datahdr%ma=0 THEN ma ELSE datahdr%ma END))+nullhdr2+4))/(bs-20::float)) AS otta,
        COALESCE(c2.relname,'?') AS iname, COALESCE(c2.reltuples,0) AS ituples, COALESCE(c2.relpages,0) AS ipages,
        COALESCE(CEIL((c2.reltuples*(datahdr-12))/(bs-20::float)),0) AS itta,
        ma, bs,
        datahdr,
        maxalign,
        ((datahdr+(maxalign-1)) & ~(maxalign-1)) + maxalign AS datahdr,
        ((datahdr-12)+(maxalign-1)) & ~(maxalign-1) AS datahdr,
        (max(CASE WHEN substring(v,12,3) IN ('8.0','8.1','8.2') THEN 27 ELSE 23 END) +
         CASE WHEN v ~ 'mingw32' THEN 8 ELSE 4 END +
         COALESCE((SELECT SUM(s1.attlen) FROM pg_attribute s1 WHERE s1.attrelid=c.oid AND s1.attnum>0),0)) AS ma,
        SUM(s1.stawalue) AS nullhdr2,
        max(CASE WHEN v ~ 'mingw32' THEN 8 ELSE 4 END) AS maxalign,
        max(CASE WHEN substring(v,12,3) IN ('8.0','8.1','8.2') THEN 27 ELSE 23 END) AS maxhdr
    FROM (
        SELECT
            table_schema,
            table_name,
            pg_stat_get_live_tuples(c.oid) AS reltuples,
            pg_stat_get_dead_tuples(c.oid) AS dead_tuples,
            pg_relation_size(c.oid) AS relpages,
            NULL AS iname,
            NULL AS ituples,
            NULL AS ipages,
            pg_stat_get_last_vacuum_time(c.oid) AS last_vacuum,
            pg_stat_get_last_autovacuum_time(c.oid) AS last_autovacuum,
            pg_stat_get_last_analyze_time(c.oid) AS last_analyze,
            pg_stat_get_last_autoanalyze_time(c.oid) AS last_autoanalyze
        FROM pg_tables c
        WHERE table_schema = 'public'
    ) AS sml
    JOIN pg_class cc ON cc.relname = sml.table_name
    JOIN pg_namespace nn ON cc.relnamespace = nn.oid AND nn.nspname = sml.table_schema
    LEFT JOIN pg_index i ON indrelid = cc.oid
    LEFT JOIN pg_class c2 ON c2.oid = i.indexrelid
    CROSS JOIN (VALUES ((SELECT current_setting('block_size')::integer),
                       CASE WHEN substring(version(),12,3) IN ('8.0','8.1','8.2') THEN 27 ELSE 23 END,
                       CASE WHEN version() ~ 'mingw32' THEN 8 ELSE 4 END)) AS bs (bs, maxhdr, ma)
    CROSS JOIN (SELECT substring(version(),12,16) AS v) AS v
    WHERE cc.relkind = 'r'
    AND nn.nspname = 'public'
    GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13,14
) AS sml
WHERE tbloat > 1.5 OR ibloat > 1.5
ORDER BY wastedibytes DESC;

-- ============================================================================
-- REAL-TIME ALERTING FUNCTIONS
-- ============================================================================

-- Function to check for performance issues
CREATE OR REPLACE FUNCTION check_performance_alerts()
RETURNS TABLE(
    alert_type TEXT,
    severity TEXT,
    message TEXT,
    metric_value NUMERIC,
    threshold NUMERIC
) AS $$
BEGIN
    RETURN QUERY

    -- Check for long-running queries
    SELECT
        'Long Running Query',
        CASE WHEN age(now(), query_start) > interval '10 minutes' THEN 'CRITICAL'
             WHEN age(now(), query_start) > interval '5 minutes' THEN 'WARNING'
             ELSE 'INFO' END,
        'Query running for ' || EXTRACT(EPOCH FROM age(now(), query_start))::text || ' seconds',
        EXTRACT(EPOCH FROM age(now(), query_start)),
        300 -- 5 minutes threshold
    FROM pg_stat_activity
    WHERE state = 'active'
    AND age(now(), query_start) > interval '5 minutes'

    UNION ALL

    -- Check for high lock waiting
    SELECT
        'Lock Contention',
        'WARNING',
        'High number of waiting connections: ' || COUNT(*),
        COUNT(*)::numeric,
        5
    FROM pg_stat_activity
    WHERE wait_event_type = 'Lock'
    GROUP BY wait_event_type
    HAVING COUNT(*) > 5

    UNION ALL

    -- Check for low cache hit ratio
    SELECT
        'Low Cache Hit Ratio',
        CASE WHEN hit_ratio < 85 THEN 'CRITICAL'
             WHEN hit_ratio < 90 THEN 'WARNING'
             ELSE 'INFO' END,
        'Cache hit ratio is ' || hit_ratio::text || '%',
        hit_ratio,
        90
    FROM (
        SELECT
            ROUND((blks_hit::numeric / NULLIF(blks_hit + blks_read, 0)) * 100, 2) as hit_ratio
        FROM pg_stat_database
        WHERE datname = current_database()
    ) t
    WHERE hit_ratio < 95

    UNION ALL

    -- Check for replication lag
    SELECT
        'Replication Lag',
        CASE WHEN lag_seconds > 300 THEN 'CRITICAL'
             WHEN lag_seconds > 60 THEN 'WARNING'
             ELSE 'INFO' END,
        'Replication lag is ' || lag_seconds::text || ' seconds',
        lag_seconds,
        60
    FROM pg_stat_replication
    WHERE EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp(pid))) > 60

    UNION ALL

    -- Check for connection pool exhaustion
    SELECT
        'Connection Pool Usage',
        CASE WHEN connection_percentage > 90 THEN 'CRITICAL'
             WHEN connection_percentage > 80 THEN 'WARNING'
             ELSE 'INFO' END,
        'Connection pool usage is ' || connection_percentage::text || '%',
        connection_percentage,
        80
    FROM (
        SELECT
            (COUNT(*)::numeric / (SELECT setting::integer FROM pg_settings WHERE name = 'max_connections')) * 100 as connection_percentage
        FROM pg_stat_activity
        WHERE state IS NOT NULL
    ) t
    WHERE connection_percentage > 80;
END;
$$ LANGUAGE plpgsql;

-- Create alerting view
CREATE OR REPLACE VIEW monitoring.performance_alerts AS
SELECT * FROM check_performance_alerts()
WHERE severity IN ('CRITICAL', 'WARNING')
ORDER BY
    CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'WARNING' THEN 2
        ELSE 3
    END,
    metric_value DESC;

-- ============================================================================
-- DASHBOARD SUMMARY
-- ============================================================================

-- Executive dashboard view
CREATE OR REPLACE VIEW monitoring.executive_dashboard AS
SELECT
    'Database Health Score' as metric_name,
    CASE
        WHEN COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) > 0 THEN 0
        WHEN COUNT(CASE WHEN severity = 'WARNING' THEN 1 END) > 2 THEN 50
        WHEN COUNT(CASE WHEN severity = 'WARNING' THEN 1 END) > 0 THEN 75
        ELSE 100
    END as metric_value,
    '%' as unit,
    CASE
        WHEN COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) > 0 THEN 'Critical Issues'
        WHEN COUNT(CASE WHEN severity = 'WARNING' THEN 1 END) > 2 THEN 'Multiple Warnings'
        WHEN COUNT(CASE WHEN severity = 'WARNING' THEN 1 END) > 0 THEN 'Minor Issues'
        ELSE 'Healthy'
    END as status
FROM monitoring.performance_alerts

UNION ALL

SELECT
    'Active Connections',
    COUNT(*)::text,
    'connections',
    CASE
        WHEN COUNT(*) > 350 THEN 'High Load'
        WHEN COUNT(*) > 200 THEN 'Moderate Load'
        ELSE 'Normal'
    END as status
FROM pg_stat_activity
WHERE state IS NOT NULL

UNION ALL

SELECT
    'Cache Hit Ratio',
    ROUND(hit_ratio::text, 2),
    '%',
    CASE
        WHEN hit_ratio > 95 THEN 'Excellent'
        WHEN hit_ratio > 90 THEN 'Good'
        WHEN hit_ratio > 85 THEN 'Fair'
        ELSE 'Poor'
    END as status
FROM (
    SELECT
        (blks_hit::numeric / NULLIF(blks_hit + blks_read, 0)) * 100 as hit_ratio
    FROM pg_stat_database
    WHERE datname = current_database()
) t

UNION ALL

SELECT
    'Average Query Time',
    ROUND(AVG(mean_time)::text, 2),
    'ms',
    CASE
        WHEN AVG(mean_time) < 10 THEN 'Excellent'
        WHEN AVG(mean_time) < 100 THEN 'Good'
        WHEN AVG(mean_time) < 1000 THEN 'Fair'
        ELSE 'Poor'
    END as status
FROM pg_stat_statements;

-- ============================================================================
-- HISTORICAL DATA COLLECTION
-- ============================================================================

-- Create monitoring metrics table for historical tracking
CREATE TABLE IF NOT EXISTS monitoring_metrics_history (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC,
    metric_unit VARCHAR(50),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    additional_data JSONB
);

-- Create indexes for monitoring history
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_history_name_time
ON monitoring_metrics_history(metric_name, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_history_time
ON monitoring_metrics_history(recorded_at DESC);

-- Function to collect monitoring metrics
CREATE OR REPLACE FUNCTION collect_monitoring_metrics()
RETURNS void AS $$
DECLARE
    metric_record RECORD;
BEGIN
    -- Collect database metrics
    INSERT INTO monitoring_metrics_history (metric_name, metric_value, metric_unit)
    SELECT
        'active_connections',
        COUNT(*),
        'connections'
    FROM pg_stat_activity
    WHERE state IS NOT NULL;

    INSERT INTO monitoring_metrics_history (metric_name, metric_value, metric_unit)
    SELECT
        'cache_hit_ratio',
        (blks_hit::numeric / NULLIF(blks_hit + blks_read, 0)) * 100,
        'percent'
    FROM pg_stat_database
    WHERE datname = current_database();

    INSERT INTO monitoring_metrics_history (metric_name, metric_value, metric_unit)
    SELECT
        'transactions_per_second',
        (xact_commit + xact_rollback)::numeric / EXTRACT(EPOCH FROM (now() - stats_reset)),
        'tps'
    FROM pg_stat_database
    WHERE datname = current_database();

    INSERT INTO monitoring_metrics_history (metric_name, metric_value, metric_unit)
    SELECT
        'deadlock_count',
        deadlocks,
        'count'
    FROM pg_stat_database
    WHERE datname = current_database();

    INSERT INTO monitoring_metrics_history (metric_name, metric_value, metric_unit)
    SELECT
        'replication_lag_seconds',
        EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp(pid))),
        'seconds'
    FROM pg_stat_replication
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Schedule metrics collection (requires pg_cron extension)
-- SELECT cron.schedule('collect-metrics', '*/5 * * * *', 'SELECT collect_monitoring_metrics();');

-- ============================================================================
-- MONITORING STRATEGY COMPLETION
-- ============================================================================

-- Grant access to monitoring views
GRANT SELECT ON ALL TABLES IN SCHEMA monitoring TO labelmint_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA monitoring TO labelmint_analytics;
GRANT SELECT ON monitoring.performance_alerts TO labelmint_admin;

-- Report completion
DO $$
BEGIN
    RAISE NOTICE 'Database monitoring strategy implemented successfully';
    RAISE NOTICE 'Monitoring views created:';
    RAISE NOTICE '  - monitoring.query_performance';
    RAISE NOTICE '  - monitoring.slow_queries';
    RAISE NOTICE '  - monitoring.optimization_opportunities';
    RAISE NOTICE '  - monitoring.database_metrics';
    RAISE NOTICE '  - monitoring.table_performance';
    RAISE NOTICE '  - monitoring.index_usage';
    RAISE NOTICE '  - monitoring.active_connections';
    RAISE NOTICE '  - monitoring.connection_pool_analysis';
    RAISE NOTICE '  - monitoring.blocking_queries';
    RAISE NOTICE '  - monitoring.buffer_cache_analysis';
    RAISE NOTICE '  - monitoring.memory_usage';
    RAISE NOTICE '  - monitoring.vacuum_analysis';
    RAISE NOTICE '  - monitoring.table_bloat';
    RAISE NOTICE '  - monitoring.performance_alerts';
    RAISE NOTICE '  - monitoring.executive_dashboard';
    RAISE NOTICE '  - monitoring_metrics_history';
    RAISE NOTICE 'Alerting functions: check_performance_alerts(), collect_monitoring_metrics()';
END $$;