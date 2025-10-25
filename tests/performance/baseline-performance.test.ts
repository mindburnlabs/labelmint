import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';

describe('Baseline Performance Tests', () => {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

  interface PerformanceMetrics {
    url: string;
    method: string;
    statusCode: number;
    responseTime: number;
    success: boolean;
    timestamp: number;
  }

  interface LoadTestResult {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  }

  describe('Basic API Performance', () => {
    it('should test health endpoint performance @api @health', async () => {
      const metrics: PerformanceMetrics[] = [];
      const testDuration = 10000; // 10 seconds
      const concurrentRequests = 10;

      console.log(`Testing health endpoint: ${BASE_URL}/health`);

      const startTime = Date.now();
      const endTime = startTime + testDuration;
      const promises: Promise<void>[] = [];

      // Create concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push((async () => {
          while (Date.now() < endTime) {
            const reqStart = performance.now();
            try {
              const response = await fetch(`${BASE_URL}/health`);
              const reqEnd = performance.now();

              metrics.push({
                url: '/health',
                method: 'GET',
                statusCode: response.status,
                responseTime: reqEnd - reqStart,
                success: response.ok,
                timestamp: Date.now()
              });
            } catch (error) {
              const reqEnd = performance.now();
              metrics.push({
                url: '/health',
                method: 'GET',
                statusCode: 0,
                responseTime: reqEnd - reqStart,
                success: false,
                timestamp: Date.now()
              });
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        })());
      }

      await Promise.all(promises);

      // Calculate metrics
      const result = calculateMetrics(metrics, testDuration);

      console.log('Health Endpoint Results:', {
        totalRequests: result.totalRequests,
        averageResponseTime: `${result.averageResponseTime.toFixed(2)}ms`,
        p95ResponseTime: `${result.p95ResponseTime.toFixed(2)}ms`,
        requestsPerSecond: result.requestsPerSecond.toFixed(2),
        errorRate: `${(result.errorRate * 100).toFixed(2)}%`
      });

      // Performance assertions
      expect(result.errorRate).toBeLessThan(0.05); // Less than 5% error rate
      expect(result.averageResponseTime).toBeLessThan(200); // Less than 200ms average
      expect(result.p95ResponseTime).toBeLessThan(500); // Less than 500ms for 95th percentile
      expect(result.requestsPerSecond).toBeGreaterThan(5); // At least 5 RPS
    }, 15000);

    it('should test static file serving performance @api @static', async () => {
      const metrics: PerformanceMetrics[] = [];
      const testDuration = 5000; // 5 seconds

      console.log(`Testing static file serving`);

      const startTime = Date.now();
      const endTime = startTime + testDuration;

      while (Date.now() < endTime) {
        const reqStart = performance.now();
        try {
          const response = await fetch(`${BASE_URL}/api-docs`);
          const reqEnd = performance.now();

          metrics.push({
            url: '/api-docs',
            method: 'GET',
            statusCode: response.status,
            responseTime: reqEnd - reqStart,
            success: response.ok,
            timestamp: Date.now()
          });
        } catch (error) {
          const reqEnd = performance.now();
          metrics.push({
            url: '/api-docs',
            method: 'GET',
            statusCode: 0,
            responseTime: reqEnd - reqStart,
            success: false,
            timestamp: Date.now()
          });
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const result = calculateMetrics(metrics, testDuration);

      console.log('Static File Results:', {
        totalRequests: result.totalRequests,
        averageResponseTime: `${result.averageResponseTime.toFixed(2)}ms`,
        p95ResponseTime: `${result.p95ResponseTime.toFixed(2)}ms`,
        errorRate: `${(result.errorRate * 100).toFixed(2)}%`
      });

      // Static files should be fast
      expect(result.errorRate).toBeLessThan(0.1); // Less than 10% error rate
      expect(result.averageResponseTime).toBeLessThan(100); // Less than 100ms average
    }, 10000);
  });

  describe('Load Testing', () => {
    it('should handle concurrent load @load-testing @concurrent', async () => {
      const endpoint = '/health';
      const concurrentUsers = 20;
      const testDuration = 15000; // 15 seconds
      const rampUpTime = 5000; // 5 seconds ramp-up

      console.log(`Running concurrent load test: ${concurrentUsers} users for ${testDuration}ms`);

      const metrics: PerformanceMetrics[] = [];
      const startTime = Date.now();
      const endTime = startTime + testDuration;

      const promises: Promise<void>[] = [];
      const rampUpInterval = rampUpTime / concurrentUsers;

      for (let i = 0; i < concurrentUsers; i++) {
        promises.push((async (userIndex: number) => {
          // Stagger start times for ramp-up
          await new Promise(resolve => setTimeout(resolve, userIndex * rampUpInterval));

          while (Date.now() < endTime) {
            const reqStart = performance.now();
            try {
              const response = await fetch(`${BASE_URL}${endpoint}`);
              const reqEnd = performance.now();

              metrics.push({
                url: endpoint,
                method: 'GET',
                statusCode: response.status,
                responseTime: reqEnd - reqStart,
                success: response.ok,
                timestamp: Date.now()
              });
            } catch (error) {
              const reqEnd = performance.now();
              metrics.push({
                url: endpoint,
                method: 'GET',
                statusCode: 0,
                responseTime: reqEnd - reqStart,
                success: false,
                timestamp: Date.now()
              });
            }

            // Random think time between 100-500ms
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
          }
        })(i));
      }

      await Promise.all(promises);

      const result = calculateMetrics(metrics, testDuration);

      console.log('Concurrent Load Test Results:', {
        totalRequests: result.totalRequests,
        averageResponseTime: `${result.averageResponseTime.toFixed(2)}ms`,
        p95ResponseTime: `${result.p95ResponseTime.toFixed(2)}ms`,
        p99ResponseTime: `${result.p99ResponseTime.toFixed(2)}ms`,
        requestsPerSecond: result.requestsPerSecond.toFixed(2),
        errorRate: `${(result.errorRate * 100).toFixed(2)}%`
      });

      // Load testing assertions
      expect(result.errorRate).toBeLessThan(0.1); // Less than 10% error rate under load
      expect(result.averageResponseTime).toBeLessThan(500); // Less than 500ms average under load
      expect(result.p95ResponseTime).toBeLessThan(1000); // Less than 1 second for 95th percentile
      expect(result.requestsPerSecond).toBeGreaterThan(10); // At least 10 RPS under load
    }, 20000);
  });

  describe('Memory and Resource Testing', () => {
    it('should monitor memory usage during sustained load @memory @sustained', async () => {
      const testDuration = 30000; // 30 seconds
      const sampleInterval = 5000; // Sample every 5 seconds
      const sampleCount = testDuration / sampleInterval;

      console.log(`Monitoring memory usage for ${testDuration}ms`);

      const memorySamples: Array<{ timestamp: number; heapUsed: number; heapTotal: number; external: number }> = [];
      const performanceSamples: Array<{ timestamp: number; avgResponseTime: number; requestCount: number }> = [];

      const startTime = Date.now();
      const endTime = startTime + testDuration;

      // Monitor memory and performance
      const monitorInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        memorySamples.push({
          timestamp: Date.now(),
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external
        });

        // Run quick performance test
        runQuickPerformanceTest().then(result => {
          performanceSamples.push({
            timestamp: Date.now(),
            avgResponseTime: result.avgResponseTime,
            requestCount: result.requestCount
          });
        });
      }, sampleInterval);

      // Sustained background load
      const loadPromise = (async () => {
        while (Date.now() < endTime) {
          const promises: Promise<any>[] = [];
          for (let i = 0; i < 5; i++) {
            promises.push(fetch(`${BASE_URL}/health`).catch(() => null));
          }
          await Promise.allSettled(promises);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      })();

      await loadPromise;
      clearInterval(monitorInterval);

      // Analyze memory usage
      const initialMemory = memorySamples[0]?.heapUsed || 0;
      const finalMemory = memorySamples[memorySamples.length - 1]?.heapUsed || 0;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;

      // Analyze performance degradation
      const initialPerformance = performanceSamples[0]?.avgResponseTime || 0;
      const finalPerformance = performanceSamples[performanceSamples.length - 1]?.avgResponseTime || 0;
      const performanceDegradation = finalPerformance - initialPerformance;
      const degradationPercent = (performanceDegradation / initialPerformance) * 100;

      console.log('Memory Usage Analysis:', {
        initialMemory: `${(initialMemory / 1024 / 1024).toFixed(2)}MB`,
        finalMemory: `${(finalMemory / 1024 / 1024).toFixed(2)}MB`,
        memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
        memoryIncreasePercent: `${memoryIncreasePercent.toFixed(2)}%`,
        samples: memorySamples.length
      });

      console.log('Performance Degradation Analysis:', {
        initialResponseTime: `${initialPerformance.toFixed(2)}ms`,
        finalResponseTime: `${finalPerformance.toFixed(2)}ms`,
        degradation: `${performanceDegradation.toFixed(2)}ms`,
        degradationPercent: `${degradationPercent.toFixed(2)}%`
      });

      // Memory and resource assertions
      expect(memoryIncreasePercent).toBeLessThan(50); // Less than 50% memory increase
      expect(degradationPercent).toBeLessThan(100); // Less than 100% performance degradation
      expect(memorySamples.length).toBeGreaterThan(5); // Should have collected samples
    }, 35000);
  });

  // Helper function to calculate performance metrics
  function calculateMetrics(metrics: PerformanceMetrics[], duration: number): LoadTestResult {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 1
      };
    }

    const responseTimes = metrics
      .filter(m => m.success)
      .map(m => m.responseTime)
      .sort((a, b) => a - b);

    const successfulRequests = metrics.filter(m => m.success).length;
    const failedRequests = metrics.length - successfulRequests;

    return {
      totalRequests: metrics.length,
      successfulRequests,
      failedRequests,
      averageResponseTime: responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0,
      p95ResponseTime: responseTimes.length > 0
        ? responseTimes[Math.floor(responseTimes.length * 0.95)] || 0
        : 0,
      p99ResponseTime: responseTimes.length > 0
        ? responseTimes[Math.floor(responseTimes.length * 0.99)] || 0
        : 0,
      requestsPerSecond: metrics.length / (duration / 1000),
      errorRate: failedRequests / metrics.length
    };
  }

  // Quick performance test helper
  async function runQuickPerformanceTest(): Promise<{ avgResponseTime: number; requestCount: number }> {
    const promises: Promise<{ responseTime: number; success: boolean }>[] = [];

    for (let i = 0; i < 3; i++) {
      promises.push((async () => {
        const start = performance.now();
        try {
          const response = await fetch(`${BASE_URL}/health`);
          const end = performance.now();
          return {
            responseTime: end - start,
            success: response.ok
          };
        } catch (error) {
          const end = performance.now();
          return {
            responseTime: end - start,
            success: false
          };
        }
      })());
    }

    const results = await Promise.all(promises);
    const successfulResults = results.filter(r => r.success);

    return {
      avgResponseTime: successfulResults.length > 0
        ? successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length
        : 0,
      requestCount: successfulResults.length
    };
  }
});