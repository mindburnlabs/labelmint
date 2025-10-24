#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bf71rs1supabase.co';
const supabaseKey = 'sbp_fbf451aa485559cb62e97609ba65697d7f68e0c0';

console.log('🔍 Testing Supabase Database Connection...');
console.log('========================================');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    // Test 1: Check if we can connect
    console.log('\n📡 Testing basic connection...');

    const { data: categories, error: categoriesError } = await supabase
      .from('transaction_categories')
      .select('name, color')
      .limit(5);

    if (categoriesError) {
      console.error('❌ Error fetching categories:', categoriesError.message);
      console.log('\n⚠️  Tables may not exist yet. Need to run migrations.');
      return false;
    }

    console.log('✅ Connected successfully!');
    console.log(`📊 Found ${categories?.length || 0} transaction categories`);

    if (categories && categories.length > 0) {
      console.log('   Sample categories:');
      categories.forEach(cat => {
        console.log(`   - ${cat.name} (${cat.color})`);
      });
    }

    // Test 2: Check users table
    console.log('\n👥 Testing users table...');

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    if (usersError) {
      console.error('❌ Error accessing users table:', usersError.message);
    } else {
      console.log(`✅ Users table accessible. Count: ${users?.length || 0}`);
    }

    // Test 3: Test TON configurations
    console.log('\n⛓️ Testing TON network configurations...');

    const { data: tonConfigs, error: tonError } = await supabase
      .from('ton_network_configs')
      .select('*');

    if (tonError) {
      console.error('❌ Error accessing TON configs:', tonError.message);
    } else {
      console.log(`✅ TON configurations found: ${tonConfigs?.length || 0}`);
      if (tonConfigs && tonConfigs.length > 0) {
        tonConfigs.forEach(config => {
          console.log(`   - ${config.network}: ${config.is_active ? 'Active' : 'Inactive'}`);
        });
      }
    }

    console.log('\n🎉 Database connection test complete!');
    console.log('✅ Supabase is ready for use');

    return true;

  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
    console.log('\n📋 Troubleshooting:');
    console.log('1. Check if Supabase project is active');
    console.log('2. Verify service role key is correct');
    console.log('3. Ensure tables have been created with migrations');
    console.log('   Run: npm run supabase:push');

    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});