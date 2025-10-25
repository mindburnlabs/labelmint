-- ============================================================================
-- DATABASE SCALING AND REPLICATION ARCHITECTURE FOR LABELMINT
-- ============================================================================

-- Set statement timeout for safety
SET statement_timeout = '600s';

-- ============================================================================
-- LOGICAL REPLICATION SETUP
-- ============================================================================

-- Create publication for all tables on primary
DO $$
BEGIN
    -- Drop existing publication if it exists
    DROP PUBLICATION IF EXISTS labelmint_all_tables;

    -- Create publication for all tables
    CREATE PUBLICATION labelmint_all_tables
        FOR ALL TABLES
        WITH (publish = 'insert, update, delete, truncate');

    RAISE NOTICE 'Publication labelmint_all_tables created for all tables';
END $$;

-- Create filtered publications for specific use cases
DO $$
BEGIN
    -- Analytics publication (subset of tables)
    DROP PUBLICATION IF EXISTS labelmint_analytics;

    CREATE PUBLICATION labelmint_analytics
        FOR TABLE users, tasks, responses, projects, transactions, api_usage, analytics_events
        WITH (publish = 'insert, update, delete');

    -- Read replica publication (exclude sensitive financial data)
    DROP PUBLICATION IF EXISTS labelmint_read_replica;

    CREATE PUBLICATION labelmint_read_replica
        FOR TABLE users, tasks, responses, projects, task_consensus, worker_accuracy_history
        WITH (publish = 'insert, update, delete');

    RAISE NOTICE 'Filtered publications created for specific use cases';
END $$;

-- ============================================================================
-- PHYSICAL REPLICATION SLOTS
-- ============================================================================

-- Create physical replication slots for each replica
DO $$
BEGIN
    -- Replica 1 (Primary read replica)
    SELECT pg_create_physical_replication_slot('replica_slot_1')
    WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot_1');

    -- Replica 2 (Analytics replica)
    SELECT pg_create_physical_replication_slot('replica_slot_2')
    WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot_2');

    -- Replica 3 (Geographic replica)
    SELECT pg_create_physical_replication_slot('replica_slot_3')
    WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica_slot_3');

    -- Backup slot for WAL archiving
    SELECT pg_create_physical_replication_slot('backup_slot')
    WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'backup_slot');

    RAISE NOTICE 'Physical replication slots created';
END $$;

-- Create logical replication slots for filtered replication
DO $$
BEGIN
    -- Analytics logical slot
    SELECT pg_create_logical_replication_slot('analytics_slot', 'pgoutput')
    WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'analytics_slot');

    -- Real-time updates logical slot
    SELECT pg_create_logical_replication_slot('realtime_slot', 'pgoutput')
    WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'realtime_slot');

    RAISE NOTICE 'Logical replication slots created';
END $$;

-- ============================================================================
-- PARTITIONING STRATEGY FOR HIGH-VOLUME TABLES
-- ============================================================================

-- Partition API usage table by month
DO $$
BEGIN
    -- Check if table exists and is not already partitioned
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage') AND
       NOT EXISTS (SELECT 1 FROM information_schema.partitions WHERE table_name = 'api_usage') THEN

        -- Create partitioned table
        ALTER TABLE api_usage DROP CONSTRAINT api_usage_pkey CASCADE;

        -- Recreate as partitioned table
        CREATE TABLE api_usage_partitioned (
            LIKE api_usage INCLUDING ALL
        ) PARTITION BY RANGE (created_at);

        -- Create initial partitions (past 6 months + future 6 months)
        FOR i IN -6..6 LOOP
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS api_usage_%s PARTITION OF api_usage_partitioned
                FOR VALUES FROM (%L) TO (%L)',
                to_char(now() + interval '1 month' * i, 'YYYY_MM'),
                date_trunc('month', now() + interval '1 month' * i),
                date_trunc('month', now() + interval '1 month' * (i + 1))
            );
        END LOOP;

        -- Copy data from original table
        INSERT INTO api_usage_partitioned SELECT * FROM api_usage;

        -- Drop original table and rename
        DROP TABLE api_usage;
        ALTER TABLE api_usage_partitioned RENAME TO api_usage;

        -- Recreate primary key
        ALTER TABLE api_usage ADD PRIMARY KEY (id, created_at);

        RAISE NOTICE 'API usage table partitioned by month';
    END IF;
END $$;

