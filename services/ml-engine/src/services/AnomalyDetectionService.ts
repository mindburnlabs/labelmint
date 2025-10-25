/**
 * Anomaly Detection Service
 * Real-time anomaly detection for user behavior, transactions, and system metrics
 */

import { EventEmitter } from 'events';
import { AnomalyDetectionModel } from '@/models/AnomalyDetectionModel';
import { featureStore } from '@/services/FeatureStore';
import { logger, mlLogger } from '@/utils/logger';
import {
  UserBehaviorFeatures,
  AnomalyDetection,
  TransactionFeatures
} from '@/types/ml.types';
import { mlConfig } from '@/config/ml.config';

interface AnomalyDetectionEvent {
  type: 'anomaly_detected' | 'behavioral_anomaly' | 'performance_anomaly';
  data: AnomalyDetection;
  timestamp: Date;
}

interface ServiceMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_io: number;
  network_io: number;
  response_time: number;
  error_rate: number;
  throughput: number;
}

export class AnomalyDetectionService extends EventEmitter {
  private anomalyModels: Map<string, AnomalyDetectionModel> = new Map();
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastMetricsUpdate = new Date();
  private recentAnomalies: Map<string, AnomalyDetection[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Initialize the anomaly detection service
   */
  async initialize(): Promise<void> {
    try {
      mlLogger.anomalyDetection('Initializing anomaly detection service');

      // Initialize models for different entity types
      await this.initializeModels();

      // Start monitoring processes
      this.startMonitoring();

      this.isRunning = true;
      mlLogger.anomalyDetection('Anomaly detection service initialized successfully');

    } catch (error) {
      mlLogger.error('Failed to initialize anomaly detection service', error as Error);
      throw error;
    }
  }

  /**
   * Initialize models for different entity types
   */
  private async initializeModels(): Promise<void> {
    const entityConfigs = [
      {
        name: 'user_behavior',
        features: [
          'account_age_days',
          'login_frequency_24h',
          'task_completion_rate',
          'average_task_time',
          'total_earned',
          'total_spent',
          'transaction_count',
          'avg_transaction_amount',
          'average_quality_score',
          'rejection_rate',
          'dispute_count',
          'consensus_agreement_rate',
        ],
        config: {
          algorithm: 'isolation_forest' as const,
          sensitivity: 0.8,
          contamination: 0.05,
        },
      },
      {
        name: 'transaction_patterns',
        features: [
          'amount',
          'hour_of_day',
          'day_of_week',
          'transaction_frequency_1h',
          'transaction_frequency_24h',
          'avg_transaction_amount_24h',
          'amount_deviation_from_avg',
          'wallet_age_days',
          'wallet_transaction_count',
        ],
        config: {
          algorithm: 'statistical' as const,
          sensitivity: 0.7,
          contamination: 0.1,
        },
      },
      {
        name: 'system_performance',
        features: [
          'cpu_usage',
          'memory_usage',
          'disk_io',
          'network_io',
          'response_time',
          'error_rate',
          'throughput',
        ],
        config: {
          algorithm: 'autoencoder' as const,
          sensitivity: 0.9,
          contamination: 0.02,
        },
      },
    ];

    for (const entityConfig of entityConfigs) {
      try {
        const model = new AnomalyDetectionModel(entityConfig.config);
        await model.initialize(entityConfig.features);

        this.anomalyModels.set(entityConfig.name, model);

        mlLogger.anomalyDetection('Model initialized', {
          model: entityConfig.name,
          features: entityConfig.features.length,
          algorithm: entityConfig.config.algorithm,
        });

      } catch (error) {
        mlLogger.error('Failed to initialize model', error as Error, {
          model: entityConfig.name,
        });
      }
    }

    if (this.anomalyModels.size === 0) {
      throw new Error('No anomaly detection models could be initialized');
    }
  }

  /**
   * Detect anomalies for user behavior
   */
  async detectUserBehaviorAnomalies(
    userId: string,
    features: UserBehaviorFeatures
  ): Promise<AnomalyDetection[]> {
    const model = this.anomalyModels.get('user_behavior');
    if (!model) {
      mlLogger.anomalyDetection('User behavior model not available');
      return [];
    }

    try {
      // Update feature store with current features
      await featureStore.updateFeatures(userId, 'user', features, true);

      // Detect anomalies
      const anomalies = await model.detectAnomalies(userId, 'user', features);

      // Store anomalies for analysis
      if (anomalies.length > 0) {
        this.storeAnomalies(userId, anomalies);

        // Emit events for significant anomalies
        for (const anomaly of anomalies) {
          if (anomaly.anomaly_score > 70) {
            this.emit('anomaly_detected', {
              type: 'behavioral_anomaly',
              data: anomaly,
              timestamp: new Date(),
            } as AnomalyDetectionEvent);
          }
        }

        mlLogger.anomalyDetection('User behavior anomalies detected', {
          userId,
          anomalyCount: anomalies.length,
          maxScore: Math.max(...anomalies.map(a => a.anomaly_score)),
        });
      }

      return anomalies;

    } catch (error) {
      mlLogger.error('Failed to detect user behavior anomalies', error as Error, {
        userId,
      });
      return [];
    }
  }

  /**
   * Detect anomalies in transaction patterns
   */
  async detectTransactionAnomalies(
    transactionId: string,
    userId: string,
    features: TransactionFeatures
  ): Promise<AnomalyDetection[]> {
    const model = this.anomalyModels.get('transaction_patterns');
    if (!model) {
      mlLogger.anomalyDetection('Transaction pattern model not available');
      return [];
    }

    try {
      // Convert transaction features to expected format
      const numericFeatures: Record<string, number> = {
        amount: features.amount,
        hour_of_day: features.hour_of_day,
        day_of_week: features.day_of_week,
        transaction_frequency_1h: features.transaction_frequency_1h,
        transaction_frequency_24h: features.transaction_frequency_24h,
        avg_transaction_amount_24h: features.avg_transaction_amount_24h,
        amount_deviation_from_avg: features.amount_deviation_from_avg,
        wallet_age_days: features.wallet_age_days,
        wallet_transaction_count: features.wallet_transaction_count,
      };

      // Update feature store
      await featureStore.updateFeatures(transactionId, 'transaction', numericFeatures, true);

      // Detect anomalies
      const anomalies = await model.detectAnomalies(transactionId, 'transaction', numericFeatures);

      // Store and emit events
      if (anomalies.length > 0) {
        this.storeAnomalies(transactionId, anomalies);

        for (const anomaly of anomalies) {
          if (anomaly.anomaly_score > 60) {
            this.emit('anomaly_detected', {
              type: 'anomaly_detected',
              data: anomaly,
              timestamp: new Date(),
            } as AnomalyDetectionEvent);
          }
        }

        mlLogger.anomalyDetection('Transaction anomalies detected', {
          transactionId,
          userId,
          anomalyCount: anomalies.length,
        });
      }

      return anomalies;

    } catch (error) {
      mlLogger.error('Failed to detect transaction anomalies', error as Error, {
        transactionId,
        userId,
      });
      return [];
    }
  }

  /**
   * Monitor system performance for anomalies
   */
  async detectSystemAnomalies(metrics: ServiceMetrics): Promise<AnomalyDetection[]> {
    const model = this.anomalyModels.get('system_performance');
    if (!model) {
      mlLogger.anomalyDetection('System performance model not available');
      return [];
    }

    try {
      const entityName = 'system_main';
      const anomalies = await model.detectAnomalies(entityName, 'session', metrics);

      if (anomalies.length > 0) {
        this.storeAnomalies(entityName, anomalies);

        for (const anomaly of anomalies) {
          if (anomaly.anomaly_score > 80) {
            this.emit('anomaly_detected', {
              type: 'performance_anomaly',
              data: anomaly,
              timestamp: new Date(),
            } as AnomalyDetectionEvent);
          }
        }

        mlLogger.anomalyDetection('System performance anomalies detected', {
          anomalyCount: anomalies.length,
          metrics: Object.keys(metrics),
        });
      }

      return anomalies;

    } catch (error) {
      mlLogger.error('Failed to detect system anomalies', error as Error);
      return [];
    }
  }

  /**
   * Analyze anomaly patterns and trends
   */
  async analyzeAnomalyTrends(
    timeWindow: number = 24, // hours
    entityType?: string
  ): Promise<{
    totalAnomalies: number;
    anomalyRate: number;
    topAnomalyTypes: Array<{ type: string; count: number; percentage: number }>;
    topAffectedEntities: Array<{ entityId: string; count: number }>;
    severityDistribution: Record<string, number>;
    timeSeriesData: Array<{ timestamp: Date; count: number; avgScore: number }>;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - timeWindow * 60 * 60 * 1000);

      // Get all anomalies in time window (simplified implementation)
      const allAnomalies = await this.getAnomaliesInTimeWindow(startDate, endDate, entityType);

      // Analyze patterns
      const anomalyTypes = new Map<string, number>();
      const entityCounts = new Map<string, number>();
      const severityCounts = new Map<string, number>();
      const timeBuckets = new Map<string, { count: number; totalScore: number }>();

      for (const anomaly of allAnomalies) {
        // Count by type
        const typeKey = anomaly.anomaly_type;
        anomalyTypes.set(typeKey, (anomalyTypes.get(typeKey) || 0) + 1);

        // Count by entity
        entityCounts.set(anomaly.entity_id, (entityCounts.get(anomaly.entity_id) || 0) + 1);

        // Count by severity
        const severity = this.getSeverityLevel(anomaly.anomaly_score);
        severityCounts.set(severity, (severityCounts.get(severity) || 0) + 1);

        // Time bucket (hourly)
        const hourKey = new Date(anomaly.detected_at).toISOString().slice(0, 13);
        const bucket = timeBuckets.get(hourKey) || { count: 0, totalScore: 0 };
        bucket.count += 1;
        bucket.totalScore += anomaly.anomaly_score;
        timeBuckets.set(hourKey, bucket);
      }

      // Calculate time series data
      const timeSeriesData = Array.from(timeBuckets.entries())
        .map(([hourStr, data]) => ({
          timestamp: new Date(hourStr + ':00:00Z'),
          count: data.count,
          avgScore: data.totalScore / data.count,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Calculate top lists
      const totalEntities = await this.getTotalEntities(entityType);
      const anomalyRate = totalEntities > 0 ? allAnomalies.length / totalEntities : 0;

      const topAnomalyTypes = Array.from(anomalyTypes.entries())
        .map(([type, count]) => ({
          type,
          count,
          percentage: (count / allAnomalies.length) * 100,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const topAffectedEntities = Array.from(entityCounts.entries())
        .map(([entityId, count]) => ({ entityId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalAnomalies: allAnomalies.length,
        anomalyRate,
        topAnomalyTypes,
        topAffectedEntities,
        severityDistribution: Object.fromEntries(severityCounts),
        timeSeriesData,
      };

    } catch (error) {
      mlLogger.error('Failed to analyze anomaly trends', error as Error);
      return {
        totalAnomalies: 0,
        anomalyRate: 0,
        topAnomalyTypes: [],
        topAffectedEntities: [],
        severityDistribution: {},
        timeSeriesData: [],
      };
    }
  }

  /**
   * Store anomalies for analysis
   */
  private storeAnomalies(entityId: string, anomalies: AnomalyDetection[]): void {
    if (!this.recentAnomalies.has(entityId)) {
      this.recentAnomalies.set(entityId, []);
    }

    const entityAnomalies = this.recentAnomalies.get(entityId)!;
    entityAnomalies.push(...anomalies);

    // Keep only recent anomalies (last 1000 per entity)
    if (entityAnomalies.length > 1000) {
      entityAnomalies.splice(0, entityAnomalies.length - 1000);
    }

    // Store in feature store for persistence
    for (const anomaly of anomalies) {
      featureStore.updateFeatures(
        `${anomaly.entity_id}_${anomaly.detected_at.getTime()}`,
        'anomaly',
        {
          anomaly_score: anomaly.anomaly_score,
          anomaly_type: anomaly.anomaly_type,
          affected_metrics: anomaly.affected_metrics,
          requires_investigation: anomaly.requires_investigation,
        },
        true
      ).catch(error => {
        mlLogger.error('Failed to store anomaly in feature store', error as Error);
      });
    }
  }

  /**
   * Start monitoring processes
   */
  private startMonitoring(): void {
    // Update models periodically
    const updateInterval = mlConfig.anomalyDetection.autoRetraining
      ? mlConfig.anomalyDetection.updateInterval * 1000
      : 60 * 60 * 1000; // Check every hour even if not retraining

    setInterval(async () => {
      if (mlConfig.anomalyDetection.autoRetraining) {
        await this.updateModels();
      }
    }, updateInterval);

    // Clean up old anomalies
    setInterval(() => {
      this.cleanupOldAnomalies();
    }, 24 * 60 * 60 * 1000); // Daily cleanup

    mlLogger.anomalyDetection('Monitoring processes started');
  }

  /**
   * Update models with new data
   */
  public async updateModels(): Promise<void> {
    try {
      mlLogger.anomalyDetection('Updating anomaly detection models');

      for (const [modelName, model] of this.anomalyModels) {
        await model.updateModel();
      }

      mlLogger.anomalyDetection('Models updated successfully');

    } catch (error) {
      mlLogger.error('Failed to update models', error as Error);
    }
  }

  /**
   * Clean up old anomalies
   */
  private cleanupOldAnomalies(): void {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

    for (const [entityId, anomalies] of this.recentAnomalies.entries()) {
      const filtered = anomalies.filter(
        anomaly => anomaly.detected_at.getTime() > cutoffTime
      );

      if (filtered.length === 0) {
        this.recentAnomalies.delete(entityId);
      } else if (filtered.length < anomalies.length) {
        this.recentAnomalies.set(entityId, filtered);
      }
    }

    mlLogger.anomalyDetection('Old anomalies cleaned up');
  }

  /**
   * Get severity level from score
   */
  private getSeverityLevel(score: number): string {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  /**
   * Get anomalies in time window (placeholder implementation)
   */
  private async getAnomaliesInTimeWindow(
    startDate: Date,
    endDate: Date,
    entityType?: string
  ): Promise<AnomalyDetection[]> {
    // In a real implementation, this would query the database
    // For now, return aggregated anomalies from memory
    const allAnomalies: AnomalyDetection[] = [];

    for (const anomalies of this.recentAnomalies.values()) {
      for (const anomaly of anomalies) {
        if (anomaly.detected_at >= startDate && anomaly.detected_at <= endDate) {
          if (!entityType || anomaly.entity_type === entityType) {
            allAnomalies.push(anomaly);
          }
        }
      }
    }

    return allAnomalies;
  }

  /**
   * Get total entities count (placeholder implementation)
   */
  private async getTotalEntities(entityType?: string): Promise<number> {
    // In a real implementation, this would query the database
    return 1000; // Placeholder value
  }

  /**
   * Get recent anomalies for an entity
   */
  getEntityAnomalies(entityId: string, limit: number = 50): AnomalyDetection[] {
    const anomalies = this.recentAnomalies.get(entityId) || [];
    return anomalies
      .sort((a, b) => b.detected_at.getTime() - a.detected_at.getTime())
      .slice(0, limit);
  }

  /**
   * Get model statistics
   */
  getModelStats(): Array<{
    name: string;
    stats: any;
  }> {
    return Array.from(this.anomalyModels.entries()).map(([name, model]) => ({
      name,
      stats: model.getModelStats(),
    }));
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    isRunning: boolean;
    modelsCount: number;
    trackedEntities: number;
    totalAnomalies: number;
    lastUpdate: Date;
  } {
    const totalAnomalies = Array.from(this.recentAnomalies.values())
      .reduce((sum, anomalies) => sum + anomalies.length, 0);

    return {
      isRunning: this.isRunning,
      modelsCount: this.anomalyModels.size,
      trackedEntities: this.recentAnomalies.size,
      totalAnomalies,
      lastUpdate: this.lastMetricsUpdate,
    };
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Dispose of all models
    for (const model of this.anomalyModels.values()) {
      model.dispose();
    }
    this.anomalyModels.clear();

    this.removeAllListeners();
    mlLogger.anomalyDetection('Anomaly detection service stopped');
  }
}

// Singleton instance
export const anomalyDetectionService = new AnomalyDetectionService();