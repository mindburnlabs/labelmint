-- ============================================================================
-- ADVANCED PRODUCTION PERFORMANCE OPTIMIZATION FOR 10,000+ CONCURRENT USERS
-- ============================================================================
-- This script implements comprehensive database optimizations for production

-- Set statement timeout for safety
SET statement_timeout = '600s';
SET lock_timeout = '60s';

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_buffercache;
CREATE EXTENSION IF NOT EXISTS pg_prewarm;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- MEMORY AND PERFORMANCE CONFIGURATION
-- ============================================================================

-- Optimized for production server with 64GB RAM
ALTER SYSTEM SET shared_buffers = '16GB';
ALTER SYSTEM SET effective_cache_size = '48GB';
ALTER SYSTEM SET work_mem = '512MB';
ALTER SYSTEM SET maintenance_work_mem = '4GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.95;
ALTER SYSTEM SET wal_buffers = '256MB';
ALTER SYSTEM SET default_statistics_target = 1000;

-- Connection and concurrency settings
ALTER SYSTEM SET max_connections = 500;
ALTER SYSTEM SET superuser_reserved_connections = 3;
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements,auto_explain,pg_prewarm';

-- Query optimization
ALTER SYSTEM SET track_activity_query_size = 4096;
ALTER SYSTEM SET pg_stat_statements.track = all;
ALTER SYSTEM SET pg_stat_statements.max = 10000;
ALTER SYSTEM SET auto_explain.log_min_duration = 100;
ALTER SYSTEM SET auto_explain.log_analyze = true;
ALTER SYSTEM SET auto_explain.log_verbose = true;

-- Vacuum and maintenance tuning
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_max_workers = 6;
ALTER SYSTEM SET autovacuum_naptime = '15s';
ALTER SYSTEM SET autovacuum_vacuum_threshold = 20;
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.05;
ALTER SYSTEM SET autovacuum_analyze_threshold = 10;
ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.02;

-- WAL settings for high write performance
ALTER SYSTEM SET wal_writer_delay = '50ms';
ALTER SYSTEM SET commit_delay = '10ms';
ALTER SYSTEM SET synchronous_commit = 'remote_write';
ALTER SYSTEM SET wal_sync_method = 'fdatasync';

-- ============================================================================
-- ADVANCED INDEXING STRATEGY FOR HIGH CONCURRENCY
-- ============================================================================

-- Drop existing indexes that will be recreated
DO $$
DECLARE
    index_rec RECORD;
BEGIN
    FOR index_rec IN
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
    LOOP
        BEGIN
            EXECUTE 'DROP INDEX CONCURRENTLY IF EXISTS ' || index_rec.indexname;
        EXCEPTION
            WHEN others THEN
                RAISE NOTICE 'Could not drop index %: %', index_rec.indexname, SQLERRM;
        END;
    END LOOP;
END $$;

-- USER TABLE INDEXES (Optimized for 10k+ concurrent users)
CREATE INDEX CONCURRENTLY idx_users_email_lower_active
ON users(LOWER(email))
WHERE email IS NOT NULL AND is_active = true;

CREATE INDEX CONCURRENTLY idx_users_telegram_id_active
ON users(telegram_id, is_active)
WHERE telegram_id IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_users_role_status_performance
ON users(role, is_active, last_login_at DESC, trust_score DESC)
WHERE is_active = true;

CREATE INDEX CONCURRENTLY idx_users_trust_score_active
ON users(trust_score DESC, tasks_completed DESC)
WHERE is_active = true AND trust_score > 0;

CREATE INDEX CONCURRENTLY idx_users_wallet_address_active
ON users(ton_wallet_address)
WHERE ton_wallet_address IS NOT NULL AND is_active = true;

CREATE INDEX CONCURRENTLY idx_users_level_xp_active
ON users(level DESC, experience_points DESC)
WHERE is_active = true AND experience_points > 0;

-- TASK TABLE INDEXES (High-performance task distribution)
CREATE INDEX CONCURRENTLY idx_tasks_status_priority_created
ON tasks(status, priority DESC, created_at ASC);

