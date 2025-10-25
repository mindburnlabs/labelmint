import { Request, Response, NextFunction } from 'express';
import { EventEmitters } from 'events';
import { logger } from '../../utils/logger';
import securityConfig from '../../config/security';

export interface AlertSeverity {
  LOW: 'low';
  MEDIUM: 'medium';
  HIGH: 'high';
  CRITICAL: 'critical';
}

export interface MonitoringEvent {
  id: string;
  type: 'security' | 'performance' | 'availability' | 'business';
  severity: keyof AlertSeverity;
  category: string;
  message: string;
  details: any;
  timestamp: number;
  source: string;
  tags: string[];
  resolved: boolean;
  resolvedAt?: number;
  escalated: boolean;
  escalatedAt?: number;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  responseTime: number;
  details?: any;
  dependencies?: string[];
}

export interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  databaseConnections: number;
  timestamp: number;
}

export interface AnomalyDetection {
  enabled: boolean;
  thresholds: {
    errorRate: number;
    responseTime: number;
    requestRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  windowSize: number; // minutes
  sensitivity: number; // 0-1
}

export class APIMonitoringService extends EventEmitters {
  private config = {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    alerting: {
      enabled: process.env.MONITORING_ALERTING_ENABLED !== 'false',
      channels: (process.env.MONITORING_ALERT_CHANNELS || 'slack,email').split(','),
      thresholds: {
        errorRate: parseFloat(process.env.MONITORING_ERROR_RATE_THRESHOLD || '0.05'), // 5%
        responseTime: parseInt(process.env.MONITORING_RESPONSE_TIME_THRESHOLD || '2000'), // 2s
        availability: parseFloat(process.env.MONITORING_AVAILABILITY_THRESHOLD || '0.99'), // 99%
        memoryUsage: parseFloat(process.env.MONITORING_MEMORY_THRESHOLD || '0.85'), // 85%
        cpuUsage: parseFloat(process.env.MONITORING_CPU_THRESHOLD || '0.80'), // 80%
        databaseConnections: parseInt(process.env.MONITORING_DB_CONNECTIONS_THRESHOLD || '80')
      },
      cooldown: parseInt(process.env.MONITORING_ALERT_COOLDOWN || '300000') // 5 minutes
    },
    healthCheck: {
      enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'), // 5 seconds
      retries: parseInt(process.env.HEALTH_CHECK_RETRIES || '3')
    },
    anomalyDetection: {
      enabled: process.env.ANOMALY_DETECTION_ENABLED === 'true',
      thresholds: {
        errorRate: 0.02, // 2% deviation
        responseTime: 0.3, // 30% deviation
        requestRate: 0.5, // 50% deviation
        memoryUsage: 0.2, // 20% deviation
        cpuUsage: 0.2 // 20% deviation
      },
      windowSize: 10, // 10 minutes
      sensitivity: 0.8 // 80% confidence
    },
    retention: {
      events: parseInt(process.env.MONITORING_EVENTS_RETENTION_DAYS || '30'), // days
      metrics: parseInt(process.env.MONITORING_METRICS_RETENTION_DAYS || '7'), // days
      healthChecks: parseInt(process.env.MONITORING_HEALTH_RETENTION_HOURS || '24') // hours
    }
  };

  private events: MonitoringEvent[] = [];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private metrics: ServiceMetrics[] = [];
  private alertCooldowns: Map<string, number> = new Map();
  private baselineMetrics: ServiceMetrics | null = null;

