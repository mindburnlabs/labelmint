export const options = {
  // Key configurations for different load testing scenarios
  scenarios: {
    // Smoke test - quick sanity check
    smoke_test: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 100,
      maxDuration: '30s',
      gracefulStop: '5s',
    },

    // Average load - normal traffic
    average_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },

    // Stress test - push to limits
    stress_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 100 },
        { duration: '3m', target: 500 },
        { duration: '5m', target: 1000 },
        { duration: '3m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },

    // Spike test - sudden traffic surge
    spike_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '10s', target: 100 },
        { duration: '1m', target: 5000 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },

    // Soak test - sustained load
    soak_test: {
      executor: 'constant-vus',
      vus: 200,
      duration: '2h',
      gracefulStop: '5s',
    },
  },

  // Thresholds for performance metrics
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.1'],
    http_reqs: ['count>500'],
  },

  // Environment-specific settings
  environments: {
    development: {
      baseUrl: 'http://localhost:3001',
    },
    staging: {
      baseUrl: 'https://staging.labelmint.org',
    },
    production: {
      baseUrl: 'https://api.labelmint.org',
    },
  },
};

// Default export for simple tests
export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.1'],
  },
};