-- Partition analytics events table by day
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_events') AND
       NOT EXISTS (SELECT 1 FROM information_schema.partitions WHERE table_name = 'analytics_events') THEN

        -- Create partitioned table
        ALTER TABLE analytics_events DROP CONSTRAINT analytics_events_pkey CASCADE;

        CREATE TABLE analytics_events_partitioned (
            LIKE analytics_events INCLUDING ALL
        ) PARTITION BY RANGE (timestamp);

        -- Create daily partitions for past week and future week
        FOR i IN -7..7 LOOP
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS analytics_events_%s PARTITION OF analytics_events_partitioned
                FOR VALUES FROM (%L) TO (%L)',
                to_char(now() + interval '1 day' * i, 'YYYY_MM_DD'),
                date_trunc('day', now() + interval '1 day' * i),
                date_trunc('day', now() + interval '1 day' * (i + 1))
            );
        END LOOP;

        -- Copy data and migrate
        INSERT INTO analytics_events_partitioned SELECT * FROM analytics_events;
        DROP TABLE analytics_events;
        ALTER TABLE analytics_events_partitioned RENAME TO analytics_events;
        ALTER TABLE analytics_events ADD PRIMARY KEY (id, timestamp);

        RAISE NOTICE 'Analytics events table partitioned by day';
    END IF;
END $$;

-- Partition transactions table by year
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') AND
       NOT EXISTS (SELECT 1 FROM information_schema.partitions WHERE table_name = 'transactions') THEN

        ALTER TABLE transactions DROP CONSTRAINT transactions_pkey CASCADE;

        CREATE TABLE transactions_partitioned (
            LIKE transactions INCLUDING ALL
        ) PARTITION BY RANGE (created_at);

        -- Create yearly partitions
        FOR year IN 2023..2026 LOOP
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS transactions_%s PARTITION OF transactions_partitioned
                FOR VALUES FROM (%L) TO (%L)',
                year,
                make_date(year, 1, 1),
                make_date(year + 1, 1, 1)
            );
        END LOOP;

        INSERT INTO transactions_partitioned SELECT * FROM transactions;
        DROP TABLE transactions;
        ALTER TABLE transactions_partitioned RENAME TO transactions;
        ALTER TABLE transactions ADD PRIMARY KEY (id, created_at);

        RAISE NOTICE 'Transactions table partitioned by year';
    END IF;
END $$;

-- ============================================================================
-- SHARDING PREPARATION
-- ============================================================================

-- Create distributed user_id hashing function
CREATE OR REPLACE FUNCTION hash_user_id(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN ('x' || lpad(right(md5(user_id::text), 8), 8, '0'))::bit(32)::integer;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to determine shard for a user
CREATE OR REPLACE FUNCTION get_user_shard(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    hash_result INTEGER;
    shard_count INTEGER := 4; -- Number of shards
BEGIN
    hash_result := hash_user_id(user_id);
    RETURN 'users_shard_' || ((hash_result % shard_count + shard_count) % shard_count);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create shard routing function for queries
CREATE OR REPLACE FUNCTION route_user_query(user_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN get_user_shard(user_id);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- CONNECTION POOLING CONFIGURATION
-- ============================================================================

-- Create view for monitoring connection pool usage
CREATE OR REPLACE VIEW monitoring.connection_pool_stats AS
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
    stats_reset as last_stats_reset
FROM pg_stat_database
WHERE datname NOT IN ('template0', 'template1', 'postgres');

-- Create view for monitoring replication lag
CREATE OR REPLACE VIEW monitoring.replication_lag AS
SELECT
    slot_name,
    plugin,
    slot_type,
    database,
    active,
    restart_lsn,
    confirmed_flush_lsn,
    pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) as lag_bytes,
    pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) as flush_lag_bytes
FROM pg_replication_slots
ORDER BY slot_name;

-- Create view for monitoring streaming replication
CREATE OR REPLACE VIEW monitoring.streaming_replication AS
SELECT
    application_name as replica_name,
    client_addr as replica_ip,
    state as replication_state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) as sent_lag_bytes,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) as replay_lag_bytes,
    sync_state,
    priority,
    backend_start as connection_start,
    backend_xmin as xmin_horizon,
    query as current_query
FROM pg_stat_replication
ORDER BY replay_lag_bytes;

-- ============================================================================
-- HIGH AVAILABILITY CONFIGURATION
-- ============================================================================