  constructor() {
    super();
    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring service
   */
  private initializeMonitoring(): void {
    if (!this.config.enabled) return;

    // Start health checks
    if (this.config.healthCheck.enabled) {
      setInterval(() => {
        this.performHealthChecks();
      }, this.config.healthCheck.interval);
    }

    // Start metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, 60000); // Every minute

    // Clean old data
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Every hour

    // Calculate baseline
    setTimeout(() => {
      this.calculateBaseline();
    }, 10 * 60 * 1000); // After 10 minutes

    logger.info('API monitoring service initialized');
  }

  /**
   * Record security event
   */
  recordSecurityEvent(category: string, severity: keyof AlertSeverity, message: string, details: any, source: string = 'api-gateway'): void {
    const event: MonitoringEvent = {
      id: this.generateEventId(),
      type: 'security',
      severity,
      category,
      message,
      details,
      timestamp: Date.now(),
      source,
      tags: ['security', category],
      resolved: false,
      escalated: false
    };

    this.addEvent(event);

    // Trigger immediate alert for critical security events
    if (severity === 'CRITICAL') {
      this.triggerAlert(event);
    }
  }

  /**
   * Record performance event
   */
  recordPerformanceEvent(category: string, severity: keyof AlertSeverity, message: string, details: any, source: string = 'api-gateway'): void {
    const event: MonitoringEvent = {
      id: this.generateEventId(),
      type: 'performance',
      severity,
      category,
      message,
      details,
      timestamp: Date.now(),
      source,
      tags: ['performance', category],
      resolved: false,
      escalated: false
    };

    this.addEvent(event);
  }

  /**
   * Record availability event
   */
  recordAvailabilityEvent(category: string, severity: keyof AlertSeverity, message: string, details: any, source: string = 'api-gateway'): void {
    const event: MonitoringEvent = {
      id: this.generateEventId(),
      type: 'availability',
      severity,
      category,
      message,
      details,
      timestamp: Date.now(),
      source,
      tags: ['availability', category],
      resolved: false,
      escalated: false
    };

    this.addEvent(event);

    // Trigger immediate alert for critical availability issues
    if (severity === 'CRITICAL') {
      this.triggerAlert(event);
    }
  }

  /**
   * Record business event
   */
  recordBusinessEvent(category: string, severity: keyof AlertSeverity, message: string, details: any, source: string = 'api-gateway'): void {
    const event: MonitoringEvent = {
      id: this.generateEventId(),
      type: 'business',
      severity,
      category,
      message,
      details,
      timestamp: Date.now(),
      source,
      tags: ['business', category],
      resolved: false,
      escalated: false
    };

    this.addEvent(event);
  }

  /**
   * Add event to monitoring system
   */
  private addEvent(event: MonitoringEvent): void {
    this.events.push(event);

    // Emit event for real-time monitoring
    this.emit('monitoring-event', event);

    // Check if alert should be triggered
    this.checkAlertConditions(event);

    // Check for anomalies
    if (this.config.anomalyDetection.enabled) {
      this.detectAnomalies(event);
    }

    logger.debug('Monitoring event recorded', {
      type: event.type,
      severity: event.severity,
      category: event.category,
      message: event.message
    });
  }

  /**
   * Check if alert should be triggered
   */
  private checkAlertConditions(event: MonitoringEvent): void {
    if (!this.config.alerting.enabled) return;

    // Check cooldown
    const alertKey = `${event.type}-${event.category}-${event.severity}`;
    const lastAlert = this.alertCooldowns.get(alertKey);
    if (lastAlert && (Date.now() - lastAlert) < this.config.alerting.cooldown) {
      return;
    }

    // Check threshold conditions
    const shouldAlert = this.evaluateAlertCondition(event);
    if (shouldAlert) {
      this.triggerAlert(event);
      this.alertCooldowns.set(alertKey, Date.now());
    }
  }

  /**
   * Evaluate if event meets alert conditions
   */
  private evaluateAlertCondition(event: MonitoringEvent): boolean {
    const thresholds = this.config.alerting.thresholds;

    switch (event.category) {
      case 'error_rate':
        return event.details.errorRate > thresholds.errorRate;

      case 'response_time':
        return event.details.responseTime > thresholds.responseTime;

      case 'availability':
        return event.details.availability < thresholds.availability;

      case 'memory_usage':
        return event.details.memoryUsage > thresholds.memoryUsage;

      case 'cpu_usage':
        return event.details.cpuUsage > thresholds.cpuUsage;

      case 'database_connections':
        return event.details.connections > thresholds.databaseConnections;

      default:
        return event.severity === 'HIGH' || event.severity === 'CRITICAL';
    }
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(event: MonitoringEvent): Promise<void> {
    logger.error('Alert triggered', {
      id: event.id,
      type: event.type,
      severity: event.severity,
      category: event.category,
      message: event.message,
      details: event.details
    });

    // Send alerts through configured channels
    for (const channel of this.config.alerting.channels) {
      try {
        await this.sendAlert(channel, event);
      } catch (error) {
        logger.error(`Failed to send alert via ${channel}:`, error);
      }
    }

    // Emit alert event
    this.emit('alert', event);
  }

  /**
   * Send alert through specific channel
   */
  private async sendAlert(channel: string, event: MonitoringEvent): Promise<void> {
    switch (channel) {
      case 'slack':
        await this.sendSlackAlert(event);
        break;
      case 'email':
        await this.sendEmailAlert(event);
        break;
      case 'webhook':
        await this.sendWebhookAlert(event);
        break;
      default:
        logger.warn(`Unknown alert channel: ${channel}`);
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(event: MonitoringEvent): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    const payload = {
      text: `🚨 ${event.severity.toUpperCase()} Alert: ${event.message}`,
      attachments: [{
        color: this.getAlertColor(event.severity),
        fields: [
          { title: 'Type', value: event.type, short: true },
          { title: 'Category', value: event.category, short: true },
          { title: 'Source', value: event.source, short: true },
          { title: 'Time', value: new Date(event.timestamp).toISOString(), short: true }
        ],
        ...(event.details ? [{
          title: 'Details',
          value: '```' + JSON.stringify(event.details, null, 2) + '```'
        }] : [])
      }]
    };

    // Send to Slack (implementation depends on your Slack client)
    logger.info('Slack alert would be sent', { payload });
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(event: MonitoringEvent): Promise<void> {
    // Implementation depends on your email service
    logger.info('Email alert would be sent', {
      to: process.env.ALERT_EMAIL_RECIPIENTS,
      subject: `[${event.severity.toUpperCase()}] ${event.message}`,
      event
    });
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(event: MonitoringEvent): Promise<void> {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (!webhookUrl) return;

    // Implementation depends on your webhook handler
    logger.info('Webhook alert would be sent', { webhookUrl, event });
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    const services = ['api-gateway', 'labeling-backend', 'payment-backend', 'enterprise-api'];

    for (const serviceName of services) {
      try {
        const healthCheck = await this.checkServiceHealth(serviceName);
        this.healthChecks.set(serviceName, healthCheck);

        if (healthCheck.status === 'unhealthy') {
          this.recordAvailabilityEvent('service_health', 'HIGH', `Service ${serviceName} is unhealthy`, {
            service: serviceName,
            status: healthCheck.status,
            responseTime: healthCheck.responseTime,
            details: healthCheck.details
          }, serviceName);
        } else if (healthCheck.status === 'degraded') {
          this.recordAvailabilityEvent('service_health', 'MEDIUM', `Service ${serviceName} is degraded`, {
            service: serviceName,
            status: healthCheck.status,
            responseTime: healthCheck.responseTime,
            details: healthCheck.details
          }, serviceName);
        }
      } catch (error) {
        logger.error(`Health check failed for ${serviceName}:`, error);
        this.healthChecks.set(serviceName, {
          name: serviceName,
          status: 'unhealthy',
          lastCheck: Date.now(),
          responseTime: -1,
          details: { error: error.message }
        });
      }
    }
  }

  /**
   * Check individual service health
   */
  private async checkServiceHealth(serviceName: string): Promise<HealthCheck> {
    const startTime = Date.now();
    const healthUrls = {
      'api-gateway': process.env.API_GATEWAY_HEALTH_URL || 'http://localhost:3002/health',
      'labeling-backend': process.env.LABELING_HEALTH_URL || 'http://localhost:3001/health',
      'payment-backend': process.env.PAYMENT_HEALTH_URL || 'http://localhost:3000/health',
      'enterprise-api': process.env.ENTERPRISE_HEALTH_URL || 'http://localhost:3003/health'
    };

    const url = healthUrls[serviceName as keyof typeof healthUrls];
    if (!url) {
      throw new Error(`No health URL configured for service: ${serviceName}`);
    }

    // Simulate health check (replace with actual implementation)
    const responseTime = Date.now() - startTime;
    const status = responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'unhealthy';

    return {
      name: serviceName,
      status,
      lastCheck: Date.now(),
      responseTime,
      details: { url }
    };
  }

  /**
   * Collect service metrics
   */
  private collectMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics: ServiceMetrics = {
      requestCount: this.getRequestCount(),
      errorCount: this.getErrorCount(),
      averageResponseTime: this.getAverageResponseTime(),
      p95ResponseTime: this.getP95ResponseTime(),
      p99ResponseTime: this.getP99ResponseTime(),
      activeConnections: this.getActiveConnections(),
      memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to milliseconds
      cacheHitRate: this.getCacheHitRate(),
      databaseConnections: this.getDatabaseConnections(),
      timestamp: Date.now()
    };

    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > 1440) { // 24 hours of minute data
      this.metrics = this.metrics.slice(-1440);
    }

    // Emit metrics event
    this.emit('metrics', metrics);
  }

  /**
   * Detect anomalies
   */
  private detectAnomalies(event: MonitoringEvent): void {
    if (!this.baselineMetrics) return;

    const recentMetrics = this.metrics.slice(-this.config.anomalyDetection.windowSize);
    if (recentMetrics.length < this.config.anomalyDetection.windowSize) return;

    const thresholds = this.config.anomalyDetection.thresholds;
    const sensitivity = this.config.anomalyDetection.sensitivity;

    // Check for anomalies in various metrics
    const anomalies = [];

    // Response time anomaly
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / recentMetrics.length;
    if (Math.abs(avgResponseTime - this.baselineMetrics.averageResponseTime) / this.baselineMetrics.averageResponseTime > thresholds.responseTime) {
      anomalies.push({
        metric: 'response_time',
        current: avgResponseTime,
        baseline: this.baselineMetrics.averageResponseTime,
        deviation: Math.abs(avgResponseTime - this.baselineMetrics.averageResponseTime) / this.baselineMetrics.averageResponseTime
      });
    }

    // Error rate anomaly
    const errorRate = recentMetrics.reduce((sum, m) => sum + m.errorCount, 0) / recentMetrics.reduce((sum, m) => sum + m.requestCount, 1);
    const baselineErrorRate = this.baselineMetrics.errorCount / Math.max(1, this.baselineMetrics.requestCount);
    if (Math.abs(errorRate - baselineErrorRate) > thresholds.errorRate) {
      anomalies.push({
        metric: 'error_rate',
        current: errorRate,
        baseline: baselineErrorRate,
        deviation: Math.abs(errorRate - baselineErrorRate)
      });
    }

    // Memory usage anomaly
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
    if (Math.abs(avgMemoryUsage - this.baselineMetrics.memoryUsage) > thresholds.memoryUsage) {
      anomalies.push({
        metric: 'memory_usage',
        current: avgMemoryUsage,
        baseline: this.baselineMetrics.memoryUsage,
        deviation: Math.abs(avgMemoryUsage - this.baselineMetrics.memoryUsage)
      });
    }

    // Create anomaly events
    if (anomalies.length > 0) {
      this.recordPerformanceEvent('anomaly_detection', 'MEDIUM', 'Anomalies detected in service metrics', {
        anomalies,
        windowSize: this.config.anomalyDetection.windowSize,
        sensitivity
      });
    }
  }

  /**
   * Calculate baseline metrics
   */
  private calculateBaseline(): void {
    if (this.metrics.length < 60) return; // Need at least 1 hour of data

    const recentMetrics = this.metrics.slice(-60); // Last hour
    this.baselineMetrics = {
      requestCount: recentMetrics.reduce((sum, m) => sum + m.requestCount, 0),
      errorCount: recentMetrics.reduce((sum, m) => sum + m.errorCount, 0),
      averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / recentMetrics.length,
      p95ResponseTime: this.calculatePercentile(recentMetrics.map(m => m.p95ResponseTime), 95),
      p99ResponseTime: this.calculatePercentile(recentMetrics.map(m => m.p99ResponseTime), 99),
      activeConnections: Math.max(...recentMetrics.map(m => m.activeConnections)),
      memoryUsage: recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length,
      cpuUsage: recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length,
      cacheHitRate: recentMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / recentMetrics.length,
      databaseConnections: Math.max(...recentMetrics.map(m => m.databaseConnections)),
      timestamp: Date.now()
    };

    logger.info('Baseline metrics calculated', this.baselineMetrics);
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Clean old data
   */
  private cleanupOldData(): void {
    const now = Date.now();

    // Clean old events
    const eventRetentionMs = this.config.retention.events * 24 * 60 * 60 * 1000;
    this.events = this.events.filter(event => now - event.timestamp < eventRetentionMs);

    // Clean old metrics
    const metricsRetentionMs = this.config.retention.metrics * 24 * 60 * 60 * 1000;
    this.metrics = this.metrics.filter(metric => now - metric.timestamp < metricsRetentionMs);

    // Clean old health checks
    const healthRetentionMs = this.config.retention.healthChecks * 60 * 60 * 1000;
    for (const [name, healthCheck] of this.healthChecks.entries()) {
      if (now - healthCheck.lastCheck > healthRetentionMs) {
        this.healthChecks.delete(name);
      }
    }

    // Clean old alert cooldowns
    for (const [key, timestamp] of this.alertCooldowns.entries()) {
      if (now - timestamp > this.config.alerting.cooldown * 2) {
        this.alertCooldowns.delete(key);
      }
    }

    logger.debug('Old monitoring data cleaned up');
  }

  /**
   * Helper methods for metrics collection
   */
  private getRequestCount(): number {
    // Implementation depends on your request tracking
    return Math.floor(Math.random() * 1000);
  }

  private getErrorCount(): number {
    // Implementation depends on your error tracking
    return Math.floor(Math.random() * 50);
  }

  private getAverageResponseTime(): number {
    // Implementation depends on your response time tracking
    return Math.random() * 500;
  }

  private getP95ResponseTime(): number {
    // Implementation depends on your response time tracking
    return Math.random() * 1000;
  }

  private getP99ResponseTime(): number {
    // Implementation depends on your response time tracking
    return Math.random() * 2000;
  }

  private getActiveConnections(): number {
    // Implementation depends on your connection tracking
    return Math.floor(Math.random() * 100);
  }

  private getCacheHitRate(): number {
    // Implementation depends on your cache metrics
    return Math.random();
  }

  private getDatabaseConnections(): number {
    // Implementation depends on your database connection tracking
    return Math.floor(Math.random() * 20);
  }

  /**
   * Helper methods
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getAlertColor(severity: keyof AlertSeverity): string {
    const colors = {
      low: 'good',
      medium: 'warning',
      high: 'danger',
      critical: '#ff0000'
    };
    return colors[severity];
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboardData(): any {
    const now = Date.now();
    const recentEvents = this.events.filter(event => now - event.timestamp < 24 * 60 * 60 * 1000); // Last 24 hours

    return {
      summary: {
        totalEvents: this.events.length,
        recentEvents: recentEvents.length,
        activeAlerts: recentEvents.filter(e => !e.resolved && (e.severity === 'HIGH' || e.severity === 'CRITICAL')).length,
        systemHealth: Array.from(this.healthChecks.values()).every(h => h.status === 'healthy') ? 'healthy' : 'degraded'
      },
      events: recentEvents.slice(-100).map(event => ({
        id: event.id,
        type: event.type,
        severity: event.severity,
        category: event.category,
        message: event.message,
        timestamp: event.timestamp,
        resolved: event.resolved
      })),
      healthChecks: Array.from(this.healthChecks.values()),
      metrics: this.metrics.slice(-60), // Last hour
      alerts: {
        enabled: this.config.alerting.enabled,
        channels: this.config.alerting.channels,
        thresholds: this.config.alerting.thresholds
      }
    };
  }

  /**
   * Get monitoring statistics
   */
  getStatistics(): any {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    const recentEvents = this.events.filter(e => e.timestamp > last24Hours);

    return {
      events: {
        total: this.events.length,
        last24h: recentEvents.length,
        byType: {
          security: recentEvents.filter(e => e.type === 'security').length,
          performance: recentEvents.filter(e => e.type === 'performance').length,
          availability: recentEvents.filter(e => e.type === 'availability').length,
          business: recentEvents.filter(e => e.type === 'business').length
        },
        bySeverity: {
          low: recentEvents.filter(e => e.severity === 'LOW').length,
          medium: recentEvents.filter(e => e.severity === 'MEDIUM').length,
          high: recentEvents.filter(e => e.severity === 'HIGH').length,
          critical: recentEvents.filter(e => e.severity === 'CRITICAL').length
        }
      },
      healthChecks: {
        total: this.healthChecks.size,
        healthy: Array.from(this.healthChecks.values()).filter(h => h.status === 'healthy').length,
        degraded: Array.from(this.healthChecks.values()).filter(h => h.status === 'degraded').length,
        unhealthy: Array.from(this.healthChecks.values()).filter(h => h.status === 'unhealthy').length
      },
      metrics: {
        collected: this.metrics.length,
        baseline: this.baselineMetrics ? {
          averageResponseTime: this.baselineMetrics.averageResponseTime,
          errorRate: this.baselineMetrics.errorCount / Math.max(1, this.baselineMetrics.requestCount),
          memoryUsage: this.baselineMetrics.memoryUsage
        } : null
      },
      alerts: {
        triggered: this.alertCooldowns.size,
        enabled: this.config.alerting.enabled,
        lastTrigger: this.alertCooldowns.size > 0 ? Math.max(...Array.from(this.alertCooldowns.values())) : null
      }
    };
  }
}

// Export singleton instance
export const apiMonitoring = new APIMonitoringService();
export default apiMonitoring;