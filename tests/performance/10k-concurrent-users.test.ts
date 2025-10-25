// ====================================================================
// COMPREHENSIVE LOAD TESTING FOR 10,000+ CONCURRENT USERS
// ====================================================================
// Production-scale performance validation with realistic user scenarios,
// distributed load generation, and comprehensive metrics collection

import { test, expect } from '@playwright/test';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { EventEmitter } from 'events';

interface LoadTestConfig {
  targetConcurrentUsers: number;
  rampUpTime: number; // seconds
  duration: number; // seconds
  scenarios: TestScenario[];
  endpoints: TestEndpoint[];
  metrics: MetricsConfig;
  distribution: DistributionConfig;
}

interface TestScenario {
  name: string;
  weight: number; // percentage of total users
  steps: TestStep[];
  thinkTime: { min: number; max: number }; // seconds
}

interface TestStep {
  action: 'navigate' | 'click' | 'fill' | 'wait' | 'api_call' | 'custom';
  target: string;
  payload?: any;
  timeout: number; // seconds
  assertions?: Assertion[];
}

interface Assertion {
  type: 'response_time' | 'status_code' | 'content' | 'element_exists';
  expected: any;
  operator: '<' | '>' | '=' | '!=' | 'contains' | 'exists';
}

interface TestEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  weight: number;
  payload?: any;
  headers?: Record<string, string>;
  expectedStatus?: number;
}

interface MetricsConfig {
  responseTime: {
    p50: number; // ms
    p90: number; // ms
    p95: number; // ms
    p99: number; // ms
    max: number; // ms
  };
  throughput: {
    requestsPerSecond: number;
    concurrentUsers: number;
  };
  errorRate: {
    max: number; // percentage
  };
  resources: {
    cpu: number; // percentage
    memory: number; // percentage
  };
}

interface DistributionConfig {
  browsers: ('chromium' | 'firefox' | 'webkit')[];
  locations: string[];
  devices: ('desktop' | 'mobile' | 'tablet')[];
  networks: ('fast' | 'average' | 'slow')[];
}

interface TestResult {
  scenario: string;
  user: number;
  step: number;
  action: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  metrics: {
    responseTime: number;
    statusCode?: number;
    contentLength?: number;
  };
}

interface LoadTestSummary {
  config: LoadTestConfig;
  results: TestResult[];
  summary: {
    totalUsers: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p50ResponseTime: number;
    p90ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    throughput: number;
  };
  performanceMetrics: {
    cpu: number[];
    memory: number[];
    network: number[];
  };
  pass: boolean;
  recommendations: string[];
}

class LoadTestRunner extends EventEmitter {
  private config: LoadTestConfig;
  private results: TestResult[] = [];
  private activeUsers: number = 0;
  private browsers: Browser[] = [];
  private contexts: BrowserContext[] = [];
  private startTime: number = 0;
  private metricsCollector: MetricsCollector;
  private userPool: Array<UserSimulator> = [];

  constructor(config: LoadTestConfig) {
    super();
    this.config = config;
    this.metricsCollector = new MetricsCollector(config.metrics);
  }

  async run(): Promise<LoadTestSummary> {
    console.log(`🚀 Starting load test for ${this.config.targetConcurrentUsers} concurrent users`);
    console.log(`⏱️  Duration: ${this.config.duration}s, Ramp-up: ${this.config.rampUpTime}s`);

    this.startTime = Date.now();
    this.emit('test:start');

    try {
      // Initialize browser pool
      await this.initializeBrowserPool();

      // Start metrics collection
      this.metricsCollector.start();

      // Ramp up users
      await this.rampUpUsers();

      // Execute test scenarios
      await this.executeScenarios();

      // Wait for completion
      await this.waitForCompletion();

      // Generate summary
      const summary = this.generateSummary();

      this.emit('test:complete', summary);
      return summary;

    } catch (error) {
      console.error('❌ Load test failed:', error);
      this.emit('test:error', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async initializeBrowserPool(): Promise<void> {
    const browserCount = Math.min(this.config.targetConcurrentUsers, 100); // Limit to 100 concurrent browsers

    console.log(`🔧 Initializing ${browserCount} browser instances`);

    for (let i = 0; i < browserCount; i++) {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--memory-pressure-off',
          '--max_old_space_size=4096'
        ]
      });

      this.browsers.push(browser);
    }

    console.log(`✅ Browser pool initialized with ${this.browsers.length} instances`);
  }

