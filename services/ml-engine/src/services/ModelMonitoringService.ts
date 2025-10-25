/**
 * Model Monitoring Service
 * Comprehensive monitoring of ML model performance, drift, and health
 */

import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import { featureStore } from '@/services/FeatureStore';
import { logger, mlLogger } from '@/utils/logger';
import {
  ModelMonitoring,
  MonitoringAlert,
  DataDriftMetrics,
  ModelMetrics,
  ModelTrainingJob
} from '@/types/ml.types';
import { mlConfig } from '@/config/ml.config';

interface ModelHealth {
  modelId: string;
  modelVersion: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastCheck: Date;
  metrics: {
    predictionCount: number;
    averageLatency: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  alerts: MonitoringAlert[];
}

interface DriftAnalysisResult {
  featureName: string;
  driftScore: number;
  psi: number;
  klDivergence: number;
  statisticalSignificance: boolean;
  recommendation: string;
}

interface PerformanceMetrics {
  timestamp: Date;
  modelId: string;
  predictionsCount: number;
  averageLatency: number;
  errorRate: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  customMetrics: Record<string, number>;
}

export class ModelMonitoringService extends EventEmitter {
  private modelHealths: Map<string, ModelHealth> = new Map();
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();
  private driftHistory: Map<string, DataDriftMetrics[]> = new Map();
  private activeAlerts: Map<string, MonitoringAlert> = new Map();
  private isRunning = false;
  private monitoringTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    super();
  }

  /**
   * Initialize the model monitoring service
   */
  async initialize(): Promise<void> {
    try {
      mlLogger.modelMonitoring('Initializing model monitoring service');

      // Start monitoring tasks
      this.startMonitoringTasks();

      // Load existing alerts
      await this.loadExistingAlerts();

      this.isRunning = true;
      mlLogger.modelMonitoring('Model monitoring service initialized successfully');

    } catch (error) {
      mlLogger.error('Failed to initialize model monitoring service', error as Error);
      throw error;
    }
  }

  /**
   * Register a model for monitoring
   */
  registerModel(modelId: string, modelVersion: string): void {
    const modelHealth: ModelHealth = {
      modelId,
      modelVersion,
      status: 'unknown',
      lastCheck: new Date(),
      metrics: {
        predictionCount: 0,
        averageLatency: 0,
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      },
      alerts: [],
    };

    this.modelHealths.set(modelId, modelHealth);
    this.performanceHistory.set(modelId, []);

    mlLogger.modelMonitoring('Model registered for monitoring', {
      modelId,
      modelVersion,
    });
  }

  /**
   * Record prediction metrics
   */
  recordPredictionMetrics(
    modelId: string,
    latencyMs: number,
    success: boolean,
    actualValue?: number,
    predictedValue?: number
  ): void {
    const health = this.modelHealths.get(modelId);
    if (!health) {
      mlLogger.modelMonitoring('Model not registered for monitoring', { modelId });
      return;
    }

    // Update health metrics
    health.metrics.predictionCount++;
    health.metrics.averageLatency =
      (health.metrics.averageLatency * (health.metrics.predictionCount - 1) + latencyMs) /
      health.metrics.predictionCount;

    if (!success) {
      health.metrics.errorRate =
        (health.metrics.errorRate * (health.metrics.predictionCount - 1) + 1) /
        health.metrics.predictionCount;
    }

    health.lastCheck = new Date();

    // Store in performance history
    const timestamp = new Date();
    const history = this.performanceHistory.get(modelId) || [];

    const metrics: PerformanceMetrics = {
      timestamp,
      modelId,
      predictionsCount: 1,
      averageLatency: latencyMs,
      errorRate: success ? 0 : 1,
      customMetrics: {},
    };

    // Calculate accuracy if actual and predicted values are provided
    if (actualValue !== undefined && predictedValue !== undefined) {
      const isCorrect = Math.abs(actualValue - predictedValue) < 0.1; // Tolerance for correctness
      metrics.accuracy = isCorrect ? 1 : 0;
    }

    history.push(metrics);

    // Keep only last 1000 entries per model
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    this.performanceHistory.set(modelId, history);

    // Check for performance alerts
    this.checkPerformanceAlerts(modelId);
  }

