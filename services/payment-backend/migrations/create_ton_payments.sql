-- TON Payment System Tables

-- TON Network Configuration
CREATE TABLE ton_network_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- 'mainnet', 'testnet'
    is_active BOOLEAN DEFAULT false,
    master_contract_address VARCHAR(255),
    usdt_contract_address VARCHAR(255) NOT NULL,
    rpc_endpoint VARCHAR(255) NOT NULL,
    api_key VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configurations
INSERT INTO ton_network_configs (name, is_active, usdt_contract_address, rpc_endpoint) VALUES
('testnet', true, 'EQD___vdB-35R-5aC_5Pq0rh0L2A_sO8U_9nZb7QJ1k0QfE', 'https://testnet.toncenter.com/api/v2/jsonRPC'),
('mainnet', false, 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', 'https://toncenter.com/api/v2/jsonRPC');

-- User Wallets
CREATE TABLE user_ton_wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    network_name VARCHAR(50) REFERENCES ton_network_configs(name),
    wallet_address VARCHAR(255) NOT NULL UNIQUE,
    wallet_version VARCHAR(50), -- 'v4R2', 'v3R2', etc.
    public_key VARCHAR(255),
    mnemonic_encrypted TEXT, -- Encrypted mnemonic phrase
    is_active BOOLEAN DEFAULT true,
    balance_usdt DECIMAL(20, 6) DEFAULT 0,
    balance_ton DECIMAL(20, 9) DEFAULT 0,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Transactions
CREATE TABLE ton_transactions (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id),
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 9) NOT NULL, -- In nanoTON
    amount_usdt DECIMAL(20, 6), -- For USDT transfers
    token_type VARCHAR(20) DEFAULT 'TON', -- 'TON' or 'USDT'
    network_name VARCHAR(50) REFERENCES ton_network_configs(name),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    block_number BIGINT,
    block_hash VARCHAR(255),
    lt BIGINT, -- Logical time
    message_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    );

-- Create indexes for ton_transactions
CREATE INDEX idx_ton_transactions_tx_hash ON ton_transactions(tx_hash);
CREATE INDEX idx_ton_transactions_user_id ON ton_transactions(user_id);
CREATE INDEX idx_ton_transactions_status ON ton_transactions(status);
CREATE INDEX idx_ton_transactions_network_name ON ton_transactions(network_name);

-- Internal Transfers (zero-fee between users)
CREATE TABLE internal_transfers (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER REFERENCES users(id),
    to_user_id INTEGER REFERENCES users(id),
    amount DECIMAL(20, 6) NOT NULL, -- Always in USDT
    description TEXT,
    status VARCHAR(20) DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    );

-- Create indexes for internal_transfers
CREATE INDEX idx_internal_transfers_from_user_id ON internal_transfers(from_user_id);
CREATE INDEX idx_internal_transfers_to_user_id ON internal_transfers(to_user_id);
CREATE INDEX idx_internal_transfers_status ON internal_transfers(status);

-- Worker Payouts
CREATE TABLE worker_payouts (
    id SERIAL PRIMARY KEY,
    task_batch_id INTEGER REFERENCES task_batches(id),
    worker_id INTEGER REFERENCES users(id),
    amount DECIMAL(20, 6) NOT NULL, -- In USDT
    wallet_address VARCHAR(255),
    tx_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed'
    fee DECIMAL(20, 6) DEFAULT 0, -- Network fee
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    );

-- Create indexes for worker_payouts
CREATE INDEX idx_worker_payouts_worker_id ON worker_payouts(worker_id);
CREATE INDEX idx_worker_payouts_status ON worker_payouts(status);
CREATE INDEX idx_worker_payouts_task_batch_id ON worker_payouts(task_batch_id);

-- Payment Requests (for deposits)
CREATE TABLE payment_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount DECIMAL(20, 6) NOT NULL, -- In USDT
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'expired'
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    );

-- Create indexes for payment_requests
CREATE INDEX idx_payment_requests_user_id ON payment_requests(user_id);
CREATE INDEX idx_payment_requests_status ON payment_requests(status);

-- Balance Snapshots (for auditing)
CREATE TABLE balance_snapshots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    balance_usdt DECIMAL(20, 6) NOT NULL,
    balance_ton DECIMAL(20, 9) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    );

-- Create indexes for balance_snapshots
CREATE INDEX idx_balance_snapshots_user_id ON balance_snapshots(user_id);
CREATE INDEX idx_balance_snapshots_created_at ON balance_snapshots(created_at);

-- Create indexes for performance
CREATE INDEX idx_user_ton_wallets_user_network ON user_ton_wallets(user_id, network_name);
CREATE INDEX idx_ton_transactions_user_status ON ton_transactions(user_id, status);
CREATE INDEX idx_worker_payouts_status_created ON worker_payouts(status, created_at);

-- Function to create daily balance snapshots
CREATE OR REPLACE FUNCTION create_daily_balance_snapshots()
RETURNS void AS $$
BEGIN
    INSERT INTO balance_snapshots (user_id, balance_usdt, balance_ton)
    SELECT
        user_id,
        balance_usdt,
        balance_ton,
        NOW()
    FROM user_ton_wallets
    WHERE is_active = true
    AND (
        SELECT MAX(created_at)
        FROM balance_snapshots
        WHERE balance_snapshots.user_id = user_ton_wallets.user_id
    ) < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_ton_network_configs_updated_at
    BEFORE UPDATE ON ton_network_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_ton_wallets_updated_at
    BEFORE UPDATE ON user_ton_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();