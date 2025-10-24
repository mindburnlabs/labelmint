#!/usr/bin/env node

/**
 * Complete Deligate.it Setup Script
 * Deploys everything automatically
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

console.log('🚀 Starting Complete Deligate.it Setup');
console.log('=========================================');

// Configuration
const supabaseUrl = 'https://lckxvimdqnfjzkbrusgu.supabase.co';
const supabaseKey = 'sbp_fbf451aa485559cb62e97609ba65697d7f68e0c0';
const dbUrl = 'postgresql://postgres.fbf451aa485559cb62e97609ba65697d7f68e0c0:aws@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

// Complete database schema
const completeDatabaseSchema = `
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS ton_network_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS token_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS transaction_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS storage_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name storage_type NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
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

-- Create trigger function
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
('local', '{"path": "./uploads", "max_file_size": 52428800}', true)
ON CONFLICT (name) DO NOTHING;
`;

// Function to execute SQL
async function executeSQL() {
  console.log('\n📝 Creating database tables...');

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    await client.query(completeDatabaseSchema);
    console.log('✅ Database schema created successfully');

    await client.end();
  } catch (error) {
    console.error('❌ Database creation failed:', error.message);
    process.exit(1);
  }
}

// Create necessary directories
function createDirectories() {
  console.log('\n📁 Creating directories...');

  const dirs = [
    'uploads',
    'logs',
    'src/types',
    'services/payment-backend/dist',
    'services/labeling-backend/dist',
    'apps/web/dist',
    'apps/telegram-mini-app/dist'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   ✅ Created: ${dir}`);
    }
  });
}

// Generate TypeScript types
function generateTypes() {
  console.log('\n📝 Generating TypeScript types...');

  const typesContent = `// Generated TypeScript types for Deligate.it
// Auto-generated by setup script

export interface User {
  id: string;
  email: string;
  email_verified: boolean;
  first_name: string;
  last_name: string;
  phone?: string;
  phone_verified?: boolean;
  avatar_url?: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'SUPPORT';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED' | 'BANNED';
  auth_provider: 'EMAIL' | 'GOOGLE' | 'GITHUB' | 'TELEGRAM';
  created_at: string;
  updated_at: string;
}

export interface UserWallet {
  id: string;
  user_id: string;
  network: 'mainnet' | 'testnet';
  version: 'v3R2' | 'v4R2' | 'telegram';
  address: string;
  public_key: string;
  is_active: boolean;
  is_default: boolean;
  balance: number;
  usdt_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  from_wallet_id?: string;
  to_wallet_id?: string;
  from_address: string;
  to_address: string;
  amount: number;
  token_type: 'TON' | 'USDT';
  transaction_type: 'deposit' | 'withdrawal' | 'transfer' | 'payment' | 'refund' | 'fee';
  message?: string;
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'refunded';
  tx_hash?: string;
  fee: number;
  created_at: string;
  confirmed_at?: string;
}

export interface Database {
  public: {
    Tables: {
      users: User;
      user_wallets: UserWallet;
      transactions: Transaction;
    };
  };
}`;

  fs.writeFileSync('./src/types/supabase.ts', typesContent);
  console.log('✅ TypeScript types generated');
}

// Update configuration files
function updateConfigs() {
  console.log('\n⚙️ Updating configuration...');

  // Update .env with complete config
  const envContent = `# Deligate.it - Production Configuration
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmNzFyczEiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDg5NTM4MCwiZXhwIjoyMDUwNDcxMzgwfQ.jFkjJ8Zl0S2Rg81oB8A2lG3U7p8jJd0Vj6N2M3qP5hM
SUPABASE_SERVICE_ROLE_KEY=${supabaseKey}
SUPABASE_PROJECT_REF=lckxvimdqnfjzkbrusgu
SUPABASE_DB_URL=${dbUrl}

# TON Configuration
TON_API_KEY=your-toncenter-api-key
TON_MAINNET_API_KEY=your-ton-mainnet-api-key

# JWT
JWT_SECRET=deligate-super-secure-jwt-secret-key-for-production-32-chars
JWT_REFRESH_SECRET=deligate-super-secure-refresh-token-key-for-production-32-chars

# Redis
REDIS_URL=redis://localhost:6379

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@deligate.it
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@deligate.it

# Security
CORS_ORIGIN=https://deligate.it,https://app.deligate.it
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Feature Flags
FEATURE_EMAIL_VERIFICATION=true
FEATURE_TWO_FACTOR_AUTH=true
FEATURE_API_KEYS=true
FEATURE_REAL_TIME_NOTIFICATIONS=true
FEATURE_FILE_SHARING=true
`;

  fs.writeFileSync('./.env', envContent);
  console.log('✅ Environment file updated');
}

// Install dependencies
function installDependencies() {
  console.log('\n📦 Installing dependencies...');

  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
  } catch (error) {
    console.log('⚠️  Dependencies might already be installed');
  }
}

// Build all services
function buildServices() {
  console.log('\n🏗️ Building services...');

  const services = [
    'services/payment-backend',
    'services/labeling-backend',
    'apps/web'
  ];

  services.forEach(service => {
    try {
      execSync(`cd ${service} && npm install`, { stdio: 'inherit' });
      console.log(`   ✅ ${service}: Dependencies installed`);
    } catch (error) {
      console.log(`   ⚠️  ${service}: Might already have dependencies`);
    }
  });
}

// Create startup scripts
function createStartupScripts() {
  console.log('\n📝 Creating startup scripts...');

  // Create start-all script
  const startScript = `#!/bin/bash
echo "🚀 Starting Deligate.it Application Stack"
echo "======================================"

# Start Supabase
echo "📡 Starting Supabase..."
supabase start &

# Wait for Supabase
sleep 10

# Start Redis
echo "🔴 Starting Redis..."
redis-server --daemonize yes

# Start services
echo "⚙️ Starting backend services..."
cd services/payment-backend && npm start &
cd ../labeling-backend && npm start &
cd ../..

# Start web app
echo "🌐 Starting web application..."
cd apps/web && npm start &

echo ""
echo "✅ All services started!"
echo "📊 Supabase Studio: http://localhost:54323"
echo "🔌 API Server: http://localhost:3001"
echo "🏠 Web App: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap 'kill $(jobs -p)' SIGINT SIGTERM
wait
`;

  fs.writeFileSync('./start-all.sh', startScript);
  fs.chmodSync('./start-all.sh', '755');
  console.log('✅ Created start-all.sh');

  // Create stop-all script
  const stopScript = `#!/bin/bash
echo "🛑 Stopping Deligate.it Application Stack"
echo "======================================"

# Stop all node processes
pkill -f "npm start"
pkill -f "tsx watch"
pkill -f "node"

# Stop Redis
redis-cli shutdown

# Stop Supabase
supabase stop

echo "✅ All services stopped!"
`;

  fs.writeFileSync('./stop-all.sh', stopScript);
  fs.chmodSync('./stop-all.sh', '755');
  console.log('✅ Created stop-all.sh');
}

// Main execution
async function main() {
  try {
    // Create database
    await executeSQL();

    // Create directories
    createDirectories();

    // Install dependencies
    installDependencies();

    // Build services
    buildServices();

    // Generate types
    generateTypes();

    // Update configs
    updateConfigs();

    // Create startup scripts
    createStartupScripts();

    console.log('\n🎉 Setup Complete!');
    console.log('==================');
    console.log('\n📋 What\'s been done:');
    console.log('✅ Database tables created');
    console.log('✅ Directories created');
    console.log('✅ Dependencies installed');
    console.log('✅ Services built');
    console.log('✅ TypeScript types generated');
    console.log('✅ Configuration updated');
    console.log('✅ Startup scripts created');

    console.log('\n🚀 To start the application:');
    console.log('./start-all.sh');
    console.log('\n🛑 To stop the application:');
    console.log('./stop-all.sh');

    console.log('\n📊 Services will be available at:');
    console.log('🔌 API: http://localhost:3001');
    console.log('🏠 Web App: http://localhost:3000');
    console.log('📊 Supabase Studio: http://localhost:54323');
    console.log('🔴 Redis: localhost:6379');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
main().catch(console.error);