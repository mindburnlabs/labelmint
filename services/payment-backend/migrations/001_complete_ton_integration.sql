-- Complete TON Blockchain Integration
-- These tables ensure all TON transactions, wallets, and payments are properly tracked

-- TON Network Configuration
CREATE TABLE IF NOT EXISTS ton_network_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE CHECK (name IN ('mainnet', 'testnet')),
    rpc_endpoint TEXT NOT NULL,
    api_key TEXT,
    usdt_contract_address TEXT NOT NULL,
    gas_fee_estimate NUMERIC(20,9) DEFAULT 0.005,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default network configurations
INSERT INTO ton_network_configs (name, rpc_endpoint, usdt_contract_address, is_active) VALUES
('testnet', 'https://testnet.toncenter.com/api/v2/jsonRPC', 'EQBJXfB_dhBn1P5O3uy7Suo4QbGwLU-lWj_H', true),
('mainnet', 'https://toncenter.com/api/v2/jsonRPC', 'EQCxE6mUtQJKFnGfaROatlOtTxW1QbGwLU-lydI', false)
ON CONFLICT (name) DO UPDATE SET
    usdt_contract_address = EXCLUDED.usdt_contract_address,
    is_active = EXCLUDED.is_active;

-- User TON Wallets
CREATE TABLE IF NOT EXISTS user_ton_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    network_name VARCHAR(20) NOT NULL REFERENCES ton_network_configs(name),
    wallet_address VARCHAR(48) NOT NULL,
    wallet_version VARCHAR(10) NOT NULL CHECK (wallet_version IN ('v3R2', 'v4R2', 'telegram')),
    public_key TEXT NOT NULL,
    mnemonic_encrypted TEXT, -- Encrypted at rest
    balance_ton NUMERIC(20,9) DEFAULT 0.000000000,
    balance_usdt NUMERIC(20,6) DEFAULT 0.000000,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_user_network UNIQUE (user_id, network_name)
);

-- TON Transactions
CREATE TABLE IF NOT EXISTS ton_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash VARCHAR(66) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    from_address VARCHAR(48) NOT NULL,
    to_address VARCHAR(48) NOT NULL,
    amount NUMERIC(20,9) DEFAULT 0,
    amount_usdt NUMERIC(20,6) DEFAULT 0,
    token_type VARCHAR(10) NOT NULL CHECK (token_type IN ('TON', 'USDT')),
    network_name VARCHAR(20) NOT NULL REFERENCES ton_network_configs(name),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
    gas_fee NUMERIC(20,9) DEFAULT 0,
    gas_used BIGINT,
    error_message TEXT,
    block_number BIGINT,
    block_hash VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT unique_tx_hash UNIQUE (tx_hash, network_name)
);

-- Payment Requests for Deposits
CREATE TABLE IF NOT EXISTS payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(20,6) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USDT',
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
    wallet_address VARCHAR(48),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enhanced Payments Table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(66);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gas_fee NUMERIC(20,9) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS block_number BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS block_hash VARCHAR(66);

-- Payment Channels for batch processing
CREATE TABLE IF NOT EXISTS payment_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('batch', 'real_time', 'scheduled')),
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default payment channels
INSERT INTO payment_channels (name, channel_type, config) VALUES
('batch', 'batch', '{"batch_size": 100, "interval_minutes": 15, "max_fee_usdt": 1.0}'),
('real_time', 'real_time', '{"max_tx_per_second": 10, "max_fee_usdt": 0.5}'),
('scheduled', 'scheduled', '{"schedule": "0 */6 * * *", "batch_size": 500, "max_fee_usdt": 2.0}')
ON CONFLICT (name) DO NOTHING;

-- Transaction Monitoring Queue
CREATE TABLE IF NOT EXISTS transaction_monitoring_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash VARCHAR(66) NOT NULL,
    network_name VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 10,
    next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Balance Snapshots for tracking
CREATE TABLE IF NOT EXISTS balance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    network_name VARCHAR(20) NOT NULL,
    balance_ton NUMERIC(20,9) NOT NULL,
    balance_usdt NUMERIC(20,6) NOT NULL,
    snapshot_type VARCHAR(20) DEFAULT 'manual' CHECK (snapshot_type IN ('manual', 'auto', 'transaction')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_network ON user_ton_wallets(user_id, network_name);
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_ton_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_ton_transactions_user ON ton_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ton_transactions_status ON ton_transactions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ton_transactions_hash ON ton_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_requests_expires ON payment_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user_date ON balance_snapshots(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_queue_retry ON transaction_monitoring_queue(next_retry_at, status);