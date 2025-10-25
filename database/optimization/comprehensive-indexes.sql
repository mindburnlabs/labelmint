-- ============================================================================
-- COMPREHENSIVE INDEXING STRATEGY FOR LABELMINT PRODUCTION
-- ============================================================================

-- Set statement timeout for safety
SET statement_timeout = '600s';

-- Enable concurrent index creation to avoid blocking
SET lock_timeout = '60s';

-- ============================================================================
-- USER TABLE INDEXES
-- ============================================================================

-- Primary authentication queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower
ON users(LOWER(email))
WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_telegram_id_active
ON users(telegram_id, is_active)
WHERE telegram_id IS NOT NULL;

-- User activity and performance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_status
ON users(role, is_active, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login_active
ON users(last_login_at DESC)
WHERE last_login_at IS NOT NULL AND is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_trust_score
ON users(trust_score DESC, tasks_completed DESC)
WHERE is_active = true;

-- TON wallet queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_ton_wallet
ON users(ton_wallet_address)
WHERE ton_wallet_address IS NOT NULL;

-- Performance metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_accuracy
ON users(accuracy_rate DESC, total_earned DESC)
WHERE accuracy_rate IS NOT NULL;

-- Gamification indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_level_xp
ON users(level DESC, experience_points DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_streak
ON users(current_streak DESC, max_streak DESC)
WHERE current_streak > 0;

-- ============================================================================
-- TASK TABLE INDEXES
-- ============================================================================

-- Task assignment and status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status_priority
ON tasks(status, priority DESC, created_at ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assignee_status
ON tasks(assigned_to, status, created_at DESC)
WHERE assigned_to IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_status_priority
ON tasks(project_id, status, priority DESC, created_at DESC);

-- Task availability and distribution
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_available
ON tasks(status, created_at ASC, priority DESC)
WHERE status = 'PENDING' AND assigned_to IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_in_progress
ON tasks(assigned_to, status, assigned_at DESC)
WHERE status IN ('ASSIGNED', 'IN_PROGRESS');

-- Consensus and quality queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_consensus
ON tasks(consensus_target, consensus_level, final_label)
WHERE consensus_target > 1;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_quality
ON tasks(quality_score DESC, ai_confidence DESC)
WHERE quality_score IS NOT NULL;

-- Deadline management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_deadline
ON tasks(due_at ASC, status)
WHERE due_at IS NOT NULL AND status NOT IN ('COMPLETED', 'CANCELLED');

-- JSONB data queries (GIN indexes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_data_gin
ON tasks USING GIN(data);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_data_type
ON tasks USING GIN((data->>'type'))
WHERE data->>'type' IS NOT NULL;

-- Task pricing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_pricing
ON tasks(base_price DESC, points DESC, multiplier DESC);

-- AI prelabel queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_ai_prelabel
ON tasks(ai_prelabel, ai_confidence DESC)
WHERE ai_prelabel IS NOT NULL;

-- Task type categorization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_type_subtype
ON tasks(type, sub_type, created_at DESC);

-- ============================================================================
-- PROJECT TABLE INDEXES
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_client_status
ON projects(client_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status_created
ON projects(status, created_at DESC)
WHERE status IN ('ACTIVE', 'COMPLETED');

-- ============================================================================
-- RESPONSE TABLE INDEXES
-- ============================================================================

-- Response analysis queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_task_user
ON responses(task_id, user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_user_task
ON responses(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- Quality and confidence analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_confidence
ON responses(confidence DESC, time_spent ASC)
WHERE confidence IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_time_spent
ON responses(time_spent DESC, created_at DESC)
WHERE time_spent IS NOT NULL;

-- ============================================================================
-- PAYMENT & TRANSACTION INDEXES
-- ============================================================================

-- Transaction status and amount queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_status
ON transactions(user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_status_amount
ON transactions(status, amount DESC, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_type_status
ON transactions(type, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_amount_range
ON transactions(amount, created_at DESC)
WHERE amount > 0;

-- Withdrawal processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_status_amount
ON withdrawals(status, amount DESC, created_at ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_batch
ON withdrawals(batch_id, status)
WHERE batch_id IS NOT NULL;

-- Client payments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_payments_project
ON client_payments(project_id, status, amount DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_payments_client
ON client_payments(client_id, status, created_at DESC);

-- ============================================================================
-- WALLET INDEXES
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_user_balance
ON wallets(user_id, balance DESC, frozen_balance DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_address
ON wallets(address)
WHERE address IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_testnet
ON wallets(testnet, balance DESC);

-- ============================================================================
-- CONSENSUS & QUALITY CONTROL INDEXES
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_consensus_resolved
ON task_consensus(resolved_at DESC, disagreement DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_accuracy_date
ON worker_accuracy_history(worker_id, date DESC, accuracy DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_behavior_date
ON worker_behavior_analysis(worker_id, date DESC, risk_score ASC);

-- ============================================================================
-- GAMIFICATION & VIRAL FEATURES INDEXES
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_achievements_progress
ON user_achievements(user_id, progress DESC, completed_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_streaks_date
ON user_streaks(user_id, date DESC, tasks_completed DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referrals_status
ON referrals(referrer_id, status, created_at DESC);

-- ============================================================================
-- ANALYTICS & MONITORING INDEXES
-- ============================================================================

-- API usage analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_user_time
ON api_usage(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_endpoint_time
ON api_usage(endpoint, method, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_hourly
ON api_usage(date_trunc('hour', created_at), status)
WHERE created_at > now() - interval '7 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_slow
ON api_usage(duration DESC, created_at DESC)
WHERE duration > 1000;

-- Analytics events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_user_time
ON analytics_events(user_id, timestamp DESC)
WHERE user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_category
ON analytics_events(category, event, timestamp DESC);

-- ============================================================================
-- TON BLOCKCHAIN INDEXES
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ton_transactions_user_status
ON ton_transactions(user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ton_transactions_hash
ON ton_transactions(transaction_hash)
WHERE transaction_hash IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ton_transactions_amount
ON ton_transactions(amount DESC, created_at DESC)
WHERE amount > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_crypto_wallets
ON user_crypto_wallets(user_id, blockchain, is_default)
WHERE is_default = true;

-- ============================================================================
-- PARTIAL INDEXES FOR COMMON FILTERED QUERIES
-- ============================================================================

-- Active users only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_users_performance
ON users(id, trust_score DESC, tasks_completed DESC)
WHERE is_active = true AND last_login_at > now() - interval '30 days';

-- High-priority pending tasks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_high_priority_tasks
ON tasks(id, priority DESC, created_at ASC)
WHERE status = 'PENDING' AND priority >= 3;

-- Recent transactions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_transactions
ON transactions(created_at DESC, amount DESC)
WHERE created_at > now() - interval '30 days';

-- Pending withdrawals
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_withdrawals
ON withdrawals(created_at ASC, amount DESC)
WHERE status = 'PENDING';

-- Failed transactions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_failed_transactions
ON transactions(created_at DESC, user_id)
WHERE status = 'FAILED';

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Task assignment algorithm
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_assignment
ON tasks(status, priority DESC, created_at ASC, project_id)
WHERE status = 'PENDING' AND assigned_to IS NULL;

-- User performance dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_dashboard
ON users(id, last_login_at DESC, tasks_completed DESC, trust_score DESC)
WHERE is_active = true;

-- Payment processing queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_queue
ON transactions(status, created_at ASC, amount DESC)
WHERE status IN ('PENDING', 'PROCESSING');

-- Analytics dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_dashboard
ON analytics_events(timestamp DESC, category, user_id)
WHERE timestamp > now() - interval '24 hours';

-- ============================================================================
-- COVERING INDEXES FOR FREQUENT QUERIES
-- ============================================================================

-- Task list with basic info
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_list_covering
ON tasks(status, priority DESC, created_at DESC)
INCLUDE (id, title, type, base_price, project_id);

-- User profile basic info
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_profile_covering
ON users(telegram_id)
INCLUDE (id, first_name, last_name, username, is_active);

-- Transaction summary
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_summary_covering
ON transactions(user_id, created_at DESC)
INCLUDE (id, amount, type, status);

-- ============================================================================
-- STATISTICS UPDATE
-- ============================================================================

-- Update table statistics after index creation
ANALYZE users;
ANALYZE tasks;
ANALYZE projects;
ANALYZE responses;
ANALYZE transactions;
ANALYZE withdrawals;
ANALYZE client_payments;
ANALYZE wallets;
ANALYZE task_consensus;
ANALYZE worker_accuracy_history;
ANALYZE user_achievements;
ANALYZE user_streaks;
ANALYZE referrals;
ANALYZE api_usage;
ANALYZE analytics_events;
ANALYZE ton_transactions;
ANALYZE user_crypto_wallets;

-- ============================================================================
-- INDEX USAGE MONITORING
-- ============================================================================

-- Create view to monitor index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    CASE
        WHEN idx_scan = 0 THEN 'NEVER USED'
        WHEN idx_scan < 10 THEN 'RARELY USED'
        WHEN idx_scan < 100 THEN 'OCCASIONALLY USED'
        ELSE 'FREQUENTLY USED'
    END AS usage_frequency
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Create view to find unused indexes
CREATE OR REPLACE VIEW unused_indexes AS
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ============================================================================

-- Function to check index efficiency
CREATE OR REPLACE FUNCTION check_index_efficiency()
RETURNS TABLE(index_name text, efficiency numeric) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.indexrelid::regclass::text as index_name,
        CASE
            WHEN s.idx_scan = 0 THEN 0
            ELSE (s.idx_tup_read::numeric / NULLIF(s.idx_scan, 0))
        END as efficiency
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE i.indisunique = false
    ORDER BY efficiency DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Function to suggest index improvements
CREATE OR REPLACE FUNCTION suggest_index_improvements()
RETURNS TABLE(table_name text, suggestion text) AS $$
BEGIN
    RETURN QUERY
    -- Find tables with high seq_scan rates
    SELECT
        schemaname||'.'||tablename as table_name,
        'Consider adding indexes for frequently scanned columns' as suggestion
    FROM pg_stat_user_tables
    WHERE seq_scan > 1000 AND (seq_scan / NULLIF(seq_scan + idx_scan, 0)) > 0.5

    UNION ALL

    -- Find large tables without proper indexes
    SELECT
        schemaname||'.'||tablename as table_name,
        'Large table with few indexes - consider optimizing query patterns' as suggestion
    FROM pg_stat_user_tables
    WHERE n_tup_ins + n_tup_upd + n_tup_del > 10000
    AND idx_scan < 100;
END;
$$ LANGUAGE plpgsql;

-- Report completion
DO $$
BEGIN
    RAISE NOTICE 'Comprehensive indexing strategy applied successfully';
    RAISE NOTICE 'Total indexes created: Check index_usage_stats view for details';
    RAISE NOTICE 'Monitor index efficiency: SELECT * FROM check_index_efficiency()';
    RAISE NOTICE 'Find unused indexes: SELECT * FROM unused_indexes';
    RAISE NOTICE 'Get improvement suggestions: SELECT * FROM suggest_index_improvements()';
END $$;