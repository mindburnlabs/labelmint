#!/usr/bin/env node

/**
 * Simple Performance Test Script for LabelMint
 * Tests basic performance metrics without requiring complex infrastructure
 */

import { performance } from 'perf_hooks';

class SimplePerformanceTest {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };
  }

  async runTests() {
    console.log('🚀 Starting Simple Performance Tests...\n');

    try {
      // Test 1: CPU Performance
      await this.testCPUPerformance();

      // Test 2: Memory Performance
      await this.testMemoryPerformance();

      // Test 3: Disk I/O Performance
      await this.testDiskPerformance();

      // Test 4: Network Performance (if available)
      await this.testNetworkPerformance();

      // Generate report
      this.generateReport();

      console.log('\n✅ Simple performance tests completed!');

    } catch (error) {
      console.error('\n❌ Performance tests failed:', error.message);
      process.exit(1);
    }
  }

  async testCPUPerformance() {
    console.log('🔥 Testing CPU performance...');

    const iterations = 1000000;
    const startTime = performance.now();

    // CPU-intensive computation
    let sum = 0;
    for (let i = 0; i < iterations; i++) {
      sum += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const operationsPerSecond = (iterations / duration) * 1000;

    this.results.tests.cpu = {
      iterations,
      duration: duration.toFixed(2),
      operationsPerSecond: operationsPerSecond.toFixed(0),
      sum: sum.toFixed(2)
    };

    console.log(`  ✅ CPU Test: ${operationsPerSecond.toFixed(0)} ops/sec, ${duration.toFixed(2)}ms`);
  }

  async testMemoryPerformance() {
    console.log('💾 Testing memory performance...');

    const iterations = 100000;
    const arrays = [];

    const startTime = performance.now();

    // Memory allocation and access test
    for (let i = 0; i < iterations; i++) {
      const arr = new Array(100).fill(0).map((_, idx) => Math.random() * idx);
      arrays.push(arr);

      // Access memory
      let sum = 0;
      for (let j = 0; j < arr.length; j++) {
        sum += arr[j];
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Get memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;

    this.results.tests.memory = {
      iterations,
      duration: duration.toFixed(2),
      arraysCreated: arrays.length,
      heapUsedMB: heapUsedMB.toFixed(2),
      heapTotalMB: heapTotalMB.toFixed(2),
      externalMB: (memUsage.external / 1024 / 1024).toFixed(2)
    };

    console.log(`  ✅ Memory Test: ${duration.toFixed(2)}ms, ${heapUsedMB.toFixed(2)}MB heap used`);
  }

  async testDiskPerformance() {
    console.log('💿 Testing disk I/O performance...');

    const fs = await import('fs');
    const path = await import('path');

    const testData = 'x'.repeat(1024 * 1024); // 1MB of data
    const testFile = path.join(process.cwd(), 'temp-perf-test.txt');

    try {
      // Write test
      const writeStartTime = performance.now();
      await fs.promises.writeFile(testFile, testData);
      const writeEndTime = performance.now();
      const writeDuration = writeEndTime - writeStartTime;

      // Read test
      const readStartTime = performance.now();
      const readData = await fs.promises.readFile(testFile, 'utf8');
      const readEndTime = performance.now();
      const readDuration = readEndTime - readStartTime;

      // Cleanup
      await fs.promises.unlink(testFile);

      const writeSpeedMBps = (1 / (writeDuration / 1000));
      const readSpeedMBps = (1 / (readDuration / 1000));

      this.results.tests.disk = {
        dataSizeMB: 1,
        writeDuration: writeDuration.toFixed(2),
        readDuration: readDuration.toFixed(2),
        writeSpeedMBps: writeSpeedMBps.toFixed(2),
        readSpeedMBps: readSpeedMBps.toFixed(2),
        dataVerified: readData.length === testData.length
      };

      console.log(`  ✅ Disk Test: Write ${writeSpeedMBps.toFixed(2)}MB/s, Read ${readSpeedMBps.toFixed(2)}MB/s`);

    } catch (error) {
      console.log(`  ⚠️  Disk test skipped: ${error.message}`);
      this.results.tests.disk = { error: error.message };
    }
  }

  async testNetworkPerformance() {
    console.log('🌐 Testing network performance...');

    const endpoints = [
      'http://localhost:3001/health',
      'http://localhost:3000',
      'https://httpbin.org/get' // External test
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        const measurements = [];

        for (let i = 0; i < 5; i++) {
          const startTime = performance.now();
          try {
            const response = await fetch(endpoint);
            const endTime = performance.now();
            measurements.push({
              responseTime: endTime - startTime,
              status: response.status,
              success: response.ok
            });
          } catch (error) {
            const endTime = performance.now();
            measurements.push({
              responseTime: endTime - startTime,
              status: 0,
              success: false,
              error: error.message
            });
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const successfulMeasurements = measurements.filter(m => m.success);
        const avgResponseTime = successfulMeasurements.length > 0
          ? successfulMeasurements.reduce((sum, m) => sum + m.responseTime, 0) / successfulMeasurements.length
          : 0;

        results.push({
          endpoint,
          totalRequests: measurements.length,
          successfulRequests: successfulMeasurements.length,
          avgResponseTime: avgResponseTime.toFixed(2),
          successRate: ((successfulMeasurements.length / measurements.length) * 100).toFixed(1)
        });

        console.log(`  ✅ ${endpoint}: ${avgResponseTime.toFixed(2)}ms avg, ${((successfulMeasurements.length / measurements.length) * 100).toFixed(1)}% success`);

      } catch (error) {
        console.log(`  ❌ ${endpoint}: ${error.message}`);
        results.push({
          endpoint,
          error: error.message
        });
      }
    }

    this.results.tests.network = results;
  }

  generateReport() {
    console.log('\n📊 Performance Test Results:');
    console.log('='.repeat(50));

    // CPU Results
    if (this.results.tests.cpu) {
      console.log(`\n🔥 CPU Performance:`);
      console.log(`   Operations/sec: ${this.results.tests.cpu.operationsPerSecond}`);
      console.log(`   Duration: ${this.results.tests.cpu.duration}ms`);
      console.log(`   Iterations: ${this.results.tests.cpu.iterations.toLocaleString()}`);
    }

    // Memory Results
    if (this.results.tests.memory) {
      console.log(`\n💾 Memory Performance:`);
      console.log(`   Heap Used: ${this.results.tests.memory.heapUsedMB}MB`);
      console.log(`   Heap Total: ${this.results.tests.memory.heapTotalMB}MB`);
      console.log(`   External: ${this.results.tests.memory.externalMB}MB`);
      console.log(`   Arrays Created: ${this.results.tests.memory.arraysCreated.toLocaleString()}`);
    }

    // Disk Results
    if (this.results.tests.disk && !this.results.tests.disk.error) {
      console.log(`\n💿 Disk I/O Performance:`);
      console.log(`   Write Speed: ${this.results.tests.disk.writeSpeedMBps}MB/s`);
      console.log(`   Read Speed: ${this.results.tests.disk.readSpeedMBps}MB/s`);
      console.log(`   Write Time: ${this.results.tests.disk.writeDuration}ms`);
      console.log(`   Read Time: ${this.results.tests.disk.readDuration}ms`);
    }

    // Network Results
    if (this.results.tests.network) {
      console.log(`\n🌐 Network Performance:`);
      this.results.tests.network.forEach(result => {
        if (result.error) {
          console.log(`   ${result.endpoint}: ERROR - ${result.error}`);
        } else {
          console.log(`   ${result.endpoint}: ${result.avgResponseTime}ms avg, ${result.successRate}% success`);
        }
      });
    }

    // Performance Assessment
    console.log(`\n🎯 Performance Assessment:`);
    this.assessPerformance();

    // Save detailed results
    this.saveResults();
  }

  assessPerformance() {
    const cpu = this.results.tests.cpu;
    const memory = this.results.tests.memory;
    const disk = this.results.tests.disk;

    let score = 0;
    let maxScore = 0;

    // CPU Scoring
    if (cpu) {
      const opsPerSec = parseFloat(cpu.operationsPerSecond);
      if (opsPerSec > 1000000) {
        console.log(`   ✅ CPU: Excellent (${opsPerSec.toLocaleString()} ops/sec)`);
        score += 3;
      } else if (opsPerSec > 500000) {
        console.log(`   ✅ CPU: Good (${opsPerSec.toLocaleString()} ops/sec)`);
        score += 2;
      } else if (opsPerSec > 100000) {
        console.log(`   ⚠️  CPU: Fair (${opsPerSec.toLocaleString()} ops/sec)`);
        score += 1;
      } else {
        console.log(`   ❌ CPU: Poor (${opsPerSec.toLocaleString()} ops/sec)`);
      }
      maxScore += 3;
    }

    // Memory Scoring
    if (memory) {
      const heapUsed = parseFloat(memory.heapUsedMB);
      if (heapUsed < 100) {
        console.log(`   ✅ Memory: Excellent (${heapUsed}MB used)`);
        score += 3;
      } else if (heapUsed < 200) {
        console.log(`   ✅ Memory: Good (${heapUsed}MB used)`);
        score += 2;
      } else if (heapUsed < 500) {
        console.log(`   ⚠️  Memory: Fair (${heapUsed}MB used)`);
        score += 1;
      } else {
        console.log(`   ❌ Memory: Poor (${heapUsed}MB used)`);
      }
      maxScore += 3;
    }

    // Disk Scoring
    if (disk && !disk.error) {
      const writeSpeed = parseFloat(disk.writeSpeedMBps);
      if (writeSpeed > 100) {
        console.log(`   ✅ Disk: Excellent (${writeSpeed}MB/s write)`);
        score += 2;
      } else if (writeSpeed > 50) {
        console.log(`   ✅ Disk: Good (${writeSpeed}MB/s write)`);
        score += 1;
      } else {
        console.log(`   ⚠️  Disk: Fair (${writeSpeed}MB/s write)`);
      }
      maxScore += 2;
    }

    const finalScore = maxScore > 0 ? (score / maxScore) * 100 : 0;
    console.log(`\n📈 Overall Performance Score: ${finalScore.toFixed(0)}%`);

    if (finalScore >= 80) {
      console.log(`   🏆 Excellent performance! Ready for production.`);
    } else if (finalScore >= 60) {
      console.log(`   ✅ Good performance. Minor optimizations recommended.`);
    } else if (finalScore >= 40) {
      console.log(`   ⚠️  Fair performance. Optimizations needed.`);
    } else {
      console.log(`   ❌ Poor performance. Significant optimizations required.`);
    }
  }

  saveResults() {
    const fs = require('fs');
    const reportPath = './performance-test-results.json';

    try {
      fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`\n💾 Detailed results saved to: ${reportPath}`);
    } catch (error) {
      console.log(`\n⚠️  Could not save results: ${error.message}`);
    }
  }
}

// Run the test
const test = new SimplePerformanceTest();
test.runTests().catch(console.error);