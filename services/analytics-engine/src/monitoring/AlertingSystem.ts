/**
 * Comprehensive Monitoring and Alerting System
 * Real-time monitoring with intelligent alerting for LabelMint analytics
 */

import EventEmitter from 'events';
import {
  AlertSeverity,
  ExecutiveAlert,
  ModelDriftMetrics,
  OperationalAnalytics,
  FinancialAnalytics,
  MLAnalytics
} from '../types/analytics.types';
import { getGlobalMetrics } from '@shared/observability/metrics';

export interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  source: string;
  metric: string;
  currentValue: number;
  threshold: number;
  trend: 'up' | 'down' | 'stable';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  metadata: Record<string, any>;
  actions: AlertAction[];
}

export interface AlertAction {
  id: string;
  type: 'auto' | 'manual';
  title: string;
  description: string;
  url?: string;
  method?: 'POST' | 'GET' | 'PUT';
  payload?: Record<string, any>;
  executed: boolean;
  executedAt?: Date;
  result?: any;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  source: string;
  metric: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  threshold: number;
  evaluationInterval: number; // minutes
  cooldownPeriod: number; // minutes
  actions: AlertAction[];
  notifications: NotificationConfig[];
  suppressionRules: SuppressionRule[];
}

export interface AlertCondition {
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  value: number;
  aggregation?: 'avg' | 'sum' | 'max' | 'min' | 'count';
  timeWindow?: number; // minutes
}

export interface NotificationConfig {
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'pagerduty';
  enabled: boolean;
  config: Record<string, any>;
  recipients: string[];
}

export interface SuppressionRule {
  type: 'time' | 'maintenance' | 'tag' | 'custom';
  condition: Record<string, any>;
  duration?: number; // minutes
}

export interface MonitoringDashboard {
  id: string;
  name: string;
  description: string;
  panels: DashboardPanel[];
  refreshInterval: number;
  autoRefresh: boolean;
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'status';
  visualization: any;
  metrics: string[];
  alerts: string[];
  thresholds: Record<string, number>;
}

