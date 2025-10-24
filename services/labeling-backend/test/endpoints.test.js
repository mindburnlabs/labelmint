import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Mock Telegram user data for testing
const mockTelegramData = {
  user: {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en',
    is_premium: false
  },
  auth_date: Math.floor(Date.now() / 1000),
  hash: 'test-hash' // In production, this would be a valid HMAC hash
};

async function testEndpoints() {
  console.log('🧪 Testing API Endpoints...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log('✅ Health check:', healthData);
    console.log('');

    // Test 2: Get next task (without auth)
    console.log('2. Testing GET /api/tasks/next without auth...');
    const nextTaskRes = await fetch(`${BASE_URL}/api/tasks/next`);
    console.log('Status:', nextTaskRes.status);
    const nextTaskData = await nextTaskRes.json();
    console.log('Response:', nextTaskData);
    console.log('');

    // Test 3: Get API info
    console.log('3. Testing GET /api/v1...');
    const apiInfoRes = await fetch(`${BASE_URL}/api/v1`);
    const apiInfoData = await apiInfoRes.json();
    console.log('✅ API Info:', apiInfoData);
    console.log('');

    // Test 4: Submit label without auth
    console.log('4. Testing POST /api/tasks/1/label without auth...');
    const labelRes = await fetch(`${BASE_URL}/api/tasks/1/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'test_answer', time_spent: 15 })
    });
    console.log('Status:', labelRes.status);
    const labelData = await labelRes.json();
    console.log('Response:', labelData);
    console.log('');

    // Test 5: Test with auth header (even if invalid hash)
    console.log('5. Testing with Telegram auth header...');
    const authHeaders = {
      'X-Telegram-Init-Data': `user=${encodeURIComponent(JSON.stringify(mockTelegramData.user))}&auth_date=${mockTelegramData.auth_date}&hash=${mockTelegramData.hash}`
    };

    const taskWithAuth = await fetch(`${BASE_URL}/api/tasks/next`, {
      headers: authHeaders
    });
    console.log('Status:', taskWithAuth.status);
    const taskWithAuthData = await taskWithAuth.json();
    console.log('Response:', taskWithAuthData);

    console.log('\n✅ Endpoint testing complete!');
    console.log('\nNote: The Telegram auth validation requires a valid hash in production.');
    console.log('Set TELEGRAM_BOT_TOKEN in your environment to enable proper auth validation.');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run tests if server is running
async function checkServerAndTest() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (res.ok) {
      await testEndpoints();
    } else {
      console.log('❌ Server is not responding correctly');
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running on http://localhost:3001');
    console.log('Run: npm run dev');
  }
}

checkServerAndTest();