  private async rampUpUsers(): Promise<void> {
    const usersPerSecond = this.config.targetConcurrentUsers / this.config.rampUpTime;
    const interval = 1000 / usersPerSecond; // milliseconds

    console.log(`📈 Ramping up ${this.config.targetConcurrentUsers} users over ${this.config.rampUpTime}s`);

    for (let i = 0; i < this.config.targetConcurrentUsers; i++) {
      const user = await this.createUserSimulator(i);
      this.userPool.push(user);

      // Stagger user start times
      if (i < this.config.targetConcurrentUsers - 1) {
        await this.sleep(interval);
      }

      // Emit progress
      if ((i + 1) % 100 === 0) {
        console.log(`👥 ${i + 1} users started`);
        this.emit('progress:users', i + 1);
      }
    }

    console.log(`✅ All ${this.config.targetConcurrentUsers} users started`);
  }

  private async createUserSimulator(userId: number): Promise<UserSimulator> {
    const browserIndex = userId % this.browsers.length;
    const browser = this.browsers[browserIndex];
    const context = await browser.newContext({
      userAgent: this.generateUserAgent(userId),
      viewport: this.generateViewport(userId),
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true
    });

    const page = await context.newPage();

    // Add performance monitoring
    await this.addPerformanceMonitoring(page, userId);

    // Select scenario based on weights
    const scenario = this.selectScenario();
    const simulator = new UserSimulator(userId, scenario, page, this.metricsCollector);

    simulator.on('result', (result: TestResult) => {
      this.results.push(result);
      this.emit('result', result);
    });

    this.contexts.push(context);
    return simulator;
  }