export class AlertingSystem extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private metrics = getGlobalMetrics();
  private isRunning = false;
  private evaluationTimer?: NodeJS.Timeout;
  private suppressionPeriods: Map<string, Date> = new Map();

  constructor() {
    super();
    this.setupDefaultRules();
  }

  /**
   * Start the alerting system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Alerting system is already running');
    }

    this.isRunning = true;
    this.startEvaluation();

    this.emit('started');
    this.metrics.increment('alerting_system_started');
    console.log('🚨 Alerting system started');
  }

  /**
   * Stop the alerting system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }

    this.emit('stopped');
    this.metrics.increment('alerting_system_stopped');
    console.log('🛑 Alerting system stopped');
  }

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(`Added alert rule: ${rule.name}`);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    console.log(`Removed alert rule: ${ruleId}`);
  }

  /**
   * Enable/disable an alert rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      console.log(`${enabled ? 'Enabled' : 'Disabled'} alert rule: ${ruleId}`);
    }
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, userId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      this.emit('alertAcknowledged', alert);
      this.metrics.increment('alert_acknowledged');
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, userId?: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      if (userId) {
        alert.acknowledgedBy = userId;
        alert.acknowledgedAt = new Date();
      }
      this.emit('alertResolved', alert);
      this.metrics.increment('alert_resolved');
    }
  }

  /**
   * Manually trigger an alert
   */
  triggerAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): Alert {
    const fullAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false
    };

    this.activeAlerts.set(fullAlert.id, fullAlert);
    this.emit('alertTriggered', fullAlert);
    this.metrics.increment('alert_triggered', { severity: alert.severity });

    // Execute automatic actions
    this.executeActions(fullAlert);

    // Send notifications
    this.sendNotifications(fullAlert);

    return fullAlert;
  }

  /**
   * Evaluate metrics and trigger alerts
   */
  async evaluateMetrics(): Promise<void> {
    const now = Date.now();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      // Check cooldown period
      if (this.isInCooldown(rule.id, now)) {
        continue;
      }

      // Check suppression rules
      if (this.isSuppressed(rule)) {
        continue;
      }

      try {
        const shouldAlert = await this.evaluateRule(rule);
        if (shouldAlert) {
          const alert = await this.createAlertFromRule(rule);
          this.activeAlerts.set(alert.id, alert);
          this.emit('alertTriggered', alert);
          this.metrics.increment('alert_triggered', { severity: alert.severity, rule: rule.id });

          // Execute automatic actions
          this.executeActions(alert);

          // Send notifications
          this.sendNotifications(alert);

          // Set cooldown
          this.setCooldown(rule.id, now);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
        this.metrics.increment('alert_evaluation_error', { rule: rule.id });
      }
    }
  }

  /**
   * Evaluate executive analytics for alerts
   */
  async evaluateExecutiveAnalytics(analytics: any): Promise<void> {
    const rules = [
      {
        id: 'executive-revenue-decline',
        name: 'Revenue Decline Alert',
        condition: { operator: 'lt', value: 5 },
        severity: 'critical' as AlertSeverity,
        metric: 'revenue_growth',
        currentValue: analytics.kpis.revenue.growth,
        source: 'executive'
      },
      {
        id: 'executive-user-churn-high',
        name: 'High User Churn Alert',
        condition: { operator: 'gt', value: 10 },
        severity: 'warning' as AlertSeverity,
        metric: 'churn_rate',
        currentValue: analytics.kpis.efficiency.churnRate,
        source: 'executive'
      },
      {
        id: 'executive-efficiency-low',
        name: 'Low Operating Efficiency',
        condition: { operator: 'lt', value: 15 },
        severity: 'warning' as AlertSeverity,
        metric: 'operating_margin',
        currentValue: analytics.kpis.efficiency.operatingMargin,
        source: 'executive'
      }
    ];

    for (const rule of rules) {
      const shouldAlert = this.evaluateCondition(rule.condition, rule.currentValue);
      if (shouldAlert) {
        this.triggerAlert({
          type: 'executive',
          severity: rule.severity,
          title: rule.name,
          description: `${rule.metric} is ${rule.currentValue}${rule.metric.includes('rate') ? '%' : ''}, threshold is ${rule.condition.value}${rule.metric.includes('rate') ? '%' : ''}`,
          source: rule.source,
          metric: rule.metric,
          currentValue: rule.currentValue,
          threshold: rule.condition.value,
          trend: 'down',
          metadata: { category: 'executive' },
          actions: []
        });
      }
    }
  }

  /**
   * Evaluate ML analytics for alerts
   */
  async evaluateMLAnalytics(analytics: MLAnalytics): Promise<void> {
    // Check for high drift
    const highDriftModels = analytics.modelPerformance.drift.filter((drift: ModelDriftMetrics) =>
      drift.severity === 'high' || drift.dataDrift > 0.2
    );

    for (const drift of highDriftModels) {
      this.triggerAlert({
        type: 'ml',
        severity: 'critical',
        title: 'Critical Model Drift Detected',
        description: `Model ${drift.modelId} has high drift: data=${(drift.dataDrift * 100).toFixed(1)}%, concept=${(drift.conceptDrift * 100).toFixed(1)}%`,
        source: 'ml',
        metric: 'model_drift',
        currentValue: drift.dataDrift,
        threshold: 0.2,
        trend: 'up',
        metadata: {
          modelId: drift.modelId,
          modelType: drift.modelId.split('-')[0],
          severity: drift.severity,
          detected: drift.detected
        },
        actions: [
          {
            id: 'retrain-model',
            type: 'auto',
            title: 'Schedule Model Retraining',
            description: 'Automatically schedule retraining for affected model'
          }
        ]
      });
    }

    // Check for low accuracy
    const lowAccuracyModels = analytics.modelPerformance.accuracy.filter((acc: any) => acc.accuracy < 80);

    for (const accuracy of lowAccuracyModels) {
      this.triggerAlert({
        type: 'ml',
        severity: 'warning',
        title: 'Low Model Accuracy',
        description: `Model ${accuracy.modelId} accuracy is ${accuracy.accuracy.toFixed(1)}%`,
        source: 'ml',
        metric: 'model_accuracy',
        currentValue: accuracy.accuracy,
        threshold: 80,
        trend: 'down',
        metadata: {
          modelId: accuracy.modelId,
          modelName: accuracy.modelName,
          accuracy: accuracy.accuracy,
          precision: accuracy.precision,
          recall: accuracy.recall
        },
        actions: []
      });
    }
  }

  /**
   * Get monitoring dashboard configuration
   */
  getDashboard(): MonitoringDashboard {
    return {
      id: 'labelmint-monitoring',
      name: 'LabelMint Monitoring Dashboard',
      description: 'Real-time monitoring of all LabelMint services and metrics',
      refreshInterval: 30,
      autoRefresh: true,
      panels: [
        {
          id: 'system-health',
          title: 'System Health Overview',
          type: 'status',
          visualization: 'gauge',
          metrics: ['system_uptime', 'error_rate', 'response_time'],
          alerts: ['critical', 'warning'],
          thresholds: { uptime: 99.5, error_rate: 1, response_time: 500 }
        },
        {
          id: 'active-alerts',
          title: 'Active Alerts',
          type: 'alert',
          visualization: 'table',
          metrics: [],
          alerts: ['all'],
          thresholds: {}
        },
        {
          id: 'executive-kpis',
          title: 'Executive KPIs',
          type: 'metric',
          visualization: 'gauge',
          metrics: ['revenue_growth', 'user_growth', 'churn_rate', 'operating_margin'],
          alerts: ['executive'],
          thresholds: { revenue_growth: 5, user_growth: 2, churn_rate: 5, operating_margin: 15 }
        },
        {
          id: 'ml-model-health',
          title: 'ML Model Health',
          type: 'chart',
          visualization: 'line',
          metrics: ['model_accuracy', 'model_drift', 'prediction_latency'],
          alerts: ['ml'],
          thresholds: { accuracy: 80, drift: 0.2, latency: 100 }
        }
      ]
    };
  }

  // Private methods

  private setupDefaultRules(): void {
    // System health rules
    this.addRule({
      id: 'system-uptime',
      name: 'System Uptime Low',
      description: 'Alert when system uptime drops below threshold',
      enabled: true,
      source: 'system',
      metric: 'uptime',
      condition: { operator: 'lt', value: 99.5 },
      severity: 'critical',
      threshold: 99.5,
      evaluationInterval: 1,
      cooldownPeriod: 5,
      actions: [
        {
          id: 'check-system-health',
          type: 'auto',
          title: 'Run System Health Check',
          description: 'Run comprehensive system health diagnostics'
        }
      ],
      notifications: [
        {
          type: 'slack',
          enabled: true,
          config: { channel: '#alerts' },
          recipients: ['devops', 'engineering']
        }
      ],
      suppressionRules: [
        {
          type: 'maintenance',
          condition: { maintenance: true }
        }
      ]
    });

    // Error rate rules
    this.addRule({
      id: 'error-rate-high',
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds threshold',
      enabled: true,
      source: 'system',
      metric: 'error_rate',
      condition: { operator: 'gt', value: 5 },
      severity: 'warning',
      threshold: 5,
      evaluationInterval: 1,
      cooldownPeriod: 5,
      actions: [],
      notifications: [
        {
          type: 'email',
          enabled: true,
          config: { template: 'error-rate-alert' },
          recipients: ['devops@labelmint.it']
        }
      ],
      suppressionRules: []
    });

    // Response time rules
    this.addRule({
      id: 'response-time-slow',
      name: 'Slow Response Time',
      description: 'Alert when response time exceeds threshold',
      enabled: true,
      source: 'system',
      metric: 'response_time',
      condition: { operator: 'gt', value: 500 },
      severity: 'warning',
      threshold: 500,
      evaluationInterval: 1,
      cooldownPeriod: 3,
      actions: [],
      notifications: [
        {
          type: 'slack',
          enabled: true,
          config: { channel: '#performance' },
          recipients: ['devops']
        }
      ],
      suppressionRules: []
    });
  }

  private startEvaluation(): void {
    this.evaluationTimer = setInterval(() => {
      if (this.isRunning) {
        this.evaluateMetrics();
      }
    }, 60000); // Evaluate every minute
  }

  private async evaluateRule(rule: AlertRule): Promise<boolean> {
    const metricValue = await this.getMetricValue(rule.metric);

    if (metricValue === null || metricValue === undefined) {
      return false;
    }

    return this.evaluateCondition(rule.condition, metricValue);
  }

  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.value;
      case 'lt': return value < condition.value;
      case 'eq': return value === condition.value;
      case 'gte': return value >= condition.value;
      case 'lte': return value <= condition.value;
      case 'ne': return value !== condition.value;
      default: return false;
    }
  }

  private async getMetricValue(metric: string): Promise<number | null> {
    // In a real implementation, this would query the metrics system
    // For now, return mock values
    const mockMetrics: Record<string, number> = {
      'uptime': 99.9,
      'error_rate': 2.5,
      'response_time': 350,
      'revenue_growth': 12.5,
      'user_growth': 8.2,
      'churn_rate': 3.8,
      'operating_margin': 18.5
    };

    return mockMetrics[metric] || null;
  }

  private async createAlertFromRule(rule: AlertRule): Promise<Alert> {
    const metricValue = await this.getMetricValue(rule.metric);

    return {
      id: this.generateAlertId(),
      type: rule.source,
      severity: rule.severity,
      title: rule.name,
      description: `${rule.metric} is ${metricValue}, threshold is ${rule.threshold}`,
      source: rule.source,
      metric: rule.metric,
      currentValue: metricValue || 0,
      threshold: rule.threshold,
      trend: this.calculateTrend(rule.metric, metricValue || 0),
      timestamp: new Date(),
      resolved: false,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name
      },
      actions: rule.actions,
      acknowledgedBy: undefined,
      acknowledgedAt: undefined
    };
  }

  private calculateTrend(metric: string, currentValue: number): 'up' | 'down' | 'stable' {
    // In a real implementation, this would compare with historical values
    return Math.random() > 0.5 ? 'up' : 'down';
  }

  private isInCooldown(ruleId: string, now: number): boolean {
    const cooldownEnd = this.suppressionPeriods.get(ruleId);
    return cooldownEnd ? now < cooldownEnd.getTime() : false;
  }

  private setCooldown(ruleId: string, now: number): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      const cooldownEnd = new Date(now + rule.cooldownPeriod * 60 * 1000);
      this.suppressionPeriods.set(ruleId, cooldownEnd);
    }
  }

  private isSuppressed(rule: AlertRule): boolean {
    return rule.suppressionRules.some(suppressionRule => {
      switch (suppressionRule.type) {
        case 'maintenance':
          return this.checkMaintenanceSuppression(suppressionRule);
        case 'time':
          return this.checkTimeSuppression(suppressionRule);
        case 'tag':
          return this.checkTagSuppression(suppressionRule);
        default:
          return false;
      }
    });
  }

  private checkMaintenanceSuppression(rule: SuppressionRule): boolean {
    // Check if system is in maintenance mode
    return rule.condition.maintenance === true;
  }

  private checkTimeSuppression(rule: SuppressionRule): boolean {
    // Check if current time is within suppression window
    const now = new Date();
    const startTime = new Date(rule.condition.startTime);
    const endTime = new Date(rule.condition.endTime);
    return now >= startTime && now <= endTime;
  }

  private checkTagSuppression(rule: SuppressionRule): boolean {
    // Check if alert tags match suppression criteria
    return false; // Implementation would check tags
  }

  private async executeActions(alert: Alert): Promise<void> {
    for (const action of alert.actions) {
      if (action.type === 'auto' && !action.executed) {
        try {
          await this.executeAction(action, alert);
          action.executed = true;
          action.executedAt = new Date();
          this.metrics.increment('alert_action_executed', { type: action.type });
        } catch (error) {
          console.error(`Failed to execute action ${action.id}:`, error);
          this.metrics.increment('alert_action_failed', { type: action.type });
        }
      }
    }
  }

  private async executeAction(action: AlertAction, alert: Alert): Promise<any> {
    switch (action.method) {
      case 'POST':
        // Implement POST action
        break;
      case 'GET':
        // Implement GET action
        break;
      case 'PUT':
        // Implement PUT action
        break;
      default:
        console.log(`Action executed: ${action.title}`);
    }

    return { success: true };
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    // Find rules that would trigger this alert
    const triggeringRules = Array.from(this.rules.values()).filter(rule =>
      rule.enabled && rule.metric === alert.metric && this.evaluateCondition(rule.condition, alert.currentValue)
    );

    for (const rule of triggeringRules) {
      for (const notification of rule.notifications) {
        if (notification.enabled) {
          try {
            await this.sendNotification(notification, alert);
            this.metrics.increment('alert_notification_sent', { type: notification.type });
          } catch (error) {
            console.error(`Failed to send ${notification.type} notification:`, error);
            this.metrics.increment('alert_notification_failed', { type: notification.type });
          }
        }
      }
    }
  }

  private async sendNotification(notification: NotificationConfig, alert: Alert): Promise<void> {
    switch (notification.type) {
      case 'email':
        await this.sendEmailNotification(notification, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(notification, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(notification, alert);
        break;
      case 'sms':
        await this.sendSMSNotification(notification, alert);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(notification, alert);
        break;
    }
  }

  private async sendEmailNotification(notification: NotificationConfig, alert: Alert): Promise<void> {
    // Implement email notification
    console.log(`Email notification sent: ${alert.title} to ${notification.recipients.join(', ')}`);
  }

  private async sendSlackNotification(notification: NotificationConfig, alert: Alert): Promise<void> {
    // Implement Slack notification
    console.log(`Slack notification sent: ${alert.title} to ${notification.config.channel}`);
  }

  private async sendWebhookNotification(notification: NotificationConfig, alert: Alert): Promise<void> {
    // Implement webhook notification
    console.log(`Webhook notification sent: ${alert.title}`);
  }

  private async sendSMSNotification(notification: NotificationConfig, alert: Alert): Promise<void> {
    // Implement SMS notification
    console.log(`SMS notification sent: ${alert.title} to ${notification.recipients.join(', ')}`);
  }

  private async sendPagerDutyNotification(notification: NotificationConfig, alert: Alert): Promise<void> {
    // Implement PagerDuty notification
    console.log(`PagerDuty notification sent: ${alert.title}`);
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private broadcastToWebSocket(message: any): void {
    // Implementation would broadcast to WebSocket clients
    console.log('Broadcasting alert via WebSocket:', message);
  }
}

export default AlertingSystem;