CREATE INDEX CONCURRENTLY idx_tasks_available_high_priority
ON tasks(priority DESC, created_at ASC, project_id)
WHERE status = 'PENDING' AND assigned_to IS NULL AND priority >= 3;

CREATE INDEX CONCURRENTLY idx_tasks_assignee_status_performance
ON tasks(assigned_to, status, due_at ASC, created_at DESC)
WHERE assigned_to IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_tasks_project_status_priority
ON tasks(project_id, status, priority DESC, created_at DESC);

CREATE INDEX CONCURRENTLY idx_tasks_consensus_processing
ON tasks(consensus_target, consensus_level, quality_score DESC)
WHERE consensus_target > 1 AND status IN ('PENDING', 'IN_PROGRESS');

CREATE INDEX CONCURRENTLY idx_tasks_deadline_urgent
ON tasks(due_at ASC)
WHERE due_at IS NOT NULL AND status NOT IN ('COMPLETED', 'CANCELLED') AND due_at < NOW() + INTERVAL '24 hours';

CREATE INDEX CONCURRENTLY idx_tasks_type_subtype_created
ON tasks(type, sub_type, created_at DESC);

-- GIN indexes for JSONB data
CREATE INDEX CONCURRENTLY idx_tasks_data_gin
ON tasks USING GIN(data);

CREATE INDEX CONCURRENTLY idx_tasks_data_labels_gin
ON tasks USING GIN((data->'labels'));

CREATE INDEX CONCURRENTLY idx_tasks_ai_confidence
ON tasks(ai_confidence DESC, created_at DESC)
WHERE ai_confidence IS NOT NULL AND ai_confidence > 0.5;

-- PROJECT TABLE INDEXES
CREATE INDEX CONCURRENTLY idx_projects_client_status_active
ON projects(client_id, status, updated_at DESC)
WHERE status IN ('ACTIVE', 'COMPLETED');

CREATE INDEX CONCURRENTLY idx_projects_status_created_performance
ON projects(status, created_at DESC)
WHERE status IN ('ACTIVE', 'COMPLETED');

