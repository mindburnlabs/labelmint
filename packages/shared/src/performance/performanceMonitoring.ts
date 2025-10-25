// ====================================================================
// COMPREHENSIVE PERFORMANCE MONITORING FOR 10,000+ CONCURRENT USERS
// ====================================================================
// Production-ready monitoring system with real-time metrics,
// alerting, and performance analytics

export interface MonitoringConfig {
  // Metrics collection
  metrics: {
    enabled: boolean;
    interval: number; // ms
    retention: number; // hours
    batchSize: number;
    compression: boolean;
  };

  // Alerting thresholds
  alerts: {
    responseTime: {
      warning: number; // ms
      critical: number; // ms
    };
    errorRate: {
      warning: number; // percentage
      critical: number; // percentage
    };
    throughput: {
      warning: number; // requests per second
      critical: number; // requests per second
    };
    memoryUsage: {
      warning: number; // percentage
      critical: number; // percentage
    };
    cpuUsage: {
      warning: number; // percentage
      critical: number; // percentage
    };
    activeUsers: {
      warning: number; // count
      critical: number; // count
    };
  };

  // Real-time monitoring
  realtime: {
    enabled: boolean;
    windowSize: number; // seconds
    updateInterval: number; // ms
    smoothingFactor: number; // 0-1
  };

  // Performance analytics
  analytics: {
    enabled: boolean;
    percentiles: number[];
    heatmaps: boolean;
    correlations: boolean;
    anomalyDetection: boolean;
  };

  // Reporting
  reporting: {
    enabled: boolean;
    interval: number; // minutes
    endpoints: string[];
    formats: ('json' | 'prometheus' | 'influxdb')[];
  };

  // Storage
  storage: {
    type: 'memory' | 'redis' | 'database';
    retention: {
      metrics: number; // hours
      alerts: number; // hours
      analytics: number; // days
    };
    compression: boolean;
  };
}

export interface PerformanceMetric {
  timestamp: number;
  name: string;
  value: number;
  tags: Record<string, string>;
  unit: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface Alert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata: Record<string, any>;
}

export interface PerformanceReport {
  timestamp: number;
  duration: number; // reporting period
  metrics: {
    total: PerformanceMetric[];
    summary: Record<string, {
      count: number;
      min: number;
      max: number;
      avg: number;
      p50: number;
      p95: number;
      p99: number;
      sum: number;
    }>;
  };
  alerts: Alert[];
  health: {
    status: 'healthy' | 'warning' | 'critical';
    score: number; // 0-100
    issues: string[];
  };
  recommendations: string[];
}

export interface RealtimeMetrics {
  timestamp: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  activeUsers: number;
  queueDepth: number;
}

class PerformanceMonitor extends EventTarget {
  private config: MonitoringConfig;
  private metrics: PerformanceMetric[] = [];
  private alerts: Alert[] = [];
  private realTimeData: RealtimeMetrics[] = [];
  private timers: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private alertRules: Map<string, Function> = new Map();
  private collectionTimer: NodeJS.Timeout | null = null;
  private reportingTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();