-- Create function for automatic failover monitoring
CREATE OR REPLACE FUNCTION check_replication_health()
RETURNS TABLE(
    replica_name TEXT,
    status TEXT,
    lag_seconds NUMERIC,
    recommendation TEXT
) AS $$
DECLARE
    lag_threshold NUMERIC := 60; -- 60 seconds threshold
    critical_lag_threshold NUMERIC := 300; -- 5 minutes critical
BEGIN
    RETURN QUERY
    SELECT
        sr.application_name,
        CASE
            WHEN sr.state = 'streaming' AND pg_wal_lsn_diff(pg_current_wal_lsn(), sr.replay_lsn) <= lag_threshold THEN 'HEALTHY'
            WHEN sr.state = 'streaming' AND pg_wal_lsn_diff(pg_current_wal_lsn(), sr.replay_lsn) <= critical_lag_threshold THEN 'WARNING'
            ELSE 'CRITICAL'
        END as status,
        EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp(sr.pid))) as lag_seconds,
        CASE
            WHEN sr.state != 'streaming' THEN 'Replica not streaming - check connection'
            WHEN pg_wal_lsn_diff(pg_current_wal_lsn(), sr.replay_lsn) > critical_lag_threshold THEN 'Consider failover - excessive lag'
            WHEN pg_wal_lsn_diff(pg_current_wal_lsn(), sr.replay_lsn) > lag_threshold THEN 'Monitor closely - high lag'
            ELSE 'Normal operation'
        END as recommendation
    FROM pg_stat_replication sr
    WHERE sr.state IS NOT NULL;

    -- Add non-responsive replicas
    RETURN QUERY
    SELECT
        rs.slot_name::text,
        'CRITICAL'::text,
        999999::numeric,
        'Replica slot inactive - investigate immediately'
    FROM pg_replication_slots rs
    WHERE rs.active = false
    AND rs.slot_type = 'physical';
END;
$$ LANGUAGE plpgsql;

-- Create health check view
CREATE OR REPLACE VIEW monitoring.replication_health AS
SELECT * FROM check_replication_health();

-- ============================================================================
-- LOAD BALANCING PREPARATION
-- ============================================================================

-- Create function to route read queries to least loaded replica
CREATE OR REPLACE FUNCTION get_read_replica()
RETURNS TEXT AS $$
DECLARE
    best_replica RECORD;
BEGIN
    -- Find replica with lowest replay lag
    SELECT application_name INTO best_replica
    FROM pg_stat_replication
    WHERE state = 'streaming'
    ORDER BY pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) ASC
    LIMIT 1;

    IF best_replica.application_name IS NOT NULL THEN
        RETURN best_replica.application_name;
    ELSE
        RETURN 'primary'; -- Fallback to primary
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create view for load balancing statistics
CREATE OR REPLACE VIEW monitoring.load_balance_stats AS
SELECT
    application_name as replica_name,
    client_addr as replica_ip,
    state as connection_state,
    EXTRACT(EPOCH FROM (now() - backend_start)) as connection_age_seconds,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) as replay_lag_bytes,
    CASE
        WHEN sync_state = 'sync' THEN 'Synchronous'
        WHEN sync_state = 'potential' THEN 'Potential'
        ELSE 'Asynchronous'
    END as sync_mode,
    priority as failover_priority
FROM pg_stat_replication
ORDER BY replay_lag_bytes ASC;

-- ============================================================================
-- SCALING AUTOMATION FUNCTIONS
-- ============================================================================

-- Function to automatically create new partitions
CREATE OR REPLACE FUNCTION create_new_partitions()
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date TIMESTAMP;
    end_date TIMESTAMP;
    result TEXT := '';
BEGIN
    -- Create API usage partitions for next month
    start_date := date_trunc('month', now() + interval '1 month');
    end_date := start_date + interval '1 month';
    partition_name := 'api_usage_' || to_char(start_date, 'YYYY_MM');

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF api_usage
        FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date);

    result := result || 'Created API usage partition: ' || partition_name || E'\n';

    -- Create analytics events partitions for next 7 days
    FOR i IN 1..7 LOOP
        start_date := date_trunc('day', now() + interval ''1 day'' * i);
        end_date := start_date + interval '1 day';
        partition_name := 'analytics_events_' || to_char(start_date, 'YYYY_MM_DD');

        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF analytics_events
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date);

        result := result || 'Created analytics events partition: ' || partition_name || E'\n';
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to drop old partitions (retention policy)
CREATE OR REPLACE FUNCTION drop_old_partitions()
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    cutoff_date TIMESTAMP := now() - interval '6 months';
    result TEXT := '';