  /**
   * Analyze data drift for a model
   */
  async analyzeDataDrift(
    modelId: string,
    featureNames: string[],
    referencePeriod: number = 7, // days
    currentPeriod: number = 1 // day
  ): Promise<DriftAnalysisResult[]> {
    try {
      mlLogger.modelMonitoring('Starting data drift analysis', {
        modelId,
        featureCount: featureNames.length,
        referencePeriod,
        currentPeriod,
      });

      const results: DriftAnalysisResult[] = [];

      for (const featureName of featureNames) {
        try {
          const driftMetrics = await featureStore.getFeatureDrift(
            'transaction', // Could be parameterized
            featureName,
            referencePeriod,
            currentPeriod
          );

          const result: DriftAnalysisResult = {
            featureName,
            driftScore: driftMetrics.drift_score,
            psi: driftMetrics.population_stability_index,
            klDivergence: driftMetrics.kl_divergence || 0,
            statisticalSignificance: driftMetrics.drift_score > mlConfig.monitoring.driftThreshold,
            recommendation: this.generateDriftRecommendation(driftMetrics),
          };

          results.push(result);

          // Create alert if significant drift detected
          if (result.statisticalSignificance) {
            await this.createDriftAlert(modelId, featureName, result);
          }

        } catch (error) {
          mlLogger.error('Failed to analyze drift for feature', error as Error, {
            modelId,
            featureName,
          });
        }
      }

      // Store drift analysis results
      const driftMetrics: DataDriftMetrics = {
        overall_drift_score: results.reduce((sum, r) => sum + r.driftScore, 0) / results.length,
        feature_drift_scores: Object.fromEntries(results.map(r => [r.featureName, r.driftScore])),
        population_stability_index: results.reduce((sum, r) => sum + r.psi, 0) / results.length,
        kolmogorov_smirnov_statistic: results.reduce((sum, r) => sum + r.klDivergence, 0) / results.length,
        training_stats: {},
        production_stats: {},
      };

      const history = this.driftHistory.get(modelId) || [];
      history.push(driftMetrics);

      // Keep only last 100 drift analyses
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }

      this.driftHistory.set(modelId, history);

      mlLogger.modelMonitoring('Data drift analysis completed', {
        modelId,
        featuresAnalyzed: results.length,
        maxDriftScore: Math.max(...results.map(r => r.driftScore)),
        significantDriftCount: results.filter(r => r.statisticalSignificance).length,
      });

      return results;

    } catch (error) {
      mlLogger.error('Data drift analysis failed', error as Error, { modelId });
      return [];
    }
  }

  /**
   * Check model performance degradation
   */
  async checkPerformanceDegradation(
    modelId: string,
    timeWindow: number = 24 // hours
  ): Promise<{
    degraded: boolean;
    metrics: {
      currentAccuracy: number;
      baselineAccuracy: number;
      degradationPercentage: number;
      currentLatency: number;
      baselineLatency: number;
      latencyIncreasePercentage: number;
      errorRate: number;
      baselineErrorRate: number;
    };
  }> {
    const history = this.performanceHistory.get(modelId);
    if (!history || history.length < 10) {
      return {
        degraded: false,
        metrics: {
          currentAccuracy: 0,
          baselineAccuracy: 0,
          degradationPercentage: 0,
          currentLatency: 0,
          baselineLatency: 0,
          latencyIncreasePercentage: 0,
          errorRate: 0,
          baselineErrorRate: 0,
        },
      };
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow * 60 * 60 * 1000);

    // Get recent metrics
    const recentMetrics = history.filter(m => m.timestamp >= windowStart);

    // Get baseline metrics (older period)
    const baselineStart = new Date(windowStart.getTime() - timeWindow * 60 * 60 * 1000);
    const baselineMetrics = history.filter(m =>
      m.timestamp >= baselineStart && m.timestamp < windowStart
    );

    if (recentMetrics.length === 0 || baselineMetrics.length === 0) {
      return {
        degraded: false,
        metrics: {
          currentAccuracy: 0,
          baselineAccuracy: 0,
          degradationPercentage: 0,
          currentLatency: 0,
          baselineLatency: 0,
          latencyIncreasePercentage: 0,
          errorRate: 0,
          baselineErrorRate: 0,
        },
      };
    }

    // Calculate current metrics
    const currentAccuracy = recentMetrics
      .filter(m => m.accuracy !== undefined)
      .reduce((sum, m) => sum + m.accuracy!, 0) /
      recentMetrics.filter(m => m.accuracy !== undefined).length || 0;

    const currentLatency = recentMetrics.reduce((sum, m) => sum + m.averageLatency, 0) / recentMetrics.length;
    const currentErrorRate = recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length;

    // Calculate baseline metrics
    const baselineAccuracy = baselineMetrics
      .filter(m => m.accuracy !== undefined)
      .reduce((sum, m) => sum + m.accuracy!, 0) /
      baselineMetrics.filter(m => m.accuracy !== undefined).length || 0;

    const baselineLatency = baselineMetrics.reduce((sum, m) => sum + m.averageLatency, 0) / baselineMetrics.length;
    const baselineErrorRate = baselineMetrics.reduce((sum, m) => sum + m.errorRate, 0) / baselineMetrics.length;

    // Calculate degradation
    const accuracyDegradation = baselineAccuracy > 0 ?
      ((baselineAccuracy - currentAccuracy) / baselineAccuracy) * 100 : 0;

    const latencyIncrease = baselineLatency > 0 ?
      ((currentLatency - baselineLatency) / baselineLatency) * 100 : 0;

    const degraded =
      accuracyDegradation > (mlConfig.monitoring.performanceThreshold * 100) ||
      latencyIncrease > (mlConfig.monitoring.performanceThreshold * 100) ||
      currentErrorRate > (baselineErrorRate * 2);

    const metrics = {
      currentAccuracy,
      baselineAccuracy,
      degradationPercentage: accuracyDegradation,
      currentLatency,
      baselineLatency,
      latencyIncreasePercentage: latencyIncrease,
      errorRate: currentErrorRate,
      baselineErrorRate,
    };

    if (degraded) {
      await this.createPerformanceAlert(modelId, metrics);
    }

    return { degraded, metrics };
  }

  /**
   * Get comprehensive monitoring report for a model
   */
  getMonitoringReport(modelId: string): ModelMonitoring | null {
    const health = this.modelHealths.get(modelId);
    if (!health) {
      return null;
    }

    const performanceHistory = this.performanceHistory.get(modelId) || [];
    const driftHistory = this.driftHistory.get(modelId) || [];

    // Calculate current performance metrics
    const recentMetrics = performanceHistory.slice(-100); // Last 100 entries
    const averageLatency = recentMetrics.length > 0 ?
      recentMetrics.reduce((sum, m) => sum + m.averageLatency, 0) / recentMetrics.length : 0;

    // Calculate latest drift metrics
    const latestDrift = driftHistory[driftHistory.length - 1];

    return {
      model_id: modelId,
      model_version: health.modelVersion,
      monitoring_period: '24h',
      prediction_count: health.metrics.predictionCount,
      accuracy_over_time: performanceHistory
        .filter(m => m.accuracy !== undefined)
        .map(m => ({
          timestamp: m.timestamp,
          value: m.accuracy!,
        })),
      drift_score: latestDrift?.overall_drift_score || 0,
      data_drift_metrics: latestDrift || {
        overall_drift_score: 0,
        feature_drift_scores: {},
        population_stability_index: 0,
        kolmogorov_smirnov_statistic: 0,
        training_stats: {},
        production_stats: {},
      },
      average_inference_time_ms: averageLatency,
      memory_usage_mb: health.metrics.memoryUsage,
      cpu_usage_percent: health.metrics.cpuUsage,
      performance_degradation_threshold: mlConfig.monitoring.performanceThreshold,
      drift_threshold: mlConfig.monitoring.driftThreshold,
      resource_usage_threshold: mlConfig.monitoring.resourceUsageThreshold || 80,
      active_alerts: Array.from(this.activeAlerts.values()).filter(alert =>
        alert.message.includes(modelId)
      ),
      last_updated: health.lastCheck,
      health_status: health.status,
    };
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'acknowledged';
    alert.acknowledged_by = acknowledgedBy;
    alert.acknowledged_at = new Date();

    mlLogger.modelMonitoring('Alert acknowledged', {
      alertId,
      type: alert.type,
      acknowledgedBy,
    });
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'resolved';
    alert.resolved_at = new Date();

    // Remove from active alerts after some time
    setTimeout(() => {
      this.activeAlerts.delete(alertId);
    }, 60000); // Keep resolved alerts for 1 minute

    mlLogger.modelMonitoring('Alert resolved', {
      alertId,
      type: alert.type,
    });
  }

  /**
   * Start monitoring tasks
   */
  private startMonitoringTasks(): void {
    // Performance monitoring every minute
    const performanceTask = cron.schedule('* * * * *', async () => {
      await this.checkAllModelsPerformance();
    }, {
      scheduled: false,
    });

    this.monitoringTasks.set('performance_monitoring', performanceTask);
    performanceTask.start();

    // Drift monitoring every hour
    const driftTask = cron.schedule('0 * * * *', async () => {
      await this.checkAllModelsDrift();
    }, {
      scheduled: false,
    });

    this.monitoringTasks.set('drift_monitoring', driftTask);
    driftTask.start();

    // Health check every 5 minutes
    const healthTask = cron.schedule('*/5 * * * *', async () => {
      await this.performHealthChecks();
    }, {
      scheduled: false,
    });

    this.monitoringTasks.set('health_checks', healthTask);
    healthTask.start();

    // Alert cleanup every hour
    const cleanupTask = cron.schedule('0 * * * *', async () => {
      await this.cleanupOldAlerts();
    }, {
      scheduled: false,
    });

    this.monitoringTasks.set('alert_cleanup', cleanupTask);
    cleanupTask.start();

    mlLogger.modelMonitoring('Monitoring tasks started');
  }

  /**
   * Check performance for all registered models
   */
  private async checkAllModelsPerformance(): Promise<void> {
    for (const modelId of this.modelHealths.keys()) {
      try {
        await this.checkPerformanceDegradation(modelId);
      } catch (error) {
        mlLogger.error('Performance check failed for model', error as Error, { modelId });
      }
    }
  }

  /**
   * Check drift for all registered models
   */
  private async checkAllModelsDrift(): Promise<void> {
    for (const modelId of this.modelHealths.keys()) {
      try {
        // Default features to monitor - could be model-specific
        const features = ['amount', 'hour_of_day', 'transaction_frequency_24h'];
        await this.analyzeDataDrift(modelId, features);
      } catch (error) {
        mlLogger.error('Drift check failed for model', error as Error, { modelId });
      }
    }
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    for (const [modelId, health] of this.modelHealths) {
      try {
        // Update system resource metrics
        health.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        health.metrics.cpuUsage = process.cpuUsage().user / 1000000; // Simplified

        // Determine health status
        const activeAlerts = Array.from(this.activeAlerts.values()).filter(alert =>
          alert.message.includes(modelId) && alert.status === 'active'
        );

        if (activeAlerts.length === 0) {
          health.status = 'healthy';
        } else if (activeAlerts.some(alert => alert.severity === 'critical')) {
          health.status = 'critical';
        } else if (activeAlerts.some(alert => alert.severity === 'error')) {
          health.status = 'warning';
        } else {
          health.status = 'warning';
        }

        health.lastCheck = new Date();

      } catch (error) {
        mlLogger.error('Health check failed for model', error as Error, { modelId });
        health.status = 'unknown';
      }
    }
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(modelId: string): void {
    const health = this.modelHealths.get(modelId);
    if (!health) return;

    // Check latency threshold
    if (health.metrics.averageLatency > 1000) { // 1 second
      this.createAlert({
        id: `latency_${modelId}_${Date.now()}`,
        type: 'performance_degradation',
        severity: health.metrics.averageLatency > 5000 ? 'critical' : 'warning',
        message: `High latency detected for model ${modelId}: ${health.metrics.averageLatency}ms`,
        details: {
          modelId,
          latency: health.metrics.averageLatency,
          threshold: 1000,
        },
        status: 'active',
        created_at: new Date(),
      });
    }

    // Check error rate threshold
    if (health.metrics.errorRate > 0.05) { // 5%
      this.createAlert({
        id: `error_rate_${modelId}_${Date.now()}`,
        type: 'performance_degradation',
        severity: health.metrics.errorRate > 0.1 ? 'critical' : 'error',
        message: `High error rate detected for model ${modelId}: ${(health.metrics.errorRate * 100).toFixed(2)}%`,
        details: {
          modelId,
          errorRate: health.metrics.errorRate,
          threshold: 0.05,
        },
        status: 'active',
        created_at: new Date(),
      });
    }
  }

  /**
   * Create drift alert
   */
  private async createDriftAlert(modelId: string, featureName: string, result: DriftAnalysisResult): Promise<void> {
    const alertId = `drift_${modelId}_${featureName}_${Date.now()}`;

    this.createAlert({
      id: alertId,
      type: 'data_drift',
      severity: result.driftScore > 0.5 ? 'critical' : 'warning',
      message: `Significant data drift detected for feature ${featureName} in model ${modelId}`,
      details: {
        modelId,
        featureName,
        driftScore: result.driftScore,
        psi: result.psi,
        statisticalSignificance: result.statisticalSignificance,
        recommendation: result.recommendation,
      },
      status: 'active',
      created_at: new Date(),
      auto_resolve_after: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
  }

  /**
   * Create performance alert
   */
  private async createPerformanceAlert(modelId: string, metrics: any): Promise<void> {
    const alertId = `performance_degradation_${modelId}_${Date.now()}`;

    this.createAlert({
      id: alertId,
      type: 'performance_degradation',
      severity: metrics.degradationPercentage > 20 ? 'critical' : 'warning',
      message: `Performance degradation detected for model ${modelId}`,
      details: {
        modelId,
        accuracyDegradation: metrics.degradationPercentage,
        latencyIncrease: metrics.latencyIncreasePercentage,
        currentAccuracy: metrics.currentAccuracy,
        baselineAccuracy: metrics.baselineAccuracy,
        currentLatency: metrics.currentLatency,
        baselineLatency: metrics.baselineLatency,
      },
      status: 'active',
      created_at: new Date(),
    });
  }

  /**
   * Create and store alert
   */
  private createAlert(alert: MonitoringAlert): void {
    this.activeAlerts.set(alert.id, alert);

    // Emit alert event
    this.emit('alert', alert);

    // Send external notifications if configured
    if (mlConfig.monitoring.alerting.enabled) {
      this.sendAlertNotification(alert);
    }

    mlLogger.modelMonitoring('Alert created', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
    });
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: MonitoringAlert): Promise<void> {
    try {
      const { webhookUrl, emailRecipients, slackWebhook } = mlConfig.monitoring.alerting;

      const payload = {
        alert,
        timestamp: new Date(),
        service: 'ml-engine',
      };

      // Send webhook notification
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      // Send Slack notification
      if (slackWebhook && alert.severity in ['error', 'critical']) {
        await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 ML Alert: ${alert.message}`,
            attachments: [{
              color: alert.severity === 'critical' ? 'danger' : 'warning',
              fields: [
                { title: 'Type', value: alert.type, short: true },
                { title: 'Severity', value: alert.severity, short: true },
                { title: 'Model', value: alert.details.modelId || 'Unknown', short: true },
                { title: 'Time', value: alert.created_at.toISOString(), short: true },
              ],
            }],
          }),
        });
      }

      // Email notifications would be implemented here
      if (emailRecipients.length > 0 && alert.severity === 'critical') {
        // Send email notification
        mlLogger.modelMonitoring('Email alert sent', {
          alertId: alert.id,
          recipients: emailRecipients,
        });
      }

    } catch (error) {
      mlLogger.error('Failed to send alert notification', error as Error, {
        alertId: alert.id,
      });
    }
  }

  /**
   * Generate drift recommendation
   */
  private generateDriftRecommendation(driftMetrics: any): string {
    const psi = driftMetrics.population_stability_index;

    if (psi > 0.25) {
      return 'Significant drift detected - immediate model retraining recommended';
    } else if (psi > 0.1) {
      return 'Moderate drift detected - schedule model retraining soon';
    } else if (psi > 0.05) {
      return 'Minor drift detected - monitor closely';
    } else {
      return 'No significant action required';
    }
  }

  /**
   * Load existing alerts from storage
   */
  private async loadExistingAlerts(): Promise<void> {
    // In a real implementation, this would load alerts from a database
    mlLogger.modelMonitoring('Loading existing alerts');
  }

  /**
   * Clean up old alerts
   */
  private async cleanupOldAlerts(): Promise<void> {
    const now = Date.now();
    const cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.created_at.getTime() < cutoffTime &&
          (alert.status === 'resolved' || alert.status === 'acknowledged')) {
        this.activeAlerts.delete(alertId);
      }
    }

    mlLogger.modelMonitoring('Alert cleanup completed', {
      activeAlerts: this.activeAlerts.size,
    });
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    isRunning: boolean;
    monitoredModels: number;
    activeAlerts: number;
    performanceDataPoints: number;
    driftAnalyses: number;
    monitoringTasks: number;
  } {
    const totalDataPoints = Array.from(this.performanceHistory.values())
      .reduce((sum, history) => sum + history.length, 0);

    const totalDriftAnalyses = Array.from(this.driftHistory.values())
      .reduce((sum, history) => sum + history.length, 0);

    return {
      isRunning: this.isRunning,
      monitoredModels: this.modelHealths.size,
      activeAlerts: this.activeAlerts.size,
      performanceDataPoints: totalDataPoints,
      driftAnalyses: totalDriftAnalyses,
      monitoringTasks: this.monitoringTasks.size,
    };
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Stop the monitoring service
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    // Stop all monitoring tasks
    for (const task of this.monitoringTasks.values()) {
      task.stop();
    }
    this.monitoringTasks.clear();

    // Clear data
    this.modelHealths.clear();
    this.performanceHistory.clear();
    this.driftHistory.clear();
    this.activeAlerts.clear();

    this.removeAllListeners();
    mlLogger.modelMonitoring('Model monitoring service stopped');
  }
}

// Singleton instance
export const modelMonitoringService = new ModelMonitoringService();