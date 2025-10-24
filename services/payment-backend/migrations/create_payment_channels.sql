-- Payment Channels and Worker Payments Schema

-- Payment Channels Table
CREATE TABLE IF NOT EXISTS payment_channels (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    channel_id BIGINT UNIQUE NOT NULL,
    capacity DECIMAL(20, 6) NOT NULL,
    spent DECIMAL(20, 6) DEFAULT 0,
    expiry TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE,
    INDEX (worker_id),
    INDEX (channel_id),
    INDEX (expiry),
    INDEX (is_active)
);

-- Worker Balances Table
CREATE TABLE IF NOT EXISTS worker_balances (
    worker_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance_usdt DECIMAL(20, 6) DEFAULT 0,
    channel_balance DECIMAL(20, 6) DEFAULT 0,
    total_earned DECIMAL(20, 6) DEFAULT 0,
    total_withdrawn DECIMAL(20, 6) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX (last_updated)
);

-- Worker Payments Table
CREATE TABLE IF NOT EXISTS worker_payments (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    amount DECIMAL(20, 6) NOT NULL,
    base_rate DECIMAL(20, 6) NOT NULL,
    complexity VARCHAR(20) NOT NULL,
    turnaround_multiplier DECIMAL(5, 2) NOT NULL,
    quality_bonus DECIMAL(5, 4) DEFAULT 0,
    payment_type VARCHAR(20) DEFAULT 'balance', -- 'balance', 'channel', 'withdrawal'
    fee DECIMAL(20, 6) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX (worker_id),
    INDEX (task_id),
    INDEX (payment_type),
    INDEX (created_at)
);

-- Internal Transactions Table (zero-fee transfers)
CREATE TABLE IF NOT EXISTS internal_transactions (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER REFERENCES users(id),
    to_user_id INTEGER REFERENCES users(id),
    amount DECIMAL(20, 6) NOT NULL,
    task_id INTEGER REFERENCES tasks(id),
    type VARCHAR(50) NOT NULL, -- 'channel_payment', 'internal_transfer', 'bonus'
    fee DECIMAL(20, 6) DEFAULT 0,
    tx_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX (from_user_id),
    INDEX (to_user_id),
    INDEX (type),
    INDEX (created_at)
);

-- Withdrawal Batch Table
CREATE TABLE IF NOT EXISTS withdrawal_batch (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(255),
    worker_id INTEGER REFERENCES users(id),
    amount DECIMAL(20, 6) NOT NULL,
    fee DECIMAL(20, 6) NOT NULL,
    token_type VARCHAR(20) DEFAULT 'USDT',
    wallet_address VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed'
    tx_hash VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    INDEX (batch_id),
    INDEX (worker_id),
    INDEX (status),
    INDEX (created_at)
);

-- Task Payment Rates Table
CREATE TABLE IF NOT EXISTS task_payment_rates (
    id SERIAL PRIMARY KEY,
    complexity VARCHAR(20) UNIQUE NOT NULL,
    base_rate DECIMAL(20, 6) NOT NULL,
    min_rate DECIMAL(20, 6),
    max_rate DECIMAL(20, 6),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default payment rates
INSERT INTO task_payment_rates (complexity, base_rate, min_rate, max_rate) VALUES
('simple', 0.02, 0.01, 0.05),
('medium', 0.05, 0.03, 0.10),
('complex', 0.15, 0.10, 0.30),
('expert', 0.75, 0.50, 1.50)
ON CONFLICT (complexity) DO NOTHING;

-- Turnaround Multipliers
CREATE TABLE IF NOT EXISTS turnaround_multipliers (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) UNIQUE NOT NULL,
    multiplier DECIMAL(5, 2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO turnaround_multipliers (type, multiplier, description) VALUES
('standard', 1.00, 'Standard delivery (24-48 hours)'),
('priority', 1.50, 'Priority delivery (6-12 hours)'),
('urgent', 2.50, 'Urgent delivery (< 6 hours)')
ON CONFLICT (type) DO NOTHING;

-- Payment Statistics View
CREATE OR REPLACE VIEW payment_stats AS
SELECT
    DATE_TRUNC('day', wp.created_at) as date,
    COUNT(*) as total_payments,
    COUNT(DISTINCT wp.worker_id) as active_workers,
    SUM(wp.amount) as total_paid,
    AVG(wp.amount) as avg_payment,
    SUM(wp.fee) as total_fees
FROM worker_payments wp
WHERE wp.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', wp.created_at)
ORDER BY date DESC;

-- Worker Earnings Leaderboard
CREATE OR REPLACE VIEW worker_leaderboard AS
SELECT
    u.id,
    u.email,
    u.telegram_username,
    COALESCE(wb.total_earned, 0) as total_earned,
    COALESCE(wb.balance_usdt, 0) as current_balance,
    COUNT(wp.id) as total_tasks,
    AVG(wp.amount) as avg_earning,
    MAX(wp.created_at) as last_payment
FROM users u
LEFT JOIN worker_balances wb ON u.id = wb.worker_id
LEFT JOIN worker_payments wp ON u.id = wp.worker_id
WHERE u.role = 'worker'
GROUP BY u.id, u.email, u.telegram_username, wb.total_earned, wb.balance_usdt
ORDER BY total_earned DESC;

-- Functions for payment calculations

-- Calculate task payment
CREATE OR REPLACE FUNCTION calculate_task_payment(
    complexity_param VARCHAR,
    turnaround_type VARCHAR,
    quality_score DECIMAL DEFAULT 1.0
) RETURNS DECIMAL AS $$
DECLARE
    base_rate DECIMAL;
    multiplier DECIMAL;
    quality_bonus DECIMAL;
BEGIN
    -- Get base rate
    SELECT base_rate INTO base_rate
    FROM task_payment_rates
    WHERE complexity = complexity_param AND is_active = true;

    IF base_rate IS NULL THEN
        base_rate := 0.02; -- default
    END IF;

    -- Get multiplier
    SELECT multiplier INTO multiplier
    FROM turnaround_multipliers
    WHERE type = turnaround_type AND is_active = true;

    IF multiplier IS NULL THEN
        multiplier := 1.0; -- default
    END IF;

    -- Calculate quality bonus (max 20%)
    quality_bonus := LEAST(0.20, GREATEST(0, (quality_score - 0.95) * 4));

    RETURN base_rate * multiplier * (1 + quality_bonus);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update worker total earnings
CREATE OR REPLACE FUNCTION update_worker_earnings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO worker_balances (worker_id, total_earned, last_updated)
    VALUES (NEW.worker_id, NEW.amount, NOW())
    ON CONFLICT (worker_id) DO UPDATE SET
        total_earned = worker_balances.total_earned + NEW.amount,
        last_updated = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER update_worker_earnings_trigger
    AFTER INSERT ON worker_payments
    FOR EACH ROW EXECUTE FUNCTION update_worker_earnings();

-- Update last_updated trigger
CREATE OR REPLACE FUNCTION update_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_balances_last_updated
    BEFORE UPDATE ON worker_balances
    FOR EACH ROW EXECUTE FUNCTION update_last_updated();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_worker_payments_created ON worker_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_transactions_created ON internal_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_batch_created ON withdrawal_batch(created_at DESC);