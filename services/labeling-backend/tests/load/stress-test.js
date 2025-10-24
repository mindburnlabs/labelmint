import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let uploadCounter = new Counter('uploads');
export let downloadCounter = new Counter('downloads');

// Stress test configuration - high concurrency
export let options = {
  stages: [
    { duration: '10s', target: 50 },   // Quick ramp up
    { duration: '20s', target: 100 },  // Continue ramping
    { duration: '30s', target: 200 },  // Peak load
    { duration: '30s', target: 300 },  // Stress point
    { duration: '20s', target: 200 },  // Ramp down
    { duration: '10s', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // Allow higher latency under stress
    http_req_failed: ['rate<0.2'],     // Allow 20% error rate under stress
    errors: ['rate<0.2'],
    uploads: ['count>100'],            // At least 100 upload attempts
  },
  throw: true, // Throw exceptions on failed checks
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Test scenarios
const scenarios = {
  upload: 0.4,  // 40% upload operations
  list: 0.3,    // 30% list operations
  info: 0.2,    // 20% info operations
  health: 0.1,  // 10% health checks
};

function randomChoice(scenario) {
  const rand = Math.random();
  let sum = 0;

  for (const [key, value] of Object.entries(scenario)) {
    sum += value;
    if (rand <= sum) {
      return key;
    }
  }
  return 'health';
}

function generateFileData(sizeKB) {
  const size = sizeKB * 1024;
  const data = new Uint8Array(size);

  // Create somewhat realistic file pattern
  const patterns = [
    () => Math.floor(Math.random() * 256), // Random bytes
    () => 0x00,                           // Null bytes
    () => 0xFF,                           // High bytes
    () => 0x89,                           // PNG header start
    () => 0x50,                           // PDF header start
  ];

  for (let i = 0; i < size; i++) {
    const patternIndex = Math.floor(Math.random() * patterns.length);
    data[i] = patterns[patternIndex]();
  }

  return data;
}

export default function () {
  const scenario = randomChoice(scenarios);
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  switch (scenario) {
    case 'upload':
      // Stress test upload endpoint
      const fileName = `stress-${Math.random().toString(36).substring(7)}.bin`;
      const fileData = generateFileData(50); // 50KB file

      const uploadResponse = http.post(
        `${BASE_URL}/api/files/upload`,
        fileData,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-File-Name': fileName,
            'X-Folder': 'stress-test',
            'X-Content-Type': 'application/octet-stream',
          },
          timeout: '10s',
        }
      );

      uploadCounter.add(1);

      const uploadSuccess = check(uploadResponse, {
        'upload status acceptable': (r) => r.status < 500,
        'upload response time < 10s': (r) => r.timings.duration < 10000,
      });
      errorRate.add(!uploadSuccess);
      break;

    case 'list':
      // Stress test list endpoint
      const listResponse = http.get(
        `${BASE_URL}/api/files/list?prefix=stress-test&maxKeys=50`,
        {
          ...params,
          timeout: '5s',
        }
      );

      check(listResponse, {
        'list status acceptable': (r) => r.status < 500,
        'list response time < 5s': (r) => r.timings.duration < 5000,
      });
      break;

    case 'info':
      // Stress test file info endpoint
      const infoResponse = http.get(
        `${BASE_URL}/api/files/info/stress-test/info-${Math.random().toString(36).substring(7)}.png`,
        {
          ...params,
          timeout: '3s',
        }
      );

      downloadCounter.add(1);

      check(infoResponse, {
        'info status handled': (r) => r.status === 200 || r.status === 404 || r.status < 500,
        'info response time < 3s': (r) => r.timings.duration < 3000,
      });
      break;

    case 'health':
      // Health check during stress
      const healthResponse = http.get(`${BASE_URL}/health`, {
        ...params,
        timeout: '2s',
      });

      check(healthResponse, {
        'health status is 200': (r) => r.status === 200,
        'health response time < 2s': (r) => r.timings.duration < 2000,
      });
      break;
  }

  // Minimal sleep to prevent overwhelming
  sleep(0.05);
}

export function handleSummary(data) {
  return {
    'stress-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const result = [];

  result.push(`${indent}Stress Test Summary`);
  result.push(`${indent}===================`);
  result.push(`${indent}Total Requests: ${data.metrics.http_reqs.count}`);
  result.push(`${indent}Failed Requests: ${data.metrics.http_req_failed.count}`);
  result.push(`${indent}Error Rate: ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%`);
  result.push(`${indent}Avg Response Time: ${data.metrics.http_req_duration.avg.toFixed(2)}ms`);
  result.push(`${indent}95th Percentile: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms`);
  result.push(`${indent}Max Response Time: ${data.metrics.http_req_duration.max.toFixed(2)}ms`);

  if (data.metrics.uploads) {
    result.push(`${indent}Total Uploads: ${data.metrics.uploads.count}`);
  }

  if (data.metrics.downloads) {
    result.push(`${indent}Total Downloads: ${data.metrics.downloads.count}`);
  }

  result.push('');
  result.push(`${indent}Thresholds:`);
  for (const [name, threshold] of Object.entries(data.thresholds)) {
    result.push(`${indent}  ${name}: ${threshold.ok ? 'PASS' : 'FAIL'}`);
  }

  return result.join('\n');
}