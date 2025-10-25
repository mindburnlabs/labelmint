// Comprehensive Performance Monitoring for LabelMint
import { EventEmitter } from 'events';

interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  gc: {
    collections: number;
    duration: number;
  };
  eventLoop: {
    utilization: number;
    lag: number;
  };
  requests: {
    total: number;
    active: number;
    errors: number;
    avgResponseTime: number;
  };
  database: {
    connections: number;
    avgQueryTime: number;
    slowQueries: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    memoryUsage: number;
  };
}

interface AlertRule {
  name: string;
  metric: string;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=';
  duration: number; // ms
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

interface Alert {
  rule: string;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  timestamp: number;
  resolved?: boolean;
  resolvedAt?: number;
}

class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private alertRules: AlertRule[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private maxMetrics = 1000; // Keep last 1000 data points
  private isMonitoring = false;
  private startTime = Date.now();

  // Request tracking
  private requestCount = 0;
  private activeRequests = 0;
  private requestErrors = 0;
  private requestTimes: number[] = [];
  private lastGCStats: any = null;

  constructor() {
    super();
    this.initializeAlertRules();
    this.setupProcessMonitoring();
  }

  private initializeAlertRules(): void {
    this.alertRules = [
      {
        name: 'High CPU Usage',
        metric: 'cpu.usage',
        threshold: 80,
        operator: '>',
        duration: 30000, // 30 seconds
        severity: 'high',
        enabled: true
      },
      {
        name: 'High Memory Usage',
        metric: 'memory.heapUsed',
        threshold: 512 * 1024 * 1024, // 512MB
        operator: '>',
        duration: 60000, // 1 minute
        severity: 'medium',
        enabled: true
      },
      {
        name: 'Critical Memory Usage',
        metric: 'memory.heapUsed',
        threshold: 1024 * 1024 * 1024, // 1GB
        operator: '>',
        duration: 10000, // 10 seconds
        severity: 'critical',
        enabled: true
      },
      {
        name: 'High Error Rate',
        metric: 'requests.errorRate',
        threshold: 5, // 5%
        operator: '>',
        duration: 30000, // 30 seconds
        severity: 'high',
        enabled: true
      },
      {
        name: 'Slow Response Time',
        metric: 'requests.avgResponseTime',
        threshold: 1000, // 1 second
        operator: '>',
        duration: 60000, // 1 minute
        severity: 'medium',
        enabled: true
      },
      {
        name: 'Critical Response Time',
        metric: 'requests.avgResponseTime',
        threshold: 5000, // 5 seconds
        operator: '>',
        duration: 10000, // 10 seconds
        severity: 'critical',
        enabled: true
      },
      {
        name: 'Low Cache Hit Rate',
        metric: 'cache.hitRate',
        threshold: 50, // 50%
        operator: '<',
        duration: 120000, // 2 minutes
        severity: 'low',
        enabled: true
      },
      {
        name: 'Event Loop Lag',
        metric: 'eventLoop.lag',
        threshold: 100, // 100ms
        operator: '>',
        duration: 30000, // 30 seconds
        severity: 'medium',
        enabled: true
      }
    ];
  }

  private setupProcessMonitoring(): void {
    // Monitor garbage collection
    if (global.gc) {
      const originalGC = global.gc;
      global.gc = () => {
        const start = Date.now();
        originalGC();
        const duration = Date.now() - start;
        this.recordGCCollection(duration);
      };
    }

    // Monitor uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.emit('criticalError', error);
      this.recordError();
    });