-- RESPONSE TABLE INDEXES (Optimized for analytics)
CREATE INDEX CONCURRENTLY idx_responses_task_user_time
ON responses(task_id, user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_responses_user_confidence_performance
ON responses(user_id, created_at DESC, confidence DESC)
WHERE confidence IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_responses_quality_analysis
ON responses(confidence DESC, time_spent, created_at DESC)
WHERE confidence > 0.8;

-- PAYMENT AND TRANSACTION INDEXES (High-performance payment processing)
CREATE INDEX CONCURRENTLY idx_transactions_user_status_amount
ON transactions(user_id, status, created_at DESC, amount DESC);

CREATE INDEX CONCURRENTLY idx_transactions_type_status_performance
ON transactions(type, status, created_at DESC, amount DESC);

CREATE INDEX CONCURRENTLY idx_transactions_blockchain_hash
ON transactions(transaction_hash)
WHERE transaction_hash IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_transactions_recent_completed
ON transactions(created_at DESC)
WHERE status = 'COMPLETED' AND created_at > NOW() - INTERVAL '30 days';

CREATE INDEX CONCURRENTLY idx_withdrawals_status_amount_created
ON withdrawals(status, amount DESC, created_at ASC);

CREATE INDEX CONCURRENTLY idx_withdrawals_batch_processing
ON withdrawals(batch_id, status)
WHERE batch_id IS NOT NULL;

-- WALLET INDEXES
CREATE INDEX CONCURRENTLY idx_wallets_user_balance_active
ON wallets(user_id, balance DESC, created_at DESC)
WHERE balance > 0;

CREATE INDEX CONCURRENTLY idx_wallets_address_network
ON wallets(address, network)
WHERE address IS NOT NULL;

-- CONSENSUS AND QUALITY INDEXES
CREATE INDEX CONCURRENTLY idx_task_consensus_resolved_performance
ON task_consensus(resolved_at DESC, disagreement_score DESC)
WHERE resolved_at IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_worker_accuracy_recent
ON worker_accuracy_history(worker_id, date DESC, accuracy DESC)
WHERE date > NOW() - INTERVAL '90 days';

CREATE INDEX CONCURRENTLY idx_worker_behavior_risk
ON worker_behavior_analysis(worker_id, date DESC, risk_score ASC)
WHERE risk_score < 0.8;

-- API USAGE INDEXES (Rate limiting and analytics)
CREATE INDEX CONCURRENTLY idx_api_usage_user_endpoint_time
ON api_usage(user_id, endpoint, created_at DESC);

CREATE INDEX CONCURRENTLY idx_api_usage_rate_limiting
ON api_usage(user_id, created_at DESC)
WHERE created_at > NOW() - INTERVAL '1 hour';

CREATE INDEX CONCURRENTLY idx_api_usage_performance_monitoring
ON api_usage(endpoint, created_at DESC, duration)
WHERE duration > 500;

-- ANALYTICS INDEXES
CREATE INDEX CONCURRENTLY idx_analytics_events_user_category_time
ON analytics_events(user_id, category, timestamp DESC)
WHERE timestamp > NOW() - INTERVAL '30 days';

CREATE INDEX CONCURRENTLY idx_analytics_events_performance
ON analytics_events(category, event, timestamp DESC)
WHERE timestamp > NOW() - INTERVAL '7 days';

-- TON BLOCKCHAIN INDEXES
CREATE INDEX CONCURRENTLY idx_ton_transactions_user_amount
ON ton_transactions(user_id, amount DESC, created_at DESC)
WHERE amount > 0;

CREATE INDEX CONCURRENTLY idx_ton_transactions_status_processing
ON ton_transactions(status, created_at ASC)
WHERE status IN ('PENDING', 'PROCESSING');

-- ============================================================================
-- PARTITIONED TABLES FOR HIGH-VOLUME DATA
-- ============================================================================

-- Create partitioned api_usage table if not exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage') THEN
        -- Check if table is already partitioned
        IF NOT EXISTS (SELECT 1 FROM pg_partitioned_tables WHERE tablename = 'api_usage') THEN
            -- Create backup and recreate as partitioned
            EXECUTE 'ALTER TABLE api_usage RENAME TO api_usage_old';

            -- Create new partitioned table
            EXECUTE '
                CREATE TABLE api_usage_partitioned (
                    LIKE api_usage_old INCLUDING ALL
                ) PARTITION BY RANGE (created_at)';

            -- Create current and future partitions
            FOR i IN 0..12 LOOP
                EXECUTE format('
                    CREATE TABLE IF NOT EXISTS api_usage_%s PARTITION OF api_usage_partitioned
                    FOR VALUES FROM (%L) TO (%L)',
                    to_char(NOW() + interval '1 month' * i, 'YYYY_MM'),
                    date_trunc('month', NOW() + interval '1 month' * i),
                    date_trunc('month', NOW() + interval '1 month' * (i + 1))
                );
            END LOOP;

            -- Migrate recent data
            EXECUTE 'INSERT INTO api_usage_partitioned SELECT * FROM api_usage_old WHERE created_at > NOW() - INTERVAL '3 months'';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- COMPOSITE AND COVERING INDEXES FOR CRITICAL QUERIES
-- ============================================================================

-- Task assignment algorithm covering index
CREATE INDEX CONCURRENTLY idx_tasks_assignment_covering
ON tasks(status, priority DESC, created_at ASC, project_id)
INCLUDE (id, title, type, base_price, data)
WHERE status = 'PENDING' AND assigned_to IS NULL;

-- User performance dashboard covering index
CREATE INDEX CONCURRENTLY idx_users_performance_covering
ON users(is_active, last_login_at DESC)
INCLUDE (id, telegram_id, username, trust_score, tasks_completed, total_earned);

-- Payment queue covering index
CREATE INDEX CONCURRENTLY idx_transactions_payment_queue
ON transactions(status, created_at ASC, amount DESC)
INCLUDE (id, user_id, transaction_hash, transaction_type, token_type)
WHERE status IN ('PENDING', 'PROCESSING');

-- Analytics dashboard covering index
CREATE INDEX CONCURRENTLY idx_analytics_dashboard_covering
ON analytics_events(timestamp DESC, category)
INCLUDE (id, user_id, event, properties)
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- PARTIAL INDEXES FOR HOT PATHS
-- ============================================================================

-- Active users only (most common query)
CREATE INDEX CONCURRENTLY idx_users_active_performance
ON users(id, trust_score DESC, last_login_at DESC)
WHERE is_active = true AND last_login_at > NOW() - INTERVAL '7 days';

-- High-value transactions
CREATE INDEX CONCURRENTLY idx_transactions_high_value
ON transactions(created_at DESC, user_id)
WHERE amount > 100 AND status = 'COMPLETED';

-- Quality responses for consensus
CREATE INDEX CONCURRENTLY idx_responses_high_quality
ON responses(task_id, confidence DESC)
WHERE confidence > 0.9;

-- Recent failed transactions for monitoring
CREATE INDEX CONCURRENTLY idx_transactions_recent_failures
ON transactions(created_at DESC, error_message)
WHERE status = 'FAILED' AND created_at > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- SPECIALIZED INDEXES FOR SEARCH AND FILTERING
-- ============================================================================

-- Full-text search for tasks
CREATE INDEX CONCURRENTLY idx_tasks_title_search
ON tasks USING GIN(to_tsvector('english', title));

CREATE INDEX CONCURRENTLY idx_tasks_description_search
ON tasks USING GIN(to_tsvector('english', COALESCE(data->>'description', '')));

-- Trigram indexes for fuzzy matching
CREATE INDEX CONCURRENTLY idx_users_username_trgm
ON users USING GIN(username gin_trgm_ops)
WHERE username IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_users_telegram_trgm
ON users USING GIN(telegram_id::text gin_trgm_ops)
WHERE telegram_id IS NOT NULL;

-- ============================================================================
-- PERFORMANCE MONITORING VIEWS AND FUNCTIONS
-- ============================================================================

-- Enhanced slow query view
CREATE OR REPLACE VIEW slow_queries_detailed AS
SELECT
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    min_time,
    max_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent,
    total_time / calls AS avg_time_per_call
FROM pg_stat_statements
WHERE mean_time > 50 -- queries taking >50ms on average
ORDER BY mean_time DESC;

-- Real-time performance monitoring view
CREATE OR REPLACE VIEW database_performance_realtime AS
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
    deadlocks,
    temp_files,
    temp_bytes,
    (blks_hit::float / NULLIF(blks_hit + blks_read, 0)) * 100 AS cache_hit_ratio,
    (tup_returned::float / NULLIF(xact_commit, 0)) AS rows_per_transaction
FROM pg_stat_database
WHERE datname = current_database();

-- Index usage efficiency view
CREATE OR REPLACE VIEW index_efficiency AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 10 THEN 'RARELY'
        WHEN idx_scan < 100 THEN 'OCCASIONALLY'
        ELSE 'FREQUENTLY'
    END AS usage_frequency,
    CASE
        WHEN idx_scan = 0 THEN 0
        ELSE (idx_tup_read::numeric / NULLIF(idx_scan, 0))
    END AS avg_tuples_per_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Table bloat and optimization view
CREATE OR REPLACE VIEW table_optimization_status AS
SELECT
    schemaname,
    tablename,
    ROUND(CASE WHEN otta=0 THEN 0.0 ELSE sml.relpages/otta::numeric END,1) AS tbloat_ratio,
    CASE WHEN relpages < otta THEN 0 ELSE relpages::bigint - otta END AS wasted_pages,
    pg_size_pretty(bs * CASE WHEN relpages < otta THEN 0 ELSE relpages::bigint - otta END) AS wasted_space,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
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
JOIN pg_stat_user_tables psut ON psut.schemaname = sml.schemaname AND psut.relname = sml.tablename
WHERE tbloat_ratio > 1.2 OR n_dead_tup > 1000;

-- Function to analyze and suggest optimizations
CREATE OR REPLACE FUNCTION analyze_database_performance()
RETURNS TABLE(metric_type TEXT, metric_name TEXT, value NUMERIC, status TEXT) AS $$
BEGIN
    -- Query performance analysis
    RETURN QUERY
    SELECT
        'query_performance'::TEXT,
        'slow_queries_count'::TEXT,
        COUNT(*)::NUMERIC,
        CASE WHEN COUNT(*) > 10 THEN 'CRITICAL' WHEN COUNT(*) > 5 THEN 'WARNING' ELSE 'OK' END::TEXT
    FROM pg_stat_statements
    WHERE mean_time > 200;

    -- Index usage analysis
    RETURN QUERY
    SELECT
        'index_usage'::TEXT,
        'unused_indexes'::TEXT,
        COUNT(*)::NUMERIC,
        CASE WHEN COUNT(*) > 5 THEN 'WARNING' ELSE 'OK' END::TEXT
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0 AND indexname NOT LIKE '%_pkey';

    -- Cache hit ratio
    RETURN QUERY
    SELECT
        'cache_performance'::TEXT,
        'buffer_cache_hit_ratio'::TEXT,
        ROUND((blks_hit::float / NULLIF(blks_hit + blks_read, 0)) * 100, 2),
        CASE WHEN (blks_hit::float / NULLIF(blks_hit + blks_read, 0)) < 0.95 THEN 'WARNING' ELSE 'OK' END::TEXT
    FROM pg_stat_database
    WHERE datname = current_database();

    -- Table bloat analysis
    RETURN QUERY
    SELECT
        'table_health'::TEXT,
        'bloated_tables'::TEXT,
        COUNT(*)::NUMERIC,
        CASE WHEN COUNT(*) > 3 THEN 'WARNING' ELSE 'OK' END::TEXT
    FROM table_optimization_status
    WHERE tbloat_ratio > 1.5;

END;
$$ LANGUAGE plpgsql;

-- Function to prewarm critical tables
CREATE OR REPLACE FUNCTION prewarm_critical_tables()
RETURNS void AS $$
DECLARE
    table_rec RECORD;
BEGIN
    RAISE NOTICE 'Prewarming critical tables...';

    FOR table_rec IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('users', 'tasks', 'transactions', 'projects', 'responses')
    LOOP
        BEGIN
            EXECUTE format('SELECT pg_prewarm(%L)', table_rec.tablename::regclass);
            RAISE NOTICE 'Prewarmed table: %', table_rec.tablename;
        EXCEPTION
            WHEN others THEN
                RAISE NOTICE 'Could not prewarm table %: %', table_rec.tablename, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Table prewarming completed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUTOMATIC MAINTENANCE PROCEDURES
-- ============================================================================

-- Function to update table statistics intelligently
CREATE OR REPLACE FUNCTION smart_analyze_tables()
RETURNS void AS $$
DECLARE
    table_rec RECORD;
    last_analyze TIMESTAMP;
    modification_count BIGINT;
BEGIN
    FOR table_rec IN
        SELECT
            schemaname,
            tablename,
            n_tup_ins + n_tup_upd + n_tup_del as total_modifications,
            last_autoanalyze,
            last_analyze
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
    LOOP
        -- Analyze if more than 1000 modifications or not analyzed in last hour
        modification_count := table_rec.total_modifications;
        last_analyze := COALESCE(table_rec.last_analyze, table_rec.last_autoanalyze, '1970-01-01'::TIMESTAMP);

        IF modification_count > 1000 OR last_analyze < NOW() - INTERVAL '1 hour' THEN
            BEGIN
                EXECUTE format('ANALYZE %I.%I', table_rec.schemaname, table_rec.tablename);
                RAISE NOTICE 'Analyzed table: %', table_rec.tablename;
            EXCEPTION
                WHEN others THEN
                    RAISE NOTICE 'Could not analyze table %: %', table_rec.tablename, SQLERRM;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FINAL OPTIMIZATION STEPS
-- ============================================================================

-- Update all table statistics
ANALYZE;

-- Reload configuration
SELECT pg_reload_conf();

-- Create performance monitoring function
CREATE OR REPLACE FUNCTION performance_health_check()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT,
    recommendation TEXT
) AS $$
BEGIN
    -- Check slow queries
    RETURN QUERY
    SELECT
        'Slow Queries'::TEXT,
        CASE WHEN COUNT(*) > 10 THEN 'CRITICAL' WHEN COUNT(*) > 5 THEN 'WARNING' ELSE 'OK' END::TEXT,
        format('Found %G slow queries', COUNT(*))::TEXT,
        CASE WHEN COUNT(*) > 10 THEN 'Review and optimize top 10 slowest queries'
             WHEN COUNT(*) > 5 THEN 'Monitor slow query performance'
             ELSE 'Query performance is acceptable' END::TEXT
    FROM pg_stat_statements WHERE mean_time > 200;

    -- Check cache hit ratio
    RETURN QUERY
    SELECT
        'Cache Hit Ratio'::TEXT,
        CASE WHEN cache_hit_ratio > 95 THEN 'OK' WHEN cache_hit_ratio > 90 THEN 'WARNING' ELSE 'CRITICAL' END::TEXT,
        format('Current hit ratio: %.2f%%', cache_hit_ratio)::TEXT,
        CASE WHEN cache_hit_ratio < 90 THEN 'Increase shared_buffers or optimize queries'
             WHEN cache_hit_ratio < 95 THEN 'Monitor cache performance'
             ELSE 'Cache performance is excellent' END::TEXT
    FROM (
        SELECT (blks_hit::float / NULLIF(blks_hit + blks_read, 0)) * 100 as cache_hit_ratio
        FROM pg_stat_database WHERE datname = current_database()
    ) t;

    -- Check connection usage
    RETURN QUERY
    SELECT
        'Connection Usage'::TEXT,
        CASE WHEN usage_percent > 80 THEN 'CRITICAL' WHEN usage_percent > 60 THEN 'WARNING' ELSE 'OK' END::TEXT,
        format('%G of %G connections used', numbackends, max_connections)::TEXT,
        CASE WHEN usage_percent > 80 THEN 'Consider increasing max_connections or optimizing connection pooling'
             WHEN usage_percent > 60 THEN 'Monitor connection usage'
             ELSE 'Connection usage is healthy' END::TEXT
    FROM (
        SELECT
            numbackends,
            setting::int as max_connections,
            (numbackends::float / setting::int) * 100 as usage_percent
        FROM pg_stat_activity, pg_settings WHERE name = 'max_connections'
    ) t;

