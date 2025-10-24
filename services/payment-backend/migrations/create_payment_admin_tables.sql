-- Additional tables for payment administration

-- System Wallets
CREATE TABLE IF NOT EXISTS system_wallets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL UNIQUE,
    network_name VARCHAR(50) REFERENCES ton_network_configs(name),
    wallet_version VARCHAR(50),
    public_key VARCHAR(255),
    mnemonic_encrypted TEXT,
    balance_usdt DECIMAL(20, 6) DEFAULT 0,
    balance_ton DECIMAL(20, 9) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Configuration
CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category, key)
);

-- Balance Adjustments (for admin adjustments)
CREATE TABLE IF NOT EXISTS balance_adjustments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount DECIMAL(20, 6) NOT NULL,
    reason TEXT,
    network_name VARCHAR(50) REFERENCES ton_network_configs(name),
    adjusted_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Reports
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE UNIQUE,
    transaction_count INTEGER DEFAULT 0,
    usdt_volume DECIMAL(20, 6) DEFAULT 0,
    ton_volume DECIMAL(20, 9) DEFAULT 0,
    payout_count INTEGER DEFAULT 0,
    payout_amount DECIMAL(20, 6) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default system configs
INSERT INTO system_configs (category, key, value, description) VALUES
('fees', 'usdt_transfer_fee', '0.1', 'USDT transfer fee in TON'),
('fees', 'ton_transfer_fee', '0.001', 'TON transfer fee in TON'),
('fees', 'internal_transfer_fee', '0', 'Internal transfer fee'),
('fees', 'platform_commission', '0.05', 'Platform commission rate (5%)'),
('fees', 'min_payout', '1', 'Minimum payout amount in USDT'),
('fees', 'max_payout', '10000', 'Maximum payout amount in USDT'),
('limits', 'max_daily_withdrawal', '1000', 'Maximum daily withdrawal in USDT'),
('limits', 'max_transaction_amount', '5000', 'Maximum single transaction in USDT'),
('limits', 'kyc_threshold', '1000', 'KYC required threshold in USDT'),
('notifications', 'low_balance_threshold', '100', 'Low balance alert threshold in USDT'),
('notifications', 'payout_delay_hours', '24', 'Delay before processing payouts in hours'),
('security', 'max_login_attempts', '5', 'Maximum login attempts before lockout'),
('security', 'session_timeout_minutes', '60', 'Session timeout in minutes')
ON CONFLICT (category, key) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_system_wallets_active ON system_wallets(is_active);
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_user ON balance_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);

-- Apply triggers
CREATE TRIGGER update_system_wallets_updated_at
    BEFORE UPDATE ON system_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_configs_updated_at
    BEFORE UPDATE ON system_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();