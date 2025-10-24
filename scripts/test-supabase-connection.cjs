#!/usr/bin/env node

/**
 * Test Supabase Database Connection
 * Verifies connectivity and basic operations
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration from environment
const supabaseUrl = 'https://bf71rs1supabase.co';
const supabaseKey = 'sbp_fbf451aa485559cb62e97609ba65697d7f68e0c0';
const dbUrl = 'postgresql://postgres.fbf451aa485559cb62e97609ba65697d7f68e0c0:aws@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

console.log('🔍 Testing Supabase Connection...');
console.log('================================');

// Test 1: Direct Supabase client
async function testSupabaseClient() {
  console.log('\n📡 Testing Supabase Client...');

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test basic connection
    const { data, error } = await supabase
      .from('transaction_categories')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.log('❌ Supabase client error:', error.message);
      return false;
    }

    console.log('✅ Supabase client connected successfully');
    console.log(`📊 Categories count: ${data?.length || 0}`);
    return true;
  } catch (error) {
    console.log('❌ Supabase client connection failed:', error.message);
    return false;
  }
}

// Test 2: Direct PostgreSQL connection
async function testPostgresConnection() {
  console.log('\n🐘 Testing PostgreSQL Connection...');

  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    // Test query
    const result = await client.query('SELECT NOW() as current_time, version() as version');

    console.log('✅ PostgreSQL connected successfully');
    console.log(`⏰ Server time: ${result.rows[0].current_time}`);
    console.log(`🔧 Version: ${result.rows[0].version.split(',')[0]}`);

    await client.end();
    return true;
  } catch (error) {
    console.log('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
}

// Test 3: Check if tables exist
async function testTableStructure() {
  console.log('\n📋 Testing Table Structure...');

  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    // Check key tables
    const tables = [
      'users',
      'user_wallets',
      'transactions',
      'user_sessions',
      'file_uploads',
      'transaction_categories',
      'ton_network_configs',
      'token_contracts'
    ];

    let allTablesExist = true;

    for (const table of tables) {
      const result = await client.query(
        'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)',
        [table]
      );

      const exists = result.rows[0].exists;
      const status = exists ? '✅' : '❌';
      console.log(`${status} Table: ${table}`);

      if (!exists) {
        allTablesExist = false;
      }
    }

    await client.end();
    return allTablesExist;
  } catch (error) {
    console.log('❌ Table structure check failed:', error.message);
    return false;
  }
}

// Test 4: Test RLS policies
async function testRLSPolicies() {
  console.log('\n🔐 Testing RLS Policies...');

  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    // Check RLS status on key tables
    const tablesWithRLS = [
      'users',
      'user_wallets',
      'transactions',
      'file_uploads'
    ];

    let rlsEnabled = true;

    for (const table of tablesWithRLS) {
      const result = await client.query(`
        SELECT rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = $1
      `, [table]);

      if (result.rows.length > 0) {
        const hasRLS = result.rows[0].rowsecurity;
        const status = hasRLS ? '✅' : '❌';
        console.log(`${status} RLS on ${table}: ${hasRLS ? 'Enabled' : 'Disabled'}`);

        if (!hasRLS) {
          rlsEnabled = false;
        }
      }
    }

    await client.end();
    return rlsEnabled;
  } catch (error) {
    console.log('❌ RLS policy check failed:', error.message);
    return false;
  }
}

// Test 5: Performance test
async function testPerformance() {
  console.log('\n⚡ Testing Performance...');

  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    const start = Date.now();

    // Execute multiple queries
    await client.query('SELECT 1');
    await client.query('SELECT 1');
    await client.query('SELECT 1');
    await client.query('SELECT 1');
    await client.query('SELECT 1');

    const end = Date.now();
    const avgLatency = (end - start) / 5;

    console.log(`✅ Average query latency: ${avgLatency}ms`);

    if (avgLatency < 100) {
      console.log('🚀 Excellent performance');
    } else if (avgLatency < 300) {
      console.log('✨ Good performance');
    } else {
      console.log('⚠️  Slow performance detected');
    }

    await client.end();
    return avgLatency < 500;
  } catch (error) {
    console.log('❌ Performance test failed:', error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  const tests = [
    { name: 'Supabase Client', fn: testSupabaseClient },
    { name: 'PostgreSQL Connection', fn: testPostgresConnection },
    { name: 'Table Structure', fn: testTableStructure },
    { name: 'RLS Policies', fn: testRLSPolicies },
    { name: 'Performance', fn: testPerformance }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      console.log(`❌ ${test.name} test failed with error:`, error.message);
      results.push({ name: test.name, passed: false });
    }
  }

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('=======================');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
  });

  console.log('\n' + '='.repeat(50));
  console.log(`Total: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All tests passed! Supabase is ready for production.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please check the issues above.');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testSupabaseClient,
  testPostgresConnection,
  testTableStructure,
  testRLSPolicies,
  testPerformance,
  runAllTests
};