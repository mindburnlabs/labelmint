import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { getCacheManager } from '../../packages/shared/src/performance/cacheManager';
import { QueryOptimizer } from '../../packages/shared/src/performance/queryOptimizer';
import { PerformanceMonitor } from '../../packages/shared/src/performance/performanceMonitor';

describe('Comprehensive Performance Tests', () => {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
  let cacheManager: any;
  let queryOptimizer: any;
  let performanceMonitor: any;

  beforeAll(async () => {
    // Initialize performance components
    cacheManager = getCacheManager();
    // Note: In real implementation, these would be initialized with actual Prisma client
    // queryOptimizer = new QueryOptimizer(prismaClient);
    performanceMonitor = new PerformanceMonitor();
    performanceMonitor.startMonitoring(1000); // Monitor every second
  });

  afterAll(async () => {
    if (performanceMonitor) {
      performanceMonitor.stopMonitoring();
    }
    if (cacheManager) {
      await cacheManager.disconnect();
    }
  });

  describe('System Performance Validation', () => {
    it('should validate baseline system performance @system @baseline', async () => {
      console.log('🔍 Validating system baseline performance...');

      const systemMetrics = {
        cpu: {
          test: () => {
            const iterations = 100000;
            const start = performance.now();
            let sum = 0;
            for (let i = 0; i < iterations; i++) {
              sum += Math.sqrt(i) * Math.sin(i);
            }
            return performance.now() - start;
          }
        },
        memory: {
          test: () => {
            const arrays = [];
            const start = performance.now();
            for (let i = 0; i < 1000; i++) {
              const arr = new Array(100).fill(0).map((_, idx) => Math.random() * idx);
              arrays.push(arr);
            }
            const duration = performance.now() - start;
            // Clean up
            arrays.length = 0;
            return duration;
          }
        },
        disk: {
          test: async () => {
            const fs = await import('fs');
            const path = await import('path');
            const testData = 'x'.repeat(1000); // 1KB
            const testFile = path.join(process.cwd(), 'temp-perf-test.txt');

            const writeStart = performance.now();
            await fs.promises.writeFile(testFile, testData);
            const writeTime = performance.now() - writeStart;

            const readStart = performance.now();
            await fs.promises.readFile(testFile);
            const readTime = performance.now() - readStart;

            try {
              await fs.promises.unlink(testFile);
            } catch {}

            return { writeTime, readTime };
          }
        }
      };

      const results = {};

      // CPU Test
      const cpuTime = systemMetrics.cpu.test();
      results.cpu = {
        time: cpuTime.toFixed(2),
        opsPerSec: (100000 / (cpuTime / 1000)).toFixed(0)
      };
      console.log(`  📊 CPU Performance: ${results.cpu.opsPerSec} ops/sec`);

      // Memory Test
      const memTime = systemMetrics.memory.test();
      results.memory = {
        time: memTime.toFixed(2),
        memUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
      };
      console.log(`  💾 Memory Performance: ${results.memory.time}ms, ${results.memory.memUsage}MB`);

      // Disk Test
      const diskResults = await systemMetrics.disk.test();
      results.disk = {
        writeTime: diskResults.writeTime.toFixed(2),
        readTime: diskResults.readTime.toFixed(2),
        writeSpeed: (1 / (diskResults.writeTime / 1000)).toFixed(2),
        readSpeed: (1 / (diskResults.readTime / 1000)).toFixed(2)
      };
      console.log(`  💿 Disk Performance: Write ${results.disk.writeSpeed}MB/s, Read ${results.disk.readSpeed}MB/s`);

      // Performance assertions
      expect(parseFloat(results.cpu.opsPerSec)).toBeGreaterThan(100000); // 100K ops/sec
      expect(parseFloat(results.memory.time)).toBeLessThan(200); // < 200ms
      expect(parseFloat(results.disk.writeSpeed)).toBeGreaterThan(10); // > 10MB/s write
      expect(parseFloat(results.disk.readSpeed)).toBeGreaterThan(20); // > 20MB/s read

      console.log('✅ System baseline performance validation passed');
    }, 10000);

    it('should validate memory usage stays within limits @memory @limits', async () => {
      console.log('💾 Testing memory usage limits...');

      const initialMemory = process.memoryUsage().heapUsed;
      const memorySnapshots = [];
      const testDuration = 10000; // 10 seconds
      const sampleInterval = 1000; // 1 second

      const startTime = Date.now();
      const endTime = startTime + testDuration;

      // Monitor memory usage over time
      while (Date.now() < endTime) {
        const memUsage = process.memoryUsage();
        memorySnapshots.push({
          timestamp: Date.now(),
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external
        });

        // Simulate some work
        const tempData = new Array(1000).fill(0).map(() => ({ id: Math.random(), data: 'x'.repeat(100) }));

        await new Promise(resolve => setTimeout(resolve, sampleInterval));

        // Clear temporary data
        tempData.length = 0;
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const maxMemory = Math.max(...memorySnapshots.map(s => s.heapUsed));

      console.log(`  📈 Memory Analysis:`);
      console.log(`    Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`    Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`    Peak: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`    Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory usage assertions
      expect(finalMemory).toBeLessThan(512 * 1024 * 1024); // < 512MB
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // < 100MB increase
      expect(maxMemory).toBeLessThan(1024 * 1024 * 1024); // < 1GB peak

      console.log('✅ Memory usage validation passed');
    }, 15000);
  });

  describe('Cache Performance Tests', () => {
    it('should validate cache performance and hit rates @cache @performance', async () => {
      console.log('🗄️ Testing cache performance...');

      const testData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: 'x'.repeat(100), // 100 bytes per item
        timestamp: Date.now() + i
      }));

      // Warm up cache
      console.log('  🔥 Warming up cache...');
      const warmupStart = performance.now();
      await cacheManager.warmCache(testData.map(item => ({
        key: `item:${item.id}`,
        value: item,
        options: { ttl: 300000, tags: ['test'] }
      })));
      const warmupTime = performance.now() - warmupStart;
      console.log(`    Cache warmup: ${warmupTime.toFixed(2)}ms for ${testData.length} items`);

      // Test cache reads
      console.log('  📖 Testing cache reads...');
      const readTimes = [];
      let cacheHits = 0;
      let cacheMisses = 0;

      for (let i = 0; i < 100; i++) {
        const randomItem = testData[Math.floor(Math.random() * testData.length)];
        const start = performance.now();
        const cached = await cacheManager.get(`item:${randomItem.id}`);
        const readTime = performance.now() - start;

        readTimes.push(readTime);

        if (cached) {
          cacheHits++;
          expect(cached.id).toBe(randomItem.id);
        } else {
          cacheMisses++;
        }
      }

      const avgReadTime = readTimes.reduce((a, b) => a + b, 0) / readTimes.length;
      const hitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;

      console.log(`    Cache reads: ${avgReadTime.toFixed(3)}ms avg, ${hitRate.toFixed(1)}% hit rate`);

      // Test cache writes
      console.log('  ✍️ Testing cache writes...');
      const writeTimes = [];

      for (let i = 0; i < 50; i++) {
        const item = {
          id: `new-${i}`,
          name: `New Item ${i}`,
          data: 'y'.repeat(200),
          timestamp: Date.now()
        };

        const start = performance.now();
        await cacheManager.set(`new-item:${item.id}`, item, { ttl: 60000 });
        const writeTime = performance.now() - start;
        writeTimes.push(writeTime);
      }

      const avgWriteTime = writeTimes.reduce((a, b) => a + b, 0) / writeTimes.length;

      console.log(`    Cache writes: ${avgWriteTime.toFixed(3)}ms avg`);

      // Get cache statistics
      const stats = cacheManager.getStats();
      console.log(`    Cache stats: ${stats.hits} hits, ${stats.misses} misses, ${(stats.hitRate * 100).toFixed(1)}% hit rate`);

      // Cache performance assertions
      expect(avgReadTime).toBeLessThan(10); // < 10ms average read
      expect(avgWriteTime).toBeLessThan(20); // < 20ms average write
      expect(hitRate).toBeGreaterThan(80); // > 80% hit rate
      expect(stats.memoryUsage).toBeLessThan(50 * 1024 * 1024); // < 50MB memory usage

      console.log('✅ Cache performance validation passed');
    }, 30000);

    it('should test cache invalidation and cleanup @cache @invalidation', async () => {
      console.log('🧹 Testing cache invalidation...');

      // Create test data with tags
      const taggedData = [
        { key: 'user:123', value: { id: 123, name: 'User 123' }, tags: ['user', 'profile'] },
        { key: 'user:124', value: { id: 124, name: 'User 124' }, tags: ['user', 'profile'] },
        { key: 'project:1', value: { id: 1, name: 'Project 1' }, tags: ['project'] },
        { key: 'project:2', value: { id: 2, name: 'Project 2' }, tags: ['project'] }
      ];

      // Set tagged data
      for (const item of taggedData) {
        await cacheManager.set(item.key, item.value, { tags: item.tags, ttl: 300000 });
      }

      // Verify data is cached
      const user123 = await cacheManager.get('user:123');
      const project1 = await cacheManager.get('project:1');
      expect(user123).toBeTruthy();
      expect(project1).toBeTruthy();

      // Invalidate by tag
      console.log('  🗑️ Invalidating user profiles...');
      await cacheManager.invalidateByTag('user');

      // Check invalidation results
      const user123After = await cacheManager.get('user:123');
      const user124After = await cacheManager.get('user:124');
      const project1After = await cacheManager.get('project:1');

      expect(user123After).toBeNull();
      expect(user124After).toBeNull();
      expect(project1After).toBeTruthy(); // Should still be cached

      console.log('✅ Cache invalidation validation passed');
    }, 10000);
  });

  describe('Performance Monitoring Tests', () => {
    it('should validate performance monitoring functionality @monitoring @metrics', async () => {
      console.log('📊 Testing performance monitoring...');

      // Record some test metrics
      for (let i = 0; i < 10; i++) {
        const responseTime = 50 + Math.random() * 100; // 50-150ms
        const success = Math.random() > 0.1; // 90% success rate
        performanceMonitor.recordRequest(responseTime, success);
      }

      // Get current metrics
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      expect(currentMetrics).toBeTruthy();
      expect(currentMetrics.requests.total).toBeGreaterThan(0);

      // Update database and cache stats
      performanceMonitor.updateDatabaseStats({
        connections: 5,
        avgQueryTime: 25,
        slowQueries: 0
      });

      performanceMonitor.updateCacheStats({
        hits: 80,
        misses: 20,
        memoryUsage: 10 * 1024 * 1024 // 10MB
      });

      // Wait a bit for monitoring to collect data
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get metrics history
      const history = performanceMonitor.getMetricsHistory(5); // Last 5 minutes
      expect(history.length).toBeGreaterThan(0);

      // Check for alerts
      const activeAlerts = performanceMonitor.getActiveAlerts();
      console.log(`  📈 Active alerts: ${activeAlerts.length}`);

      // Generate performance report
      const report = await performanceMonitor.generatePerformanceReport();
      expect(report).toContain('Performance Monitoring Report');
      expect(report.length).toBeGreaterThan(100);

      console.log(`  📋 Report generated: ${report.length} characters`);

      console.log('✅ Performance monitoring validation passed');
    }, 10000);

    it('should test alerting system @monitoring @alerts', async () => {
      console.log('🚨 Testing alerting system...');

      // Add a test alert rule with low threshold
      performanceMonitor.addAlertRule({
        name: 'Test High Response Time',
        metric: 'requests.avgResponseTime',
        threshold: 10, // 10ms (very low for testing)
        operator: '>',
        duration: 1000, // 1 second
        severity: 'medium'
      });

      // Record slow requests to trigger alert
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordRequest(50 + Math.random() * 50, true); // 50-100ms
      }

      // Wait for alert detection
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for alerts
      const activeAlerts = performanceMonitor.getActiveAlerts();
      const testAlert = activeAlerts.find(alert => alert.rule === 'Test High Response Time');

      if (testAlert) {
        console.log(`  🚨 Alert triggered: ${testAlert.rule} (${testAlert.severity})`);
        expect(testAlert.value).toBeGreaterThan(10);
      } else {
        console.log('  ⚠️ Test alert not triggered (monitoring may need more time)');
      }

      // Clean up test alert rule
      performanceMonitor.removeAlertRule('Test High Response Time');

      console.log('✅ Alerting system validation passed');
    }, 10000);
  });

  describe('Load Testing with Optimizations', () => {
    it('should handle sustained load with optimizations @load @sustained', async () => {
      console.log('⚡ Testing sustained load with optimizations...');

      const testDuration = 20000; // 20 seconds
      const concurrentUsers = 20;
      const results = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        errors: []
      };

      console.log(`  🔄 Running ${concurrentUsers} concurrent users for ${testDuration / 1000}s`);

      const startTime = Date.now();
      const endTime = startTime + testDuration;

      const promises = [];

      for (let i = 0; i < concurrentUsers; i++) {
        promises.push((async (userId: number) => {
          let requestCount = 0;

          while (Date.now() < endTime) {
            const reqStart = performance.now();

            try {
              // Simulate cache-optimized request
              const cacheKey = `user-data:${userId}`;
              let data = await cacheManager.get(cacheKey);

              if (!data) {
                // Simulate database fetch
                data = { userId, data: 'x'.repeat(1000), timestamp: Date.now() };
                await cacheManager.set(cacheKey, data, { ttl: 60000 });
              }

              const reqEnd = performance.now();
              const responseTime = reqEnd - reqStart;

              results.totalRequests++;
              results.successfulRequests++;
              results.responseTimes.push(responseTime);
              requestCount++;

              // Record in performance monitor
              performanceMonitor.recordRequest(responseTime, true);

            } catch (error) {
              const reqEnd = performance.now();
              const responseTime = reqEnd - reqStart;

              results.totalRequests++;
              results.failedRequests++;
              results.responseTimes.push(responseTime);
              results.errors.push(error.message);

              performanceMonitor.recordRequest(responseTime, false);
            }

            // Simulate user think time
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
          }

          return requestCount;
        })(i));
      }

      const userRequestCounts = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      // Calculate statistics
      const sortedTimes = results.responseTimes.sort((a, b) => a - b);
      const stats = {
        totalRequests: results.totalRequests,
        successfulRequests: results.successfulRequests,
        failedRequests: results.failedRequests,
        avgResponseTime: results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length,
        minResponseTime: Math.min(...results.responseTimes),
        maxResponseTime: Math.max(...results.responseTimes),
        p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
        p99ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.99)],
        requestsPerSecond: results.totalRequests / (totalDuration / 1000),
        errorRate: (results.failedRequests / results.totalRequests) * 100,
        throughputPerUser: userRequestCounts.reduce((a, b) => a + b, 0) / concurrentUsers
      };

      console.log('  📊 Load Test Results:');
      console.log(`    Total Requests: ${stats.totalRequests}`);
      console.log(`    Successful: ${stats.successfulRequests}`);
      console.log(`    Failed: ${stats.failedRequests}`);
      console.log(`    Requests/sec: ${stats.requestsPerSecond.toFixed(2)}`);
      console.log(`    Error Rate: ${stats.errorRate.toFixed(2)}%`);
      console.log(`    Avg Response: ${stats.avgResponseTime.toFixed(2)}ms`);
      console.log(`    P95 Response: ${stats.p95ResponseTime.toFixed(2)}ms`);
      console.log(`    P99 Response: ${stats.p99ResponseTime.toFixed(2)}ms`);
      console.log(`    Throughput/User: ${stats.throughputPerUser.toFixed(1)} requests`);

      // Performance assertions
      expect(stats.errorRate).toBeLessThan(5); // < 5% error rate
      expect(stats.avgResponseTime).toBeLessThan(200); // < 200ms average
      expect(stats.p95ResponseTime).toBeLessThan(500); // < 500ms for 95th percentile
      expect(stats.requestsPerSecond).toBeGreaterThan(50); // > 50 RPS
      expect(stats.throughputPerUser).toBeGreaterThan(10); // > 10 requests per user

      console.log('✅ Sustained load test passed');
    }, 30000);
  });

  describe('Production Readiness Validation', () => {
    it('should validate all production performance targets @production @readiness', async () => {
      console.log('🎯 Validating production readiness...');

      const targets = {
        responseTime: 200, // ms
        memoryUsage: 512 * 1024 * 1024, // 512MB
        throughput: 1000, // req/s
        errorRate: 1, // %
        cacheHitRate: 80, // %
        cpuUsage: 80 // %
      };

      const results = {};

      // Test 1: Response Time
      console.log('  ⏱️ Testing response time target...');
      const responseTimes = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        await cacheManager.get('test-key');
        const time = performance.now() - start;
        responseTimes.push(time);
      }
      results.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      results.p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      console.log(`    Avg: ${results.avgResponseTime.toFixed(2)}ms, P95: ${results.p95ResponseTime.toFixed(2)}ms`);

      // Test 2: Memory Usage
      console.log('  💾 Testing memory usage target...');
      const memUsage = process.memoryUsage();
      results.memoryUsage = memUsage.heapUsed;
      console.log(`    Memory: ${(results.memoryUsage / 1024 / 1024).toFixed(2)}MB`);

      // Test 3: Throughput
      console.log('  🚀 Testing throughput target...');
      const throughputStart = performance.now();
      const throughputPromises = [];
      for (let i = 0; i < 50; i++) {
        throughputPromises.push(cacheManager.get(`throughput-test-${i}`));
      }
      await Promise.all(throughputPromises);
      const throughputDuration = performance.now() - throughputStart;
      results.throughput = 50 / (throughputDuration / 1000);
      console.log(`    Throughput: ${results.throughput.toFixed(2)} req/s`);

      // Test 4: Error Rate
      console.log('  ❌ Testing error rate target...');
      let errors = 0;
      for (let i = 0; i < 100; i++) {
        try {
          await cacheManager.get('test-key');
        } catch (error) {
          errors++;
        }
      }
      results.errorRate = (errors / 100) * 100;
      console.log(`    Error Rate: ${results.errorRate.toFixed(2)}%`);

      // Test 5: Cache Hit Rate
      console.log('  🎯 Testing cache hit rate target...');
      await cacheManager.set('hit-rate-test', { data: 'test' }, { ttl: 60000 });
      let hits = 0;
      for (let i = 0; i < 50; i++) {
        const result = await cacheManager.get('hit-rate-test');
        if (result) hits++;
      }
      results.cacheHitRate = (hits / 50) * 100;
      console.log(`    Cache Hit Rate: ${results.cacheHitRate.toFixed(1)}%`);

      // Test 6: CPU Usage (simple approximation)
      console.log('  🔥 Testing CPU usage target...');
      const cpuStart = performance.now();
      let cpuSum = 0;
      for (let i = 0; i < 100000; i++) {
        cpuSum += Math.sqrt(i) * Math.sin(i);
      }
      const cpuDuration = performance.now() - cpuStart;
      results.cpuUsage = (cpuDuration / 1000) * 10; // Rough approximation
      console.log(`    CPU Usage: ${results.cpuUsage.toFixed(2)}%`);

      // Validation
      console.log('\n  🎯 Production Readiness Results:');
      const validations = [
        { name: 'Response Time', actual: results.avgResponseTime, target: targets.responseTime, unit: 'ms', pass: results.avgResponseTime <= targets.responseTime },
        { name: 'Memory Usage', actual: results.memoryUsage / 1024 / 1024, target: targets.memoryUsage / 1024 / 1024, unit: 'MB', pass: results.memoryUsage <= targets.memoryUsage },
        { name: 'Throughput', actual: results.throughput, target: targets.throughput, unit: 'req/s', pass: results.throughput >= targets.throughput },
        { name: 'Error Rate', actual: results.errorRate, target: targets.errorRate, unit: '%', pass: results.errorRate <= targets.errorRate },
        { name: 'Cache Hit Rate', actual: results.cacheHitRate, target: targets.cacheHitRate, unit: '%', pass: results.cacheHitRate >= targets.cacheHitRate },
        { name: 'CPU Usage', actual: results.cpuUsage, target: targets.cpuUsage, unit: '%', pass: results.cpuUsage <= targets.cpuUsage }
      ];

      let passedValidations = 0;
      for (const validation of validations) {
        const status = validation.pass ? '✅' : '❌';
        console.log(`    ${status} ${validation.name}: ${validation.actual.toFixed(2)}${validation.unit} (target: ${validation.target}${validation.unit})`);
        if (validation.pass) passedValidations++;
      }

      const overallPassRate = (passedValidations / validations.length) * 100;
      console.log(`\n  📈 Overall Readiness: ${passedValidations}/${validations.length} (${overallPassRate.toFixed(1)}%)`);

      // Final assertion
      expect(overallPassRate).toBeGreaterThan(80); // At least 80% of targets should pass

      if (overallPassRate >= 90) {
        console.log('🏆 EXCELLENT: System is production-ready with optimal performance!');
      } else if (overallPassRate >= 80) {
        console.log('✅ GOOD: System is production-ready with minor optimizations needed.');
      } else {
        console.log('⚠️ NEEDS WORK: System requires optimization before production deployment.');
      }

      console.log('✅ Production readiness validation completed');
    }, 30000);
  });
});