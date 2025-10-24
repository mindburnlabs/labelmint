-- Payment channels table
CREATE TABLE IF NOT EXISTS payment_channels (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(100) NOT NULL UNIQUE,
    platform_address TEXT NOT NULL,
    worker_id INTEGER NOT NULL,
    worker_address TEXT NOT NULL,
    platform_balance DECIMAL(20,6) NOT NULL DEFAULT 0,
    worker_balance DECIMAL(20,6) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'initiating'
        CHECK (status IN ('initiating', 'active', 'closing', 'closed', 'challenged')),
    sequence BIGINT NOT NULL DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    settle_threshold INTEGER NOT NULL DEFAULT 100,
    auto_settle BOOLEAN NOT NULL DEFAULT true,
    settle_interval VARCHAR(10) NOT NULL DEFAULT 'daily'
        CHECK (settle_interval IN ('hourly', 'daily', 'weekly')),
    contract_address TEXT NOT NULL,
    initial_deposit DECIMAL(20,6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_payment_channels_worker
        FOREIGN KEY (worker_id) REFERENCES workers(telegram_id) ON DELETE CASCADE
);

-- Off-chain transactions table
CREATE TABLE IF NOT EXISTS offchain_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    channel_id VARCHAR(100) NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount DECIMAL(20,6) NOT NULL CHECK (amount > 0),
    sequence BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    type VARCHAR(20) NOT NULL DEFAULT 'payment'
        CHECK (type IN ('payment', 'deposit', 'withdrawal', 'bonus', 'refund')),
    task_id INTEGER,
    metadata JSONB,
    signature TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'settled', 'failed', 'cancelled')),
    settled_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_offchain_transactions_channel
        FOREIGN KEY (channel_id) REFERENCES payment_channels(channel_id) ON DELETE CASCADE,
    CONSTRAINT fk_offchain_transactions_task
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- Channel settlements table
CREATE TABLE IF NOT EXISTS channel_settlements (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(100) NOT NULL,
    settlement_hash TEXT,
    transaction_count INTEGER NOT NULL,
    total_amount DECIMAL(20,6) NOT NULL,
    platform_balance_before DECIMAL(20,6),
    worker_balance_before DECIMAL(20,6),
    platform_balance_after DECIMAL(20,6),
    worker_balance_after DECIMAL(20,6),
    gas_used BIGINT,
    gas_cost DECIMAL(20,6),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_channel_settlements_channel
        FOREIGN KEY (channel_id) REFERENCES payment_channels(channel_id) ON DELETE CASCADE
);

