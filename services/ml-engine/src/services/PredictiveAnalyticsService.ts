/**
 * Predictive Analytics Service
 * Orchestrates predictive models for churn, revenue, and quality predictions
 */

import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import { PredictiveAnalyticsModel } from '@/models/PredictiveAnalyticsModel';
import { featureStore } from '@/services/FeatureStore';
import { logger, mlLogger } from '@/utils/logger';
import {
  UserBehaviorFeatures,
  Prediction,
  PredictionRequest,
  PredictionResponse
} from '@/types/ml.types';
import { mlConfig } from '@/config/ml.config';

interface PredictionJob {
  id: string;
  modelType: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  entityIds: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  results?: Prediction[];
  error?: string;
}

export class PredictiveAnalyticsService extends EventEmitter {
  private models: Map<string, PredictiveAnalyticsModel> = new Map();
  private isRunning = false;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private batchJobs: Map<string, PredictionJob> = new Map();
  private predictionCache: Map<string, { prediction: Prediction; expires: number }> = new Map();

  constructor() {
    super();
  }

  /**
   * Initialize the predictive analytics service
   */
  async initialize(): Promise<void> {
    try {
      mlLogger.prediction('Initializing predictive analytics service');

      // Initialize prediction models
      await this.initializeModels();

      // Schedule periodic model updates and predictions
      this.schedulePeriodicTasks();

      this.isRunning = true;
      mlLogger.prediction('Predictive analytics service initialized successfully');

    } catch (error) {
      mlLogger.error('Failed to initialize predictive analytics service', error as Error);
      throw error;
    }
  }

