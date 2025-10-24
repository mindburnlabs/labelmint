-- Database Seeding Script for Deligate.it
-- Use with: supabase db reset < scripts/seed-database.sql

-- Create admin user
INSERT INTO users (
    id,
    email,
    email_verified,
    first_name,
    last_name,
    role,
    status,
    auth_provider,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'admin@labelmint.it',
    true,
    'Admin',
    'User',
    'SUPER_ADMIN',
    'ACTIVE',
    'EMAIL',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- Create test user
INSERT INTO users (
    id,
    email,
    email_verified,
    first_name,
    last_name,
    role,
    status,
    auth_provider,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'test@labelmint.it',
    true,
    'Test',
    'User',
    'USER',
    'ACTIVE',
    'EMAIL',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- Create additional transaction categories if needed
INSERT INTO transaction_categories (name, description, color, icon) VALUES
('Subscription', 'Recurring subscription payments', '#f59e0b', 'credit-card'),
('Donation', 'Charitable donations', '#ec4899', 'heart'),
('Investment', 'Investment transactions', '#14b8a6', 'trending-up'),
('Mining', 'Mining rewards', '#84cc16', 'pickaxe'),
('Staking', 'Staking rewards', '#0ea5e9', 'coins')
ON CONFLICT (name) DO NOTHING;

-- Create storage configurations
INSERT INTO storage_configs (name, config, is_active) VALUES
('local', '{"path": "./uploads", "max_file_size": 104857600}', true),
('s3', '{"bucket": "labelmint-files", "region": "us-east-1", "endpoint": ""}', false)
ON CONFLICT (name) DO NOTHING;

-- Create sample API key for test user
INSERT INTO user_api_keys (
    user_id,
    name,
    key_hash,
    key_prefix,
    permissions,
    rate_limit,
    status,
    created_at,
    updated_at
) SELECT
    u.id,
    'Test API Key',
    encode(sha256('test-secret-key-' || u.id::text), 'hex'),
    'deli_test',
    '["read:wallets", "write:transactions", "read:transactions"]',
    1000,
    'active',
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'test@labelmint.it'
ON CONFLICT DO NOTHING;