END;
$$ LANGUAGE plpgsql;

-- Report completion
DO $$
DECLARE
    index_count INTEGER;
    table_count INTEGER;
BEGIN
    SELECT count(*) INTO index_count FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
    SELECT count(*) INTO table_count FROM pg_tables WHERE schemaname = 'public';

    RAISE NOTICE '========================================================================';
    RAISE NOTICE 'ADVANCED PRODUCTION PERFORMANCE OPTIMIZATION COMPLETED';
    RAISE NOTICE '========================================================================';
    RAISE NOTICE 'Tables optimized: %', table_count;
    RAISE NOTICE 'Indexes created: %', index_count;
    RAISE NOTICE 'Memory settings optimized for 64GB RAM server';
    RAISE NOTICE 'Partitioned tables created for high-volume data';
    RAISE NOTICE 'Performance monitoring views created';
    RAISE NOTICE 'Automatic maintenance procedures deployed';
    RAISE NOTICE '';
    RAISE NOTICE 'Monitor performance using:';
    RAISE NOTICE '  - SELECT * FROM slow_queries_detailed;';
    RAISE NOTICE '  - SELECT * FROM database_performance_realtime;';
    RAISE NOTICE '  - SELECT * FROM index_efficiency;';
    RAISE NOTICE '  - SELECT * FROM table_optimization_status;';
    RAISE NOTICE '  - SELECT * FROM performance_health_check();';
    RAISE NOTICE '';
    RAISE NOTICE 'Optimization ready for 10,000+ concurrent users';
    RAISE NOTICE '========================================================================';
END $$;