    process.on('unhandledRejection', (reason) => {
      this.emit('unhandledRejection', reason);
      this.recordError();
    });
  }

  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      console.log('⚠️ Performance monitoring already started');
      return;
    }

    console.log(`🚀 Starting performance monitoring (interval: ${intervalMs}ms)`);
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
    }, intervalMs);

    this.emit('monitoringStarted');
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('⚠️ Performance monitoring not running');
      return;
    }

    console.log('🛑 Stopping performance monitoring');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoringStopped');
  }

  private collectMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = require('os').loadavg();

    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      cpu: {
        usage: this.calculateCPUUsage(cpuUsage),
        loadAverage: loadAvg
      },
      memory: {
        used: memUsage.rss,
        total: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      gc: this.getGCStats(),
      eventLoop: this.getEventLoopStats(),
      requests: this.getRequestStats(),
      database: this.getDatabaseStats(),
      cache: this.getCacheStats()
    };

    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    this.emit('metricsCollected', metrics);
  }

  private calculateCPUUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Simple CPU usage calculation
    const total = cpuUsage.user + cpuUsage.system;
    return total / 1000000; // Convert to seconds
  }

  private getGCStats(): { collections: number; duration: number } {
    // This would integrate with actual GC monitoring
    return {
      collections: 0,
      duration: 0
    };
  }

  private recordGCCollection(duration: number): void {
    // Update latest metrics with GC info
    if (this.metrics.length > 0) {
      const latest = this.metrics[this.metrics.length - 1];
      latest.gc.collections++;
      latest.gc.duration += duration;
    }
  }

  private getEventLoopStats(): { utilization: number; lag: number } {
    const start = process.hrtime.bigint();

    // SetImmediate to measure event loop lag
    return new Promise(resolve => {
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve({
          utilization: Math.min(lag / 100, 1), // Normalize to 0-1
          lag
        });
      });
    });
  }

  private getRequestStats(): any {
    const avgResponseTime = this.requestTimes.length > 0
      ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length
      : 0;

    // Keep only recent response times
    if (this.requestTimes.length > 100) {
      this.requestTimes = this.requestTimes.slice(-100);
    }

    return {
      total: this.requestCount,
      active: this.activeRequests,
      errors: this.requestErrors,
      avgResponseTime,
      errorRate: this.requestCount > 0 ? (this.requestErrors / this.requestCount) * 100 : 0
    };
  }

  private getDatabaseStats(): any {
    // This would integrate with actual database monitoring
    return {
      connections: 0,
      avgQueryTime: 0,
      slowQueries: 0
    };
  }

  private getCacheStats(): any {
    // This would integrate with actual cache monitoring
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      memoryUsage: 0
    };
  }

  private checkAlerts(): void {
    if (this.metrics.length === 0) return;

    const latest = this.metrics[this.metrics.length - 1];
    const now = Date.now();

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      const value = this.getMetricValue(latest, rule.metric);
      if (value === undefined) continue;

      const isTriggered = this.compareValues(value, rule.threshold, rule.operator);
      const alertKey = `${rule.name}_${rule.metric}`;

      if (isTriggered) {
        const existingAlert = this.alerts.get(alertKey);

        if (!existingAlert) {
          // New alert
          const alert: Alert = {
            rule: rule.name,
            metric: rule.metric,
            value,
            threshold: rule.threshold,
            severity: rule.severity,
            timestamp: now
          };

          this.alerts.set(alertKey, alert);
          this.emit('alert', alert);
          this.logAlert(alert, 'TRIGGERED');

        } else if (!existingAlert.resolved && (now - existingAlert.timestamp) >= rule.duration) {
          // Alert duration exceeded
          this.emit('alertSustained', existingAlert);
          this.logAlert(existingAlert, 'SUSTAINED');
        }
      } else {
        const existingAlert = this.alerts.get(alertKey);

        if (existingAlert && !existingAlert.resolved) {
          // Alert resolved
          existingAlert.resolved = true;
          existingAlert.resolvedAt = now;
          this.emit('alertResolved', existingAlert);
          this.logAlert(existingAlert, 'RESOLVED');
        }
      }
    }
  }

  private getMetricValue(metrics: PerformanceMetrics, path: string): number | undefined {
    const parts = path.split('.');
    let value: any = metrics;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return typeof value === 'number' ? value : undefined;
  }

  private compareValues(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      default: return false;
    }
  }

  private logAlert(alert: Alert, status: 'TRIGGERED' | 'SUSTAINED' | 'RESOLVED'): void {
    const statusEmoji = {
      'TRIGGERED': '🚨',
      'SUSTAINED': '⏰',
      'RESOLVED': '✅'
    };

    const severityEmoji = {
      'low': '🟡',
      'medium': '🟠',
      'high': '🔴',
      'critical': '💀'
    };

    console.log(
      `${statusEmoji[status]} ${severityEmoji[alert.severity]} ` +
      `${alert.rule}: ${alert.metric} = ${alert.value.toFixed(2)} ` +
      `(threshold: ${alert.threshold}) - ${status.toLowerCase()}`
    );
  }

  // Public API methods

  recordRequest(duration: number, success: boolean = true): void {
    this.requestCount++;
    this.activeRequests++;
    this.requestTimes.push(duration);

    if (!success) {
      this.requestErrors++;
    }

    // Simulate request completion (would be called from actual request handler)
    setTimeout(() => {
      this.activeRequests--;
    }, 0);
  }

  recordError(): void {
    this.requestErrors++;
  }

  updateDatabaseStats(stats: { connections: number; avgQueryTime: number; slowQueries: number }): void {
    if (this.metrics.length > 0) {
      const latest = this.metrics[this.metrics.length - 1];
      latest.database = stats;
    }
  }

  updateCacheStats(stats: { hits: number; misses: number; memoryUsage: number }): void {
    if (this.metrics.length > 0) {
      const latest = this.metrics[this.metrics.length - 1];
      latest.cache = {
        ...stats,
        hitRate: stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0
      };
    }
  }

  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(minutes: number = 60): PerformanceMetrics[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  getAlertsHistory(hours: number = 24): Alert[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return Array.from(this.alerts.values()).filter(alert => alert.timestamp >= cutoff);
  }

  addAlertRule(rule: Omit<AlertRule, 'enabled'>): void {
    this.alertRules.push({ ...rule, enabled: true });
  }

  removeAlertRule(name: string): void {
    this.alertRules = this.alertRules.filter(rule => rule.name !== name);
  }

  enableAlert(name: string): void {
    const rule = this.alertRules.find(r => r.name === name);
    if (rule) rule.enabled = true;
  }

  disableAlert(name: string): void {
    const rule = this.alertRules.find(r => r.name === name);
    if (rule) rule.enabled = false;
  }

  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  async generatePerformanceReport(): Promise<string> {
    const current = this.getCurrentMetrics();
    const activeAlerts = this.getActiveAlerts();
    const recentMetrics = this.getMetricsHistory(60); // Last hour
    const uptime = Date.now() - this.startTime;

    let report = `# Performance Monitoring Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Uptime: ${Math.floor(uptime / 1000 / 60)} minutes\n\n`;

    // Current Status
    if (current) {
      report += `## Current Status\n`;
      report += `- CPU Usage: ${current.cpu.usage.toFixed(2)}%\n`;
      report += `- Memory Used: ${(current.memory.heapUsed / 1024 / 1024).toFixed(2)}MB\n`;
      report += `- Active Requests: ${current.requests.active}\n`;
      report += `- Avg Response Time: ${current.requests.avgResponseTime.toFixed(2)}ms\n`;
      report += `- Error Rate: ${current.requests.errorRate.toFixed(2)}%\n`;
      report += `- Cache Hit Rate: ${current.cache.hitRate.toFixed(2)}%\n\n`;
    }

    // Active Alerts
    if (activeAlerts.length > 0) {
      report += `## Active Alerts (${activeAlerts.length})\n\n`;
      for (const alert of activeAlerts) {
        const duration = Date.now() - alert.timestamp;
        report += `### ${alert.rule} (${alert.severity})\n`;
        report += `- Metric: ${alert.metric}\n`;
        report += `- Value: ${alert.value.toFixed(2)}\n`;
        report += `- Threshold: ${alert.threshold}\n`;
        report += `- Duration: ${Math.floor(duration / 1000)}s\n\n`;
      }
    } else {
      report += `## Active Alerts: None ✅\n\n`;
    }

    // Statistics (last hour)
    if (recentMetrics.length > 0) {
      const avgCPU = recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length;
      const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory.heapUsed, 0) / recentMetrics.length;
      const maxMemory = Math.max(...recentMetrics.map(m => m.memory.heapUsed));
      const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.requests.avgResponseTime, 0) / recentMetrics.length;
      const totalRequests = recentMetrics[recentMetrics.length - 1].requests.total;
      const totalErrors = recentMetrics[recentMetrics.length - 1].requests.errors;

      report += `## Last Hour Statistics\n`;
      report += `- Average CPU Usage: ${avgCPU.toFixed(2)}%\n`;
      report += `- Average Memory: ${(avgMemory / 1024 / 1024).toFixed(2)}MB\n`;
      report += `- Peak Memory: ${(maxMemory / 1024 / 1024).toFixed(2)}MB\n`;
      report += `- Average Response Time: ${avgResponseTime.toFixed(2)}ms\n`;
      report += `- Total Requests: ${totalRequests}\n`;
      report += `- Total Errors: ${totalErrors}\n`;
      report += `- Error Rate: ${totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : 0}%\n\n`;
    }

    // Recommendations
    report += `## Recommendations\n`;

    if (current && current.memory.heapUsed > 512 * 1024 * 1024) {
      report += `- ⚠️ Memory usage is high. Consider optimizing memory usage or adding more RAM.\n`;
    }

    if (current && current.requests.avgResponseTime > 500) {
      report += `- ⚠️ Response times are elevated. Check for slow queries or resource bottlenecks.\n`;
    }

    if (current && current.requests.errorRate > 1) {
      report += `- ⚠️ Error rate is above optimal. Check application logs for issues.\n`;
    }

    if (current && current.cache.hitRate < 70) {
      report += `- ⚠️ Cache hit rate could be improved. Review caching strategy.\n`;
    }

    if (activeAlerts.length === 0 && current && current.requests.errorRate < 1 && current.requests.avgResponseTime < 500) {
      report += `- ✅ Performance is within optimal ranges.\n`;
    }

    return report;
  }
}

export { PerformanceMonitor, type PerformanceMetrics, type AlertRule, type Alert };