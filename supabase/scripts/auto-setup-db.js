#!/usr/bin/env node

import fs from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

console.log('🚀 Auto-Setting Up Deligate.it Database');
console.log('=====================================');

const supabaseUrl = 'https://lckxvimdqnfjzkbrusgu.supabase.co';
const supabaseKey = 'sbp_fbf451aa485559cb62e97609ba65697d7f68e0c0';
const dbUrl = 'postgresql://postgres.fbf451aa485559cb62e97609ba65697d7f68e0c0:aws@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

// Read the SQL file
const sqlFile = fs.readFileSync('./scripts/create-database.sql', 'utf8');

// Execute SQL directly via PostgreSQL client
async function setupDatabase() {
  console.log('\n📝 Creating database tables...');

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Split SQL into individual statements and execute
    const statements = sqlFile
      .split(';;')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          await client.query(statement);
          console.log(`   ✅ Executed statement ${i + 1}/${statements.length}`);
        } catch (error) {
          // Ignore "already exists" errors
          if (error.message.includes('already exists') ||
              error.message.includes('duplicate key') ||
              error.message.includes('does not exist')) {
            console.log(`   ℹ️  ${error.message.split(':')[0]}`);
          } else {
            console.log(`   ❌ Error: ${error.message}`);
          }
        }
      }
    }

    await client.end();
    console.log('\n✅ Database setup complete!');

    // Verify setup
    await verifyDatabase();

    // Generate types
    console.log('\n📝 Generating TypeScript types...');
    try {
      execSync('npx supabase gen types typescript --project-ref lckxvimdqnfjzkbrusgu --local > ./src/types/supabase.ts', { stdio: 'inherit' });
      console.log('✅ TypeScript types generated');
    } catch (error) {
      console.log('⚠️  Could not generate types automatically. Run: npm run db:generate');
    }

    console.log('\n🎉 Database is ready for production!');
    console.log('\nNext steps:');
    console.log('1. npm run dev');
    console.log('2. Open http://localhost:3000');
    console.log('3. Start using your app!');

  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

async function verifyDatabase() {
  console.log('\n🔍 Verifying database setup...');

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const tables = [
    { name: 'users', description: 'User accounts' },
    { name: 'user_wallets', description: 'TON wallets' },
    { name: 'transactions', description: 'Transaction records' },
    { name: 'transaction_categories', description: 'Transaction categories' },
    { name: 'ton_network_configs', description: 'TON networks' }
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ ${table.name}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table.name}: ${count || 0} records`);
      }
    } catch (error) {
      console.log(`   ❌ ${table.name}: ${error.message}`);
    }
  }
}

// Run the setup
setupDatabase().catch(console.error);