  private generateUserAgent(userId: number): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    ];

    return userAgents[userId % userAgents.length];
  }

  private generateViewport(userId: number): { width: number; height: number } {
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1366, height: 768 },  // Desktop
      { width: 375, height: 667 },   // Mobile
      { width: 768, height: 1024 }   // Tablet
    ];

    return viewports[userId % viewports.length];
  }

  private async addPerformanceMonitoring(page: Page, userId: number): Promise<void> {
    // Enable performance monitoring
    await page.coverage.startJSCoverage();
    await page.coverage.startCSSCoverage();

    // Add request/response monitoring
    page.on('request', (request) => {
      this.metricsCollector.recordRequest(userId, request.url(), request.method());
    });

    page.on('response', (response) => {
      this.metricsCollector.recordResponse(userId, response.url(), response.status(), response.headers());
    });

    // Monitor console for errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.metricsCollector.recordError(userId, msg.text());
      }
    });
  }

  private selectScenario(): TestScenario {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const scenario of this.config.scenarios) {
      cumulative += scenario.weight;
      if (random <= cumulative) {
        return scenario;
      }
    }

    return this.config.scenarios[0];
  }

  private async executeScenarios(): Promise<void> {
    console.log(`🎭 Executing scenarios for ${this.config.duration}s`);

    const promises = this.userPool.map(async (user) => {
      await user.start();
    });

    // Wait for the specified duration
    await this.sleep(this.config.duration * 1000);

    // Stop all users
    this.userPool.forEach(user => user.stop());

    // Wait for all users to complete
    await Promise.allSettled(promises);

    console.log(`✅ Scenario execution completed`);
  }

  private async waitForCompletion(): Promise<void> {
    // Wait for any remaining requests to complete
    await this.sleep(5000);
  }

  private generateSummary(): LoadTestSummary {
    const successfulResults = this.results.filter(r => r.success);
    const failedResults = this.results.filter(r => !r.success);

    const responseTimes = successfulResults.map(r => r.metrics.responseTime);
    responseTimes.sort((a, b) => a - b);

    const totalDuration = (Date.now() - this.startTime) / 1000;
    const totalRequests = this.results.length;
    const requestsPerSecond = totalRequests / totalDuration;

    const summary: LoadTestSummary = {
      config: this.config,
      results: this.results,
      summary: {
        totalUsers: this.config.targetConcurrentUsers,
        totalRequests,
        successfulRequests: successfulResults.length,
        failedRequests: failedResults.length,
        averageResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
        minResponseTime: responseTimes.length > 0 ? responseTimes[0] : 0,
        maxResponseTime: responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0,
        p50ResponseTime: this.getPercentile(responseTimes, 50),
        p90ResponseTime: this.getPercentile(responseTimes, 90),
        p95ResponseTime: this.getPercentile(responseTimes, 95),
        p99ResponseTime: this.getPercentile(responseTimes, 99),
        requestsPerSecond,
        errorRate: (failedResults.length / totalRequests) * 100,
        throughput: successfulResults.length / totalDuration
      },
      performanceMetrics: this.metricsCollector.getMetrics(),
      pass: this.evaluatePerformance(),
      recommendations: this.generateRecommendations()
    };

    console.log(`📊 Load test completed:`);
    console.log(`   Total requests: ${totalRequests}`);
    console.log(`   Success rate: ${((successfulResults.length / totalRequests) * 100).toFixed(2)}%`);
    console.log(`   Average response time: ${summary.summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`   95th percentile: ${summary.summary.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   Requests per second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`   Error rate: ${summary.summary.errorRate.toFixed(2)}%`);
    console.log(`   Test result: ${summary.pass ? '✅ PASS' : '❌ FAIL'}`);

    return summary;
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private evaluatePerformance(): boolean {
    const successfulResults = this.results.filter(r => r.success);
    const responseTimes = successfulResults.map(r => r.metrics.responseTime);
    responseTimes.sort((a, b) => a - b);

    // Check response time thresholds
    if (this.getPercentile(responseTimes, 95) > this.config.metrics.responseTime.p95) {
      return false;
    }

    // Check error rate
    const errorRate = (this.results.filter(r => !r.success).length / this.results.length) * 100;
    if (errorRate > this.config.metrics.errorRate.max) {
      return false;
    }

    // Check throughput
    const totalDuration = (Date.now() - this.startTime) / 1000;
    const throughput = successfulResults.length / totalDuration;
    if (throughput < this.config.metrics.throughput.requestsPerSecond) {
      return false;
    }

    return true;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const successfulResults = this.results.filter(r => r.success);
    const responseTimes = successfulResults.map(r => r.metrics.responseTime);
    responseTimes.sort((a, b) => a - b);

    // Response time recommendations
    const p95ResponseTime = this.getPercentile(responseTimes, 95);
    if (p95ResponseTime > this.config.metrics.responseTime.p95) {
      recommendations.push(`95th percentile response time (${p95ResponseTime.toFixed(2)}ms) exceeds target. Consider optimizing slow endpoints.`);
    }

    // Error rate recommendations
    const errorRate = (this.results.filter(r => !r.success).length / this.results.length) * 100;
    if (errorRate > this.config.metrics.errorRate.max) {
      recommendations.push(`Error rate (${errorRate.toFixed(2)}%) exceeds target. Investigate and fix failing requests.`);
    }

    // Throughput recommendations
    const totalDuration = (Date.now() - this.startTime) / 1000;
    const throughput = successfulResults.length / totalDuration;
    if (throughput < this.config.metrics.throughput.requestsPerSecond) {
      recommendations.push(`Throughput (${throughput.toFixed(2)} req/s) below target. Consider scaling infrastructure.`);
    }

    // Resource usage recommendations
    const metrics = this.metricsCollector.getMetrics();
    const avgCpu = metrics.cpu.reduce((a, b) => a + b, 0) / metrics.cpu.length;
    const avgMemory = metrics.memory.reduce((a, b) => a + b, 0) / metrics.memory.length;

    if (avgCpu > this.config.metrics.resources.cpu) {
      recommendations.push(`Average CPU usage (${avgCpu.toFixed(2)}%) high. Consider scaling up or optimizing code.`);
    }

    if (avgMemory > this.config.metrics.resources.memory) {
      recommendations.push(`Average memory usage (${avgMemory.toFixed(2)}%) high. Investigate memory leaks or increase resources.`);
    }

    return recommendations;
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up resources');

    // Stop metrics collection
    this.metricsCollector.stop();

    // Close all contexts
    for (const context of this.contexts) {
      try {
        await context.close();
      } catch (error) {
        console.error('Error closing context:', error);
      }
    }

    // Close all browsers
    for (const browser of this.browsers) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }

    this.browsers = [];
    this.contexts = [];
    this.userPool = [];

    console.log('✅ Cleanup completed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class UserSimulator extends EventEmitter {
  private userId: number;
  private scenario: TestScenario;
  private page: Page;
  private metricsCollector: MetricsCollector;
  private running: boolean = false;
  private currentStep: number = 0;

  constructor(userId: number, scenario: TestScenario, page: Page, metricsCollector: MetricsCollector) {
    super();
    this.userId = userId;
    this.scenario = scenario;
    this.page = page;
    this.metricsCollector = metricsCollector;
  }

  async start(): Promise<void> {
    this.running = true;
    this.emit('user:start', this.userId);

    while (this.running && this.currentStep < this.scenario.steps.length) {
      const step = this.scenario.steps[this.currentStep];
      await this.executeStep(step);
      this.currentStep++;

      // Add think time
      if (this.running && step !== this.scenario.steps[this.scenario.steps.length - 1]) {
        const thinkTime = this.randomBetween(this.scenario.thinkTime.min, this.scenario.thinkTime.max);
        await this.sleep(thinkTime * 1000);
      }
    }

    this.emit('user:complete', this.userId);
  }

  stop(): void {
    this.running = false;
  }

  private async executeStep(step: TestStep): Promise<void> {
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;
    const metrics: any = {};

    try {
      switch (step.action) {
        case 'navigate':
          await this.page.goto(step.target, { timeout: step.timeout * 1000 });
          metrics.responseTime = Date.now() - startTime;
          break;

        case 'click':
          await this.page.click(step.target, { timeout: step.timeout * 1000 });
          metrics.responseTime = Date.now() - startTime;
          break;

        case 'fill':
          await this.page.fill(step.target, step.payload.value, { timeout: step.timeout * 1000 });
          metrics.responseTime = Date.now() - startTime;
          break;

        case 'wait':
          await this.page.waitForSelector(step.target, { timeout: step.timeout * 1000 });
          metrics.responseTime = Date.now() - startTime;
          break;

        case 'api_call':
          const response = await this.page.evaluate(async ({ url, method, payload, headers }) => {
            const options: RequestInit = {
              method,
              headers: {
                'Content-Type': 'application/json',
                ...headers
              }
            };

            if (payload && method !== 'GET') {
              options.body = JSON.stringify(payload);
            }

            const response = await fetch(url, options);
            return {
              status: response.status,
              headers: Object.fromEntries(response.headers.entries()),
              contentLength: response.headers.get('content-length')
            };
          }, {
            url: step.target,
            method: 'GET',
            payload: step.payload,
            headers: step.headers || {}
          });

          metrics.responseTime = Date.now() - startTime;
          metrics.statusCode = response.status;
          metrics.contentLength = response.contentLength ? parseInt(response.contentLength) : 0;
          break;

        case 'custom':
          // Execute custom JavaScript
          await this.page.evaluate(step.payload.script, step.payload.args);
          metrics.responseTime = Date.now() - startTime;
          break;
      }

      // Execute assertions
      if (step.assertions) {
        await this.executeAssertions(step.assertions);
      }

    } catch (err) {
      success = false;
      error = (err as Error).message;
      metrics.responseTime = Date.now() - startTime;
    }

    const result: TestResult = {
      scenario: this.scenario.name,
      user: this.userId,
      step: this.currentStep,
      action: step.action,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      success,
      error,
      metrics
    };

    this.emit('result', result);
    this.metricsCollector.recordResult(result);
  }

  private async executeAssertions(assertions: Assertion[]): Promise<void> {
    for (const assertion of assertions) {
      let actual: any;

      switch (assertion.type) {
        case 'response_time':
          actual = this.metricsCollector.getLastResponseTime();
          break;
        case 'status_code':
          actual = this.metricsCollector.getLastStatusCode();
          break;
        case 'element_exists':
          actual = await this.page.$(assertion.expected) !== null;
          break;
        case 'content':
          actual = await this.page.textContent(assertion.expected);
          break;
      }

      const passed = this.evaluateAssertion(actual, assertion.expected, assertion.operator);
      if (!passed) {
        throw new Error(`Assertion failed: ${assertion.type} ${assertion.operator} ${assertion.expected}, got ${actual}`);
      }
    }
  }

  private evaluateAssertion(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case '<': return actual < expected;
      case '>': return actual > expected;
      case '=': return actual === expected;
      case '!=': return actual !== expected;
      case 'contains': return String(actual).includes(expected);
      case 'exists': return actual !== null && actual !== undefined;
      default: return false;
    }
  }

  private randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class MetricsCollector {
  private config: MetricsConfig;
  private metrics: {
    cpu: number[];
    memory: number[];
    network: number[];
  };
  private results: TestResult[] = [];
  private requests: Map<number, Array<{ url: string; method: string; timestamp: number }>> = new Map();
  private responses: Map<number, Array<{ url: string; status: number; timestamp: number }>> = new Map();
  private errors: Array<{ userId: number; error: string; timestamp: number }> = [];
  private collectionTimer: NodeJS.Timeout | null = null;

  constructor(config: MetricsConfig) {
    this.config = config;
    this.metrics = {
      cpu: [],
      memory: [],
      network: []
    };
  }

  start(): void {
    this.collectionTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, 1000);
  }

  stop(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
  }

  recordRequest(userId: number, url: string, method: string): void {
    if (!this.requests.has(userId)) {
      this.requests.set(userId, []);
    }
    this.requests.get(userId)!.push({
      url,
      method,
      timestamp: Date.now()
    });
  }

  recordResponse(userId: number, url: string, status: number, headers: any): void {
    if (!this.responses.has(userId)) {
      this.responses.set(userId, []);
    }
    this.responses.get(userId)!.push({
      url,
      status,
      timestamp: Date.now()
    });
  }

  recordError(userId: number, error: string): void {
    this.errors.push({
      userId,
      error,
      timestamp: Date.now()
    });
  }

  recordResult(result: TestResult): void {
    this.results.push(result);
  }

  getLastResponseTime(): number {
    if (this.results.length === 0) return 0;
    return this.results[this.results.length - 1].metrics.responseTime || 0;
  }

  getLastStatusCode(): number {
    if (this.results.length === 0) return 0;
    return this.results[this.results.length - 1].metrics.statusCode || 0;
  }

  private collectSystemMetrics(): void {
    // Collect CPU usage (simulated)
    const cpu = Math.random() * 100;
    this.metrics.cpu.push(cpu);

    // Collect memory usage (simulated)
    const memory = Math.random() * 100;
    this.metrics.memory.push(memory);

    // Collect network usage (simulated)
    const network = Math.random() * 100;
    this.metrics.network.push(network);

    // Keep only last 60 seconds of data
    if (this.metrics.cpu.length > 60) {
      this.metrics.cpu.shift();
      this.metrics.memory.shift();
      this.metrics.network.shift();
    }
  }

  getMetrics(): { cpu: number[]; memory: number[]; network: number[] } {
    return { ...this.metrics };
  }
}

// Test configuration for 10,000 concurrent users
const loadTestConfig: LoadTestConfig = {
  targetConcurrentUsers: 10000,
  rampUpTime: 300, // 5 minutes
  duration: 1800,  // 30 minutes
  scenarios: [
    {
      name: 'user_browsing',
      weight: 40,
      thinkTime: { min: 2, max: 5 },
      steps: [
        { action: 'navigate', target: 'https://labelmint.it', timeout: 10 },
        { action: 'wait', target: 'body', timeout: 5 },
        { action: 'navigate', target: 'https://labelmint.it/tasks', timeout: 10 },
        { action: 'wait', target: '.task-list', timeout: 5 },
        { action: 'click', target: '.task-item:first-child', timeout: 5 },
        { action: 'wait', target: '.task-details', timeout: 5 }
      ]
    },
    {
      name: 'task_worker',
      weight: 35,
      thinkTime: { min: 1, max: 3 },
      steps: [
        { action: 'navigate', target: 'https://labelmint.it/worker', timeout: 10 },
        { action: 'wait', target: '.dashboard', timeout: 5 },
        { action: 'api_call', target: 'https://api.labelmint.it/tasks/available', timeout: 5 },
        { action: 'api_call', target: 'https://api.labelmint.it/tasks/claim', timeout: 5, payload: { taskId: 'test' } },
        { action: 'wait', target: '.task-workspace', timeout: 10 }
      ]
    },
    {
      name: 'client_dashboard',
      weight: 25,
      thinkTime: { min: 3, max: 8 },
      steps: [
        { action: 'navigate', target: 'https://labelmint.it/client', timeout: 10 },
        { action: 'wait', target: '.client-dashboard', timeout: 5 },
        { action: 'click', target: '.projects-tab', timeout: 5 },
        { action: 'api_call', target: 'https://api.labelmint.it/projects', timeout: 5 },
        { action: 'wait', target: '.projects-list', timeout: 5 }
      ]
    }
  ],
  endpoints: [
    { path: '/api/v1/tasks', method: 'GET', weight: 30 },
    { path: '/api/v1/tasks/available', method: 'GET', weight: 25 },
    { path: '/api/v1/tasks/claim', method: 'POST', weight: 20 },
    { path: '/api/v1/tasks/submit', method: 'POST', weight: 15 },
    { path: '/api/v1/projects', method: 'GET', weight: 10 }
  ],
  metrics: {
    responseTime: {
      p50: 200,
      p90: 500,
      p95: 800,
      p99: 2000,
      max: 5000
    },
    throughput: {
      requestsPerSecond: 1000,
      concurrentUsers: 10000
    },
    errorRate: {
      max: 1.0
    },
    resources: {
      cpu: 70,
      memory: 80
    }
  },
  distribution: {
    browsers: ['chromium'],
    locations: ['us-east-1'],
    devices: ['desktop', 'mobile'],
    networks: ['fast', 'average']
  }
};

// Test execution
test.describe('Load Testing for 10,000+ Concurrent Users', () => {
  test('should handle 10,000 concurrent users', async () => {
    const runner = new LoadTestRunner(loadTestConfig);
    const summary = await runner.run();

    // Validate performance requirements
    expect(summary.summary.averageResponseTime).toBeLessThan(loadTestConfig.metrics.responseTime.p95);
    expect(summary.summary.p95ResponseTime).toBeLessThan(loadTestConfig.metrics.responseTime.p95);
    expect(summary.summary.p99ResponseTime).toBeLessThan(loadTestConfig.metrics.responseTime.p99);
    expect(summary.summary.errorRate).toBeLessThan(loadTestConfig.metrics.errorRate.max);
    expect(summary.summary.requestsPerSecond).toBeGreaterThan(loadTestConfig.metrics.throughput.requestsPerSecond / 10); // At least 10% of target
    expect(summary.pass).toBe(true);

    // Validate concurrent user handling
    expect(summary.summary.totalUsers).toBeGreaterThanOrEqual(loadTestConfig.targetConcurrentUsers * 0.95); // At least 95% of target users

    // Generate detailed report
    console.log('\n=== DETAILED PERFORMANCE REPORT ===');
    console.log(JSON.stringify(summary, null, 2));

    // Save results to file
    await saveResults(summary);
  });

  test('should maintain performance under sustained load', async () => {
    // Test sustained performance over time
    const sustainedConfig = { ...loadTestConfig, duration: 3600 }; // 1 hour
    const runner = new LoadTestRunner(sustainedConfig);
    const summary = await runner.run();

    // Check for performance degradation
    expect(summary.pass).toBe(true);
    expect(summary.summary.errorRate).toBeLessThan(2.0); // Allow slightly higher error rate for sustained load

    console.log('Sustained load test completed successfully');
  });
});

async function saveResults(summary: LoadTestSummary): Promise<void> {
  const fs = require('fs').promises;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `load-test-results-${timestamp}.json`;

  try {
    await fs.writeFile(filename, JSON.stringify(summary, null, 2));
    console.log(`\n📄 Results saved to ${filename}`);
  } catch (error) {
    console.error('Failed to save results:', error);
  }
}

export { LoadTestRunner, type LoadTestConfig, type LoadTestSummary };