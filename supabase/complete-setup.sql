-- Deligate.it Complete Database Setup
-- Execute this in Supabase SQL Editor
-- =======================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing objects
DROP TABLE IF EXISTS file_uploads CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS transaction_categories CASCADE;
DROP TABLE IF EXISTS user_wallets CASCADE;
DROP TABLE IF EXISTS user_api_keys CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS storage_configs CASCADE;
DROP TABLE IF EXISTS token_contracts CASCADE;
DROP TABLE IF EXISTS ton_network_configs CASCADE;

DROP TYPE IF EXISTS storage_type CASCADE;
DROP TYPE IF EXISTS upload_status CASCADE;
DROP TYPE IF EXISTS api_key_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS token_type CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;
DROP TYPE IF EXISTS transaction_status CASCADE;
DROP TYPE IF EXISTS wallet_version CASCADE;
DROP TYPE IF EXISTS wallet_network CASCADE;
DROP TYPE IF EXISTS auth_provider CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Create types
CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT');
CREATE TYPE user_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED', 'BANNED');
CREATE TYPE auth_provider AS ENUM ('EMAIL', 'GOOGLE', 'GITHUB', 'TELEGRAM');
CREATE TYPE wallet_network AS ENUM ('mainnet', 'testnet');
CREATE TYPE wallet_version AS ENUM ('v3R2', 'v4R2', 'telegram');
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed', 'cancelled', 'refunded');
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'transfer', 'payment', 'refund', 'fee');
CREATE TYPE token_type AS ENUM ('TON', 'USDT');
CREATE TYPE api_key_status AS ENUM ('active', 'expired', 'revoked', 'suspended');
CREATE TYPE upload_status AS ENUM ('uploading', 'processing', 'completed', 'failed', 'deleted', 'scanning');
CREATE TYPE storage_type AS ENUM ('local', 's3', 'gcs', 'azure');

-- Create tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT false,
    avatar_url VARCHAR(500),
    role user_role DEFAULT 'USER',
    status user_status DEFAULT 'PENDING',
    auth_provider auth_provider DEFAULT 'EMAIL',
    auth_provider_id VARCHAR(255),
    password_hash VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    permissions JSONB DEFAULT '[]',
    rate_limit INTEGER DEFAULT 1000,
    status api_key_status DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ton_network_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network wallet_network NOT NULL UNIQUE,
    rpc_url VARCHAR(500) NOT NULL,
    api_key VARCHAR(255),
    gas_fee_estimate DECIMAL(20,9) DEFAULT 0.005,
    max_gas_fee DECIMAL(20,9) DEFAULT 0.1,
    default_timeout INTEGER DEFAULT 30000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE token_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network wallet_network NOT NULL,
    token_type token_type NOT NULL,
    contract_address VARCHAR(255) NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 9,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(network, token_type)
);

CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    network wallet_network NOT NULL,
    version wallet_version NOT NULL,
    address VARCHAR(255) NOT NULL,
    public_key VARCHAR(255) NOT NULL,
    mnemonic_encrypted TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    balance DECIMAL(20,9) DEFAULT 0,
    usdt_balance DECIMAL(20,6) DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_wallet_id UUID REFERENCES user_wallets(id),
    to_wallet_id UUID REFERENCES user_wallets(id),
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    amount DECIMAL(20,9) NOT NULL,
    token_type token_type NOT NULL DEFAULT 'TON',
    transaction_type transaction_type NOT NULL DEFAULT 'transfer',
    message TEXT,
    status transaction_status DEFAULT 'pending',
    tx_hash VARCHAR(255),
    fee DECIMAL(20,9) DEFAULT 0,
    category_id UUID REFERENCES transaction_categories(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX idx_user_wallets_address ON user_wallets(address);
CREATE INDEX idx_transactions_from_wallet ON transactions(from_wallet_id);
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Create trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER handle_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at_user_api_keys BEFORE UPDATE ON user_api_keys FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at_ton_network_configs BEFORE UPDATE ON ton_network_configs FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at_user_wallets BEFORE UPDATE ON user_wallets FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own sessions" ON user_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON user_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own API keys" ON user_api_keys FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own wallets" ON user_wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallets" ON user_wallets FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM user_wallets
        WHERE user_id = auth.uid()
        AND id IN (from_wallet_id, to_wallet_id)
    )
);

-- Insert default data
INSERT INTO ton_network_configs (network, rpc_url) VALUES
('testnet', 'https://testnet.toncenter.com/api/v2/jsonRPC'),
('mainnet', 'https://toncenter.com/api/v2/jsonRPC')
ON CONFLICT (network) DO NOTHING;

INSERT INTO token_contracts (network, token_type, contract_address, decimals, symbol, name) VALUES
('testnet', 'TON', 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c', 9, 'TON', 'Toncoin'),
('testnet', 'USDT', 'EQBJXfB_dhBn1P5O3uy7Suo4QbGwLU-lWj_H', 6, 'USDT', 'USDT'),
('mainnet', 'TON', 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c', 9, 'TON', 'Toncoin'),
('mainnet', 'USDT', 'EQCxE6mUtQJKFnGfaROatlOtTxW1QbGwLU-lydI', 6, 'USDT', 'USDT')
ON CONFLICT (network, token_type) DO NOTHING;

INSERT INTO transaction_categories (name, description, color, icon) VALUES
('Transfer', 'Standard wallet-to-wallet transfer', '#6366f1', 'arrow-right'),
('Payment', 'Payment for goods or services', '#10b981', 'shopping-cart'),
('Deposit', 'Deposit into wallet', '#10b981', 'plus-circle'),
('Withdrawal', 'Withdrawal from wallet', '#ef4444', 'minus-circle'),
('Fee', 'Transaction fees', '#8b5cf6', 'dollar-sign')
ON CONFLICT (name) DO NOTHING;