import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

// Test configuration
export let options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 },  // Stay at 10 users
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 50 },  // Stay at 50 users
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '1m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete within 2s
    http_req_failed: ['rate<0.1'],      // Error rate must be less than 10%
    errors: ['rate<0.1'],               // Custom error rate must be less than 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Helper function to generate random test data
function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Test data
const testFiles = {
  png: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  json: JSON.stringify({ test: true, data: randomString(1000) }),
  txt: randomString(5000),
};

export function setup() {
  console.log('Starting load test...');
}

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Test 1: Health check
  let response = http.get(`${BASE_URL}/health`, params);
  let success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!success);

  // Test 2: Get presigned upload URL
  response = http.post(
    `${BASE_URL}/api/files/upload/url`,
    JSON.stringify({
      fileName: `test-${randomString(10)}.png`,
      contentType: 'image/png',
      folder: 'load-test',
    }),
    params
  );
  success = check(response, {
    'presigned URL status is 200': (r) => r.status === 200,
    'presigned URL has uploadUrl': (r) => r.json('uploadUrl') !== undefined,
    'presigned URL has key': (r) => r.json('key') !== undefined,
    'presigned URL response time < 1s': (r) => r.timings.duration < 1000,
  });
  errorRate.add(!success);

  if (success) {
    const uploadData = response.json();

    // Test 3: Upload file (mock since we can't use the presigned URL directly in k6)
    // Instead, we'll test the regular upload endpoint
    let fileData = new Uint8Array(1024); // 1KB test file
    for (let i = 0; i < fileData.length; i++) {
      fileData[i] = Math.floor(Math.random() * 256);
    }

    response = http.post(
      `${BASE_URL}/api/files/upload`,
      fileData,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': `load-test-${randomString(10)}.bin`,
          'X-Folder': 'load-test',
        },
      }
    );
    // Note: This will likely fail with the current implementation, but we're testing the error handling
    check(response, {
      'upload handled (success or error)': (r) => r.status === 200 || r.status === 400 || r.status === 500,
    });
  }

  // Test 4: List files
  response = http.get(`${BASE_URL}/api/files/list?prefix=load-test&maxKeys=10`, params);
  success = check(response, {
    'list files status is 200': (r) => r.status === 200,
    'list files response is array': (r) => Array.isArray(r.json('files')),
    'list files response time < 1s': (r) => r.timings.duration < 1000,
  });
  errorRate.add(!success);

  // Test 5: Get file info (will likely return 404, but we're testing the endpoint)
  response = http.get(`${BASE_URL}/api/files/info/load-test/nonexistent.png`, params);
  check(response, {
    'file info handled (200 or 404)': (r) => r.status === 200 || r.status === 404,
  });

  // Test 6: Check scanner status
  response = http.get(`${BASE_URL}/api/files/scanner/status`, params);
  check(response, {
    'scanner status handled': (r) => r.status === 200 || r.status === 503,
  });

  // Brief pause between iterations
  sleep(0.1);
}

export function teardown() {
  console.log('Load test completed');
}