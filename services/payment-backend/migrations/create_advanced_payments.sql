-- Advanced Payment Features Migration

-- Multi-chain support
CREATE TABLE payment_chains (
    id SERIAL PRIMARY KEY,
    chain_name VARCHAR(50) NOT NULL UNIQUE, -- 'ton', 'solana', 'polygon', 'arbitrum'
    chain_id INTEGER,
    native_currency VARCHAR(10) NOT NULL, -- 'TON', 'SOL', 'MATIC', 'ETH'
    fee_rate DECIMAL(20, 10) NOT NULL, -- Fee per transaction
    average_speed INTEGER NOT NULL, -- Average confirmation time in seconds
    is_active BOOLEAN DEFAULT true,
    rpc_endpoints JSONB, -- Array of RPC URLs
    explorer_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert supported chains
INSERT INTO payment_chains (chain_name, chain_id, native_currency, fee_rate, average_speed, rpc_endpoints, explorer_url) VALUES
('ton', -1, 'TON', 0.001, 2, '["https://toncenter.com/api/v2/jsonRPC"]', 'https://tonscan.org'),
('solana', 101, 'SOL', 0.00025, 1, '["https://api.mainnet-beta.solana.com"]', 'https://solscan.io'),
('polygon', 137, 'MATIC', 0.01, 5, '["https://polygon-rpc.com"]', 'https://polygonscan.com'),
('arbitrum', 42161, 'ETH', 0.1, 3, '["https://arb1.arbitrum.io/rpc"]', 'https://arbiscan.io');

-- Crypto-to-USDT conversions
CREATE TABLE crypto_conversions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    from_chain VARCHAR(50) REFERENCES payment_chains(chain_name),
    from_currency VARCHAR(20) NOT NULL,
    from_amount DECIMAL(30, 18) NOT NULL,
    to_currency VARCHAR(20) NOT NULL DEFAULT 'USDT',
    to_amount DECIMAL(30, 6) NOT NULL,
    exchange_rate DECIMAL(30, 18) NOT NULL,
    fee DECIMAL(30, 18) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    from_tx_hash VARCHAR(255),
    to_tx_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Scheduled payments
CREATE TABLE scheduled_payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    recipient_id INTEGER REFERENCES users(id),
    amount DECIMAL(20, 6) NOT NULL,
    currency VARCHAR(20) NOT NULL DEFAULT 'USDT',
    frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    next_payment_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'cancelled', 'completed'
    total_payments INTEGER DEFAULT 0,
    completed_payments INTEGER DEFAULT 0,
    metadata JSONB, -- Additional payment data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment splits and referral system
CREATE TABLE payment_splits (
    id SERIAL PRIMARY KEY,
    source_payment_id INTEGER, -- Can reference various payment tables
    source_type VARCHAR(50) NOT NULL, -- 'task_payment', 'conversion', 'bonus'
    total_amount DECIMAL(20, 6) NOT NULL,
    currency VARCHAR(20) NOT NULL DEFAULT 'USDT',
    splits JSONB NOT NULL, -- Array of split objects
    status VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referral relationships
CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER REFERENCES users(id),
    referred_id INTEGER REFERENCES users(id) UNIQUE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    bonus_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.05, -- 5% default
    status VARCHAR(20) DEFAULT 'active',
    total_earned DECIMAL(20, 6) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escrow system for disputed tasks
CREATE TABLE escrow_accounts (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id),
    payer_id INTEGER REFERENCES users(id),
    payee_id INTEGER REFERENCES users(id),
    amount DECIMAL(20, 6) NOT NULL,
    currency VARCHAR(20) NOT NULL DEFAULT 'USDT',
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'funded', 'released', 'refunded', 'disputed'
    release_conditions JSONB, -- Conditions for release
    dispute_reason TEXT,
    dispute_resolved_by INTEGER REFERENCES users(id), -- Admin who resolved
    dispute_resolution TEXT,
    funded_tx_hash VARCHAR(255),
    released_tx_hash VARCHAR(255),
    refunded_tx_hash VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staking system for loyal workers
CREATE TABLE staking_pools (
    id SERIAL PRIMARY KEY,
    pool_name VARCHAR(100) NOT NULL,
    description TEXT,
    apy DECIMAL(5, 4) NOT NULL, -- Annual Percentage Yield
    min_stake DECIMAL(20, 6) NOT NULL,
    max_stake DECIMAL(20, 6),
    lock_period_days INTEGER NOT NULL, -- Lock-up period
    total_staked DECIMAL(20, 6) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User stakes
CREATE TABLE user_stakes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    pool_id INTEGER REFERENCES staking_pools(id),
    amount DECIMAL(20, 6) NOT NULL,
    currency VARCHAR(20) NOT NULL DEFAULT 'USDT',
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'unstaking', 'completed', 'penalized'
    stake_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unlock_at TIMESTAMP WITH TIME ZONE NOT NULL,
    rewards_earned DECIMAL(20, 6) DEFAULT 0,
    last_reward_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    penalty_amount DECIMAL(20, 6) DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reward distribution records
CREATE TABLE reward_distributions (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER REFERENCES staking_pools(id),
    user_id INTEGER REFERENCES users(id),
    stake_id INTEGER REFERENCES user_stakes(id),
    reward_amount DECIMAL(20, 6) NOT NULL,
    currency VARCHAR(20) NOT NULL DEFAULT 'USDT',
    apy_used DECIMAL(5, 4) NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    tx_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multi-chain wallet addresses for users
CREATE TABLE user_crypto_wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    chain VARCHAR(50) REFERENCES payment_chains(chain_name),
    address VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    label VARCHAR(100), -- e.g., "My Solana Wallet"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, chain, address)
);

-- Payment analytics
CREATE TABLE payment_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    chain VARCHAR(50) REFERENCES payment_chains(chain_name),
    total_transactions INTEGER DEFAULT 0,
    total_volume DECIMAL(30, 6) DEFAULT 0,
    total_fees DECIMAL(30, 6) DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    avg_transaction_value DECIMAL(30, 6) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, chain)
);