BEGIN
    -- Drop old API usage partitions
    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename LIKE 'api_usage_%'
        AND tablename < 'api_usage_' || to_char(cutoff_date, 'YYYY_MM')
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || partition_name || ' CASCADE';
        result := result || 'Dropped API usage partition: ' || partition_name || E'\n';
    END LOOP;

    -- Drop old analytics events partitions
    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename LIKE 'analytics_events_%'
        AND tablename < 'analytics_events_' || to_char(cutoff_date, 'YYYY_MM_DD')
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || partition_name || ' CASCADE';
        result := result || 'Dropped analytics events partition: ' || partition_name || E'\n';
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MONITORING DASHBOARD
-- ============================================================================

-- Comprehensive monitoring view
CREATE OR REPLACE VIEW monitoring.scaling_dashboard AS
SELECT
    'Connection Pool' as metric_category,
    active_connections as metric_value,
    'Active connections' as metric_name,
    CASE
        WHEN active_connections < 200 THEN 'Good'
        WHEN active_connections < 350 THEN 'Warning'
        ELSE 'Critical'
    END as status
FROM monitoring.connection_pool_stats
WHERE database_name = current_database()

UNION ALL

SELECT
    'Cache Hit Ratio',
    cache_hit_ratio_percent,
    'Cache efficiency',
    CASE
        WHEN cache_hit_ratio_percent > 95 THEN 'Good'
        WHEN cache_hit_ratio_percent > 90 THEN 'Warning'
        ELSE 'Critical'
    END as status
FROM monitoring.connection_pool_stats
WHERE database_name = current_database()

UNION ALL

SELECT
    'Replication Lag',
    COALESCE(AVG(lag_seconds), 0),
    'Average replica lag (seconds)',
    CASE
        WHEN AVG(lag_seconds) < 10 THEN 'Good'
        WHEN AVG(lag_seconds) < 60 THEN 'Warning'
        ELSE 'Critical'
    END as status
FROM monitoring.replication_health

UNION ALL

SELECT
    'Active Replicas',
    COUNT(*),
    'Streaming replicas',
    CASE
        WHEN COUNT(*) >= 2 THEN 'Good'
        WHEN COUNT(*) >= 1 THEN 'Warning'
        ELSE 'Critical'
    END as status
FROM monitoring.streaming_replication
WHERE replication_state = 'streaming';

-- ============================================================================
-- AUTOMATION SCHEDULING
-- ============================================================================

-- Schedule partition maintenance (requires pg_cron extension)
-- SELECT cron.schedule('create-partitions', '0 2 * * *', 'SELECT create_new_partitions();');
-- SELECT cron.schedule('drop-old-partitions', '0 3 * * 0', 'SELECT drop_old_partitions();');

-- Schedule health checks
-- SELECT cron.schedule('replication-health-check', '*/5 * * * *', 'SELECT * FROM monitoring.replication_health;');

-- ============================================================================
-- REPLICATION ARCHITECTURE COMPLETION
-- ============================================================================

-- Report configuration
DO $$
BEGIN
    RAISE NOTICE 'Database replication and scaling architecture configured';
    RAISE NOTICE 'Publications created: labelmint_all_tables, labelmint_analytics, labelmint_read_replica';
    RAISE NOTICE 'Replication slots created: replica_slot_1, replica_slot_2, replica_slot_3, backup_slot';
    RAISE NOTICE 'Tables partitioned: api_usage (monthly), analytics_events (daily), transactions (yearly)';
    RAISE NOTICE 'Monitoring views available:';
    RAISE NOTICE '  - monitoring.connection_pool_stats';
    RAISE NOTICE '  - monitoring.replication_lag';
    RAISE NOTICE '  - monitoring.streaming_replication';
    RAISE NOTICE '  - monitoring.replication_health';
    RAISE NOTICE '  - monitoring.load_balance_stats';
    RAISE NOTICE '  - monitoring.scaling_dashboard';
    RAISE NOTICE 'Automation functions: create_new_partitions(), drop_old_partitions()';
    RAISE NOTICE 'Sharding preparation completed with user_id hashing';
END $$;