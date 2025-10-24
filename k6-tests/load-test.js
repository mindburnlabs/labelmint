import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

// Test configuration
export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate below 10%
    errors: ['rate<0.1'],             // Custom error rate below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Health check endpoint
  let healthResponse = http.get(`${BASE_URL}/api/health`);
  errorRate.add(healthResponse.status !== 200);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 200ms': (r) => r.timings.waiting < 200,
  });

  // Main page
  let homeResponse = http.get(`${BASE_URL}/`);
  errorRate.add(homeResponse.status !== 200);
  check(homeResponse, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage loads correctly': (r) => r.body.includes('Deligate'),
  });

  // Simulate user journey
  // 1. Load app page
  let appResponse = http.get(`${BASE_URL}/app`);
  errorRate.add(appResponse.status !== 200);
  check(appResponse, {
    'app page status is 200': (r) => r.status === 200,
  });

  // 2. Simulate API call (if applicable)
  let apiResponse = http.get(`${BASE_URL}/api/user`, {
    headers: {
      'Authorization': 'Bearer test-token',
    },
  });
  // Don't count 401 as error for unauthenticated endpoint
  if (apiResponse.status !== 200 && apiResponse.status !== 401) {
    errorRate.add(1);
  }
  check(apiResponse, {
    'API responds appropriately': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'performance-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  return `
    K6 Load Test Summary
    ====================

    Total Requests: ${data.metrics.http_reqs.count}
    Failed Requests: ${data.metrics.http_req_failed.count}
    Error Rate: ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%

    Response Times:
    - Average: ${data.metrics.http_req_duration.avg.toFixed(2)}ms
    - Median: ${data.metrics.http_req_duration.med.toFixed(2)}ms
    - 95th Percentile: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms
    - 99th Percentile: ${data.metrics.http_req_duration['p(99)'].toFixed(2)}ms

    RPS: ${data.metrics.http_reqs.rate.toFixed(2)}
  `;
}