-- Exchange rate history for conversions
CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    from_currency VARCHAR(20) NOT NULL,
    to_currency VARCHAR(20) NOT NULL,
    rate DECIMAL(30, 18) NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'coingecko', 'binance', etc.
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_crypto_conversions_user_id ON crypto_conversions(user_id);
CREATE INDEX idx_crypto_conversions_status ON crypto_conversions(status);
CREATE INDEX idx_scheduled_payments_user_id ON scheduled_payments(user_id);
CREATE INDEX idx_scheduled_payments_next_payment ON scheduled_payments(next_payment_at) WHERE status = 'active';
CREATE INDEX idx_payment_splits_source ON payment_splits(source_payment_id, source_type);
CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_escrow_accounts_task_id ON escrow_accounts(task_id);
CREATE INDEX idx_escrow_accounts_status ON escrow_accounts(status);
CREATE INDEX idx_user_stakes_user_id ON user_stakes(user_id);
CREATE INDEX idx_user_stakes_pool_id ON user_stakes(pool_id);
CREATE INDEX idx_user_stakes_unlock_at ON user_stakes(unlock_at) WHERE status = 'active';
CREATE INDEX idx_reward_distributions_user_id ON reward_distributions(user_id);
CREATE INDEX idx_user_crypto_wallets_user_chain ON user_crypto_wallets(user_id, chain);
CREATE INDEX idx_payment_analytics_date_chain ON payment_analytics(date, chain);
CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_exchange_rates_timestamp ON exchange_rates(timestamp);

-- Insert default staking pools
INSERT INTO staking_pools (pool_name, description, apy, min_stake, max_stake, lock_period_days) VALUES
('Bronze Staker', 'Entry-level staking pool for new workers', 0.05, 100, 10000, 30),
('Silver Staker', 'Intermediate staking with better rewards', 0.08, 1000, 50000, 60),
('Gold Staker', 'Premium staking for loyal workers', 0.12, 5000, 100000, 90),
('Platinum Staker', 'VIP staking with highest rewards', 0.15, 10000, NULL, 180);

-- Functions for calculating rewards
CREATE OR REPLACE FUNCTION calculate_staking_rewards()
RETURNS TRIGGER AS $$
DECLARE
    reward_amount DECIMAL(20, 6);
    daily_rate DECIMAL(10, 8);
    days_elapsed INTEGER;
BEGIN
    -- Calculate rewards for active stakes
    FOR stake IN
        SELECT us.*, sp.apy
        FROM user_stakes us
        JOIN staking_pools sp ON us.pool_id = sp.id
        WHERE us.status = 'active'
        AND us.last_reward_calculated < NOW() - INTERVAL '1 hour'
    LOOP
        -- Calculate daily rate from APY
        daily_rate := stake.apy / 365;

        -- Calculate hours elapsed since last reward
        days_elapsed := EXTRACT(EPOCH FROM (NOW() - stake.last_reward_calculated)) / 86400;

        -- Calculate reward amount
        reward_amount := stake.amount * daily_rate * days_elapsed;

        -- Update stake
        UPDATE user_stakes
        SET
            rewards_earned = rewards_earned + reward_amount,
            last_reward_calculated = NOW()
        WHERE id = stake.id;

        -- Record reward distribution
        INSERT INTO reward_distributions (
            pool_id, user_id, stake_id, reward_amount,
            period_start, period_end, apy_used
        ) VALUES (
            stake.pool_id, stake.user_id, stake.id, reward_amount,
            stake.last_reward_calculated - INTERVAL '1 hour',
            NOW(), stake.apy
        );
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Schedule the reward calculation (requires pg_cron extension)
-- Uncomment if pg_cron is installed
-- SELECT cron.schedule('calculate-staking-rewards', '0 * * * *', 'SELECT calculate_staking_rewards();');