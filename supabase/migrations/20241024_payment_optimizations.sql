-- Payment System Database Optimization
-- Migration: 2024-10-24-payment-optimizations

-- Create indexes for payment-related tables

-- User table indexes for payment operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_ton_wallet_address ON users(ton_wallet_address) WHERE ton_wallet_address IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_client ON users(role) WHERE role = 'CLIENT';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_workers ON users(role, is_active) WHERE role = 'WORKER' AND is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_balance_lookup ON users(id) WHERE wallet_balance > 0 OR total_earned > 0;

-- Transaction table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_status ON transactions(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_type_created ON transactions(user_id, type, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at) WHERE status IN ('PENDING', 'PROCESSING');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_hash_lookup ON transactions(transaction_hash) WHERE transaction_hash IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_reference ON transactions(reference_type, reference_id) WHERE reference_type IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_currency_amount ON transactions(currency, amount) WHERE status = 'COMPLETED';

-- Withdrawal table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_user_status ON withdrawals(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_status_created ON withdrawals(status, created_at) WHERE status IN ('PENDING', 'PROCESSING');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_batch_id ON withdrawals(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_currency_status ON withdrawals(currency, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_address ON withdrawals(wallet_address) WHERE status = 'COMPLETED';

-- Client payment indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_payments_project ON client_payments(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_payments_client_status ON client_payments(client_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_payments_status_created ON client_payments(status, created_at) WHERE status IN ('PENDING', 'PROCESSING');

-- TON transaction indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ton_transactions_user_status ON ton_transactions(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ton_transactions_hash ON ton_transactions(transaction_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ton_transactions_address ON ton_transactions(from_address, to_address);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ton_transactions_block_height ON ton_transactions(block_height) WHERE block_height IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ton_transactions_created ON ton_transactions(created_at DESC);

-- User crypto wallet indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_crypto_wallets_user_blockchain ON user_crypto_wallets(user_id, blockchain);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_crypto_wallets_default ON user_crypto_wallets(user_id, is_default) WHERE is_default = true;

-- Audit log table for payment auditing
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for audit logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action) WHERE user_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at) WHERE action IN ('CREATE', 'UPDATE', 'DELETE');

-- Payment analytics materialized views
CREATE MATERIALIZED VIEW IF NOT EXISTS payment_analytics_daily AS
SELECT
    DATE(created_at) as date,
    currency,
    type,
    status,
    COUNT(*) as transaction_count,
    COALESCE(SUM(amount), 0) as total_amount,
    COALESCE(AVG(amount), 0) as avg_amount,
    COALESCE(SUM(fee), 0) as total_fees
FROM transactions
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at), currency, type, status
ORDER BY date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_analytics_daily_unique
ON payment_analytics_daily(date, currency, type, status);

-- Create index for refreshing materialized view
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_analytics_daily_date
ON payment_analytics_daily(date DESC);

-- Withdrawal analytics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS withdrawal_analytics_daily AS
SELECT
    DATE(created_at) as date,
    currency,
    status,
    COUNT(*) as withdrawal_count,
    COALESCE(SUM(amount), 0) as total_amount,
    COALESCE(SUM(fee), 0) as total_fees,
    COUNT(DISTINCT user_id) as unique_users
FROM withdrawals
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at), currency, status
ORDER BY date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_analytics_daily_unique
ON withdrawal_analytics_daily(date, currency, status);

-- User payment stats materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS user_payment_stats AS
SELECT
    u.id as user_id,
    u.role,
    COALESCE(t.total_transactions, 0) as total_transactions,
    COALESCE(t.total_amount, 0) as total_transaction_amount,
    COALESCE(t.last_transaction, NULL) as last_transaction_at,
    COALESCE(w.total_withdrawals, 0) as total_withdrawals,
    COALESCE(w.total_withdrawal_amount, 0) as total_withdrawal_amount,
    COALESCE(w.last_withdrawal, NULL) as last_withdrawal_at
FROM users u
LEFT JOIN (
    SELECT
        user_id,
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_amount,
        MAX(created_at) as last_transaction
    FROM transactions
    WHERE status = 'COMPLETED'
    GROUP BY user_id
) t ON u.id = t.user_id
LEFT JOIN (
    SELECT
        user_id,
        COUNT(*) as total_withdrawals,
        COALESCE(SUM(amount), 0) as total_amount,
        MAX(created_at) as last_withdrawal
    FROM withdrawals
    WHERE status = 'COMPLETED'
    GROUP BY user_id
) w ON u.id = w.user_id
WHERE u.role IN ('WORKER', 'CLIENT');

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_payment_stats_unique
ON user_payment_stats(user_id);

-- Functions to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_payment_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY payment_analytics_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY withdrawal_analytics_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_payment_stats;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for user payment performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_answers_worker_created
ON task_answers(worker_id, created_at DESC) WHERE is_correct = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_answers_earnings
ON task_answers(worker_id, earnings) WHERE earnings > 0;

-- Payment queue table for batch processing
CREATE TABLE IF NOT EXISTS payment_queue (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    amount DECIMAL(20,6) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USDT',
    type VARCHAR(50) NOT NULL, -- 'EARNING', 'WITHDRAWAL', 'BONUS'
    status VARCHAR(20) DEFAULT 'PENDING',
    priority INTEGER DEFAULT 0,
    data JSONB,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_queue_status_priority
ON payment_queue(status, priority DESC, next_attempt_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_queue_user_type
ON payment_queue(user_id, type) WHERE status = 'PENDING';

-- Triggers for data integrity

-- Trigger to update user total earned when a transaction is completed
CREATE OR REPLACE FUNCTION update_user_total_earned()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        IF NEW.type IN ('EARNING', 'BONUS', 'REFERRAL') THEN
            UPDATE users
            SET total_earned = total_earned + NEW.amount
            WHERE id = NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_user_total_earned ON transactions;
CREATE TRIGGER tr_update_user_total_earned
    AFTER UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_total_earned();

-- Trigger to update user total withdrawn when a withdrawal is completed
CREATE OR REPLACE FUNCTION update_user_total_withdrawn()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        UPDATE users
        SET total_withdrawn = total_withdrawn + NEW.amount
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_user_total_withdrawn ON withdrawals;
CREATE TRIGGER tr_update_user_total_withdrawn
    AFTER UPDATE ON withdrawals
    FOR EACH ROW
    EXECUTE FUNCTION update_user_total_withdrawn();

-- Partitioning for large tables (transactions)
-- This will be useful for high-volume payment processing

-- Create partitioned table for transactions (for future use)
/*
CREATE TABLE transactions_partitioned (
    LIKE transactions INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE transactions_2024_01 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
*/

-- Row Level Security for payment tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ton_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own transactions
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can view own withdrawals" ON withdrawals
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can view own ton_transactions" ON ton_transactions
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true));

-- Create procedure for batch withdrawal processing
CREATE OR REPLACE FUNCTION process_withdrawal_batch(
    p_batch_size INTEGER DEFAULT 100,
    p_currency VARCHAR(10) DEFAULT 'USDT'
)
RETURNS TABLE(processed_count BIGINT, total_amount DECIMAL(20,6)) AS $$
DECLARE
    v_count BIGINT;
    v_total DECIMAL(20,6);
BEGIN
    -- Update status to PROCESSING for batch
    UPDATE withdrawals
    SET status = 'PROCESSING',
        processed_at = NOW()
    WHERE id IN (
        SELECT id
        FROM withdrawals
        WHERE status = 'PENDING'
          AND currency = p_currency
        ORDER BY created_at
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    RETURNING id, amount;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Sum the amounts
    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM withdrawals
    WHERE status = 'PROCESSING'
      AND processed_at = NOW();

    RETURN QUERY SELECT v_count, v_total;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Audit trail for all payment-related operations';
COMMENT ON TABLE payment_queue IS 'Queue for processing payments in batches';
COMMENT ON MATERIALIZED VIEW payment_analytics_daily IS 'Daily payment analytics aggregated for reporting';
COMMENT ON MATERIALIZED VIEW withdrawal_analytics_daily IS 'Daily withdrawal analytics aggregated for reporting';
COMMENT ON MATERIALIZED VIEW user_payment_stats IS 'User payment statistics for performance tracking';

-- Create scheduled job function (for pg_cron extension if available)
-- SELECT cron.schedule('refresh-payment-analytics', '0 */6 * * *', 'SELECT refresh_payment_analytics();');

COMMIT;