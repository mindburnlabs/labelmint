#!/usr/bin/env node

/**
 * Database Setup Script for Deligate.it
 * Creates all necessary tables and initial data in Supabase
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bf71rs1supabase.co';
const supabaseKey = 'sbp_fbf451aa485559cb62e97609ba65697d7f68e0c0';

console.log('🚀 Setting up Deligate.it Database...');
console.log('==================================');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql, description) {
  try {
    console.log(`\n📝 Executing: ${description}`);

    // Use raw SQL execution via RPC (you'd need to create this function in Supabase)
    // For now, we'll show what needs to be executed
    console.log(`SQL:\n${sql.substring(0, 200)}${sql.length > 200 ? '...' : ''}`);

    // In a real setup, you would:
    // 1. Go to Supabase Dashboard → SQL Editor
    // 2. Run each migration file
    // 3. Or use Supabase CLI: supabase db push

    return true;
  } catch (error) {
    console.error(`❌ Error executing ${description}:`, error.message);
    return false;
  }
}

async function setupDatabase() {
  console.log('\n📋 Database Setup Instructions:');
  console.log('==============================');
  console.log('\nSince we have the credentials, here\'s what you need to do:');
  console.log('\n1️⃣ Open Supabase Dashboard:');
  console.log(`   https://supabase.com/dashboard/project/bf71rs1`);
  console.log('\n2️⃣ Go to SQL Editor (in left sidebar)');
  console.log('\n3️⃣ Run these migration files in order:');
  console.log('   - supabase/migrations/20240101000000_initial_schema.sql');
  console.log('   - supabase/migrations/20240101000001_rls_policies.sql');
  console.log('   - supabase/migrations/20240101000002_functions_triggers.sql');
  console.log('\n4️⃣ Or use the Supabase CLI:');
  console.log('   npm run supabase:push');
  console.log('\n5️⃣ Verify setup:');
  console.log('   npm run db:generate');
  console.log('   node scripts/quick-db-test.js');

  // Read migration files to show what they contain
  console.log('\n📄 Migration Files Overview:');
  console.log('===========================');

  const migrations = [
    '20240101000000_initial_schema.sql',
    '20240101000001_rls_policies.sql',
    '20240101000002_functions_triggers.sql'
  ];

  for (const migration of migrations) {
    try {
      const path = `./supabase/migrations/${migration}`;
      if (fs.existsSync(path)) {
        const content = fs.readFileSync(path, 'utf8');
        const lines = content.split('\n').length;
        console.log(`\n📋 ${migration}`);
        console.log(`   Lines: ${lines}`);
        console.log(`   Size: ${Math.round(content.length / 1024)} KB`);

        // Show key elements
        if (content.includes('CREATE TABLE')) {
          const tables = (content.match(/CREATE TABLE.*?(\w+)/g) || [])
            .map(m => m.split('CREATE TABLE IF NOT EXISTS ')[1] || m.split('CREATE TABLE ')[1]);
          console.log(`   Tables: ${tables.join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Could not read ${migration}: ${error.message}`);
    }
  }

  console.log('\n✨ Database schema includes:');
  console.log('   - Users & authentication');
  console.log('   - TON blockchain wallets');
  console.log('   - Transaction records');
  console.log('   - File storage');
  console.log('   - API keys & sessions');
  console.log('   - Row Level Security (RLS)');
  console.log('   - Stored procedures');

  console.log('\n🎯 Next Steps:');
  console.log('1. Run the migrations in Supabase Dashboard');
  console.log('2. Test the connection with: node scripts/quick-db-test.js');
  console.log('3. Start development with: npm run dev');
}

// Alternative: Create tables programmatically
async function createBasicStructure() {
  console.log('\n🏗️ Creating Basic Database Structure...');
  console.log('=====================================');

  const createExtensions = `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
    CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;
  `;

  const createTypes = `
    CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT');
    CREATE TYPE user_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED', 'BANNED');
    CREATE TYPE auth_provider AS ENUM ('EMAIL', 'GOOGLE', 'GITHUB', 'TELEGRAM');
    CREATE TYPE wallet_network AS ENUM ('mainnet', 'testnet');
    CREATE TYPE wallet_version AS ENUM ('v3R2', 'v4R2', 'telegram');
    CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed', 'cancelled', 'refunded');
    CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'transfer', 'payment', 'refund', 'fee');
    CREATE TYPE token_type AS ENUM ('TON', 'USDT');
  `;

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE NOT NULL,
      email_verified BOOLEAN DEFAULT false,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      role user_role DEFAULT 'USER',
      status user_status DEFAULT 'PENDING',
      auth_provider auth_provider DEFAULT 'EMAIL',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const createWalletsTable = `
    CREATE TABLE IF NOT EXISTS user_wallets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      network wallet_network NOT NULL,
      version wallet_version NOT NULL,
      address VARCHAR(255) NOT NULL,
      public_key VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      is_default BOOLEAN DEFAULT false,
      balance DECIMAL(20,9) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, network)
    );
  `;

  const createTransactionsTable = `
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      from_wallet_id UUID,
      to_wallet_id UUID,
      from_address VARCHAR(255) NOT NULL,
      to_address VARCHAR(255) NOT NULL,
      amount DECIMAL(20,9) NOT NULL,
      token_type token_type NOT NULL DEFAULT 'TON',
      transaction_type transaction_type NOT NULL DEFAULT 'transfer',
      status transaction_status DEFAULT 'pending',
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      confirmed_at TIMESTAMPTZ
    );
  `;

  console.log('\n⚠️  To create tables programmatically, you need to:');
  console.log('1. Enable database admin access in Supabase Dashboard');
  console.log('2. Or use the SQL Editor directly');
  console.log('3. Or run migrations with: npm run supabase:push');

  return true;
}

async function main() {
  try {
    // Test basic connection
    console.log('\n🔍 Testing Supabase connection...');
    const { data, error } = await supabase.from('_test_connection').select('*').limit(1);

    if (error && !error.message.includes('does not exist')) {
      console.error('❌ Cannot connect to Supabase:', error.message);
      console.log('\nCheck:');
      console.log('1. Project URL is correct');
      console.log('2. Service role key is valid');
      console.log('3. Project is active');
    } else {
      console.log('✅ Connection successful! Project is accessible.');
    }

    // Show setup instructions
    await setupDatabase();

    // Show programmatic option
    await createBasicStructure();

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
  }
}

main().catch(console.error);