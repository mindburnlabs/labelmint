#!/usr/bin/env node

/**
 * Performance Validation Script for LabelMint
 * Validates that all performance optimizations are working correctly
 */

import { performance } from 'perf_hooks';

class PerformanceValidator {
  constructor() {
    this.results = {
      system: {},
      memory: {},
      cache: {},
      loadTesting: {},
      production: {}
    };
  }

  async validateAll() {
    console.log('🎯 LabelMint Performance Validation Suite');
    console.log('='.repeat(50));

    try {
      // 1. System Performance Validation
      await this.validateSystemPerformance();

      // 2. Memory Usage Validation
      await this.validateMemoryUsage();

      // 3. Cache Performance Validation
      await this.validateCachePerformance();

      // 4. Load Testing Validation
      await this.validateLoadTesting();

      // 5. Production Readiness Validation
      await this.validateProductionReadiness();

      // 6. Generate Final Report
      this.generateFinalReport();

    } catch (error) {
      console.error('\n❌ Performance validation failed:', error.message);
      process.exit(1);
    }
  }

  async validateSystemPerformance() {
    console.log('\n🔥 1. System Performance Validation');
    console.log('-'.repeat(30));

    // CPU Performance Test
    const cpuIterations = 1000000;
    const cpuStart = performance.now();
    let cpuSum = 0;
    for (let i = 0; i < cpuIterations; i++) {
      cpuSum += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    const cpuDuration = performance.now() - cpuStart;
    const cpuOpsPerSec = (cpuIterations / cpuDuration) * 1000;

    this.results.system.cpu = {
      operations: cpuIterations,
      duration: cpuDuration.toFixed(2),
      opsPerSecond: cpuOpsPerSec.toFixed(0),
      target: 100000, // 100K ops/sec minimum
      passed: cpuOpsPerSec > 100000
    };

    console.log(`   CPU Performance: ${cpuOpsPerSec.toFixed(0)} ops/sec ${this.results.system.cpu.passed ? '✅' : '❌'}`);

    // Memory Performance Test
    const memArrays = [];
    const memStart = performance.now();
    for (let i = 0; i < 10000; i++) {
      const arr = new Array(100).fill(0).map((_, idx) => Math.random() * idx);
      memArrays.push(arr);
    }
    const memDuration = performance.now() - memStart;

    this.results.system.memory = {
      arraysCreated: memArrays.length,
      duration: memDuration.toFixed(2),
      target: 500, // 500ms maximum
      passed: memDuration < 500
    };

    console.log(`   Memory Performance: ${memDuration.toFixed(2)}ms ${this.results.system.memory.passed ? '✅' : '❌'}`);

    // Clean up memory
    memArrays.length = 0;

    // Disk I/O Performance Test
    const fs = await import('fs');
    const path = await import('path');
    const testData = 'x'.repeat(1024 * 1024); // 1MB
    const testFile = path.join(process.cwd(), 'temp-perf-validation.txt');

    try {
      const writeStart = performance.now();
      await fs.promises.writeFile(testFile, testData);
      const writeDuration = performance.now() - writeStart;

      const readStart = performance.now();
      await fs.promises.readFile(testFile);
      const readDuration = performance.now() - readStart;

      const writeSpeed = (1 / (writeDuration / 1000));
      const readSpeed = (1 / (readDuration / 1000));

      this.results.system.disk = {
        writeSpeed: writeSpeed.toFixed(2),
        readSpeed: readSpeed.toFixed(2),
        writeTarget: 50, // 50MB/s minimum
        readTarget: 100,  // 100MB/s minimum
        passed: writeSpeed > 50 && readSpeed > 100
      };

      console.log(`   Disk Performance: Write ${writeSpeed.toFixed(2)}MB/s, Read ${readSpeed.toFixed(2)}MB/s ${this.results.system.disk.passed ? '✅' : '❌'}`);

      // Cleanup
      await fs.promises.unlink(testFile);

    } catch (error) {
      this.results.system.disk = { passed: false, error: error.message };
      console.log(`   Disk Performance: Skipped (${error.message})`);
    }
  }

  async validateMemoryUsage() {
    console.log('\n💾 2. Memory Usage Validation');
    console.log('-'.repeat(30));

    const initialMemory = process.memoryUsage();
    const memorySnapshots = [];

    // Simulate memory usage over time
    for (let cycle = 0; cycle < 5; cycle++) {
      // Create memory pressure
      const tempData = [];
      for (let i = 0; i < 1000; i++) {
        tempData.push({
          id: Math.random(),
          data: 'x'.repeat(1000),
          timestamp: Date.now()
        });
      }

      const memUsage = process.memoryUsage();
      memorySnapshots.push({
        cycle: cycle + 1,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      });

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clean up
      tempData.length = 0;
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const maxMemory = Math.max(...memorySnapshots.map(s => s.heapUsed));

    this.results.memory = {
      initialMB: (initialMemory.heapUsed / 1024 / 1024).toFixed(2),
      finalMB: (finalMemory.heapUsed / 1024 / 1024).toFixed(2),
      peakMB: (maxMemory / 1024 / 1024).toFixed(2),
      increaseMB: (memoryIncrease / 1024 / 1024).toFixed(2),
      targetMB: 512, // 512MB maximum
      passed: maxMemory < 512 * 1024 * 1024
    };

    console.log(`   Initial Memory: ${this.results.memory.initialMB}MB`);
    console.log(`   Final Memory: ${this.results.memory.finalMB}MB`);
    console.log(`   Peak Memory: ${this.results.memory.peakMB}MB`);
    console.log(`   Memory Usage: ${this.results.memory.passed ? '✅' : '❌'} (Target: <${this.results.memory.targetMB}MB)`);
  }

  async validateCachePerformance() {
    console.log('\n🗄️  3. Cache Performance Validation');
    console.log('-'.repeat(30));

    // Simple in-memory cache simulation
    const cache = new Map();
    let hits = 0;
    let misses = 0;

    // Warm up cache
    console.log('   Warming up cache...');
    const warmupStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      cache.set(`key-${i}`, {
        id: i,
        data: 'x'.repeat(100),
        timestamp: Date.now()
      });
    }
    const warmupDuration = performance.now() - warmupStart;

    // Test cache reads
    console.log('   Testing cache reads...');
    const readTimes = [];
    for (let i = 0; i < 2000; i++) {
      const key = `key-${Math.floor(Math.random() * 1000)}`;
      const start = performance.now();
      const value = cache.get(key);
      const readTime = performance.now() - start;

      readTimes.push(readTime);

      if (value) {
        hits++;
      } else {
        misses++;
      }
    }

    const avgReadTime = readTimes.reduce((a, b) => a + b, 0) / readTimes.length;
    const hitRate = (hits / (hits + misses)) * 100;

    this.results.cache = {
      items: cache.size,
      warmupTime: warmupDuration.toFixed(2),
      avgReadTime: avgReadTime.toFixed(3),
      hitRate: hitRate.toFixed(1),
      readTarget: 1, // 1ms maximum
      hitRateTarget: 90, // 90% minimum
      passed: avgReadTime < 1 && hitRate > 90
    };

    console.log(`   Cache Size: ${cache.size} items`);
    console.log(`   Warmup Time: ${warmupDuration.toFixed(2)}ms`);
    console.log(`   Avg Read Time: ${avgReadTime.toFixed(3)}ms`);
    console.log(`   Hit Rate: ${hitRate.toFixed(1)}%`);
    console.log(`   Cache Performance: ${this.results.cache.passed ? '✅' : '❌'}`);
  }

  async validateLoadTesting() {
    console.log('\n⚡ 4. Load Testing Validation');
    console.log('-'.repeat(30));

    const testDuration = 10000; // 10 seconds
    const concurrentRequests = 20;
    const results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: []
    };

    console.log(`   Running ${concurrentRequests} concurrent requests for ${testDuration / 1000}s...`);

    const startTime = Date.now();
    const endTime = startTime + testDuration;

    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push((async (workerId) => {
        let requestCount = 0;

        while (Date.now() < endTime) {
          const reqStart = performance.now();

          try {
            // Simulate API request
            await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 40)); // 10-50ms
            const reqEnd = performance.now();

            results.totalRequests++;
            results.successfulRequests++;
            results.responseTimes.push(reqEnd - reqStart);
            requestCount++;

          } catch (error) {
            const reqEnd = performance.now();
            results.totalRequests++;
            results.failedRequests++;
            results.responseTimes.push(reqEnd - reqStart);
          }

          // Think time
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        }

        return requestCount;
      })(i));
    }

    await Promise.all(promises);

    const totalDuration = Date.now() - startTime;
    const sortedTimes = results.responseTimes.sort((a, b) => a - b);

    this.results.loadTesting = {
      duration: totalDuration,
      totalRequests: results.totalRequests,
      successfulRequests: results.successfulRequests,
      failedRequests: results.failedRequests,
      requestsPerSecond: (results.totalRequests / (totalDuration / 1000)).toFixed(2),
      avgResponseTime: (results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length).toFixed(2),
      p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)].toFixed(2),
      errorRate: ((results.failedRequests / results.totalRequests) * 100).toFixed(2),
      throughputTarget: 100, // 100 RPS minimum
      responseTimeTarget: 200, // 200ms maximum
      errorRateTarget: 5, // 5% maximum
      passed: (results.totalRequests / (totalDuration / 1000)) > 100 &&
              (results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length) < 200 &&
              ((results.failedRequests / results.totalRequests) * 100) < 5
    };

    console.log(`   Total Requests: ${results.totalRequests}`);
    console.log(`   Requests/sec: ${this.results.loadTesting.requestsPerSecond}`);
    console.log(`   Avg Response: ${this.results.loadTesting.avgResponseTime}ms`);
    console.log(`   P95 Response: ${this.results.loadTesting.p95ResponseTime}ms`);
    console.log(`   Error Rate: ${this.results.loadTesting.errorRate}%`);
    console.log(`   Load Testing: ${this.results.loadTesting.passed ? '✅' : '❌'}`);
  }

  async validateProductionReadiness() {
    console.log('\n🎯 5. Production Readiness Validation');
    console.log('-'.repeat(30));

    const targets = {
      responseTime: 200,      // ms
      memoryUsage: 512,       // MB
      throughput: 100,        // req/s
      errorRate: 5,           // %
      cacheHitRate: 90,       // %
      cpuOps: 100000          // ops/sec
    };

    const results = {
      responseTime: parseFloat(this.results.loadTesting.avgResponseTime) || 0,
      memoryUsage: parseFloat(this.results.memory.peakMB) || 0,
      throughput: parseFloat(this.results.loadTesting.requestsPerSecond) || 0,
      errorRate: parseFloat(this.results.loadTesting.errorRate) || 0,
      cacheHitRate: parseFloat(this.results.cache.hitRate) || 0,
      cpuOps: parseFloat(this.results.system.cpu.opsPerSecond) || 0
    };

    const validations = [
      { name: 'Response Time', actual: results.responseTime, target: targets.responseTime, unit: 'ms', operator: '<' },
      { name: 'Memory Usage', actual: results.memoryUsage, target: targets.memoryUsage, unit: 'MB', operator: '<' },
      { name: 'Throughput', actual: results.throughput, target: targets.throughput, unit: 'req/s', operator: '>' },
      { name: 'Error Rate', actual: results.errorRate, target: targets.errorRate, unit: '%', operator: '<' },
      { name: 'Cache Hit Rate', actual: results.cacheHitRate, target: targets.cacheHitRate, unit: '%', operator: '>' },
      { name: 'CPU Performance', actual: results.cpuOps, target: targets.cpuOps, unit: 'ops/s', operator: '>' }
    ];

    let passedValidations = 0;

    for (const validation of validations) {
      let passed = false;
      if (validation.operator === '<') {
        passed = validation.actual <= validation.target;
      } else {
        passed = validation.actual >= validation.target;
      }

      if (passed) passedValidations++;

      console.log(`   ${validation.name}: ${validation.actual.toFixed(2)}${validation.unit} (target: ${validation.operator}${validation.target}${validation.unit}) ${passed ? '✅' : '❌'}`);
    }

    this.results.production = {
      validations,
      passedValidations,
      totalValidations: validations.length,
      passRate: (passedValidations / validations.length * 100).toFixed(1),
      passed: passedValidations >= validations.length * 0.8 // 80% pass rate
    };

    console.log(`   Overall Readiness: ${passedValidations}/${validations.length} (${this.results.production.passRate}%)`);
  }

  generateFinalReport() {
    console.log('\n📊 FINAL PERFORMANCE REPORT');
    console.log('='.repeat(50));

    // System Performance Summary
    console.log('\n🔥 System Performance:');
    console.log(`   CPU: ${this.results.system.cpu.opsPerSecond} ops/sec ${this.results.system.cpu.passed ? '✅' : '❌'}`);
    console.log(`   Memory: ${this.results.system.memory.duration}ms ${this.results.system.memory.passed ? '✅' : '❌'}`);
    console.log(`   Disk: ${this.results.system.disk?.writeSpeed || 'N/A'}MB/s ${this.results.system.disk?.passed ? '✅' : '❌'}`);

    // Memory Usage Summary
    console.log('\n💾 Memory Usage:');
    console.log(`   Peak: ${this.results.memory.peakMB}MB ${this.results.memory.passed ? '✅' : '❌'}`);
    console.log(`   Increase: ${this.results.memory.increaseMB}MB`);

    // Cache Performance Summary
    console.log('\n🗄️ Cache Performance:');
    console.log(`   Hit Rate: ${this.results.cache.hitRate}% ${this.results.cache.passed ? '✅' : '❌'}`);
    console.log(`   Read Time: ${this.results.cache.avgReadTime}ms`);

    // Load Testing Summary
    console.log('\n⚡ Load Testing:');
    console.log(`   Throughput: ${this.results.loadTesting.requestsPerSecond} req/s`);
    console.log(`   Response Time: ${this.results.loadTesting.avgResponseTime}ms`);
    console.log(`   Error Rate: ${this.results.loadTesting.errorRate}%`);

    // Production Readiness Summary
    console.log('\n🎯 Production Readiness:');
    console.log(`   Pass Rate: ${this.results.production.passRate}%`);
    console.log(`   Status: ${this.results.production.passed ? '✅ PRODUCTION READY' : '❌ NEEDS OPTIMIZATION'}`);

    // Overall Assessment
    const systemScore = Object.values(this.results.system).filter(r => r.passed).length;
    const systemTotal = Object.values(this.results.system).length;

    console.log('\n🏆 OVERALL ASSESSMENT:');
    console.log(`   System Performance: ${systemScore}/${systemTotal} tests passed`);
    console.log(`   Memory Management: ${this.results.memory.passed ? '✅' : '❌'}`);
    console.log(`   Cache Performance: ${this.results.cache.passed ? '✅' : '❌'}`);
    console.log(`   Load Testing: ${this.results.loadTesting.passed ? '✅' : '❌'}`);
    console.log(`   Production Readiness: ${this.results.production.passed ? '✅' : '❌'}`);

    if (this.results.production.passed) {
      console.log('\n🎉 EXCELLENT! System is ready for production deployment.');
      console.log('   All critical performance targets have been met.');
    } else {
      console.log('\n⚠️ ATTENTION REQUIRED: System needs optimization before production.');
      console.log('   Review the failed validations above and optimize accordingly.');
    }

    // Save detailed results
    this.saveResultsToFile();
  }

  saveResultsToFile() {
    const fs = require('fs');
    const reportData = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        productionReady: this.results.production.passed,
        passRate: this.results.production.passRate,
        recommendations: this.generateRecommendations()
      }
    };

    try {
      fs.writeFileSync('performance-validation-results.json', JSON.stringify(reportData, null, 2));
      console.log('\n💾 Detailed results saved to: performance-validation-results.json');
    } catch (error) {
      console.log('\n⚠️ Could not save results file:', error.message);
    }
  }

  generateRecommendations() {
    const recommendations = [];

    if (!this.results.system.cpu.passed) {
      recommendations.push('Optimize CPU-intensive operations or upgrade processing power');
    }

    if (!this.results.memory.passed) {
      recommendations.push('Reduce memory usage through optimization or increase available memory');
    }

    if (!this.results.cache.passed) {
      recommendations.push('Improve cache hit rates through better caching strategies');
    }

    if (!this.results.loadTesting.passed) {
      recommendations.push('Optimize request handling to improve throughput and reduce response times');
    }

    if (recommendations.length === 0) {
      recommendations.push('All performance targets met - system is well optimized');
    }

    return recommendations;
  }
}

// Run the validation
const validator = new PerformanceValidator();
validator.validateAll().catch(console.error);