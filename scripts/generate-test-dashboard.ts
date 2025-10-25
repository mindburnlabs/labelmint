#!/usr/bin/env node

/**
 * Test Dashboard Generator
 * Generates comprehensive testing metrics and quality dashboard
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

interface TestMetrics {
  unitTests: {
    total: number;
    passed: number;
    failed: number;
    coverage: {
      lines: number;
      functions: number;
      branches: number;
      statements: number;
    };
  };
  integrationTests: {
    total: number;
    passed: number;
    failed: number;
  };
  e2eTests: {
    total: number;
    passed: number;
    failed: number;
  };
  securityTests: {
    vulnerabilities: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  performanceTests: {
    averageResponseTime: number;
    p95ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  codeQuality: {
    eslintErrors: number;
    eslintWarnings: number;
    typeErrors: number;
    duplicateLines: number;
    maintainabilityIndex: number;
  };
}

class TestDashboardGenerator {
  private readonly outputPath: string;
  private readonly metrics: TestMetrics;

  constructor(outputPath: string = './test-dashboard') {
    this.outputPath = outputPath;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): TestMetrics {
    return {
      unitTests: {
        total: 0,
        passed: 0,
        failed: 0,
        coverage: {
          lines: 0,
          functions: 0,
          branches: 0,
          statements: 0
        }
      },
      integrationTests: {
        total: 0,
        passed: 0,
        failed: 0
      },
      e2eTests: {
        total: 0,
        passed: 0,
        failed: 0
      },
      securityTests: {
        vulnerabilities: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        }
      },
      performanceTests: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0
      },
      codeQuality: {
        eslintErrors: 0,
        eslintWarnings: 0,
        typeErrors: 0,
        duplicateLines: 0,
        maintainabilityIndex: 0
      }
    };
  }

  public async generateDashboard(): Promise<void> {
    console.log('🚀 Generating Test Dashboard...');

    // Ensure output directory exists
    if (!existsSync(this.outputPath)) {
      mkdirSync(this.outputPath, { recursive: true });
    }

    // Collect all metrics
    await this.collectUnitTestMetrics();
    await this.collectIntegrationTestMetrics();
    await this.collectE2ETestMetrics();
    await this.collectSecurityTestMetrics();
    await this.collectPerformanceTestMetrics();
    await this.collectCodeQualityMetrics();

    // Generate reports
    this.generateHTMLDashboard();
    this.generateJSONReport();
    this.generateMarkdownReport();

    console.log('✅ Test Dashboard Generated Successfully!');
    console.log(`📊 View the dashboard at: ${join(this.outputPath, 'index.html')}`);
  }

  private async collectUnitTestMetrics(): Promise<void> {
    console.log('📋 Collecting Unit Test Metrics...');

    try {
      // Read coverage summary
      if (existsSync('coverage/coverage-summary.json')) {
        const coverageData = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
        const total = coverageData.total;

        this.metrics.unitTests.coverage = {
          lines: parseFloat(total.lines.pct.toFixed(1)),
          functions: parseFloat(total.functions.pct.toFixed(1)),
          branches: parseFloat(total.branches.pct.toFixed(1)),
          statements: parseFloat(total.statements.pct.toFixed(1))
        };
      }

      // Read test results
      if (existsSync('test-results/unit-results.json')) {
        const testData = JSON.parse(readFileSync('test-results/unit-results.json', 'utf8'));
        this.metrics.unitTests.total = testData.numTotalTests || 0;
        this.metrics.unitTests.passed = testData.numPassedTests || 0;
        this.metrics.unitTests.failed = testData.numFailedTests || 0;
      }

      // Run tests to get fresh metrics if needed
      if (this.metrics.unitTests.total === 0) {
        try {
          execSync('pnpm run test:unit --reporter=json --outputFile=test-results/unit-results.json', { stdio: 'pipe' });
          const testData = JSON.parse(readFileSync('test-results/unit-results.json', 'utf8'));
          this.metrics.unitTests.total = testData.numTotalTests || 0;
          this.metrics.unitTests.passed = testData.numPassedTests || 0;
          this.metrics.unitTests.failed = testData.numFailedTests || 0;
        } catch (error) {
          console.warn('⚠️ Could not run unit tests for metrics collection');
        }
      }
    } catch (error) {
      console.warn('⚠️ Error collecting unit test metrics:', error);
    }
  }

  private async collectIntegrationTestMetrics(): Promise<void> {
    console.log('🔗 Collecting Integration Test Metrics...');

    try {
      if (existsSync('test-results/integration-results.json')) {
        const testData = JSON.parse(readFileSync('test-results/integration-results.json', 'utf8'));
        this.metrics.integrationTests.total = testData.numTotalTests || 0;
        this.metrics.integrationTests.passed = testData.numPassedTests || 0;
        this.metrics.integrationTests.failed = testData.numFailedTests || 0;
      }
    } catch (error) {
      console.warn('⚠️ Error collecting integration test metrics:', error);
    }
  }

  private async collectE2ETestMetrics(): Promise<void> {
    console.log('🎭 Collecting E2E Test Metrics...');

    try {
      if (existsSync('playwright-report/results.json')) {
        const testData = JSON.parse(readFileSync('playwright-report/results.json', 'utf8'));
        this.metrics.e2eTests.total = testData.suites?.reduce((acc: number, suite: any) =>
          acc + (suite.specs?.length || 0), 0) || 0;

        const passed = testData.suites?.reduce((acc: number, suite: any) =>
          acc + (suite.specs?.filter((spec: any) => spec.ok)?.length || 0), 0) || 0;

        this.metrics.e2eTests.passed = passed;
        this.metrics.e2eTests.failed = this.metrics.e2eTests.total - passed;
      }
    } catch (error) {
      console.warn('⚠️ Error collecting E2E test metrics:', error);
    }
  }

  private async collectSecurityTestMetrics(): Promise<void> {
    console.log('🔒 Collecting Security Test Metrics...');

    try {
      if (existsSync('security-reports/security-scan.json')) {
        const securityData = JSON.parse(readFileSync('security-reports/security-scan.json', 'utf8'));
        this.metrics.securityTests.vulnerabilities = {
          critical: securityData.critical || 0,
          high: securityData.high || 0,
          medium: securityData.medium || 0,
          low: securityData.low || 0
        };
      }

      // Check for ESLint security rules
      if (existsSync('eslint-report.json')) {
        const eslintData = JSON.parse(readFileSync('eslint-report.json', 'utf8'));
        const securityIssues = eslintData.filter((issue: any) =>
          issue.ruleId && issue.ruleId.includes('security'));

        this.metrics.securityTests.vulnerabilities.medium += securityIssues.length;
      }
    } catch (error) {
      console.warn('⚠️ Error collecting security test metrics:', error);
    }
  }

  private async collectPerformanceTestMetrics(): Promise<void> {
    console.log('⚡ Collecting Performance Test Metrics...');

    try {
      if (existsSync('performance-reports/load-test-results.json')) {
        const perfData = JSON.parse(readFileSync('performance-reports/load-test-results.json', 'utf8'));
        this.metrics.performanceTests = {
          averageResponseTime: perfData.averageResponseTime || 0,
          p95ResponseTime: perfData.p95ResponseTime || 0,
          requestsPerSecond: perfData.requestsPerSecond || 0,
          errorRate: perfData.errorRate || 0
        };
      }
    } catch (error) {
      console.warn('⚠️ Error collecting performance test metrics:', error);
    }
  }

  private async collectCodeQualityMetrics(): Promise<void> {
    console.log('📏 Collecting Code Quality Metrics...');

    try {
      // ESLint metrics
      if (existsSync('eslint-report.json')) {
        const eslintData = JSON.parse(readFileSync('eslint-report.json', 'utf8'));
        this.metrics.codeQuality.eslintErrors = eslintData.filter((issue: any) => issue.severity === 2).length;
        this.metrics.codeQuality.eslintWarnings = eslintData.filter((issue: any) => issue.severity === 1).length;
      }

      // TypeScript metrics
      try {
        execSync('pnpm run type-check --noEmit', { stdio: 'pipe' });
      } catch (error: any) {
        const typeErrors = error.stdout?.toString().match(/Found \d+ errors/) || ['Found 0 errors'];
        this.metrics.codeQuality.typeErrors = parseInt(typeErrors[0].match(/\d+/)?.[0] || '0');
      }
    } catch (error) {
      console.warn('⚠️ Error collecting code quality metrics:', error);
    }
  }

  private generateHTMLDashboard(): void {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LabelMint Test Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .metric-card {
            @apply bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow;
        }
        .status-pass { @apply text-green-600 bg-green-50; }
        .status-fail { @apply text-red-600 bg-red-50; }
        .status-warning { @apply text-yellow-600 bg-yellow-50; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="container mx-auto px-4 py-8">
        <header class="mb-8">
            <h1 class="text-4xl font-bold text-gray-800 mb-2">LabelMint Test Dashboard</h1>
            <p class="text-gray-600">Comprehensive testing metrics and quality assurance</p>
            <p class="text-sm text-gray-500">Last updated: ${new Date().toLocaleString()}</p>
        </header>

        <!-- Overview Cards -->
        <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Unit Tests</h3>
                <div class="text-3xl font-bold ${this.getStatusClass(this.metrics.unitTests.coverage.lines)}">
                    ${this.metrics.unitTests.coverage.lines}%
                </div>
                <p class="text-sm text-gray-600">Coverage (${this.metrics.unitTests.passed}/${this.metrics.unitTests.total} passed)</p>
            </div>

            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Integration Tests</h3>
                <div class="text-3xl font-bold ${this.getStatusClass(this.metrics.integrationTests.total > 0 ? 100 : 0)}">
                    ${this.metrics.integrationTests.total}
                </div>
                <p class="text-sm text-gray-600">Tests (${this.metrics.integrationTests.passed} passed)</p>
            </div>

            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">E2E Tests</h3>
                <div class="text-3xl font-bold ${this.getStatusClass(this.metrics.e2eTests.total > 0 ? 100 : 0)}">
                    ${this.metrics.e2eTests.total}
                </div>
                <p class="text-sm text-gray-600">Tests (${this.metrics.e2eTests.passed} passed)</p>
            </div>

            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Security Issues</h3>
                <div class="text-3xl font-bold ${this.getSecurityStatusClass()}">
                    ${this.getTotalSecurityIssues()}
                </div>
                <p class="text-sm text-gray-600">Total vulnerabilities</p>
            </div>
        </section>

        <!-- Coverage Charts -->
        <section class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">Test Coverage</h3>
                <canvas id="coverageChart" width="400" height="300"></canvas>
            </div>

            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">Test Results Distribution</h3>
                <canvas id="testResultsChart" width="400" height="300"></canvas>
            </div>
        </section>

        <!-- Performance Metrics -->
        <section class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Avg Response Time</h3>
                <div class="text-2xl font-bold text-blue-600">
                    ${this.metrics.performanceTests.averageResponseTime}ms
                </div>
                <p class="text-sm text-gray-600">Performance target: < 1000ms</p>
            </div>

            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">P95 Response Time</h3>
                <div class="text-2xl font-bold text-blue-600">
                    ${this.metrics.performanceTests.p95ResponseTime}ms
                </div>
                <p class="text-sm text-gray-600">Performance target: < 2000ms</p>
            </div>

            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Requests/Second</h3>
                <div class="text-2xl font-bold text-green-600">
                    ${this.metrics.performanceTests.requestsPerSecond.toFixed(1)}
                </div>
                <p class="text-sm text-gray-600">Throughput metric</p>
            </div>

            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Error Rate</h3>
                <div class="text-2xl font-bold ${this.getErrorRateClass()}">
                    ${(this.metrics.performanceTests.errorRate * 100).toFixed(2)}%
                </div>
                <p class="text-sm text-gray-600">Target: < 5%</p>
            </div>
        </section>

        <!-- Code Quality -->
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">Code Quality</h3>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-gray-600">ESLint Errors:</span>
                        <span class="font-semibold ${this.metrics.codeQuality.eslintErrors > 0 ? 'text-red-600' : 'text-green-600'}">
                            ${this.metrics.codeQuality.eslintErrors}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">ESLint Warnings:</span>
                        <span class="font-semibold ${this.metrics.codeQuality.eslintWarnings > 0 ? 'text-yellow-600' : 'text-green-600'}">
                            ${this.metrics.codeQuality.eslintWarnings}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">TypeScript Errors:</span>
                        <span class="font-semibold ${this.metrics.codeQuality.typeErrors > 0 ? 'text-red-600' : 'text-green-600'}">
                            ${this.metrics.codeQuality.typeErrors}
                        </span>
                    </div>
                </div>
            </div>

            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">Security Vulnerabilities</h3>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Critical:</span>
                        <span class="font-semibold ${this.metrics.securityTests.vulnerabilities.critical > 0 ? 'text-red-600' : 'text-green-600'}">
                            ${this.metrics.securityTests.vulnerabilities.critical}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">High:</span>
                        <span class="font-semibold ${this.metrics.securityTests.vulnerabilities.high > 0 ? 'text-red-600' : 'text-green-600'}">
                            ${this.metrics.securityTests.vulnerabilities.high}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Medium:</span>
                        <span class="font-semibold ${this.metrics.securityTests.vulnerabilities.medium > 0 ? 'text-yellow-600' : 'text-green-600'}">
                            ${this.metrics.securityTests.vulnerabilities.medium}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Low:</span>
                        <span class="font-semibold text-blue-600">
                            ${this.metrics.securityTests.vulnerabilities.low}
                        </span>
                    </div>
                </div>
            </div>

            <div class="metric-card">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">Quality Gates Status</h3>
                <div class="space-y-2">
                    ${this.generateQualityGatesHTML()}
                </div>
            </div>
        </section>

        <!-- Test Execution Timeline -->
        <section class="metric-card mb-8">
            <h3 class="text-lg font-semibold text-gray-700 mb-4">Recent Test Executions</h3>
            <div id="timelineChart" style="height: 200px;">
                <div class="flex items-center justify-center h-full text-gray-500">
                    <p>Timeline chart would be implemented with real test execution data</p>
                </div>
            </div>
        </section>
    </div>

    <script>
        // Coverage Chart
        const coverageCtx = document.getElementById('coverageChart').getContext('2d');
        new Chart(coverageCtx, {
            type: 'bar',
            data: {
                labels: ['Lines', 'Functions', 'Branches', 'Statements'],
                datasets: [{
                    label: 'Coverage %',
                    data: [
                        ${this.metrics.unitTests.coverage.lines},
                        ${this.metrics.unitTests.coverage.functions},
                        ${this.metrics.unitTests.coverage.branches},
                        ${this.metrics.unitTests.coverage.statements}
                    ],
                    backgroundColor: [
                        ${this.metrics.unitTests.coverage.lines >= 80 ? "'#10b981'" : "'#ef4444'"},
                        ${this.metrics.unitTests.coverage.functions >= 80 ? "'#10b981'" : "'#ef4444'"},
                        ${this.metrics.unitTests.coverage.branches >= 75 ? "'#10b981'" : "'#ef4444'"},
                        ${this.metrics.unitTests.coverage.statements >= 80 ? "'#10b981'" : "'#ef4444'"}
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        // Test Results Chart
        const testResultsCtx = document.getElementById('testResultsChart').getContext('2d');
        new Chart(testResultsCtx, {
            type: 'doughnut',
            data: {
                labels: ['Unit Tests Passed', 'Unit Tests Failed', 'Integration Tests', 'E2E Tests'],
                datasets: [{
                    data: [
                    ${this.metrics.unitTests.passed},
                    ${this.metrics.unitTests.failed},
                    ${this.metrics.integrationTests.total},
                    ${this.metrics.e2eTests.total}
                ],
                backgroundColor: ['#10b981', '#ef4444', '#3b82f6', '#8b5cf6']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    </script>
</body>
</html>`;

    writeFileSync(join(this.outputPath, 'index.html'), html);
  }

  private generateJSONReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      summary: {
        totalTests: this.metrics.unitTests.total + this.metrics.integrationTests.total + this.metrics.e2eTests.total,
        passedTests: this.metrics.unitTests.passed + this.metrics.integrationTests.passed + this.metrics.e2eTests.passed,
        failedTests: this.metrics.unitTests.failed + this.metrics.integrationTests.failed + this.metrics.e2eTests.failed,
        overallCoverage: this.metrics.unitTests.coverage.lines,
        securityIssues: this.getTotalSecurityIssues(),
        qualityScore: this.calculateQualityScore()
      }
    };

    writeFileSync(join(this.outputPath, 'metrics.json'), JSON.stringify(report, null, 2));
  }

  private generateMarkdownReport(): void {
    const markdown = `# LabelMint Test Report

Generated on: ${new Date().toLocaleString()}

## 📊 Test Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total Tests | ${this.metrics.unitTests.total + this.metrics.integrationTests.total + this.metrics.e2eTests.total} | ${this.getTotalTests() > 0 ? '✅' : '❌'} |
| Passed Tests | ${this.metrics.unitTests.passed + this.metrics.integrationTests.passed + this.metrics.e2eTests.passed} | ✅ |
| Failed Tests | ${this.metrics.unitTests.failed + this.metrics.integrationTests.failed + this.metrics.e2eTests.failed} | ${this.getTotalFailedTests() > 0 ? '❌' : '✅'} |
| Overall Coverage | ${this.metrics.unitTests.coverage.lines}% | ${this.metrics.unitTests.coverage.lines >= 80 ? '✅' : '❌'} |
| Security Issues | ${this.getTotalSecurityIssues()} | ${this.getTotalSecurityIssues() === 0 ? '✅' : '❌'} |

## 🧪 Unit Tests

- **Total**: ${this.metrics.unitTests.total}
- **Passed**: ${this.metrics.unitTests.passed}
- **Failed**: ${this.metrics.unitTests.failed}
- **Coverage**:
  - Lines: ${this.metrics.unitTests.coverage.lines}%
  - Functions: ${this.metrics.unitTests.coverage.functions}%
  - Branches: ${this.metrics.unitTests.coverage.branches}%
  - Statements: ${this.metrics.unitTests.coverage.statements}%

## 🔗 Integration Tests

- **Total**: ${this.metrics.integrationTests.total}
- **Passed**: ${this.metrics.integrationTests.passed}
- **Failed**: ${this.metrics.integrationTests.failed}

## 🎭 E2E Tests

- **Total**: ${this.metrics.e2eTests.total}
- **Passed**: ${this.metrics.e2eTests.passed}
- **Failed**: ${this.metrics.e2eTests.failed}

## 🔒 Security Vulnerabilities

- **Critical**: ${this.metrics.securityTests.vulnerabilities.critical}
- **High**: ${this.metrics.securityTests.vulnerabilities.high}
- **Medium**: ${this.metrics.securityTests.vulnerabilities.medium}
- **Low**: ${this.metrics.securityTests.vulnerabilities.low}

## ⚡ Performance Metrics

- **Average Response Time**: ${this.metrics.performanceTests.averageResponseTime}ms
- **P95 Response Time**: ${this.metrics.performanceTests.p95ResponseTime}ms
- **Requests/Second**: ${this.metrics.performanceTests.requestsPerSecond}
- **Error Rate**: ${(this.metrics.performanceTests.errorRate * 100).toFixed(2)}%

## 📏 Code Quality

- **ESLint Errors**: ${this.metrics.codeQuality.eslintErrors}
- **ESLint Warnings**: ${this.metrics.codeQuality.eslintWarnings}
- **TypeScript Errors**: ${this.metrics.codeQuality.typeErrors}

## 🎯 Quality Gates

${this.generateQualityGatesMarkdown()}

## 📈 Quality Score: ${this.calculateQualityScore()}/100

---

*This report was automatically generated by the LabelMint Test Dashboard Generator*`;

    writeFileSync(join(this.outputPath, 'report.md'), markdown);
  }

  private getStatusClass(value: number): string {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  private getSecurityStatusClass(): string {
    const total = this.getTotalSecurityIssues();
    if (total === 0) return 'text-green-600';
    if (total <= 5) return 'text-yellow-600';
    return 'text-red-600';
  }

  private getErrorRateClass(): string {
    const rate = this.metrics.performanceTests.errorRate * 100;
    if (rate <= 1) return 'text-green-600';
    if (rate <= 5) return 'text-yellow-600';
    return 'text-red-600';
  }

  private getTotalSecurityIssues(): number {
    return Object.values(this.metrics.securityTests.vulnerabilities).reduce((a, b) => a + b, 0);
  }

  private getTotalTests(): number {
    return this.metrics.unitTests.total + this.metrics.integrationTests.total + this.metrics.e2eTests.total;
  }

  private getTotalFailedTests(): number {
    return this.metrics.unitTests.failed + this.metrics.integrationTests.failed + this.metrics.e2eTests.failed;
  }

  private calculateQualityScore(): number {
    let score = 0;
    let maxScore = 0;

    // Test coverage (30% of score)
    maxScore += 30;
    score += Math.min(30, (this.metrics.unitTests.coverage.lines / 100) * 30);

    // Test success rate (25% of score)
    maxScore += 25;
    const totalTests = this.getTotalTests();
    if (totalTests > 0) {
      const passedTests = this.metrics.unitTests.passed + this.metrics.integrationTests.passed + this.metrics.e2eTests.passed;
      score += (passedTests / totalTests) * 25;
    }

    // Security (20% of score)
    maxScore += 20;
    const securityIssues = this.getTotalSecurityIssues();
    if (securityIssues === 0) {
      score += 20;
    } else if (securityIssues <= 3) {
      score += 15;
    } else if (securityIssues <= 10) {
      score += 10;
    }

    // Performance (15% of score)
    maxScore += 15;
    if (this.metrics.performanceTests.averageResponseTime > 0) {
      if (this.metrics.performanceTests.averageResponseTime <= 500) {
        score += 15;
      } else if (this.metrics.performanceTests.averageResponseTime <= 1000) {
        score += 12;
      } else if (this.metrics.performanceTests.averageResponseTime <= 2000) {
        score += 8;
      }
    }

    // Code quality (10% of score)
    maxScore += 10;
    const qualityIssues = this.metrics.codeQuality.eslintErrors + this.metrics.codeQuality.typeErrors;
    if (qualityIssues === 0) {
      score += 10;
    } else if (qualityIssues <= 5) {
      score += 8;
    } else if (qualityIssues <= 15) {
      score += 5;
    }

    return Math.round((score / maxScore) * 100);
  }

  private generateQualityGatesHTML(): string {
    const gates = [
      {
        name: 'Unit Test Coverage ≥ 80%',
        status: this.metrics.unitTests.coverage.lines >= 80,
        value: `${this.metrics.unitTests.coverage.lines}%`
      },
      {
        name: 'No Critical Security Issues',
        status: this.metrics.securityTests.vulnerabilities.critical === 0,
        value: `${this.metrics.securityTests.vulnerabilities.critical} critical`
      },
      {
        name: 'Performance < 1s avg response',
        status: this.metrics.performanceTests.averageResponseTime <= 1000 || this.metrics.performanceTests.averageResponseTime === 0,
        value: `${this.metrics.performanceTests.averageResponseTime}ms`
      },
      {
        name: 'Zero TypeScript Errors',
        status: this.metrics.codeQuality.typeErrors === 0,
        value: `${this.metrics.codeQuality.typeErrors} errors`
      }
    ];

    return gates.map(gate => `
      <div class="flex justify-between items-center">
        <span class="text-gray-600">${gate.name}:</span>
        <span class="font-semibold ${gate.status ? 'text-green-600' : 'text-red-600'}">
          ${gate.status ? '✅' : '❌'} ${gate.value}
        </span>
      </div>
    `).join('');
  }

  private generateQualityGatesMarkdown(): string {
    const gates = [
      {
        name: 'Unit Test Coverage ≥ 80%',
        status: this.metrics.unitTests.coverage.lines >= 80,
        value: `${this.metrics.unitTests.coverage.lines}%`
      },
      {
        name: 'No Critical Security Issues',
        status: this.metrics.securityTests.vulnerabilities.critical === 0,
        value: `${this.metrics.securityTests.vulnerabilities.critical} critical`
      },
      {
        name: 'Performance < 1s avg response',
        status: this.metrics.performanceTests.averageResponseTime <= 1000 || this.metrics.performanceTests.averageResponseTime === 0,
        value: `${this.metrics.performanceTests.averageResponseTime}ms`
      },
      {
        name: 'Zero TypeScript Errors',
        status: this.metrics.codeQuality.typeErrors === 0,
        value: `${this.metrics.codeQuality.typeErrors} errors`
      }
    ];

    return gates.map(gate =>
      `- **${gate.name}**: ${gate.status ? '✅' : '❌'} ${gate.value}`
    ).join('\n');
  }
}

// Main execution
async function main() {
  const generator = new TestDashboardGenerator();
  await generator.generateDashboard();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TestDashboardGenerator };