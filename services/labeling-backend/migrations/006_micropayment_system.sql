-- Client payments table
CREATE TABLE IF NOT EXISTS client_payments (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    client_telegram_id INTEGER NOT NULL,
    amount_usdt DECIMAL(10,4) NOT NULL,
    platform_fee DECIMAL(10,4) NOT NULL,
    total_amount DECIMAL(10,4) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    description TEXT,
    payment_link TEXT,
    invoice_link TEXT,
    transaction_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Worker transactions table
CREATE TABLE IF NOT EXISTS worker_transactions (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('earning', 'withdrawal', 'bonus', 'refund')),
    amount DECIMAL(10,4) NOT NULL,
    reference VARCHAR(100),
    reference_id INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    transaction_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Withdrawals table (enhanced)
CREATE TABLE IF NOT EXISTS withdrawals (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL,
    amount DECIMAL(10,4) NOT NULL CHECK (amount > 0),
    method VARCHAR(20) NOT NULL CHECK (method IN ('ton', 'telegram', 'wise', 'bank', 'usdt')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    address TEXT,
    telegram_wallet TEXT,
    fee DECIMAL(10,4) DEFAULT 0,
    batch_id INTEGER REFERENCES withdrawal_batches(id),
    transaction_hash TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Withdrawal batches table
CREATE TABLE IF NOT EXISTS withdrawal_batches (
    id SERIAL PRIMARY KEY,
    total_amount DECIMAL(10,4) NOT NULL,
    total_transactions INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    transaction_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Update workers table with wallet info
ALTER TABLE workers ADD COLUMN IF NOT EXISTS telegram_wallet TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS ton_wallet TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS preferred_withdrawal_method VARCHAR(20) DEFAULT 'telegram';
ALTER TABLE workers ADD COLUMN IF NOT EXISTS auto_withdrawal BOOLEAN DEFAULT false;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS auto_withdrawal_threshold DECIMAL(10,2) DEFAULT 10.00;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_payments_project_id ON client_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_client_id ON client_payments(client_telegram_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_status ON client_payments(status);
CREATE INDEX IF NOT EXISTS idx_worker_transactions_worker_id ON worker_transactions(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_transactions_type ON worker_transactions(type);
CREATE INDEX IF NOT EXISTS idx_worker_transactions_created_at ON worker_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_withdrawals_worker_id ON withdrawals(worker_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_batch_id ON withdrawals(batch_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_batches_status ON withdrawal_batches(status);

-- Create function to update worker balance
CREATE OR REPLACE FUNCTION update_worker_balance(
    worker_id_param INTEGER,
    amount_param DECIMAL(10,4),
    transaction_type_param VARCHAR(20)
) RETURNS DECIMAL(10,4) AS $$
DECLARE
    new_balance DECIMAL(10,4);
BEGIN
    IF transaction_type_param IN ('earning', 'bonus', 'refund') THEN
        -- Add to balance
        UPDATE workers
        SET balance = balance + amount_param
        WHERE telegram_id = worker_id_param
        RETURNING balance INTO new_balance;
    ELSIF transaction_type_param = 'withdrawal' THEN
        -- Subtract from balance
        UPDATE workers
        SET balance = balance - amount_param
        WHERE telegram_id = worker_id_param
        RETURNING balance INTO new_balance;
    END IF;

    RETURN new_balance;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic balance updates
CREATE OR REPLACE FUNCTION trigger_update_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update worker balance when transaction is completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        PERFORM update_worker_balance(
            NEW.worker_id,
            NEW.amount,
            NEW.type
        );

        -- Update total earned if earning
        IF NEW.type IN ('earning', 'bonus') THEN
            UPDATE workers
            SET total_earned = total_earned + NEW.amount
            WHERE telegram_id = NEW.worker_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_balance_trigger ON worker_transactions;
CREATE TRIGGER update_balance_trigger
    AFTER UPDATE ON worker_transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_balance();

-- Create view for worker dashboard
CREATE OR REPLACE VIEW worker_wallet_dashboard AS
SELECT
    w.telegram_id,
    w.balance,
    w.total_earned,
    w.telegram_wallet,
    w.ton_wallet,
    COALESCE(today.earned_today, 0) as earned_today,
    COALESCE(today.labels_today, 0) as labels_today,
    COALESCE(pending.withdrawals_pending, 0) as withdrawals_pending,
    w.last_active
FROM workers w
LEFT JOIN (
    SELECT
        worker_id,
        SUM(amount) as earned_today,
        COUNT(*) as labels_today
    FROM worker_transactions
    WHERE type = 'earning'
      AND DATE(created_at) = CURRENT_DATE
      AND status = 'completed'
    GROUP BY worker_id
) today ON w.telegram_id = today.worker_id
LEFT JOIN (
    SELECT
        worker_id,
        SUM(amount) as withdrawals_pending
    FROM withdrawals
    WHERE status = 'pending'
    GROUP BY worker_id
) pending ON w.telegram_id = pending.worker_id;

-- Insert sample withdrawal configuration
INSERT INTO payout_config (method, min_amount, fee_fixed, fee_percentage, description) VALUES
('telegram', 1.00, 0, 0, 'Telegram Wallet instant withdrawal'),
('ton', 1.00, 0.10, 0, 'TON blockchain withdrawal'),
('usdt', 1.00, 1.00, 0, 'USDT (TRC-20) withdrawal')
ON CONFLICT (method) DO NOTHING;

-- Create function to auto-process withdrawals
CREATE OR REPLACE FUNCTION process_auto_withdrawals()
RETURNS INTEGER AS $$
DECLARE
    processed_count INTEGER := 0;
    auto_workers RECORD;
BEGIN
    -- Find workers with auto-withdrawal enabled
    FOR auto_workers IN
        SELECT *
        FROM workers
        WHERE auto_withdrawal = true
          AND balance >= auto_withdrawal_threshold
    LOOP
        -- Create withdrawal record
        INSERT INTO withdrawals (worker_id, amount, method, address)
        VALUES (
            auto_workers.telegram_id,
            auto_workers.balance,
            auto_workers.preferred_withdrawal_method,
            COALESCE(auto_workers.telegram_wallet, auto_workers.ton_wallet)
        );

        processed_count := processed_count + 1;
    END LOOP;

    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;