    this.config = this.mergeConfig(config);
    this.initialize();
  }

  private mergeConfig(userConfig: Partial<MonitoringConfig>): MonitoringConfig {
    return {
      metrics: {
        enabled: true,
        interval: 5000, // 5 seconds
        retention: 24, // 24 hours
        batchSize: 100,
        compression: true,
        ...userConfig.metrics
      },
      alerts: {
        responseTime: {
          warning: 500,  // 500ms
          critical: 2000, // 2s
          ...userConfig.alerts?.responseTime
        },
        errorRate: {
          warning: 5,   // 5%
          critical: 15, // 15%
          ...userConfig.alerts?.errorRate
        },
        throughput: {
          warning: 100,  // 100 req/s
          critical: 500, // 500 req/s
          ...userConfig.alerts?.throughput
        },
        memoryUsage: {
          warning: 70, // 70%
          critical: 90, // 90%
          ...userConfig.alerts?.memoryUsage
        },
        cpuUsage: {
          warning: 70, // 70%
          critical: 90, // 90%
          ...userConfig.alerts?.cpuUsage
        },
        activeUsers: {
          warning: 5000,  // 5,000 users
          critical: 9000, // 9,000 users
          ...userConfig.alerts?.activeUsers
        },
        ...userConfig.alerts
      },
      realtime: {
        enabled: true,
        windowSize: 300, // 5 minutes
        updateInterval: 1000, // 1 second
        smoothingFactor: 0.1,
        ...userConfig.realtime
      },
      analytics: {
        enabled: true,
        percentiles: [50, 90, 95, 99],
        heatmaps: true,
        correlations: true,
        anomalyDetection: true,
        ...userConfig.analytics
      },
      reporting: {
        enabled: true,
        interval: 5, // 5 minutes
        endpoints: ['/api/metrics', 'http://prometheus:9090/api/v1/write'],
        formats: ['json', 'prometheus'],
        ...userConfig.reporting
      },
      storage: {
        type: 'memory',
        retention: {
          metrics: 24,
          alerts: 168, // 1 week
          analytics: 30, // 30 days
        },
        compression: true,
        ...userConfig.storage
      },
      ...userConfig
    };
  }

  private initialize(): void {
    this.setupAlertRules();
    this.startCollection();
    this.startReporting();
    this.startCleanup();

    console.log('✅ Performance monitor initialized');
  }

  private setupAlertRules(): void {
    // Response time alerts
    this.addAlertRule('response_time_warning', (metrics: PerformanceMetric[]) => {
      const avgResponseTime = this.calculateAverage(metrics.filter(m => m.name === 'response_time'));
      if (avgResponseTime > this.config.alerts.responseTime.warning) {
        this.createAlert('response_time_warning', 'warning',
          `Average response time (${avgResponseTime.toFixed(2)}ms) exceeds warning threshold`);
      }
    });

    this.addAlertRule('response_time_critical', (metrics: PerformanceMetric[]) => {
      const avgResponseTime = this.calculateAverage(metrics.filter(m => m.name === 'response_time'));
      if (avgResponseTime > this.config.alerts.responseTime.critical) {
        this.createAlert('response_time_critical', 'critical',
          `Average response time (${avgResponseTime.toFixed(2)}ms) exceeds critical threshold`);
      }
    });

    // Error rate alerts
    this.addAlertRule('error_rate_warning', (metrics: PerformanceMetric[]) => {
      const errorRate = this.calculateErrorRate(metrics);
      if (errorRate > this.config.alerts.errorRate.warning) {
        this.createAlert('error_rate_warning', 'warning',
          `Error rate (${errorRate.toFixed(2)}%) exceeds warning threshold`);
      }
    });

    this.addAlertRule('error_rate_critical', (metrics: PerformanceMetric[]) => {
      const errorRate = this.calculateErrorRate(metrics);
      if (errorRate > this.config.alerts.errorRate.critical) {
        this.createAlert('error_rate_critical', 'critical',
          `Error rate (${errorRate.toFixed(2)}%) exceeds critical threshold`);
      }
    });

    // Memory usage alerts
    this.addAlertRule('memory_usage_warning', (metrics: PerformanceMetric[]) => {
      const memoryUsage = this.getLatestValue(metrics, 'memory_usage');
      if (memoryUsage > this.config.alerts.memoryUsage.warning) {
        this.createAlert('memory_usage_warning', 'warning',
          `Memory usage (${memoryUsage.toFixed(2)}%) exceeds warning threshold`);
      }
    });

    this.addAlertRule('memory_usage_critical', (metrics: PerformanceMetric[]) => {
      const memoryUsage = this.getLatestValue(metrics, 'memory_usage');
      if (memoryUsage > this.config.alerts.memoryUsage.critical) {
        this.createAlert('memory_usage_critical', 'critical',
          `Memory usage (${memoryUsage.toFixed(2)}%) exceeds critical threshold`);
      }
    });

    // CPU usage alerts
    this.addAlertRule('cpu_usage_warning', (metrics: PerformanceMetric[]) => {
      const cpuUsage = this.getLatestValue(metrics, 'cpu_usage');
      if (cpuUsage > this.config.alerts.cpuUsage.warning) {
        this.createAlert('cpu_usage_warning', 'warning',
          `CPU usage (${cpuUsage.toFixed(2)}%) exceeds warning threshold`);
      }
    });

    this.addAlertRule('cpu_usage_critical', (metrics: PerformanceMetric[]) => {
      const cpuUsage = this.getLatestValue(metrics, 'cpu_usage');
      if (cpuUsage > this.config.alerts.cpuUsage.critical) {
        this.createAlert('cpu_usage_critical', 'critical',
          `CPU usage (${cpuUsage.toFixed(2)}%) exceeds critical threshold`);
      }
    });

    // Active users alerts
    this.addAlertRule('active_users_warning', (metrics: PerformanceMetric[]) => {
      const activeUsers = this.getLatestValue(metrics, 'active_users');
      if (activeUsers > this.config.alerts.activeUsers.warning) {
        this.createAlert('active_users_warning', 'warning',
          `Active users (${Math.floor(activeUsers)}) approaching system limits`);
      }
    });

    this.addAlertRule('active_users_critical', (metrics: PerformanceMetric[]) => {
      const activeUsers = this.getLatestValue(metrics, 'active_users');
      if (activeUsers > this.config.alerts.activeUsers.critical) {
        this.createAlert('active_users_critical', 'critical',
          `Active users (${Math.floor(activeUsers)}) at critical level`);
      }
    });
  }

  private startCollection(): void {
    if (!this.config.metrics.enabled) return;

    this.collectionTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.metrics.interval);
  }

  private startReporting(): void {
    if (!this.config.reporting.enabled) return;

    this.reportingTimer = setInterval(() => {
      this.generateReport();
    }, this.config.reporting.interval * 60 * 1000); // Convert minutes to ms
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Run every hour
  }

  private collectSystemMetrics(): void {
    const now = Date.now();

    // Collect basic metrics
    this.recordMetric('timestamp', now, {}, 'ms', 'gauge');

    // Collect performance metrics
    if (typeof performance !== 'undefined') {
      const perfNow = performance.now();
      this.recordMetric('performance_now', perfNow, {}, 'ms', 'gauge');
    }

    // Collect memory metrics
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      this.recordMetric('memory_used', memory.usedJSHeapSize, { unit: 'bytes' }, 'bytes', 'gauge');
      this.recordMetric('memory_total', memory.totalJSHeapSize, { unit: 'bytes' }, 'bytes', 'gauge');
      this.recordMetric('memory_limit', memory.jsHeapSizeLimit, { unit: 'bytes' }, 'bytes', 'gauge');

      const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      this.recordMetric('memory_usage', usagePercent, { unit: 'percent' }, 'percent', 'gauge');
    }

    // Collect navigation timing metrics
    if (typeof performance !== 'undefined' && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0];
        this.recordMetric('dns_lookup', nav.domainLookupEnd - nav.domainLookupStart, {}, 'ms', 'timer');
        this.recordMetric('tcp_connection', nav.connectEnd - nav.connectStart, {}, 'ms', 'timer');
        this.recordMetric('response_time', nav.responseEnd - nav.requestStart, {}, 'ms', 'timer');
        this.recordMetric('dom_interactive', nav.domInteractive - nav.navigationStart, {}, 'ms', 'timer');
        this.recordMetric('load_complete', nav.loadEventEnd - nav.navigationStart, {}, 'ms', 'timer');
      }
    }

    // Check alert rules
    this.checkAlertRules();

    // Update real-time metrics
    if (this.config.realtime.enabled) {
      this.updateRealTimeMetrics();
    }
  }

  private updateRealTimeMetrics(): void {
    const now = Date.now();
    const windowStart = now - (this.config.realtime.windowSize * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= windowStart);

    const realtimeMetrics: RealtimeMetrics = {
      timestamp: now,
      requestsPerSecond: this.calculateRequestsPerSecond(recentMetrics),
      averageResponseTime: this.calculateAverage(recentMetrics.filter(m => m.name === 'response_time')),
      errorRate: this.calculateErrorRate(recentMetrics),
      activeConnections: this.getLatestValue(recentMetrics, 'active_connections') || 0,
      memoryUsage: this.getLatestValue(recentMetrics, 'memory_usage') || 0,
      cpuUsage: this.getLatestValue(recentMetrics, 'cpu_usage') || 0,
      cacheHitRate: this.calculateCacheHitRate(recentMetrics),
      activeUsers: this.getLatestValue(recentMetrics, 'active_users') || 0,
      queueDepth: this.getLatestValue(recentMetrics, 'queue_depth') || 0
    };

    // Apply smoothing
    if (this.realTimeData.length > 0) {
      const last = this.realTimeData[this.realTimeData.length - 1];
      const factor = this.config.realtime.smoothingFactor;

      Object.keys(realtimeMetrics).forEach(key => {
        if (key !== 'timestamp') {
          const currentValue = (realtimeMetrics as any)[key];
          const lastValue = (last as any)[key];
          (realtimeMetrics as any)[key] = lastValue + factor * (currentValue - lastValue);
        }
      });
    }

    this.realTimeData.push(realtimeMetrics);

    // Keep only the configured window size
    const maxDataPoints = Math.floor(this.config.realtime.windowSize * 1000 / this.config.realtime.updateInterval);
    if (this.realTimeData.length > maxDataPoints) {
      this.realTimeData = this.realTimeData.slice(-maxDataPoints);
    }

    this.dispatchEvent(new CustomEvent('realtime-update', { detail: realtimeMetrics }));
  }

  // Public API methods

  recordMetric(name: string, value: number, tags: Record<string, string> = {}, unit: string = '', type: 'counter' | 'gauge' | 'histogram' | 'timer' = 'gauge'): void {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      name,
      value,
      tags,
      unit,
      type
    };

    this.metrics.push(metric);

    // Update internal counters
    switch (type) {
      case 'counter':
        const currentCount = this.counters.get(name) || 0;
        this.counters.set(name, currentCount + value);
        break;
      case 'gauge':
        this.gauges.set(name, value);
        break;
      case 'histogram':
        const histogram = this.histograms.get(name) || [];
        histogram.push(value);
        this.histograms.set(name, histogram);
        break;
    }

    // Check if batch needs to be processed
    if (this.metrics.length >= this.config.metrics.batchSize) {
      this.processBatch();
    }
  }

  startTimer(name: string): string {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timers.set(timerId, performance.now());
    return timerId;
  }

  endTimer(timerId: string, tags: Record<string, string> = {}): number {
    const startTime = this.timers.get(timerId);
    if (startTime === undefined) {
      console.warn(`Timer ${timerId} not found`);
      return 0;
    }

    const duration = performance.now() - startTime;
    const name = timerId.split('_')[0];

    this.recordMetric(`${name}_duration`, duration, tags, 'ms', 'timer');
    this.timers.delete(timerId);

    return duration;
  }

  incrementCounter(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    this.recordMetric(name, value, tags, '', 'counter');
  }

  setGauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric(name, value, tags, '', 'gauge');
  }

  recordHistogram(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric(name, value, tags, '', 'histogram');
  }

  // Performance monitoring helpers

  measureFunction<T>(name: string, fn: () => T | Promise<T>, tags: Record<string, string> = {}): T | Promise<T> {
    const timerId = this.startTimer(name);

    const measureFn = async () => {
      try {
        const result = await fn();
        this.endTimer(timerId, { ...tags, status: 'success' });
        return result;
      } catch (error) {
        this.endTimer(timerId, { ...tags, status: 'error' });
        this.incrementCounter(`${name}_errors`, 1, { ...tags, error: (error as Error).name });
        throw error;
      }
    };

    return measureFn();
  }

  trackHttpRequest(method: string, url: string, statusCode: number, duration: number): void {
    const tags = {
      method,
      url: this.sanitizeUrl(url),
      status_code: statusCode.toString(),
      status: statusCode >= 400 ? 'error' : 'success'
    };

    this.recordMetric('http_request_duration', duration, tags, 'ms', 'timer');
    this.incrementCounter('http_requests_total', 1, tags);

    if (statusCode >= 400) {
      this.incrementCounter('http_errors_total', 1, tags);
    }
  }

  trackDatabaseQuery(query: string, duration: number, success: boolean = true): void {
    const tags = {
      query_type: this.getQueryType(query),
      status: success ? 'success' : 'error'
    };

    this.recordMetric('db_query_duration', duration, tags, 'ms', 'timer');
    this.incrementCounter('db_queries_total', 1, tags);

    if (!success) {
      this.incrementCounter('db_errors_total', 1, tags);
    }
  }

  trackCacheOperation(operation: 'get' | 'set' | 'delete', key: string, hit: boolean, duration: number): void {
    const tags = {
      operation,
      key_pattern: this.getKeyPattern(key),
      hit: hit.toString()
    };

    this.recordMetric('cache_operation_duration', duration, tags, 'ms', 'timer');
    this.incrementCounter('cache_operations_total', 1, tags);

    if (operation === 'get') {
      this.incrementCounter('cache_hits_total', 1, { hit: 'true' });
      this.incrementCounter('cache_misses_total', 1, { hit: 'false' });
    }
  }

  // Analytics and reporting

  generateReport(): PerformanceReport {
    const now = Date.now();
    const reportStart = now - (this.config.reporting.interval * 60 * 1000);
    const reportMetrics = this.metrics.filter(m => m.timestamp >= reportStart);

    const summary = this.calculateSummary(reportMetrics);
    const health = this.calculateHealth(summary);
    const recommendations = this.generateRecommendations(summary, health);

    const report: PerformanceReport = {
      timestamp: now,
      duration: this.config.reporting.interval * 60 * 1000,
      metrics: {
        total: reportMetrics,
        summary
      },
      alerts: this.getActiveAlerts(),
      health,
      recommendations
    };

    this.dispatchEvent(new CustomEvent('report-generated', { detail: report }));

    // Send to configured endpoints
    if (this.config.reporting.enabled) {
      this.sendReport(report);
    }

    return report;
  }

  getRealTimeMetrics(): RealtimeMetrics[] {
    return [...this.realTimeData];
  }

  getCurrentMetrics(): RealtimeMetrics | null {
    return this.realTimeData.length > 0 ? this.realTimeData[this.realTimeData.length - 1] : null;
  }

  getMetricsSummary(): any {
    const summary = this.calculateSummary(this.metrics);
    const activeAlerts = this.getActiveAlerts();

    return {
      timestamp: Date.now(),
      metrics: summary,
      alerts: activeAlerts,
      health: this.calculateHealth(summary),
      realTime: this.getCurrentMetrics()
    };
  }

  // Alert management

  addAlertRule(name: string, rule: Function): void {
    this.alertRules.set(name, rule);
  }

  removeAlertRule(name: string): void {
    this.alertRules.delete(name);
  }

  private createAlert(name: string, severity: 'info' | 'warning' | 'critical', message: string, metadata: Record<string, any> = {}): void {
    const alert: Alert = {
      id: `${name}_${Date.now()}`,
      name,
      severity,
      message,
      timestamp: Date.now(),
      resolved: false,
      metadata
    };

    this.alerts.push(alert);
    this.dispatchEvent(new CustomEvent('alert-created', { detail: alert }));

    console.warn(`🚨 ${severity.toUpperCase()}: ${message}`);
  }

  private resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.dispatchEvent(new CustomEvent('alert-resolved', { detail: alert }));
    }
  }

  private getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  private checkAlertRules(): void {
    const recentMetrics = this.metrics.filter(m =>
      m.timestamp > Date.now() - (this.config.metrics.interval * 10)
    );

    this.alertRules.forEach((rule, name) => {
      try {
        rule(recentMetrics);
      } catch (error) {
        console.error(`Alert rule ${name} failed:`, error);
      }
    });
  }

  // Utility methods

  private processBatch(): void {
    if (this.config.metrics.compression) {
      // Process and potentially compress metrics
      console.debug(`Processing batch of ${this.metrics.length} metrics`);
    }

    // Keep only metrics within retention period
    const cutoffTime = Date.now() - (this.config.metrics.retention * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
  }

  private cleanupOldData(): void {
    const now = Date.now();

    // Clean up old metrics
    const metricsCutoff = now - (this.config.storage.retention.metrics * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > metricsCutoff);

    // Clean up old alerts
    const alertsCutoff = now - (this.config.storage.retention.alerts * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => a.timestamp > alertsCutoff || !a.resolved);

    // Clean up old real-time data
    const realtimeCutoff = now - (this.config.realtime.windowSize * 1000);
    this.realTimeData = this.realTimeData.filter(d => d.timestamp > realtimeCutoff);

    // Clean up timers
    const timerCutoff = now - 60000; // 1 minute
    for (const [timerId, startTime] of this.timers.entries()) {
      if (startTime < timerCutoff) {
        this.timers.delete(timerId);
      }
    }

    console.log('🧹 Performance monitor cleanup completed');
  }

  private calculateAverage(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  private calculateErrorRate(metrics: PerformanceMetric[]): number {
    const totalRequests = metrics.filter(m => m.name === 'http_requests_total').reduce((acc, m) => acc + m.value, 0);
    const totalErrors = metrics.filter(m => m.name === 'http_errors_total').reduce((acc, m) => acc + m.value, 0);

    if (totalRequests === 0) return 0;
    return (totalErrors / totalRequests) * 100;
  }

  private calculateRequestsPerSecond(metrics: PerformanceMetric[]): number {
    const requests = metrics.filter(m => m.name === 'http_requests_total');
    if (requests.length < 2) return 0;

    const timeSpan = (Math.max(...requests.map(r => r.timestamp)) - Math.min(...requests.map(r => r.timestamp))) / 1000;
    const requestCount = requests.reduce((acc, r) => acc + r.value, 0);

    return timeSpan > 0 ? requestCount / timeSpan : 0;
  }

  private calculateCacheHitRate(metrics: PerformanceMetric[]): number {
    const hits = metrics.filter(m => m.name === 'cache_hits_total').reduce((acc, m) => acc + m.value, 0);
    const misses = metrics.filter(m => m.name === 'cache_misses_total').reduce((acc, m) => acc + m.value, 0);
    const total = hits + misses;

    if (total === 0) return 0;
    return (hits / total) * 100;
  }

  private getLatestValue(metrics: PerformanceMetric[], name: string): number | null {
    const filtered = metrics.filter(m => m.name === name);
    if (filtered.length === 0) return null;
    return filtered[filtered.length - 1].value;
  }

  private calculateSummary(metrics: PerformanceMetric[]): Record<string, any> {
    const summary: Record<string, any> = {};

    // Group metrics by name
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    // Calculate statistics for each metric
    Object.entries(grouped).forEach(([name, values]) => {
      if (values.length > 0) {
        values.sort((a, b) => a - b);
        const sum = values.reduce((acc, val) => acc + val, 0);

        summary[name] = {
          count: values.length,
          min: values[0],
          max: values[values.length - 1],
          avg: sum / values.length,
          sum,
          p50: this.getPercentile(values, 50),
          p95: this.getPercentile(values, 95),
          p99: this.getPercentile(values, 99)
        };
      }
    });

    return summary;
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private calculateHealth(summary: Record<string, any>): { status: 'healthy' | 'warning' | 'critical'; score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    // Check response time
    if (summary.response_time) {
      const avgResponseTime = summary.response_time.avg;
      if (avgResponseTime > this.config.alerts.responseTime.critical) {
        issues.push(`Critical response time: ${avgResponseTime.toFixed(2)}ms`);
        score -= 30;
      } else if (avgResponseTime > this.config.alerts.responseTime.warning) {
        issues.push(`Slow response time: ${avgResponseTime.toFixed(2)}ms`);
        score -= 15;
      }
    }

    // Check error rate
    if (summary.http_errors_total && summary.http_requests_total) {
      const errorRate = (summary.http_errors_total.sum / summary.http_requests_total.sum) * 100;
      if (errorRate > this.config.alerts.errorRate.critical) {
        issues.push(`Critical error rate: ${errorRate.toFixed(2)}%`);
        score -= 25;
      } else if (errorRate > this.config.alerts.errorRate.warning) {
        issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
        score -= 10;
      }
    }

    // Check memory usage
    if (summary.memory_usage) {
      const avgMemoryUsage = summary.memory_usage.avg;
      if (avgMemoryUsage > this.config.alerts.memoryUsage.critical) {
        issues.push(`Critical memory usage: ${avgMemoryUsage.toFixed(2)}%`);
        score -= 20;
      } else if (avgMemoryUsage > this.config.alerts.memoryUsage.warning) {
        issues.push(`High memory usage: ${avgMemoryUsage.toFixed(2)}%`);
        score -= 10;
      }
    }

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (score < 50) {
      status = 'critical';
    } else if (score < 80 || issues.length > 0) {
      status = 'warning';
    }

    return { status, score: Math.max(0, score), issues };
  }

  private generateRecommendations(summary: Record<string, any>, health: any): string[] {
    const recommendations: string[] = [];

    if (health.issues.length > 0) {
      recommendations.push('Address active performance issues immediately');
    }

    // Performance recommendations
    if (summary.response_time && summary.response_time.avg > 500) {
      recommendations.push('Optimize slow queries and API endpoints');
    }

    if (summary.memory_usage && summary.memory_usage.avg > 70) {
      recommendations.push('Consider memory optimization and garbage collection tuning');
    }

    // Scaling recommendations
    const currentLoad = this.getCurrentMetrics();
    if (currentLoad && currentLoad.requestsPerSecond > this.config.alerts.thputput.warning) {
      recommendations.push('Consider scaling up to handle increased load');
    }

    return recommendations;
  }

  private async sendReport(report: PerformanceReport): Promise<void> {
    for (const endpoint of this.config.reporting.endpoints) {
      try {
        for (const format of this.config.reporting.formats) {
          let data: string;
          let contentType: string;

          switch (format) {
            case 'json':
              data = JSON.stringify(report);
              contentType = 'application/json';
              break;
            case 'prometheus':
              data = this.convertToPrometheusFormat(report);
              contentType = 'text/plain';
              break;
            case 'influxdb':
              data = this.convertToInfluxDBFormat(report);
              contentType = 'application/x-www-form-urlencoded';
              break;
            default:
              continue;
          }

          await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': contentType
            },
            body: data
          });
        }
      } catch (error) {
        console.error('Failed to send report:', error);
      }
    }
  }

  private convertToPrometheusFormat(report: PerformanceReport): string {
    const lines: string[] = [];

    Object.entries(report.metrics.summary).forEach(([name, stats]) => {
      lines.push(`# HELP ${name} ${name} metric`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}_avg ${stats.avg}`);
      lines.push(`${name}_count ${stats.count}`);
      lines.push(`${name}_sum ${stats.sum}`);
    });

    return lines.join('\n');
  }

  private convertToInfluxDBFormat(report: PerformanceReport): string {
    // Convert to InfluxDB line protocol format
    const lines: string[] = [];

    Object.entries(report.metrics.summary).forEach(([name, stats]) => {
      const tags = 'metric=' + name;
      const fields = `avg=${stats.avg},count=${stats.count},sum=${stats.sum}`;
      const timestamp = report.timestamp * 1000000; // Convert to nanoseconds

      lines.push(`performance,${tags} ${fields} ${timestamp}`);
    });

    return lines.join('\n');
  }

  // Utility methods for tracking

  private sanitizeUrl(url: string): string {
    // Remove sensitive information from URLs
    return url.replace(/token=[^&]*/, 'token=***');
  }

  private getQueryType(query: string): string {
    const upperQuery = query.trim().toUpperCase();
    if (upperQuery.startsWith('SELECT')) return 'SELECT';
    if (upperQuery.startsWith('INSERT')) return 'INSERT';
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
    if (upperQuery.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }

  private getKeyPattern(key: string): string {
    // Extract pattern from cache keys
    if (key.includes('user:')) return 'user';
    if (key.includes('task:')) return 'task';
    if (key.includes('project:')) return 'project';
    return 'other';
  }

  // Cleanup and destruction

  destroy(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }

    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clear data
    this.metrics = [];
    this.alerts = [];
    this.realTimeData = [];
    this.timers.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.alertRules.clear();

    console.log('✅ Performance monitor destroyed');
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(config?: Partial<MonitoringConfig>): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor(config);
  }
  return performanceMonitor;
}

export { PerformanceMonitor, type MonitoringConfig, type PerformanceMetric, type Alert, type PerformanceReport, type RealtimeMetrics };