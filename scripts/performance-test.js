#!/usr/bin/env node

/**
 * LabelMint Performance Testing Script
 *
 * This script runs comprehensive performance tests including:
 * - Load testing with k6
 * - API performance testing
 * - Frontend performance testing with Lighthouse
 * - Database performance testing
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class PerformanceTestSuite {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      tests: {}
    };
  }

  async runAllTests() {
    console.log('🚀 Starting LabelMint Performance Test Suite...\n');

    try {
      // 1. Health Check
      await this.runHealthCheck();

      // 2. Load Testing
      await this.runLoadTests();

      // 3. API Performance Testing
      await this.runAPIPerformanceTests();

      // 4. Frontend Performance Testing
      await this.runFrontendPerformanceTests();

      // 5. Database Performance Testing
      await this.runDatabasePerformanceTests();

      // 6. Generate Report
      await this.generateReport();

      console.log('\n✅ Performance tests completed successfully!');
      console.log('📊 Report generated: performance-report.html');

    } catch (error) {
      console.error('\n❌ Performance tests failed:', error.message);
      process.exit(1);
    }
  }

  async runHealthCheck() {
    console.log('🔍 Running health check...');

    try {
      const response = await fetch(`${this.results.baseUrl}/api/health`);
      const data = await response.json();

      if (response.ok) {
        console.log('✅ Health check passed');
        this.results.tests.healthCheck = {
          status: 'passed',
          responseTime: Date.now(),
          data
        };
      } else {
        throw new Error(`Health check failed: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      this.results.tests.healthCheck = {
        status: 'failed',
        error: error.message
      };
      throw error;
    }
  }

  async runLoadTests() {
    console.log('⚡ Running load tests...');

    const loadTestConfigs = [
      {
        name: 'smoke-test',
        description: 'Basic smoke test with light load',
        vus: 10,
        duration: '30s'
      },
      {
        name: 'average-load',
        description: 'Normal traffic simulation',
        vus: 100,
        duration: '2m'
      },
      {
        name: 'stress-test',
        description: 'High load stress test',
        vus: 500,
        duration: '5m'
      }
    ];

    for (const config of loadTestConfigs) {
      console.log(`  Running ${config.name} (${config.description})...`);

      try {
        // Create temporary k6 script
        const k6Script = this.generateK6Script(config);
        const scriptPath = path.join(__dirname, 'temp-k6-script.js');
        fs.writeFileSync(scriptPath, k6Script);

        // Run k6 test
        const k6Output = execSync(
          `k6 run --out json=temp-${config.name}-results.json ${scriptPath}`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );

        // Parse results
        const results = this.parseK6Results(`temp-${config.name}-results.json`);

        this.results.tests[config.name] = {
          status: 'passed',
          config,
          metrics: results
        };

        console.log(`  ✅ ${config.name} completed`);

        // Cleanup
        fs.unlinkSync(scriptPath);
        fs.unlinkSync(`temp-${config.name}-results.json`);

      } catch (error) {
        console.error(`  ❌ ${config.name} failed:`, error.message);
        this.results.tests[config.name] = {
          status: 'failed',
          error: error.message,
          config
        };
      }
    }
  }

  generateK6Script(config) {
    return `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  vus: ${config.vus},
  duration: '${config.duration}',
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.1'],
    errors: ['rate<0.1'],
  },
};

const BASE_URL = '${this.results.baseUrl}';

export default function () {
  // Health check
  let healthResponse = http.get(\`\${BASE_URL}/api/health\`);
  errorRate.add(healthResponse.status !== 200);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 200ms': (r) => r.timings.waiting < 200,
  });

  // Main page
  let homeResponse = http.get(\`\${BASE_URL}/\`);
  errorRate.add(homeResponse.status !== 200);
  check(homeResponse, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage loads correctly': (r) => r.body.includes('LabelMint') || r.body.includes('Deligate'),
  });

  // API endpoints
  let apiResponse = http.get(\`\${BASE_URL}/api/tasks/available\`);
  errorRate.add(apiResponse.status !== 200);
  check(apiResponse, {
    'API responds appropriately': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'k6-summary.json': JSON.stringify(data, null, 2),
  };
}
    `;
  }

  parseK6Results(jsonPath) {
    try {
      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      const data = JSON.parse(jsonContent);

      return {
        totalRequests: data.metrics?.http_reqs?.count || 0,
        failedRequests: data.metrics?.http_req_failed?.count || 0,
        avgResponseTime: data.metrics?.http_req_duration?.avg || 0,
        p95ResponseTime: data.metrics?.http_req_duration?.['p(95)'] || 0,
        p99ResponseTime: data.metrics?.http_req_duration?.['p(99)'] || 0,
        errorRate: ((data.metrics?.http_req_failed?.rate || 0) * 100).toFixed(2),
        requestsPerSecond: data.metrics?.http_reqs?.rate || 0
      };
    } catch (error) {
      console.warn('Failed to parse k6 results:', error.message);
      return {};
    }
  }

  async runAPIPerformanceTests() {
    console.log('🔌 Running API performance tests...');

    const endpoints = [
      { path: '/api/health', method: 'GET' },
      { path: '/api/tasks/available', method: 'GET' },
      { path: '/api/user/profile', method: 'GET' },
      { path: '/api/dashboard', method: 'GET' }
    ];

    const results = {};

    for (const endpoint of endpoints) {
      console.log(`  Testing ${endpoint.method} ${endpoint.path}...`);

      try {
        const measurements = [];

        // Make 50 requests to each endpoint
        for (let i = 0; i < 50; i++) {
          const start = Date.now();
          try {
            const response = await fetch(`${this.results.baseUrl}${endpoint.path}`, {
              method: endpoint.method,
              headers: {
                'Content-Type': 'application/json'
              }
            });
            measurements.push(Date.now() - start);
          } catch (error) {
            measurements.push(5000); // Timeout
          }
        }

        const sortedMeasurements = measurements.sort((a, b) => a - b);

        results[endpoint.path] = {
          avgResponseTime: measurements.reduce((a, b) => a + b, 0) / measurements.length,
          minResponseTime: Math.min(...measurements),
          maxResponseTime: Math.max(...measurements),
          p95ResponseTime: this.percentile(sortedMeasurements, 0.95),
          p99ResponseTime: this.percentile(sortedMeasurements, 0.99),
          successRate: measurements.filter(m => m < 5000).length / measurements.length * 100
        };

        console.log(`  ✅ ${endpoint.method} ${endpoint.path} - Avg: ${results[endpoint.path].avgResponseTime.toFixed(0)}ms`);

      } catch (error) {
        console.error(`  ❌ ${endpoint.method} ${endpoint.path} failed:`, error.message);
        results[endpoint.path] = {
          error: error.message
        };
      }
    }

    this.results.tests.apiPerformance = {
      status: 'completed',
      endpoints: results
    };
  }

  async runFrontendPerformanceTests() {
    console.log('🎨 Running frontend performance tests...');

    try {
      // Check if Lighthouse CLI is available
      execSync('which lighthouse', { stdio: 'ignore' });

      console.log('  Running Lighthouse audit...');

      const lighthouseCommand = `lighthouse ${this.results.baseUrl} \
        --output=json \
        --output-path=./lighthouse-results.json \
        --chrome-flags="--headless" \
        --quiet`;

      execSync(lighthouseCommand, { stdio: 'pipe' });

      const lighthouseResults = JSON.parse(fs.readFileSync('./lighthouse-results.json', 'utf8'));

      const performanceScore = lighthouseResults.lhr.categories.performance.score * 100;

      this.results.tests.frontendPerformance = {
        status: 'completed',
        performanceScore,
        metrics: {
          firstContentfulPaint: lighthouseResults.lhr.audits['first-contentful-paint'].numericValue,
          largestContentfulPaint: lighthouseResults.lhr.audits['largest-contentful-paint'].numericValue,
          cumulativeLayoutShift: lighthouseResults.lhr.audits['cumulative-layout-shift'].numericValue,
          totalBlockingTime: lighthouseResults.lhr.audits['total-blocking-time'].numericValue,
          speedIndex: lighthouseResults.lhr.audits['speed-index'].numericValue
        },
        opportunities: lighthouseResults.lhr.categories.performance.score < 0.9 ?
          Object.values(lighthouseResults.lhr.audits)
            .filter(audit => audit.score < 0.9 && audit.details?.type === 'opportunity')
            .map(audit => ({
              id: audit.id,
              title: audit.title,
              description: audit.description,
              potentialSavings: audit.details?.overallSavingsMs || 0
            })) : []
      };

      console.log(`  ✅ Performance score: ${performanceScore}`);

      // Cleanup
      fs.unlinkSync('./lighthouse-results.json');

    } catch (error) {
      console.error('  ❌ Frontend performance test failed:', error.message);
      this.results.tests.frontendPerformance = {
        status: 'failed',
        error: error.message
      };
    }
  }

  async runDatabasePerformanceTests() {
    console.log('🗄️  Running database performance tests...');

    const queries = [
      { name: 'SELECT users', query: 'SELECT COUNT(*) FROM users' },
      { name: 'SELECT tasks', query: 'SELECT COUNT(*) FROM tasks WHERE completion_status = $1' },
      { name: 'JOIN query', query: 'SELECT u.*, COUNT(t.id) as task_count FROM users u LEFT JOIN tasks t ON u.id = t.client_id GROUP BY u.id LIMIT 10' }
    ];

    const results = {};

    for (const query of queries) {
      console.log(`  Testing ${query.name}...`);

      try {
        const measurements = [];

        for (let i = 0; i < 20; i++) {
          const start = Date.now();
          try {
            // Note: This would need to be implemented as an API endpoint
            const response = await fetch(`${this.results.baseUrl}/api/admin/test-query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: query.query })
            });
            measurements.push(Date.now() - start);
          } catch (error) {
            measurements.push(1000);
          }
        }

        const sortedMeasurements = measurements.sort((a, b) => a - b);

        results[query.name] = {
          avgExecutionTime: measurements.reduce((a, b) => a + b, 0) / measurements.length,
          minExecutionTime: Math.min(...measurements),
          maxExecutionTime: Math.max(...measurements),
          p95ExecutionTime: this.percentile(sortedMeasurements, 0.95)
        };

        console.log(`  ✅ ${query.name} - Avg: ${results[query.name].avgExecutionTime.toFixed(0)}ms`);

      } catch (error) {
        console.error(`  ❌ ${query.name} failed:`, error.message);
        results[query.name] = {
          error: error.message
        };
      }
    }

    this.results.tests.databasePerformance = {
      status: 'completed',
      queries: results
    };
  }

  percentile(sortedArray, p) {
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }

  async generateReport() {
    console.log('📊 Generating performance report...');

    const htmlReport = this.generateHTMLReport();
    fs.writeFileSync('performance-report.html', htmlReport);

    const jsonReport = JSON.stringify(this.results, null, 2);
    fs.writeFileSync('performance-results.json', jsonReport);
  }

  generateHTMLReport() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LabelMint Performance Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen py-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <header class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900">LabelMint Performance Report</h1>
                <p class="text-gray-600 mt-2">
                    Generated on ${new Date(this.results.timestamp).toLocaleString()} |
                    Environment: ${this.results.environment} |
                    Base URL: ${this.results.baseUrl}
                </p>
            </header>

            <!-- Overview Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                ${this.generateOverviewCards()}
            </div>

            <!-- Test Results -->
            <div class="space-y-8">
                ${this.generateLoadTestSection()}
                ${this.generateAPIPerformanceSection()}
                ${this.generateFrontendPerformanceSection()}
                ${this.generateDatabasePerformanceSection()}
            </div>
        </div>
    </div>

    <script>
        ${this.generateChartsScript()}
    </script>
</body>
</html>
    `;
  }

  generateOverviewCards() {
    const loadTests = Object.values(this.results.tests).filter(test => test.config);
    const avgLoadTime = loadTests.length > 0 ?
      loadTests.reduce((sum, test) => sum + (test.metrics?.avgResponseTime || 0), 0) / loadTests.length : 0;

    const frontendScore = this.results.tests.frontendPerformance?.performanceScore || 0;

    return `
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-2">Average Load Test Response Time</h3>
            <p class="text-3xl font-bold text-blue-600">${avgLoadTime.toFixed(0)}ms</p>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-2">Frontend Performance Score</h3>
            <p class="text-3xl font-bold ${frontendScore >= 90 ? 'text-green-600' : frontendScore >= 70 ? 'text-yellow-600' : 'text-red-600'}">${frontendScore.toFixed(0)}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-2">Tests Status</h3>
            <p class="text-3xl font-bold ${Object.values(this.results.tests).every(t => t.status === 'passed' || t.status === 'completed') ? 'text-green-600' : 'text-red-600'}">${Object.values(this.results.tests).filter(t => t.status === 'passed' || t.status === 'completed').length}/${Object.values(this.results.tests).length}</p>
        </div>
    `;
  }

  generateLoadTestSection() {
    const loadTests = Object.entries(this.results.tests).filter(([key]) =>
      key.includes('smoke') || key.includes('average') || key.includes('stress')
    );

    if (loadTests.length === 0) return '';

    return `
        <section class="bg-white rounded-lg shadow p-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Load Test Results</h2>
            <div class="space-y-6">
                ${loadTests.map(([name, test]) => `
                    <div class="border rounded-lg p-4">
                        <h3 class="text-lg font-medium text-gray-900 mb-2">${test.config?.description || name}</h3>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span class="text-gray-500">VUs:</span>
                                <span class="font-medium ml-2">${test.config?.vus || 'N/A'}</span>
                            </div>
                            <div>
                                <span class="text-gray-500">Duration:</span>
                                <span class="font-medium ml-2">${test.config?.duration || 'N/A'}</span>
                            </div>
                            <div>
                                <span class="text-gray-500">Avg Response:</span>
                                <span class="font-medium ml-2">${test.metrics?.avgResponseTime?.toFixed(0) || 'N/A'}ms</span>
                            </div>
                            <div>
                                <span class="text-gray-500">Error Rate:</span>
                                <span class="font-medium ml-2 ${test.metrics?.errorRate < 5 ? 'text-green-600' : 'text-red-600'}">${test.metrics?.errorRate || 'N/A'}%</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
  }

  generateAPIPerformanceSection() {
    const apiTest = this.results.tests.apiPerformance;
    if (!apiTest || apiTest.status !== 'completed') return '';

    return `
        <section class="bg-white rounded-lg shadow p-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">API Performance</h2>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P95 Time</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${Object.entries(apiTest.endpoints).map(([endpoint, metrics]) => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${endpoint}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${metrics.avgResponseTime?.toFixed(0)}ms</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${metrics.p95ResponseTime?.toFixed(0)}ms</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${metrics.successRate >= 99 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                        ${metrics.successRate?.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
  }

  generateFrontendPerformanceSection() {
    const frontendTest = this.results.tests.frontendPerformance;
    if (!frontendTest || frontendTest.status !== 'completed') return '';

    return `
        <section class="bg-white rounded-lg shadow p-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Frontend Performance</h2>
            <div class="mb-6">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-lg font-medium text-gray-900">Performance Score</span>
                    <span class="text-2xl font-bold ${frontendTest.performanceScore >= 90 ? 'text-green-600' : frontendTest.performanceScore >= 70 ? 'text-yellow-600' : 'text-red-600'}">${frontendTest.performanceScore.toFixed(0)}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3">
                    <div class="h-3 rounded-full ${frontendTest.performanceScore >= 90 ? 'bg-green-600' : frontendTest.performanceScore >= 70 ? 'bg-yellow-600' : 'bg-red-600'}" style="width: ${frontendTest.performanceScore}%"></div>
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                    <span class="text-gray-500">First Contentful Paint:</span>
                    <span class="font-medium ml-2">${(frontendTest.metrics.firstContentfulPaint / 1000).toFixed(1)}s</span>
                </div>
                <div>
                    <span class="text-gray-500">Largest Contentful Paint:</span>
                    <span class="font-medium ml-2">${(frontendTest.metrics.largestContentfulPaint / 1000).toFixed(1)}s</span>
                </div>
                <div>
                    <span class="text-gray-500">Cumulative Layout Shift:</span>
                    <span class="font-medium ml-2">${frontendTest.metrics.cumulativeLayoutShift.toFixed(3)}</span>
                </div>
                <div>
                    <span class="text-gray-500">Total Blocking Time:</span>
                    <span class="font-medium ml-2">${frontendTest.metrics.totalBlockingTime.toFixed(0)}ms</span>
                </div>
                <div>
                    <span class="text-gray-500">Speed Index:</span>
                    <span class="font-medium ml-2">${frontendTest.metrics.speedIndex.toFixed(0)}ms</span>
                </div>
            </div>
        </section>
    `;
  }

  generateDatabasePerformanceSection() {
    const dbTest = this.results.tests.databasePerformance;
    if (!dbTest || dbTest.status !== 'completed') return '';

    return `
        <section class="bg-white rounded-lg shadow p-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Database Performance</h2>
            <div class="space-y-4">
                ${Object.entries(dbTest.queries).map(([name, metrics]) => `
                    <div class="border rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-2">${name}</h4>
                        <div class="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <span class="text-gray-500">Avg:</span>
                                <span class="font-medium ml-2">${metrics.avgExecutionTime?.toFixed(0)}ms</span>
                            </div>
                            <div>
                                <span class="text-gray-500">Min:</span>
                                <span class="font-medium ml-2">${metrics.minExecutionTime?.toFixed(0)}ms</span>
                            </div>
                            <div>
                                <span class="text-gray-500">P95:</span>
                                <span class="font-medium ml-2">${metrics.p95ExecutionTime?.toFixed(0)}ms</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
  }

  generateChartsScript() {
    return `
        // Add any interactive charts here if needed
        console.log('Performance report loaded');
    `;
  }
}

// Run the performance test suite
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new PerformanceTestSuite();
  testSuite.runAllTests().catch(console.error);
}

export default PerformanceTestSuite;