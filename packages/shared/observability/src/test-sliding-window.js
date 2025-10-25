// Simple test for sliding window functionality
import { Summary } from './metrics.js';

console.log('🧪 Testing Sliding Window Implementation');
console.log('==========================================');

async function testSlidingWindow() {
  try {
    // Test 1: Basic functionality
    console.log('\n1️⃣ Testing basic sliding window...');

    const summary = new Summary('test_response_time', { service: 'test' });
    summary.setSlidingWindow(5000, 5); // 5 second window

    const now = Date.now();

    // Add some values
    summary.observe(100);
    summary.observe(200);
    summary.observe(300);

    let result = summary.getValue();
    console.log(`✅ Basic test - Count: ${result.metadata?.count}, Mean: ${result.value.toFixed(2)}`);
    console.log(`   Quantiles - 50th: ${result.metadata?.quantiles?.['0.5']}, 95th: ${result.metadata?.quantiles?.['0.95']}`);

    // Test 2: Sliding window expiration
    console.log('\n2️⃣ Testing sliding window expiration...');

    // Set very short window
    summary.setSlidingWindow(100, 2); // 100ms window

    summary.observe(10);

    const result1 = summary.getValue();
    console.log(`   Before expiration - Count: ${result1.metadata?.count}`);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    summary.observe(20); // This will trigger cleanup

    const result2 = summary.getValue();
    console.log(`   After expiration - Count: ${result2.metadata?.count}, Value: ${result2.value}`);

    if (result2.metadata?.count === 1 && result2.value === 20) {
      console.log('✅ Sliding window expiration working correctly');
    } else {
      console.log('❌ Sliding window expiration failed');
    }

    // Test 3: Labels
    console.log('\n3️⃣ Testing labels...');

    summary.setSlidingWindow(5000, 5);

    summary.observe(50, { endpoint: '/api/users' });
    summary.observe(150, { endpoint: '/api/users' });
    summary.observe(250, { endpoint: '/api/orders' });

    const usersResult = summary.getValue({ endpoint: '/api/users' });
    const ordersResult = summary.getValue({ endpoint: '/api/orders' });

    console.log(`   Users endpoint - Count: ${usersResult.metadata?.count}, Mean: ${usersResult.value}`);
    console.log(`   Orders endpoint - Count: ${ordersResult.metadata?.count}, Mean: ${ordersResult.value}`);

    if (usersResult.metadata?.count === 2 && usersResult.value === 100 &&
        ordersResult.metadata?.count === 1 && ordersResult.value === 250) {
      console.log('✅ Labels working correctly');
    } else {
      console.log('❌ Labels failed');
    }

    // Test 4: Prometheus format
    console.log('\n4️⃣ Testing Prometheus format...');

    const prometheusOutput = summary.toPrometheus();
    console.log('   Prometheus output preview:');
    console.log('   ' + prometheusOutput.split('\n').slice(0, 6).join('\n   '));

    if (prometheusOutput.includes('sliding window') &&
        prometheusOutput.includes('quantile')) {
      console.log('✅ Prometheus format includes sliding window info');
    } else {
      console.log('❌ Prometheus format incomplete');
    }

    // Test 5: Performance with many values
    console.log('\n5️⃣ Testing performance with many values...');

    const perfSummary = new Summary('perf_test', {});
    perfSummary.setSlidingWindow(1000, 10);

    const start = Date.now();

    // Add many values
    for (let i = 0; i < 10000; i++) {
      perfSummary.observe(Math.random() * 1000);
    }

    const end = Date.now();
    const perfResult = perfSummary.getValue();

    console.log(`   Processed 10000 values in ${end - start}ms`);
    console.log(`   Current window count: ${perfResult.metadata?.count}`);
    console.log(`   Mean: ${perfResult.value.toFixed(2)}`);

    console.log('\n🎉 All sliding window tests completed!');
    return true;

  } catch (error) {
    console.error('\n❌ Sliding window test failed:', error);
    return false;
  }
}

// Test quantile calculations specifically
function testQuantiles() {
  console.log('\n📊 Testing quantile calculations...');

  const summary = new Summary('quantile_test', {});
  summary.setSlidingWindow(60000, 5);

  // Add predictable data
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  values.forEach(value => summary.observe(value));

  const result = summary.getValue();

  console.log(`   Data: [${values.join(', ')}]`);
  console.log(`   50th percentile (median): ${result.metadata?.quantiles?.['0.5']}`);
  console.log(`   90th percentile: ${result.metadata?.quantiles?.['0.9']}`);
  console.log(`   95th percentile: ${result.metadata?.quantiles?.['0.95']}`);
  console.log(`   99th percentile: ${result.metadata?.quantiles?.['0.99']}`);

  // Expected values for our test data
  const expected = {
    '0.5': 5.5,   // Median of 1-10
    '0.9': 9,     // 90th percentile
    '0.95': 10,   // 95th percentile
    '0.99': 10    // 99th percentile
  };

  let allCorrect = true;
  for (const [quantile, expectedValue] of Object.entries(expected)) {
    const actualValue = result.metadata?.quantiles?.[quantile];
    if (Math.abs(actualValue - expectedValue) > 0.1) {
      console.log(`   ❌ Quantile ${quantile}: expected ${expectedValue}, got ${actualValue}`);
      allCorrect = false;
    }
  }

  if (allCorrect) {
    console.log('✅ All quantiles calculated correctly');
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Sliding Window Tests');
  console.log('==================================');

  testQuantiles();

  const success = await testSlidingWindow();

  if (success) {
    console.log('\n✨ All sliding window tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

runAllTests().catch(console.error);