  /**
   * Initialize prediction models
   */
  private async initializeModels(): Promise<void> {
    const modelConfigs = [
      {
        name: 'churn',
        config: {
          modelType: 'churn' as const,
          algorithm: 'neural_network' as const,
          features: mlConfig.prediction.models.churn.features.length > 0
            ? mlConfig.prediction.models.churn.features
            : [
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
          targetVariable: 'churned',
          predictionHorizon: mlConfig.prediction.models.churn.horizonDays,
          updateFrequency: mlConfig.prediction.models.churn.updateFrequency,
          hyperparameters: {
            hiddenLayers: [64, 32, 16],
            dropoutRate: 0.3,
            learningRate: 0.001,
            epochs: 100,
            batchSize: 32,
            earlyStoppingPatience: 10,
          },
          isClassification: true,
        },
      },
      {
        name: 'revenue',
        config: {
          modelType: 'revenue' as const,
          algorithm: 'neural_network' as const,
          features: mlConfig.prediction.models.revenue.features.length > 0
            ? mlConfig.prediction.models.revenue.features
            : [
                'total_earned',
                'transaction_count',
                'avg_transaction_amount',
                'task_completion_rate',
                'account_age_days',
                'login_frequency_24h',
                'average_quality_score',
                'wallet_age_days',
              ],
          targetVariable: 'revenue_90d',
          predictionHorizon: mlConfig.prediction.models.revenue.horizonDays,
          updateFrequency: mlConfig.prediction.models.revenue.updateFrequency,
          hyperparameters: {
            hiddenLayers: [128, 64, 32],
            dropoutRate: 0.2,
            learningRate: 0.001,
            epochs: 150,
            batchSize: 64,
            earlyStoppingPatience: 15,
          },
          isClassification: false,
        },
      },
      {
        name: 'quality',
        config: {
          modelType: 'quality' as const,
          algorithm: 'gradient_boosting' as const,
          features: mlConfig.prediction.models.quality.features.length > 0
            ? mlConfig.prediction.models.quality.features
            : [
                'average_quality_score',
                'task_completion_rate',
                'average_task_time',
                'rejection_rate',
                'consensus_agreement_rate',
                'account_age_days',
                'transaction_count',
                'login_frequency_24h',
              ],
          targetVariable: 'quality_score',
          predictionHorizon: 7, // 7 days
          updateFrequency: mlConfig.prediction.models.quality.updateFrequency,
          hyperparameters: {
            nEstimators: 100,
            maxDepth: 6,
            learningRate: 0.1,
            subsample: 0.8,
          },
          isClassification: false,
        },
      },
    ];

    for (const modelConfig of modelConfigs) {
      if (mlConfig.prediction.models[modelConfig.name as keyof typeof mlConfig.prediction.models].enabled) {
        try {
          const model = new PredictiveAnalyticsModel(modelConfig.config);

          // Try to load existing model
          try {
            await model.loadModel(`./models/${modelConfig.name}_model`);
            mlLogger.prediction('Model loaded successfully', { model: modelConfig.name });
          } catch (loadError) {
            mlLogger.prediction('Model not found, will train new model', { model: modelConfig.name });
            await model.trainModel();
            await model.saveModel(`./models/${modelConfig.name}_model`);
          }

          this.models.set(modelConfig.name, model);

          mlLogger.prediction('Model initialized', {
            model: modelConfig.name,
            features: modelConfig.config.features.length,
            algorithm: modelConfig.config.algorithm,
          });

        } catch (error) {
          mlLogger.error('Failed to initialize model', error as Error, {
            model: modelConfig.name,
          });
        }
      }
    }

    if (this.models.size === 0) {
      throw new Error('No prediction models could be initialized');
    }
  }

  /**
   * Make prediction for entities
   */
  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();

    try {
      const model = this.models.get(request.model_type);
      if (!model) {
        throw new Error(`Model not found: ${request.model_type}`);
      }

      // Check cache first
      const cacheKey = this.getCacheKey(request.entity_id, request.model_type);
      const cached = this.predictionCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        mlLogger.prediction('Returning cached prediction', {
          entityId: request.entity_id,
          modelType: request.model_type,
        });

        return {
          prediction: cached.prediction,
          processing_time_ms: Date.now() - startTime,
          model_version: cached.prediction.model_version,
          confidence_intervals: this.calculateConfidenceIntervals(cached.prediction),
        };
      }

      // Get features for entity
      const features = await this.getEntityFeatures(request.entity_id, request.entity_type);

      // Make prediction
      const predictions = await model.predict([request.entity_id], [features]);
      const prediction = predictions[0];

      if (!prediction) {
        throw new Error('Model returned no prediction');
      }

      // Cache the prediction
      this.predictionCache.set(cacheKey, {
        prediction,
        expires: Date.now() + (this.getCacheTTL(request.model_type) * 1000),
      });

      // Update feature store with prediction
      await this.updateFeatureStore(prediction);

      const processingTime = Date.now() - startTime;

      mlLogger.prediction('Prediction completed', {
        entityId: request.entity_id,
        modelType: request.model_type,
        predictedValue: prediction.predicted_value,
        confidence: prediction.confidence,
        processingTime,
      });

      return {
        prediction,
        processing_time_ms: processingTime,
        model_version: prediction.model_version,
        confidence_intervals: this.calculateConfidenceIntervals(prediction),
      };

    } catch (error) {
      mlLogger.error('Failed to make prediction', error as Error, {
        entityId: request.entity_id,
        modelType: request.model_type,
      });
      throw error;
    }
  }

  /**
   * Batch predict for multiple entities
   */
  async batchPredict(entityIds: string[], modelType: string): Promise<{
    job_id: string;
    status: string;
    estimated_completion?: Date;
    results?: Prediction[];
    errors?: string[];
  }> {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const model = this.models.get(modelType);
      if (!model) {
        throw new Error(`Model not found: ${modelType}`);
      }

      const job: PredictionJob = {
        id: jobId,
        modelType,
        status: 'queued',
        entityIds: entityIds.slice(),
        createdAt: new Date(),
      };

      this.batchJobs.set(jobId, job);

      // Process batch asynchronously
      this.processBatchJob(job);

      const estimatedCompletion = new Date(Date.now() + (entityIds.length * 100)); // 100ms per entity

      mlLogger.prediction('Batch prediction job queued', {
        jobId,
        modelType,
        entityCount: entityIds.length,
        estimatedCompletion,
      });

      return {
        job_id: jobId,
        status: 'queued',
        estimated_completion: estimatedCompletion,
      };

    } catch (error) {
      mlLogger.error('Failed to queue batch prediction', error as Error, {
        modelType,
        entityCount: entityIds.length,
      });

      return {
        job_id: jobId,
        status: 'failed',
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Get batch prediction job status
   */
  getBatchJobStatus(jobId: string): {
    job_id: string;
    status: string;
    progress?: number;
    results?: Prediction[];
    errors?: string[];
    created_at: Date;
    started_at?: Date;
    completed_at?: Date;
  } | null {
    const job = this.batchJobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      job_id: job.id,
      status: job.status,
      progress: job.status === 'running' ? this.calculateJobProgress(job) : 0,
      results: job.results || [],
      errors: job.error ? [job.error] : [],
      created_at: job.createdAt,
      started_at: job.startedAt,
      completed_at: job.completedAt,
    };
  }

  /**
   * Process batch prediction job
   */
  private async processBatchJob(job: PredictionJob): Promise<void> {
    try {
      job.status = 'running';
      job.startedAt = new Date();

      const model = this.models.get(job.modelType)!;
      const batchSize = 50; // Process in batches to avoid memory issues
      const results: Prediction[] = [];

      for (let i = 0; i < job.entityIds.length; i += batchSize) {
        const batch = job.entityIds.slice(i, i + batchSize);

        // Get features for batch
        const featuresPromises = batch.map(async (entityId) => {
          try {
            const features = await this.getEntityFeatures(entityId, 'user');
            return { entityId, features, error: null };
          } catch (error) {
            return { entityId, features: null, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        });

        const batchResults = await Promise.all(featuresPromises);
        const validEntities = batchResults.filter(r => !r.error && r.features);

        if (validEntities.length > 0) {
          const entityIds = validEntities.map(r => r.entityId);
          const features = validEntities.map(r => r.features!);

          const predictions = await model.predict(entityIds, features);
          results.push(...predictions);

          // Update feature store with predictions
          for (const prediction of predictions) {
            await this.updateFeatureStore(prediction);
          }
        }

        // Add delay to prevent overwhelming the system
        if (i + batchSize < job.entityIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      job.results = results;
      job.status = 'completed';
      job.completedAt = new Date();

      mlLogger.prediction('Batch prediction job completed', {
        jobId: job.id,
        modelType: job.modelType,
        totalEntities: job.entityIds.length,
        successfulPredictions: results.length,
        duration: job.completedAt.getTime() - job.startedAt!.getTime(),
      });

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();

      mlLogger.error('Batch prediction job failed', error as Error, {
        jobId: job.id,
        modelType: job.modelType,
      });
    }
  }

  /**
   * Get features for an entity
   */
  private async getEntityFeatures(entityId: string, entityType: string): Promise<UserBehaviorFeatures> {
    const featureNames = [
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
      'wallet_age_days',
      'wallet_transaction_count',
      'wallet_total_volume',
    ];

    try {
      const features = await featureStore.getFeatures(entityId, entityType, featureNames);

      // Convert to UserBehaviorFeatures format
      return {
        user_id: entityId,
        session_duration_avg: features.session_duration_avg || 600,
        account_age_days: features.account_age_days || 30,
        verification_status: features.verification_status || 'unverified',
        risk_tier: features.risk_tier || 'low',
        login_frequency_24h: features.login_frequency_24h || 1,
        task_completion_rate: features.task_completion_rate || 0.8,
        average_task_time: features.average_task_time || 300,
        total_earned: features.total_earned || 0,
        total_spent: features.total_spent || 0,
        transaction_count: features.transaction_count || 0,
        avg_transaction_amount: features.avg_transaction_amount || 25,
        payment_method_count: features.payment_method_count || 1,
        average_quality_score: features.average_quality_score || 0.85,
        rejection_rate: features.rejection_rate || 0.1,
        dispute_count: features.dispute_count || 0,
        consensus_agreement_rate: features.consensus_agreement_rate || 0.9,
        peak_activity_hours: features.peak_activity_hours || [14, 15, 16],
        preferred_task_types: features.preferred_task_types || [],
        device_usage_pattern: features.device_usage_pattern || {},
        location_consistency_score: features.location_consistency_score || 0.9,
      };

    } catch (error) {
      mlLogger.error('Failed to get entity features', error as Error, { entityId, entityType });

      // Return default features
      return {
        user_id: entityId,
        session_duration_avg: 600,
        account_age_days: 30,
        verification_status: 'unverified',
        risk_tier: 'low',
        login_frequency_24h: 1,
        task_completion_rate: 0.8,
        average_task_time: 300,
        total_earned: 0,
        total_spent: 0,
        transaction_count: 0,
        avg_transaction_amount: 25,
        payment_method_count: 1,
        average_quality_score: 0.85,
        rejection_rate: 0.1,
        dispute_count: 0,
        consensus_agreement_rate: 0.9,
        peak_activity_hours: [14, 15, 16],
        preferred_task_types: [],
        device_usage_pattern: {},
        location_consistency_score: 0.9,
      };
    }
  }

  /**
   * Update feature store with prediction
   */
  private async updateFeatureStore(prediction: Prediction): Promise<void> {
    try {
      await featureStore.updateFeatures(
        prediction.id,
        'prediction',
        {
          predicted_value: prediction.predicted_value,
          confidence: prediction.confidence,
          prediction_type: prediction.prediction_type,
          model_version: prediction.model_version,
          expires_at: prediction.expires_at,
          primary_drivers: prediction.primary_drivers,
        },
        true
      );
    } catch (error) {
      mlLogger.error('Failed to update feature store with prediction', error as Error, {
        predictionId: prediction.id,
      });
    }
  }

  /**
   * Schedule periodic tasks
   */
  private schedulePeriodicTasks(): void {
    // Schedule model retraining
    if (mlConfig.training.autoRetraining.enabled) {
      const task = cron.schedule(mlConfig.training.autoRetraining.schedule, async () => {
        await this.retrainModels();
      });

      this.scheduledJobs.set('model_retraining', task);

      mlLogger.prediction('Model retraining scheduled', {
        schedule: mlConfig.training.autoRetraining.schedule,
      });
    }

    // Schedule periodic predictions
    const predictionTask = cron.schedule('0 */6 * * *', async () => {
      await this.runPeriodicPredictions();
    });

    this.scheduledJobs.set('periodic_predictions', predictionTask);

    mlLogger.prediction('Periodic predictions scheduled', {
      schedule: 'every 6 hours',
    });

    // Schedule cache cleanup
    const cleanupTask = cron.schedule('0 */2 * * *', async () => {
      this.cleanupCache();
    });

    this.scheduledJobs.set('cache_cleanup', cleanupTask);
  }

  /**
   * Retrain all models
   */
  private async retrainModels(): Promise<void> {
    mlLogger.prediction('Starting model retraining');

    for (const [modelName, model] of this.models) {
      try {
        const currentMetrics = model.getMetrics();
        const shouldRetrain = !currentMetrics ||
          currentMetrics.accuracy < mlConfig.training.autoRetraining.minAccuracy;

        if (shouldRetrain) {
          mlLogger.prediction('Retraining model', { model: modelName });

          const newMetrics = await model.trainModel();
          await model.saveModel(`./models/${modelName}_model`);

          mlLogger.prediction('Model retraining completed', {
            model: modelName,
            oldAccuracy: currentMetrics?.accuracy || 0,
            newAccuracy: newMetrics.accuracy,
          });

          // Emit event for model update
          this.emit('model_updated', {
            modelName,
            oldMetrics: currentMetrics,
            newMetrics,
            timestamp: new Date(),
          });

        } else {
          mlLogger.prediction('Model performance acceptable, skipping retraining', {
            model: modelName,
            accuracy: currentMetrics.accuracy,
          });
        }

      } catch (error) {
        mlLogger.error('Failed to retrain model', error as Error, { model: modelName });
      }
    }
  }

  /**
   * Run periodic predictions for all active users
   */
  private async runPeriodicPredictions(): Promise<void> {
    mlLogger.prediction('Starting periodic predictions');

    try {
      // Get active users (simplified - in production, query user database)
      const activeUsers = await this.getActiveUsers(1000); // Limit to 1000 users

      for (const [modelName, model] of this.models) {
        try {
          // Process in batches
          const batchSize = 50;
          for (let i = 0; i < activeUsers.length; i += batchSize) {
            const batch = activeUsers.slice(i, i + batchSize);

            const features = await Promise.all(
              batch.map(userId => this.getEntityFeatures(userId, 'user'))
            );

            const predictions = await model.predict(batch, features);

            // Store predictions
            for (const prediction of predictions) {
              await this.updateFeatureStore(prediction);
            }

            mlLogger.prediction('Periodic predictions batch completed', {
              model: modelName,
              batchSize: batch.length,
              processed: i + batch.length,
              total: activeUsers.length,
            });

            // Add delay to prevent overwhelming the system
            if (i + batchSize < activeUsers.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

        } catch (error) {
          mlLogger.error('Failed to run periodic predictions for model', error as Error, {
            model: modelName,
          });
        }
      }

      mlLogger.prediction('Periodic predictions completed', {
        totalUsers: activeUsers.length,
        models: this.models.size,
      });

    } catch (error) {
      mlLogger.error('Failed to run periodic predictions', error as Error);
    }
  }

  /**
   * Get active users (placeholder implementation)
   */
  private async getActiveUsers(limit: number): Promise<string[]> {
    // In a real implementation, this would query the user database
    // For now, return mock user IDs
    return Array.from({ length: limit }, (_, i) => `user_${i + 1}`);
  }

  /**
   * Calculate job progress
   */
  private calculateJobProgress(job: PredictionJob): number {
    if (!job.startedAt) return 0;

    const elapsed = Date.now() - job.startedAt.getTime();
    const estimatedDuration = job.entityIds.length * 100; // 100ms per entity
    return Math.min(100, (elapsed / estimatedDuration) * 100);
  }

  /**
   * Get cache key for prediction
   */
  private getCacheKey(entityId: string, modelType: string): string {
    return `prediction:${modelType}:${entityId}`;
  }

  /**
   * Get cache TTL for model type
   */
  private getCacheTTL(modelType: string): number {
    const ttlMap: Record<string, number> = {
      churn: 3600, // 1 hour
      revenue: 1800, // 30 minutes
      quality: 900, // 15 minutes
    };

    return ttlMap[modelType] || 1800;
  }

  /**
   * Calculate confidence intervals for predictions
   */
  private calculateConfidenceIntervals(prediction: Prediction): Record<string, [number, number]> {
    const confidence = prediction.confidence;
    const value = prediction.predicted_value as number;

    // Simple confidence interval calculation
    const margin = (1 - confidence) * Math.abs(value) * 0.5;

    if (prediction.probability_distribution) {
      const positiveProb = prediction.probability_distribution.positive || 0.5;
      return {
        probability: [
          Math.max(0, positiveProb - margin),
          Math.min(1, positiveProb + margin),
        ],
      };
    } else {
      return {
        value: [
          Math.max(0, value - margin),
          value + margin,
        ],
      };
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.predictionCache.entries()) {
      if (value.expires <= now) {
        this.predictionCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      mlLogger.prediction('Cache cleanup completed', {
        cleaned,
        remaining: this.predictionCache.size,
      });
    }

    // Clean up old batch jobs
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    for (const [jobId, job] of this.batchJobs.entries()) {
      if (job.createdAt.getTime() < cutoffTime && (job.status === 'completed' || job.status === 'failed')) {
        this.batchJobs.delete(jobId);
      }
    }
  }

  /**
   * Get model statistics
   */
  getModelStats(): Array<{
    name: string;
    type: string;
    isTrained: boolean;
    metrics?: any;
    lastTrained?: Date;
  }> {
    return Array.from(this.models.entries()).map(([name, model]) => ({
      name,
      type: model.getConfig().modelType,
      isTrained: model.isModelTrained(),
      metrics: model.getMetrics(),
      lastTrained: undefined, // This would be stored in model metadata
    }));
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    isRunning: boolean;
    modelsCount: number;
    activeJobs: number;
    cacheSize: number;
    scheduledTasks: number;
  } {
    const activeJobs = Array.from(this.batchJobs.values()).filter(job =>
      job.status === 'queued' || job.status === 'running'
    ).length;

    return {
      isRunning: this.isRunning,
      modelsCount: this.models.size,
      activeJobs,
      cacheSize: this.predictionCache.size,
      scheduledTasks: this.scheduledJobs.size,
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

    // Stop scheduled tasks
    for (const task of this.scheduledJobs.values()) {
      task.stop();
    }
    this.scheduledJobs.clear();

    // Dispose of models
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();

    // Clear caches and jobs
    this.predictionCache.clear();
    this.batchJobs.clear();

    this.removeAllListeners();
    mlLogger.prediction('Predictive analytics service stopped');
  }
}

// Singleton instance
export const predictiveAnalyticsService = new PredictiveAnalyticsService();