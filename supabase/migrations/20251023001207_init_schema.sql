-- ========================================
-- Deligate.it Database Initial Schema
-- ========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;

-- Create custom types
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

-- Users table
CREATE TABLE IF NOT EXISTS users (
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
    two_factor_secret VARCHAR(255),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User API keys
CREATE TABLE IF NOT EXISTS user_api_keys (
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TON network configurations
CREATE TABLE IF NOT EXISTS ton_network_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network wallet_network NOT NULL UNIQUE,
    rpc_url VARCHAR(500) NOT NULL,
    api_key VARCHAR(255),
    gas_fee_estimate DECIMAL(20,9) DEFAULT 0.005,
    max_gas_fee DECIMAL(20,9) DEFAULT 0.1,
    default_timeout INTEGER DEFAULT 30000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Token contracts
CREATE TABLE IF NOT EXISTS token_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network wallet_network NOT NULL,
    token_type token_type NOT NULL,
    contract_address VARCHAR(255) NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 9,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(network, token_type)
);

-- User wallets
CREATE TABLE IF NOT EXISTS user_wallets (
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, network)
);

-- Transaction categories
CREATE TABLE IF NOT EXISTS transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
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
    block_number BIGINT,
    fee DECIMAL(20,9) DEFAULT 0,
    category_id UUID REFERENCES transaction_categories(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);

-- File storage configurations
CREATE TABLE IF NOT EXISTS storage_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name storage_type NOT NULL UNIQUE,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- File uploads
CREATE TABLE IF NOT EXISTS file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_type storage_type DEFAULT 'local',
    is_public BOOLEAN DEFAULT false,
    is_scanned BOOLEAN DEFAULT false,
    scan_result JSONB,
    status upload_status DEFAULT 'uploading',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_key_hash ON user_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_wallets(address);
CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet ON transactions(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet ON transactions(to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_status ON file_uploads(status);

-- Create trigger function for updated_at timestamps
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
CREATE TRIGGER handle_updated_at_token_contracts BEFORE UPDATE ON token_contracts FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at_user_wallets BEFORE UPDATE ON user_wallets FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at_storage_configs BEFORE UPDATE ON storage_configs FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_updated_at_file_uploads BEFORE UPDATE ON file_uploads FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read/write their own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Users can manage their own sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON user_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Users can manage their own API keys
CREATE POLICY "Users can view own API keys" ON user_api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys" ON user_api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys" ON user_api_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys" ON user_api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- Users can view their own wallets
CREATE POLICY "Users can view own wallets" ON user_wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallets" ON user_wallets
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can view transactions involving their wallets
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_wallets
            WHERE user_id = auth.uid()
            AND id IN (from_wallet_id, to_wallet_id)
        )
    );

-- Users can manage their own files
CREATE POLICY "Users can view own files" ON file_uploads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upload files" ON file_uploads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files" ON file_uploads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files" ON file_uploads
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public files are viewable by everyone" ON file_uploads
    FOR SELECT USING (is_public = true);

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
('Fee', 'Transaction fees', '#8b5cf6', 'dollar-sign'),
('Refund', 'Refunded transaction', '#06b6d4', 'refresh-cw')
ON CONFLICT (name) DO NOTHING;

INSERT INTO storage_configs (name, config, is_active) VALUES
('local', '{"path": "./uploads", "max_file_size": 104857600}', true)
ON CONFLICT (name) DO NOTHING;