-- Channel metrics table for analytics
CREATE TABLE IF NOT EXISTS channel_metrics (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    total_volume DECIMAL(20,6) NOT NULL DEFAULT 0,
    off_chain_savings DECIMAL(20,6) NOT NULL DEFAULT 0,
    average_transaction_size DECIMAL(20,6),
    peak_balance DECIMAL(20,6),
    settlement_count INTEGER NOT NULL DEFAULT 0,
    efficiency_score DECIMAL(5,2),

    CONSTRAINT fk_channel_metrics_channel
        FOREIGN KEY (channel_id) REFERENCES payment_channels(channel_id) ON DELETE CASCADE,
    UNIQUE(channel_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_channels_worker_id ON payment_channels(worker_id);
CREATE INDEX IF NOT EXISTS idx_payment_channels_status ON payment_channels(status);
CREATE INDEX IF NOT EXISTS idx_payment_channels_created_at ON payment_channels(created_at);

CREATE INDEX IF NOT EXISTS idx_offchain_transactions_channel_id ON offchain_transactions(channel_id);
CREATE INDEX IF NOT EXISTS idx_offchain_transactions_timestamp ON offchain_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_offchain_transactions_status ON offchain_transactions(status);
CREATE INDEX IF NOT EXISTS idx_offchain_transactions_type ON offchain_transactions(type);

CREATE INDEX IF NOT EXISTS idx_channel_settlements_channel_id ON channel_settlements(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_settlements_created_at ON channel_settlements(created_at);

CREATE INDEX IF NOT EXISTS idx_channel_metrics_channel_id ON channel_metrics(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_metrics_date ON channel_metrics(date);

-- Create view for channel statistics
CREATE OR REPLACE VIEW channel_summary AS
SELECT
    pc.channel_id,
    pc.worker_id,
    pc.status,
    pc.platform_balance,
    pc.worker_balance,
    pc.last_update,
    pc.settle_threshold,
    pc.auto_settle,
    pc.settle_interval,
    COALESCE(tx.total_transactions, 0) as total_transactions,
    COALESCE(tx.total_volume, 0) as total_volume,
    COALESCE(tx.pending_count, 0) as pending_transactions,
    COALESCE(settl.settlement_count, 0) as settlement_count,
    COALESCE(pc.initial_deposit, 0) + COALESCE(tx.total_volume, 0) as total_turnover,
    CASE
        WHEN pc.created_at >= NOW() - INTERVAL '7 days' THEN 'new'
        WHEN pc.last_update >= NOW() - INTERVAL '24 hours' THEN 'active'
        WHEN pc.last_update >= NOW() - INTERVAL '7 days' THEN 'inactive'
        ELSE 'dormant'
    END as activity_status
FROM payment_channels pc
LEFT JOIN (
    SELECT
        channel_id,
        COUNT(*) as total_transactions,
        SUM(amount) as total_volume,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
    FROM offchain_transactions
    GROUP BY channel_id
) tx ON pc.channel_id = tx.channel_id
LEFT JOIN (
    SELECT
        channel_id,
        COUNT(*) as settlement_count
    FROM channel_settlements
    WHERE status = 'completed'
    GROUP BY channel_id
) settl ON pc.channel_id = settl.channel_id;

-- Function to create channel for frequent workers
CREATE OR REPLACE FUNCTION create_worker_channel(
    worker_id_param INTEGER,
    initial_deposit DECIMAL(20,6) DEFAULT 10
) RETURNS TEXT AS $$
DECLARE
    channel_id TEXT;
    platform_address TEXT := 'EQDa...'; -- Platform address from config
    worker_address TEXT;
    channel_exists BOOLEAN;
BEGIN
    -- Check if worker already has active channel
    SELECT COUNT(*) > 0 INTO channel_exists
    FROM payment_channels
    WHERE worker_id = worker_id_param
      AND status = 'active';

    IF channel_exists THEN
        RETURN (SELECT channel_id FROM payment_channels
                  WHERE worker_id = worker_id_param AND status = 'active' LIMIT 1);
    END IF;

    -- Get worker's TON address
    SELECT ton_wallet INTO worker_address
    FROM workers
    WHERE telegram_id = worker_id_param;

    IF worker_address IS NULL THEN
        RAISE EXCEPTION 'Worker has no TON wallet address';
    END IF;

    -- Generate unique channel ID
    LOOP
        channel_id := 'channel_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' ||
                     substr(md5(random()::text), 1, 8);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM payment_channels WHERE channel_id = channel_id);
    END LOOP;

    -- Insert channel record
    INSERT INTO payment_channels (
        channel_id, platform_address, worker_id, worker_address,
        platform_balance, worker_balance, status, sequence,
        settle_threshold, auto_settle, settle_interval, initial_deposit
    ) VALUES (
        channel_id, platform_address, worker_id_param, worker_address,
        initial_deposit, 0, 'initiating', 0,
        100, true, 'daily', initial_deposit
    );

    RETURN channel_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create channels for frequent workers
CREATE OR REPLACE FUNCTION auto_create_channels_for_frequent_workers()
RETURNS INTEGER AS $$
DECLARE
    workers_processed INTEGER := 0;
    worker_record RECORD;
BEGIN
    -- Find workers with high transaction volume but no channel
    FOR worker_record IN
        SELECT w.telegram_id, w.ton_wallet, tx_count
        FROM workers w
        LEFT JOIN (
            SELECT COUNT(*) as tx_count, worker_id
            FROM worker_transactions
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY worker_id
        ) tx ON w.telegram_id = tx.worker_id
        WHERE w.ton_wallet IS NOT NULL
          AND (tx_count >= 50 OR w.total_earned >= 100)
          AND w.telegram_id NOT IN (
              SELECT worker_id FROM payment_channels WHERE status = 'active'
          )
    LOOP
        PERFORM create_worker_channel(worker_record.telegram_id);
        workers_processed := workers_processed + 1;
    END LOOP;

    RETURN workers_processed;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update channel metrics
CREATE OR REPLACE FUNCTION update_channel_metrics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO channel_metrics (
        channel_id, date, total_transactions, total_volume,
        average_transaction_size, peak_balance, efficiency_score
    )
    VALUES (
        NEW.channel_id,
        CURRENT_DATE,
        1,
        NEW.amount,
        NEW.amount,
        (
            SELECT GREATEST(platform_balance, worker_balance)
            FROM payment_channels
            WHERE channel_id = NEW.channel_id
        ),
        95.0 -- Default efficiency score
    )
    ON CONFLICT (channel_id, date) DO UPDATE SET
        total_transactions = channel_metrics.total_transactions + 1,
        total_volume = channel_metrics.total_volume + NEW.amount,
        average_transaction_size = (channel_metrics.total_volume + NEW.amount) /
                               (channel_metrics.total_transactions + 1),
        peak_balance = GREATEST(channel_metrics.peak_balance,
            (SELECT GREATEST(platform_balance, worker_balance)
             FROM payment_channels
             WHERE channel_id = NEW.channel_id))
    ;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic metrics update
DROP TRIGGER IF EXISTS update_channel_metrics_trigger ON offchain_transactions;
CREATE TRIGGER update_channel_metrics_trigger
    AFTER INSERT ON offchain_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_channel_metrics();

-- Add channel preference to workers table
ALTER TABLE workers ADD COLUMN IF NOT EXISTS prefers_channel BOOLEAN DEFAULT false;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS channel_threshold DECIMAL(20,6) DEFAULT 100;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS auto_settle_interval VARCHAR(10) DEFAULT 'daily';

-- Insert default configuration
INSERT INTO payment_channels (channel_id, platform_address, worker_id, worker_address,
                                platform_balance, worker_balance, status, settle_threshold,
                                auto_settle, settle_interval, initial_deposit)
SELECT
    'demo_channel_' || w.telegram_id,
    'EQDa...', -- Replace with actual platform address
    w.ton_wallet,
    w.ton_wallet,
    10.0,
    0.0,
    'active',
    100,
    true,
    'daily',
    10.0
FROM workers w
WHERE w.ton_wallet IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payment_channels WHERE worker_id = w.telegram_id
  )
LIMIT 1;