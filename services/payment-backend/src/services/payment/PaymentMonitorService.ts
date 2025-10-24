/**
 * Payment Monitoring Service for Production
 * Monitors payment failures, tracks metrics, and triggers alerts
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { TON_MAINNET_CONFIG } from '@/config/ton-mainnet';

export interface PaymentMetric {
  timestamp: Date;
  type: 'success' | 'failure' | 'timeout' | 'high_gas' | 'low_balance';
  transactionId?: string;
  userId?: string;
  amount?: string;
  fee?: string;
  error?: string;
  gasUsed?: string;
  confirmationTime?: number;
}

export interface AlertData {
  type: 'critical' | 'warning' | 'info';
  message: string;
  metrics: PaymentMetric[];
  threshold: number;
  currentValue: number;
}

export class PaymentMonitorService extends EventEmitter {
  private prisma: PrismaClient;
  private cloudwatch: CloudWatchLogsClient;
  private metrics: PaymentMetric[] = [];
  private alertQueue: AlertData[] = [];
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;
  private alertInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.cloudwatch = new CloudWatchLogsClient({ region: process.env.AWS_REGION });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Payment monitor already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting payment monitoring service...');

    // Start monitoring intervals
    this.monitoringInterval = setInterval(() => {
      this.checkPaymentHealth();
      this.analyzeMetrics();
      this.checkGasPrices();
      this.checkPendingTransactions();
    }, 30000); // Every 30 seconds

    this.alertInterval = setInterval(() => {
      this.processAlerts();
    }, 5000); // Every 5 seconds

    // Listen to payment events
    this.setupEventListeners();

    console.log('Payment monitoring service started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.alertInterval) {
      clearInterval(this.alertInterval);
    }

    console.log('Payment monitoring service stopped');
  }

  private setupEventListeners(): void {
    // Listen to transaction events
    this.on('transaction_success', (metric: PaymentMetric) => {
      this.recordMetric(metric);
    });

    this.on('transaction_failure', (metric: PaymentMetric) => {
      this.recordMetric(metric);
      this.checkFailureSpike(metric);
    });

    this.on('transaction_timeout', (metric: PaymentMetric) => {
      this.recordMetric(metric);
      this.alert({
        type: 'warning',
        message: `Transaction timeout: ${metric.transactionId}`,
        metrics: [metric],
        threshold: TON_MAINNET_CONFIG.limits.confirmationTimeout,
        currentValue: metric.confirmationTime || 0
      });
    });
  }

  recordMetric(metric: PaymentMetric): void {
    this.metrics.push(metric);

    // Keep only last 10000 metrics in memory
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }

    // Send to CloudWatch
    this.sendToCloudWatch(metric);
  }

  private async sendToCloudWatch(metric: PaymentMetric): Promise<void> {
    try {
      const command = new PutLogEventsCommand({
        logGroupName: `/aws/ecs/labelmint-payments`,
        logStreamName: `payment-metrics-${new Date().toISOString().split('T')[0]}`,
        logEvents: [{
          timestamp: Date.now(),
          message: JSON.stringify(metric)
        }]
      });

      await this.cloudwatch.send(command);
    } catch (error) {
      console.error('Failed to send metric to CloudWatch:', error);
    }
  }

  private async checkPaymentHealth(): Promise<void> {
    try {
      // Check recent transaction success rate
      const recentTime = new Date(Date.now() - 300000); // Last 5 minutes
      const recentMetrics = this.metrics.filter(m => m.timestamp > recentTime);

      if (recentMetrics.length > 0) {
        const failureRate = recentMetrics.filter(m => m.type === 'failure').length / recentMetrics.length;

        if (failureRate > TON_MAINNET_CONFIG.monitoring.failureRateThreshold) {
          this.alert({
            type: 'critical',
            message: `High failure rate detected: ${(failureRate * 100).toFixed(2)}%`,
            metrics: recentMetrics,
            threshold: TON_MAINNET_CONFIG.monitoring.failureRateThreshold,
            currentValue: failureRate
          });
        }
      }

      // Check database for stuck transactions
      const stuckTransactions = await this.prisma.tonTransaction.findMany({
        where: {
          status: 'PENDING',
          createdAt: { lt: new Date(Date.now() - TON_MAINNET_CONFIG.limits.confirmationTimeout) }
        }
      });

      if (stuckTransactions.length > 0) {
        stuckTransactions.forEach(tx => {
          this.recordMetric({
            timestamp: new Date(),
            type: 'timeout',
            transactionId: tx.id,
            userId: tx.userId,
            amount: tx.amount,
            error: 'Transaction stuck in pending state'
          });
        });
      }

    } catch (error) {
      console.error('Error checking payment health:', error);
    }
  }

  private async analyzeMetrics(): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const lastHourMetrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

    // Calculate hourly statistics
    const stats = {
      totalTransactions: lastHourMetrics.length,
      successRate: 0,
      averageFee: 0,
      averageConfirmationTime: 0,
      totalVolume: '0',
      errors: {} as Record<string, number>
    };

    if (lastHourMetrics.length > 0) {
      const successful = lastHourMetrics.filter(m => m.type === 'success');
      stats.successRate = successful.length / lastHourMetrics.length;

      const fees = lastHourMetrics.filter(m => m.fee).map(m => parseFloat(m.fee!));
      if (fees.length > 0) {
        stats.averageFee = fees.reduce((a, b) => a + b, 0) / fees.length;
      }

      const confirmationTimes = lastHourMetrics.filter(m => m.confirmationTime)
        .map(m => m.confirmationTime!);
      if (confirmationTimes.length > 0) {
        stats.averageConfirmationTime = confirmationTimes.reduce((a, b) => a + b, 0) / confirmationTimes.length;
      }

      // Count error types
      lastHourMetrics.forEach(m => {
        if (m.error && m.type === 'failure') {
          stats.errors[m.error] = (stats.errors[m.error] || 0) + 1;
        }
      });
    }

    // Emit statistics
    this.emit('hourly_stats', stats);
  }

  private async checkGasPrices(): Promise<void> {
    try {
      // This would integrate with TON API to get current gas prices
      // For now, we'll simulate with recent transaction fees
      const recentMetrics = this.metrics.slice(-100);
      const highGasTx = recentMetrics.filter(m =>
        m.fee && parseFloat(m.fee) > parseFloat(TON_MAINNET_CONFIG.monitoring.gasPriceThreshold)
      );

      if (highGasTx.length > recentMetrics.length * 0.2) { // More than 20% of transactions
        this.alert({
          type: 'warning',
          message: `High gas prices detected: ${highGasTx.length} transactions affected`,
          metrics: highGasTx,
          threshold: parseFloat(TON_MAINNET_CONFIG.monitoring.gasPriceThreshold),
          currentValue: highGasTx.reduce((sum, tx) => sum + parseFloat(tx.fee!), 0) / highGasTx.length
        });
      }
    } catch (error) {
      console.error('Error checking gas prices:', error);
    }
  }

  private async checkPendingTransactions(): Promise<void> {
    try {
      const pendingCount = await this.prisma.tonTransaction.count({
        where: { status: 'PENDING' }
      });

      if (pendingCount > TON_MAINNET_CONFIG.monitoring.pendingTxThreshold) {
        this.alert({
          type: 'warning',
          message: `High number of pending transactions: ${pendingCount}`,
          metrics: [],
          threshold: TON_MAINNET_CONFIG.monitoring.pendingTxThreshold,
          currentValue: pendingCount
        });
      }
    } catch (error) {
      console.error('Error checking pending transactions:', error);
    }
  }

  private checkFailureSpike(metric: PaymentMetric): void {
    const userFailures = this.metrics.filter(m =>
      m.userId === metric.userId &&
      m.type === 'failure' &&
      m.timestamp > new Date(Date.now() - 3600000) // Last hour
    );

    if (userFailures.length >= TON_MAINNET_CONFIG.security.suspiciousActivityThreshold) {
      this.alert({
        type: 'critical',
        message: `Suspicious activity detected for user ${metric.userId}: ${userFailures.length} failed transactions`,
        metrics: userFailures,
        threshold: TON_MAINNET_CONFIG.security.suspiciousActivityThreshold,
        currentValue: userFailures.length
      });
    }
  }

  private alert(data: AlertData): void {
    this.alertQueue.push(data);
    this.emit('alert', data);
  }

  private async processAlerts(): Promise<void> {
    if (this.alertQueue.length === 0) return;

    const alerts = this.alertQueue.splice(0, 10); // Process 10 alerts at a time

    for (const alert of alerts) {
      try {
        // Send to monitoring system (Slack, PagerDuty, etc.)
        await this.sendAlert(alert);

        // Log alert
        console.warn(`[${alert.type.toUpperCase()}] ${alert.message}`, {
          threshold: alert.threshold,
          currentValue: alert.currentValue
        });

        // Store in database for analytics
        await this.prisma.paymentAlert.create({
          data: {
            type: alert.type,
            message: alert.message,
            threshold: alert.threshold.toString(),
            currentValue: alert.currentValue.toString(),
            metadata: JSON.stringify({
              metrics: alert.metrics,
              timestamp: new Date()
            })
          }
        });

      } catch (error) {
        console.error('Failed to process alert:', error);
        // Re-queue failed alerts
        this.alertQueue.unshift(alert);
      }
    }
  }

  private async sendAlert(alert: AlertData): Promise<void> {
    // Implement your alert delivery mechanism here
    // Examples: Slack webhook, PagerDuty, Email, etc.

    if (process.env.SLACK_WEBHOOK_URL) {
      const slackMessage = {
        text: `Payment Alert: ${alert.type.toUpperCase()}`,
        attachments: [{
          color: alert.type === 'critical' ? 'danger' : alert.type === 'warning' ? 'warning' : 'good',
          fields: [
            { title: 'Message', value: alert.message, short: false },
            { title: 'Threshold', value: alert.threshold.toString(), short: true },
            { title: 'Current Value', value: alert.currentValue.toString(), short: true }
          ]
        }]
      };

      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage)
      });
    }
  }

  // Public methods for querying metrics
  getMetrics(timeRange?: { start: Date; end: Date }): PaymentMetric[] {
    if (!timeRange) return this.metrics;

    return this.metrics.filter(m =>
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  async getPaymentStats(period: 'hour' | 'day' | 'week' = 'hour') {
    const now = new Date();
    let startTime: Date;

    switch (period) {
      case 'hour':
        startTime = new Date(now.getTime() - 3600000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 86400000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 604800000);
        break;
    }

    const [total, successful, failed, volume] = await Promise.all([
      this.prisma.tonTransaction.count({
        where: { createdAt: { gte: startTime } }
      }),
      this.prisma.tonTransaction.count({
        where: { status: 'COMPLETED', createdAt: { gte: startTime } }
      }),
      this.prisma.tonTransaction.count({
        where: { status: 'FAILED', createdAt: { gte: startTime } }
      }),
      this.prisma.tonTransaction.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: startTime } },
        _sum: { amount: true }
      })
    ]);

    return {
      period,
      totalTransactions: total,
      successfulTransactions: successful,
      failedTransactions: failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      totalVolume: volume._sum.amount || '0',
      averageTransactionValue: successful > 0 ?
        (parseFloat(volume._sum.amount || '0') / successful).toString() : '0'
    };
  }
}

export const paymentMonitor = new PaymentMonitorService();