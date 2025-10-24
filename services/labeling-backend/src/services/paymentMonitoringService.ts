import { PrismaClient } from '@prisma/client';
import { RedisClient } from '../lib/redis';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

interface AlertConfig {
  enabled: boolean;
  thresholds: {
    failedTransactions: number;
    pendingPayments: number;
    withdrawalFailures: number;
    unusualVolume: number;
    processingTime: number; // in seconds
  };
  notifications: {
    email: boolean;
    slack: boolean;
    telegram: boolean;
  };
  recipients: {
    emails: string[];
    slackChannels: string[];
    telegramChats: string[];
  };
}

interface MonitoringMetrics {
  timestamp: Date;
  activeConnections: number;
  pendingTransactions: number;
  failedTransactions: number;
  avgProcessingTime: number;
  queueSize: number;
  errorRate: number;
  throughput: number;
}

interface Alert {
  id: string;
  type: 'PERFORMANCE' | 'ERROR' | 'SECURITY' | 'CAPACITY';
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  title: string;
  message: string;
  metrics: any;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  resolvedAt?: Date;
}

export class PaymentMonitoringService extends EventEmitter {
  private config: AlertConfig;
  private metrics: MonitoringMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  // Metric collection intervals
  private readonly METRICS_INTERVAL = 30000; // 30 seconds
  private readonly ALERT_CHECK_INTERVAL = 60000; // 1 minute
  private readonly METRICS_RETENTION = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private prisma: PrismaClient,
    private redis: RedisClient,
    config: AlertConfig
  ) {
    super();
    this.config = config;
  }

  /**
   * Start monitoring the payment service
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Payment monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting payment monitoring service');

    // Start metrics collection
    this.monitoringInterval = setInterval(
      () => this.collectMetrics(),
      this.METRICS_INTERVAL
    );

    // Start alert checking
    setInterval(
      () => this.checkAlerts(),
      this.ALERT_CHECK_INTERVAL
    );

    // Initial metrics collection
    await this.collectMetrics();

    logger.info('Payment monitoring service started');
  }

  /**
   * Stop monitoring the payment service
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Payment monitoring service stopped');
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const [
        pendingCount,
        failedCount,
        processingStats,
        queueSize,
        activeConnections,
      ] = await Promise.all([
        // Count pending transactions
        this.prisma.transaction.count({
          where: {
            status: 'PENDING',
            createdAt: { gte: fiveMinutesAgo },
          },
        }),
        // Count failed transactions
        this.prisma.transaction.count({
          where: {
            status: 'FAILED',
            createdAt: { gte: fiveMinutesAgo },
          },
        }),
        // Calculate average processing time
        this.prisma.transaction.aggregate({
          where: {
            status: 'COMPLETED',
            completedAt: { not: null },
            createdAt: { gte: fiveMinutesAgo },
          },
          _avg: {
            createdAt: true,
          },
        }),
        // Get queue size from Redis
        this.redis.llen('payment_queue'),
        // Get active database connections (approximate)
        this.getActiveConnections(),
      ]);

      // Calculate error rate
      const totalTransactions = await this.prisma.transaction.count({
        where: { createdAt: { gte: fiveMinutesAgo } },
      });
      const errorRate = totalTransactions > 0 ? (failedCount / totalTransactions) * 100 : 0;

      // Calculate throughput (transactions per minute)
      const throughput = totalTransactions / 5;

      const metrics: MonitoringMetrics = {
        timestamp: now,
        activeConnections,
        pendingTransactions: pendingCount,
        failedTransactions: failedCount,
        avgProcessingTime: this.calculateAvgProcessingTime(processingStats),
        queueSize,
        errorRate,
        throughput,
      };

      // Store metrics
      this.metrics.push(metrics);

      // Cleanup old metrics
      this.cleanupOldMetrics();

      // Store in Redis for dashboard
      await this.redis.setex(
        'payment_metrics:latest',
        60,
        JSON.stringify(metrics)
      );

      // Store time series data
      await this.redis.lpush(
        'payment_metrics:timeseries',
        JSON.stringify(metrics)
      );
      await this.redis.ltrim('payment_metrics:timeseries', 0, 999); // Keep last 1000 entries

      // Emit metrics event
      this.emit('metrics', metrics);

    } catch (error) {
      logger.error('Failed to collect metrics', error);
      this.createAlert({
        type: 'ERROR',
        severity: 'ERROR',
        title: 'Metrics Collection Failed',
        message: `Failed to collect payment metrics: ${error.message}`,
        metrics: { error: error.message },
        triggeredAt: new Date(),
        acknowledged: false,
      });
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const latestMetrics = this.metrics[this.metrics.length - 1];
    if (!latestMetrics) {
      return;
    }

    // Check various alert conditions
    await this.checkFailedTransactionsAlert(latestMetrics);
    await this.checkPendingPaymentsAlert(latestMetrics);
    await this.checkProcessingTimeAlert(latestMetrics);
    await this.checkQueueSizeAlert(latestMetrics);
    await this.checkErrorRateAlert(latestMetrics);
    await this.checkThroughputAlert(latestMetrics);
  }

  /**
   * Check for failed transactions alert
   */
  private async checkFailedTransactionsAlert(metrics: MonitoringMetrics): Promise<void> {
    if (metrics.failedTransactions > this.config.thresholds.failedTransactions) {
      const alertId = 'failed_transactions';

      if (!this.alerts.has(alertId) || !this.alerts.get(alertId)?.acknowledged) {
        await this.createAlert({
          id: alertId,
          type: 'ERROR',
          severity: metrics.failedTransactions > this.config.thresholds.failedTransactions * 2 ? 'CRITICAL' : 'ERROR',
          title: 'High Failed Transaction Rate',
          message: `${metrics.failedTransactions} transactions failed in the last 5 minutes (threshold: ${this.config.thresholds.failedTransactions})`,
          metrics: { failedTransactions: metrics.failedTransactions },
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }
    }
  }

  /**
   * Check for pending payments alert
   */
  private async checkPendingPaymentsAlert(metrics: MonitoringMetrics): Promise<void> {
    if (metrics.pendingTransactions > this.config.thresholds.pendingPayments) {
      const alertId = 'pending_payments';

      if (!this.alerts.has(alertId) || !this.alerts.get(alertId)?.acknowledged) {
        await this.createAlert({
          id: alertId,
          type: 'PERFORMANCE',
          severity: 'WARNING',
          title: 'High Pending Payment Count',
          message: `${metrics.pendingTransactions} payments are pending (threshold: ${this.config.thresholds.pendingPayments})`,
          metrics: { pendingTransactions: metrics.pendingTransactions },
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }
    }
  }

  /**
   * Check for processing time alert
   */
  private async checkProcessingTimeAlert(metrics: MonitoringMetrics): Promise<void> {
    if (metrics.avgProcessingTime > this.config.thresholds.processingTime) {
      const alertId = 'slow_processing';

      if (!this.alerts.has(alertId) || !this.alerts.get(alertId)?.acknowledged) {
        await this.createAlert({
          id: alertId,
          type: 'PERFORMANCE',
          severity: metrics.avgProcessingTime > this.config.thresholds.processingTime * 2 ? 'ERROR' : 'WARNING',
          title: 'Slow Payment Processing',
          message: `Average processing time is ${metrics.avgProcessingTime}s (threshold: ${this.config.thresholds.processingTime}s)`,
          metrics: { avgProcessingTime: metrics.avgProcessingTime },
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }
    }
  }

  /**
   * Check for queue size alert
   */
  private async checkQueueSizeAlert(metrics: MonitoringMetrics): Promise<void> {
    const queueThreshold = 1000; // Configurable
    if (metrics.queueSize > queueThreshold) {
      const alertId = 'large_queue';

      if (!this.alerts.has(alertId) || !this.alerts.get(alertId)?.acknowledged) {
        await this.createAlert({
          id: alertId,
          type: 'CAPACITY',
          severity: metrics.queueSize > queueThreshold * 2 ? 'CRITICAL' : 'WARNING',
          title: 'Large Payment Queue',
          message: `Payment queue has ${metrics.queueSize} items (threshold: ${queueThreshold})`,
          metrics: { queueSize: metrics.queueSize },
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }
    }
  }

  /**
   * Check for error rate alert
   */
  private async checkErrorRateAlert(metrics: MonitoringMetrics): Promise<void> {
    const errorRateThreshold = 5; // 5%
    if (metrics.errorRate > errorRateThreshold) {
      const alertId = 'high_error_rate';

      if (!this.alerts.has(alertId) || !this.alerts.get(alertId)?.acknowledged) {
        await this.createAlert({
          id: alertId,
          type: 'ERROR',
          severity: metrics.errorRate > 10 ? 'CRITICAL' : 'ERROR',
          title: 'High Error Rate',
          message: `Error rate is ${metrics.errorRate.toFixed(2)}% (threshold: ${errorRateThreshold}%)`,
          metrics: { errorRate: metrics.errorRate },
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }
    }
  }

  /**
   * Check for throughput alert
   */
  private async checkThroughputAlert(metrics: MonitoringMetrics): Promise<void> {
    const expectedThroughput = 10; // transactions per minute
    if (metrics.throughput < expectedThroughput && metrics.throughput > 0) {
      const alertId = 'low_throughput';

      if (!this.alerts.has(alertId) || !this.alerts.get(alertId)?.acknowledged) {
        await this.createAlert({
          id: alertId,
          type: 'PERFORMANCE',
          severity: 'WARNING',
          title: 'Low Transaction Throughput',
          message: `Throughput is ${metrics.throughput.toFixed(2)} tx/min (expected: ${expectedThroughput} tx/min)`,
          metrics: { throughput: metrics.throughput },
          triggeredAt: new Date(),
          acknowledged: false,
        });
      }
    }
  }

  /**
   * Create and handle an alert
   */
  private async createAlert(alert: Alert): Promise<void> {
    // Store alert
    this.alerts.set(alert.id, alert);

    // Store in Redis
    await this.redis.hset(
      'payment_alerts',
      alert.id,
      JSON.stringify(alert)
    );
    await this.redis.expire('payment_alerts', 7 * 24 * 60 * 60); // 7 days

    // Emit alert event
    this.emit('alert', alert);

    // Send notifications
    await this.sendNotifications(alert);

    logger.warn('Payment alert triggered', {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
    });
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const notifications = [];

    // Email notification
    if (this.config.notifications.email && this.config.recipients.emails.length > 0) {
      notifications.push(
        this.sendEmailNotification(alert, this.config.recipients.emails)
      );
    }

    // Slack notification
    if (this.config.notifications.slack && this.config.recipients.slackChannels.length > 0) {
      notifications.push(
        this.sendSlackNotification(alert, this.config.recipients.slackChannels)
      );
    }

    // Telegram notification
    if (this.config.notifications.telegram && this.config.recipients.telegramChats.length > 0) {
      notifications.push(
        this.sendTelegramNotification(alert, this.config.recipients.telegramChats)
      );
    }

    // Send all notifications in parallel
    await Promise.allSettled(notifications);
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(alert: Alert, emails: string[]): Promise<void> {
    // Implementation would depend on email service (SendGrid, AWS SES, etc.)
    logger.info(`Email alert sent to ${emails.join(', ')}`, {
      alertId: alert.id,
      title: alert.title,
    });
  }

  /**
   * Send Slack notification (placeholder)
   */
  private async sendSlackNotification(alert: Alert, channels: string[]): Promise<void> {
    // Implementation would use Slack Web API
    const color = this.getSeverityColor(alert.severity);
    const message = {
      attachments: [{
        color,
        title: `[${alert.severity}] ${alert.title}`,
        text: alert.message,
        fields: [
          { title: 'Type', value: alert.type, short: true },
          { title: 'Time', value: alert.triggeredAt.toISOString(), short: true },
        ],
        footer: 'LabelMint Payment Monitoring',
      }],
    };

    logger.info(`Slack alert sent to ${channels.join(', ')}`, {
      alertId: alert.id,
      message,
    });
  }

  /**
   * Send Telegram notification (placeholder)
   */
  private async sendTelegramNotification(alert: Alert, chats: string[]): Promise<void> {
    // Implementation would use Telegram Bot API
    const emoji = this.getSeverityEmoji(alert.severity);
    const message = `${emoji} *${alert.title}*\n\n${alert.message}\n\n_Type: ${alert.type}_\n_Time: ${alert.triggeredAt.toISOString()}_`;

    logger.info(`Telegram alert sent to ${chats.join(', ')}`, {
      alertId: alert.id,
      message,
    });
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;

    // Update Redis
    await this.redis.hset(
      'payment_alerts',
      alertId,
      JSON.stringify(alert)
    );

    logger.info(`Alert ${alertId} acknowledged by ${userId}`);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.resolvedAt = new Date();

    // Update Redis
    await this.redis.hset(
      'payment_alerts',
      alertId,
      JSON.stringify(alert)
    );

    logger.info(`Alert ${alertId} resolved`);
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): MonitoringMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(minutes: number = 60): MonitoringMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolvedAt);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  // Helper methods

  private calculateAvgProcessingTime(stats: any): number {
    // Placeholder calculation - would need actual implementation
    return 5; // seconds
  }

  private async getActiveConnections(): Promise<number> {
    // This would need to be implemented based on your database connection pool
    return 5; // placeholder
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.METRICS_RETENTION);
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return 'danger';
      case 'ERROR': return 'warning';
      case 'WARNING': return 'warning';
      case 'INFO': return 'good';
      default: return 'good';
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return '🚨';
      case 'ERROR': return '❌';
      case 'WARNING': return '⚠️';
      case 'INFO': return 'ℹ️';
      default: return 'ℹ️';
    }
  }
}