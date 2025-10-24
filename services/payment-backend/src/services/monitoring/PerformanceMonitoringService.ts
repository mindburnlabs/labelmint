/**
 * Performance Monitoring Service
 * Real-time performance metrics collection and analysis
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { collectDefaultMetrics, Counter, Histogram, Gauge, Registry } from 'prom-client';
import { Logger } from '../utils/logger';

export interface PerformanceMetrics {
  requestLatency: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestRate: number;
  errorRate: number;
  cacheHitRate: number;
  dbQueryTime: number;
  throughput: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}

export interface AlertThreshold {
  metric: keyof PerformanceMetrics;
  operator: '>' | '<' | '==' | '>=';
  value: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceAlert {
  id: string;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
  timestamp: Date;
}

export class PerformanceMonitoringService extends EventEmitter {
  private logger: Logger;
  private metrics: Map<string, any> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private requestTimes: number[] = [];
  private activeRequests: Set<string> = new Set();
  private thresholds: AlertThreshold[] = [];
  private registry: Registry;
  private perfObserver: PerformanceObserver;
  private metricsCollectionInterval: NodeJS.Timeout;
  private alertCheckInterval: NodeJS.Timeout;

  // Prometheus metrics
  private httpRequestDuration: Histogram<string>;
  private httpRequestTotal: Counter<string>;
  private activeConnectionsGauge: Gauge<string>;
  private memoryUsageGauge: Gauge<string>;
  private cpuUsageGauge: Gauge<string>;
  private cacheHitRateGauge: Gauge<string>;
  private dbQueryDuration: Histogram<string>;

  constructor() {
    super();
    this.logger = new Logger('PerformanceMonitoring');
    this.registry = new Registry();

    // Initialize Prometheus metrics
    this.initializePrometheusMetrics();

    // Setup performance observer
    this.setupPerformanceObserver();

    // Start metrics collection
    this.startMetricsCollection();

    // Setup default thresholds
    this.setupDefaultThresholds();

    // Collect default Node.js metrics
    collectDefaultMetrics({ register: this.registry });
  }

  private initializePrometheusMetrics(): void {
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry]
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
      registers: [this.registry]
    });

    this.activeConnectionsGauge = new Gauge({
      name: 'active_connections_total',
      help: 'Number of active connections',
      registers: [this.registry]
    });

    this.memoryUsageGauge = new Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry]
    });

    this.cpuUsageGauge = new Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.registry]
    });

    this.cacheHitRateGauge = new Gauge({
      name: 'cache_hit_rate_percent',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
      registers: [this.registry]
    });

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });
  }

  private setupPerformanceObserver(): void {
    this.perfObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      for (const entry of entries) {
        if (entry.entryType === 'function') {
          this.logger.debug(`Function performance: ${entry.name} - ${entry.duration}ms`);
        } else if (entry.entryType === 'measure') {
          this.recordCustomMetric(entry.name, entry.duration);
        }
      }
    });

    this.perfObserver.observe({ entryTypes: ['function', 'measure'] });
  }

  private startMetricsCollection(): void {
    // Collect system metrics every 5 seconds
    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectSystemMetrics();
    }, 5000);

    // Check alerts every 10 seconds
    this.alertCheckInterval = setInterval(() => {
      this.checkThresholds();
    }, 10000);
  }

  private setupDefaultThresholds(): void {
    this.thresholds = [
      { metric: 'requestLatency', operator: '>', value: 2000, duration: 60, severity: 'high' },
      { metric: 'cpuUsage', operator: '>', value: 80, duration: 300, severity: 'medium' },
      { metric: 'memoryUsage', operator: '>', value: 85, duration: 300, severity: 'high' },
      { metric: 'errorRate', operator: '>', value: 5, duration: 60, severity: 'critical' },
      { metric: 'cacheHitRate', operator: '<', value: 70, duration: 600, severity: 'medium' },
      { metric: 'activeConnections', operator: '>', value: 1000, duration: 30, severity: 'high' }
    ];
  }

  /**
   * Record HTTP request metrics
   */
  recordRequest(metrics: RequestMetrics): void {
    const requestId = `${metrics.timestamp.getTime()}-${Math.random()}`;
    this.activeRequests.add(requestId);

    // Record Prometheus metrics
    this.httpRequestDuration
      .labels(metrics.method, metrics.path, metrics.statusCode.toString())
      .observe(metrics.duration / 1000);

    this.httpRequestTotal
      .labels(metrics.method, metrics.path, metrics.statusCode.toString())
      .inc();

    // Update request times for percentile calculations
    this.requestTimes.push(metrics.duration);

    // Keep only last 10000 requests
    if (this.requestTimes.length > 10000) {
      this.requestTimes = this.requestTimes.slice(-10000);
    }

    // Remove from active requests
    setTimeout(() => {
      this.activeRequests.delete(requestId);
    }, 0);

    // Emit event for real-time monitoring
    this.emit('request', metrics);

    // Log slow requests
    if (metrics.duration > 1000) {
      this.logger.warn(`Slow request detected: ${metrics.method} ${metrics.path} - ${metrics.duration}ms`);
    }
  }

  /**
   * Record database query performance
   */
  recordDBQuery(queryType: string, table: string, duration: number): void {
    this.dbQueryDuration
      .labels(queryType, table)
      .observe(duration / 1000);

    this.emit('db_query', { queryType, table, duration });

    if (duration > 500) {
      this.logger.warn(`Slow DB query: ${queryType} on ${table} - ${duration}ms`);
    }
  }

  /**
   * Record cache performance
   */
  recordCacheMetrics(cacheType: string, hits: number, misses: number): Promise<void> {
    const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;

    this.cacheHitRateGauge
      .labels(cacheType)
      .set(hitRate);

    this.metrics.set(`cache_${cacheType}_hit_rate`, hitRate);
    this.metrics.set(`cache_${cacheType}_hits`, hits);
    this.metrics.set(`cache_${cacheType}_misses`, misses);

    return Promise.resolve();
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(name: string, value: number, labels?: Record<string, string>): void {
    const key = labels ? `${name}:${JSON.stringify(labels)}` : name;
    this.metrics.set(key, value);
    this.emit('custom_metric', { name, value, labels });
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Calculate percentiles
    const sortedTimes = [...this.requestTimes].sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sortedTimes, 50);
    const p95 = this.calculatePercentile(sortedTimes, 95);
    const p99 = this.calculatePercentile(sortedTimes, 99);

    return {
      requestLatency: this.getAverage(this.requestTimes),
      cpuUsage: this.calculateCPUUsage(cpuUsage),
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      activeConnections: this.activeRequests.size,
      requestRate: this.calculateRequestRate(),
      errorRate: this.calculateErrorRate(),
      cacheHitRate: this.metrics.get('cache_hit_rate') || 0,
      dbQueryTime: this.metrics.get('db_query_time_avg') || 0,
      throughput: this.calculateThroughput(),
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99
    };
  }

  /**
   * Get Prometheus metrics endpoint
   */
  async getPrometheusMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Set custom alert threshold
   */
  setThreshold(threshold: AlertThreshold): void {
    this.thresholds.push(threshold);
    this.logger.info(`Alert threshold set: ${threshold.metric} ${threshold.operator} ${threshold.value}`);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.logger.info(`Alert resolved: ${alert.message}`);
      this.emit('alert_resolved', alert);
    }
  }

  /**
   * Get performance report
   */
  async getPerformanceReport(timeRange: 'hour' | 'day' | 'week' = 'hour'): Promise<any> {
    const now = new Date();
    const timeRanges = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    };

    const range = timeRanges[timeRange];

    return {
      timestamp: now.toISOString(),
      timeRange,
      metrics: await this.getCurrentMetrics(),
      alerts: this.getActiveAlerts(),
      topSlowRequests: this.getTopSlowRequests(10),
      topErrorPaths: this.getTopErrorPaths(10),
      resourceUsage: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime()
      },
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Private helper methods
   */

  private async collectSystemMetrics(): Promise<void> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Update Prometheus gauges
    this.memoryUsageGauge.labels('heap_used').set(memUsage.heapUsed);
    this.memoryUsageGauge.labels('heap_total').set(memUsage.heapTotal);
    this.memoryUsageGauge.labels('rss').set(memUsage.rss);
    this.memoryUsageGauge.labels('external').set(memUsage.external);

    this.cpuUsageGauge.set(this.calculateCPUUsage(cpuUsage));
    this.activeConnectionsGauge.set(this.activeRequests.size);

    // Store in metrics map
    this.metrics.set('memory_heap_used', memUsage.heapUsed);
    this.metrics.set('memory_heap_total', memUsage.heapTotal);
    this.metrics.set('memory_rss', memUsage.rss);
    this.metrics.set('cpu_usage', this.calculateCPUUsage(cpuUsage));
    this.metrics.set('active_connections', this.activeRequests.size);
    this.metrics.set('timestamp', Date.now());
  }

  private checkThresholds(): void {
    const currentMetrics = this.metrics;

    for (const threshold of this.thresholds) {
      const value = currentMetrics.get(threshold.metric.toString());

      if (value !== undefined) {
        const isTriggered = this.evaluateThreshold(value, threshold.operator, threshold.value);
        const alertId = `${threshold.metric}_${threshold.operator}_${threshold.value}`;

        if (isTriggered) {
          let alert = this.alerts.get(alertId);

          if (!alert) {
            // Create new alert
            alert = {
              id: alertId,
              metric: threshold.metric.toString(),
              value,
              threshold: threshold.value,
              severity: threshold.severity,
              message: this.createAlertMessage(threshold, value),
              timestamp: new Date(),
              resolved: false
            };

            this.alerts.set(alertId, alert);
            this.logger.warn(`Performance alert triggered: ${alert.message}`);
            this.emit('alert', alert);
          }
        } else {
          // Resolve alert if it exists
          const alert = this.alerts.get(alertId);
          if (alert && !alert.resolved) {
            this.resolveAlert(alertId);
          }
        }
      }
    }
  }

  private evaluateThreshold(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '==': return value === threshold;
      default: return false;
    }
  }

  private createAlertMessage(threshold: AlertThreshold, value: number): string {
    return `${threshold.metric} is ${value} (threshold: ${threshold.operator} ${threshold.value})`;
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private getAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private calculateCPUUsage(cpuUsage: NodeJS.CpuUsage): number {
    const total = cpuUsage.user + cpuUsage.system;
    return (total / 1000000) * 100; // Convert to percentage
  }

  private calculateRequestRate(): number {
    // Calculate requests per second over last minute
    const oneMinuteAgo = Date.now() - 60000;
    // Implementation would require storing request timestamps
    return 0;
  }

  private calculateErrorRate(): number {
    // Calculate error rate percentage
    // Implementation would require tracking error counts
    return 0;
  }

  private calculateThroughput(): number {
    // Calculate requests per second
    return this.activeRequests.size;
  }

  private getTopSlowRequests(limit: number): any[] {
    // Return top slowest requests
    // Implementation would require storing request history
    return [];
  }

  private getTopErrorPaths(limit: number): any[] {
    // Return paths with most errors
    // Implementation would require tracking errors by path
    return [];
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.metrics;

    if (metrics.get('cpu_usage') > 70) {
      recommendations.push('Consider scaling up or optimizing CPU-intensive operations');
    }

    if (metrics.get('memory_heap_used') / metrics.get('memory_heap_total') > 0.8) {
      recommendations.push('Memory usage is high, consider profiling for memory leaks');
    }

    if (metrics.get('cache_hit_rate') < 70) {
      recommendations.push('Cache hit rate is low, review caching strategy');
    }

    return recommendations;
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }

    if (this.perfObserver) {
      this.perfObserver.disconnect();
    }

    this.logger.info('Performance monitoring service shutdown');
  }
}

// Singleton instance
const performanceMonitoring = new PerformanceMonitoringService();
export default performanceMonitoring;