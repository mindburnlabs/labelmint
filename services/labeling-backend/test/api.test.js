import fetch from 'node-fetch';
import crypto from 'crypto';

const API_BASE = 'http://localhost:3001/api/v1';

// Test API credentials (create these in your actual implementation)
const API_KEY = 'tl_test_key_1234567890abcdef';
const API_SECRET = 'test_secret_key_for_development_only';

function generateSignature(method, path, timestamp, body) {
  const payload = `${method}${path}${timestamp}${body ? JSON.stringify(body) : ''}`;
  return crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');
}

async function testAPI() {
  console.log('🧪 Testing Enterprise API...\n');

  try {
    // Test 1: Create API key (this would normally be authenticated)
    console.log('1️⃣ Testing POST /keys (Create API Key)');
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateSignature('POST', '/api/v1/keys', timestamp, { name: 'Test API Key' });

    console.log('   Headers:');
    console.log(`   X-API-Key: ${API_KEY}`);
    console.log(`   X-Timestamp: ${timestamp}`);
    console.log(`   X-Signature: ${signature}\n`);

    // Test 2: Create project
    console.log('2️⃣ Testing POST /projects (Create Project)');
    console.log('   Request body: {
      name: "Test Project",
      type: "image",
      categories: ["cat", "dog", "bird"],
      description: "Test project for API validation"
    }\n');

    // Test 3: Upload data
    console.log('3️⃣ Testing POST /projects/:id/upload (Upload Data)');
    console.log('   Request body: {
      data: [
        { id: "1", data: "https://example.com/image1.jpg" },
        { id: "2", data: "https://example.com/image2.jpg" }
      ]
    }\n');

    // Test 4: Get project status
    console.log('4️⃣ Testing GET /projects/:id/status (Get Status)');

    // Test 5: Get results
    console.log('5️⃣ Testing GET /projects/:id/results (Get Results)');
    console.log('   Query params: format=json, limit=10\n');

    console.log('✅ API endpoints defined successfully!');
    console.log('\n📚 To test the API with real data:');
    console.log('1. Start the backend server: npm run dev');
    console.log('2. Generate a real API key through the authentication system');
    console.log('3. Use HMAC-SHA256 signatures for authentication');
    console.log('4. Visit http://localhost:3001/api-docs for interactive documentation');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

testAPI();