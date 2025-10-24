import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const taskAssignmentRate = new Rate('task_assignment_success_rate');
const taskSubmissionRate = new Rate('task_submission_success_rate');

// Test configuration
export const options = {
  stages: [
    // Ramp up to 100 concurrent users over 2 minutes
    { duration: '2m', target: 100 },
    // Stay at 100 users for 5 minutes
    { duration: '5m', target: 100 },
    // Ramp up to 500 users over 3 minutes
    { duration: '3m', target: 500 },
    // Stay at 500 users for 5 minutes (stress test)
    { duration: '5m', target: 500 },
    // Ramp down to 100 users over 2 minutes
    { duration: '2m', target: 100 },
    // Cool down for 2 minutes
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
    task_assignment_success_rate: ['rate>0.95'],
    task_submission_success_rate: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Helper functions
function generateAuthToken(userId) {
  // In real test, this would be a valid JWT token
  return `Bearer mock_token_${userId}`;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Test data
const PROJECT_IDS = [1, 2, 3, 4, 5];
const WORKER_IDS = Array.from({ length: 1000 }, (_, i) => i + 1);

export function setup() {
  // Create test data if needed
  console.log('Setting up load test...');

  // Initialize tasks for testing
  const taskCreationResponse = http.post(
    `${BASE_URL}/api/test/create-tasks`,
    JSON.stringify({
      count: 10000,
      projectId: 1,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer admin_test_token',
      },
    }
  );

  if (taskCreationResponse.status !== 200) {
    throw new Error('Failed to create test tasks');
  }

  console.log('Setup complete');
}

export function teardown() {
  console.log('Cleaning up load test...');

  // Clean up test data
  http.post(
    `${BASE_URL}/api/test/cleanup`,
    null,
    {
      headers: {
        'Authorization': 'Bearer admin_test_token',
      },
    }
  );

  console.log('Cleanup complete');
}

export default function () {
  const workerId = WORKER_IDS[Math.floor(Math.random() * WORKER_IDS.length)];
  const authToken = generateAuthToken(workerId);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': authToken,
  };

  // Scenario 1: Get available tasks
  const getTasksResponse = http.get(
    `${BASE_URL}/api/tasks?limit=50`,
    { headers }
  );

  const getTasksSuccess = check(getTasksResponse, {
    'get tasks status is 200': (r) => r.status === 200,
    'get tasks response time < 200ms': (r) => r.timings.duration < 200,
    'get tasks returns tasks': (r) => {
      const data = JSON.parse(r.body);
      return data.success && data.data.tasks.length > 0;
    },
  });

  sleep(getRandomInt(1, 3)); // Simulate user thinking time

  if (getTasksSuccess) {
    // Scenario 2: Assign a task
    const tasksData = JSON.parse(getTasksResponse.body);
    const availableTasks = tasksData.data.tasks.filter(t => t.status === 'AVAILABLE');

    if (availableTasks.length > 0) {
      const task = availableTasks[0];

      const assignResponse = http.post(
        `${BASE_URL}/api/tasks/${task.id}/assign`,
        null,
        { headers }
      );

      const assignSuccess = check(assignResponse, {
        'assign task status is 200': (r) => r.status === 200,
        'assign task response time < 500ms': (r) => r.timings.duration < 500,
        'task assigned successfully': (r) => {
          const data = JSON.parse(r.body);
          return data.success && data.data.task.status === 'IN_PROGRESS';
        },
      });

      taskAssignmentRate.add(assignSuccess);

      if (assignSuccess) {
        sleep(getRandomInt(30, 120)); // Simulate work time (30-120 seconds)

        // Scenario 3: Submit task labels
        const submitResponse = http.post(
          `${BASE_URL}/api/tasks/${task.id}/submit`,
          JSON.stringify({
            labels: ['label1', 'label2'],
            confidence: 95,
            timeSpent: getRandomInt(30, 120),
          }),
          { headers }
        );

        const submitSuccess = check(submitResponse, {
          'submit task status is 200': (r) => r.status === 200,
          'submit task response time < 500ms': (r) => r.timings.duration < 500,
          'task submitted successfully': (r) => {
            const data = JSON.parse(r.body);
            return data.success;
          },
        });

        taskSubmissionRate.add(submitSuccess);
      }
    }
  }

  sleep(getRandomInt(5, 10)); // Pause between requests
}

// Advanced test scenarios
export function handleSummary(data) {
  console.log('\n=== Load Test Summary ===');
  console.log(`Total Requests: ${data.metrics.http_reqs.count}`);
  console.log(`Failed Requests: ${data.metrics.http_req_failed.count}`);
  console.log(`Request Failure Rate: ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%`);
  console.log(`Average Response Time: ${data.metrics.http_req_duration.avg.toFixed(2)}ms`);
  console.log(`95th Percentile: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms`);
  console.log(`99th Percentile: ${data.metrics.http_req_duration['p(99)'].toFixed(2)}ms`);

  console.log('\n=== Task Assignment ===');
  console.log(`Success Rate: ${(data.metrics.task_assignment_success_rate.rate * 100).toFixed(2)}%`);

  console.log('\n=== Task Submission ===');
  console.log(`Success Rate: ${(data.metrics.task_submission_success_rate.rate * 100).toFixed(2)}%`);

  console.log('\n=== Performance by Endpoint ===');

  // Group response times by endpoint
  const endpoints = {};
  for (const sample of data.samples) {
    const url = new URL(sample.url).pathname;
    if (!endpoints[url]) {
      endpoints[url] = { times: [], count: 0 };
    }
    endpoints[url].times.push(sample.response_time);
    endpoints[url].count++;
  }

  Object.entries(endpoints).forEach(([endpoint, data]) => {
    const avgTime = data.times.reduce((a, b) => a + b, 0) / data.times.length;
    const maxTime = Math.max(...data.times);
    console.log(`${endpoint}:`);
    console.log(`  Requests: ${data.count}`);
    console.log(`  Avg Time: ${avgTime.toFixed(2)}ms`);
    console.log(`  Max Time: ${maxTime.toFixed(2)}ms`);
  });
}