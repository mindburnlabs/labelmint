/**
 * Predictive Analytics System Tests
 * Comprehensive tests for prediction models and services
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PredictiveAnalyticsModel } from '@/models/PredictiveAnalyticsModel';
import { predictiveAnalyticsService } from '@/services/PredictiveAnalyticsService';
import { featureStore } from '@/services/FeatureStore';
import { UserBehaviorFeatures, PredictionRequest } from '@/types/ml.types';
import { mlLogger } from '@/utils/logger';

describe('Predictive Analytics System', () => {
  let churnModel: PredictiveAnalyticsModel;
  let revenueModel: PredictiveAnalyticsModel;
  let mockUserFeatures: UserBehaviorFeatures;

  beforeAll(async () => {
    // Initialize test environment
    mlLogger.info('Initializing predictive analytics test environment');

    // Create test models
    churnModel = new PredictiveAnalyticsModel({
      modelType: 'churn',
      algorithm: 'neural_network',
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
      ],
      targetVariable: 'churned',
      predictionHorizon: 30,
      updateFrequency: 'daily',
      hyperparameters: {
        hiddenLayers: [32, 16],
        dropoutRate: 0.2,
        learningRate: 0.01,
        epochs: 10,
        batchSize: 16,
        earlyStoppingPatience: 5,
      },
      isClassification: true,
    });

    revenueModel = new PredictiveAnalyticsModel({
      modelType: 'revenue',
      algorithm: 'neural_network',
      features: [
        'total_earned',
        'transaction_count',
        'avg_transaction_amount',
        'task_completion_rate',
        'account_age_days',
        'login_frequency_24h',
        'average_quality_score',
      ],
      targetVariable: 'revenue_90d',
      predictionHorizon: 90,
      updateFrequency: 'weekly',
      hyperparameters: {
        hiddenLayers: [64, 32],
        dropoutRate: 0.2,
        learningRate: 0.01,
        epochs: 15,
        batchSize: 32,
        earlyStoppingPatience: 5,
      },
      isClassification: false,
    });

    // Mock user features for testing
    mockUserFeatures = {
      account_age_days: 60,
      verification_status: 'verified',
      risk_tier: 'low',
      login_frequency_24h: 5,
      task_completion_rate: 0.85,
      average_task_time: 300,
      total_earned: 2500,
      total_spent: 1200,
      transaction_count: 45,
      avg_transaction_amount: 55,
      payment_method_count: 2,
      average_quality_score: 0.92,
      rejection_rate: 0.05,
      dispute_count: 1,
      consensus_agreement_rate: 0.95,
      peak_activity_hours: [14, 15, 16],
      preferred_task_types: ['image_classification', 'text_annotation'],
      device_usage_pattern: {
        mobile: 0.7,
        desktop: 0.3,
      },
      location_consistency_score: 0.98,
    };
  });

  afterAll(async () => {
    // Cleanup test environment
    churnModel.dispose();
    revenueModel.dispose();
  });

  describe('PredictiveAnalyticsModel', () => {
    it('should initialize with correct configuration', () => {
      expect(churnModel.getConfig().modelType).toBe('churn');
      expect(churnModel.getConfig().isClassification).toBe(true);
      expect(revenueModel.getConfig().modelType).toBe('revenue');
      expect(revenueModel.getConfig().isClassification).toBe(false);
    });

    it('should train churn prediction model', async () => {
      const metrics = await churnModel.trainModel();

      expect(metrics.accuracy).toBeGreaterThan(0.7);
      expect(metrics.precision).toBeGreaterThan(0.6);
      expect(metrics.recall).toBeGreaterThan(0.6);
      expect(metrics.f1_score).toBeGreaterThan(0.6);
      expect(churnModel.isModelTrained()).toBe(true);
    });

    it('should train revenue prediction model', async () => {
      const metrics = await revenueModel.trainModel();

      expect(metrics.mean_squared_error).toBeDefined();
      expect(metrics.mean_absolute_error).toBeDefined();
      expect(metrics.r2_score).toBeDefined();
      expect(revenueModel.isModelTrained()).toBe(true);
    });

    it('should make churn predictions', async () => {
      // Train model if not already trained
      if (!churnModel.isModelTrained()) {
        await churnModel.trainModel();
      }

      const predictions = await churnModel.predict(['user_123'], [mockUserFeatures]);

      expect(predictions).toHaveLength(1);
      const prediction = predictions[0];

      expect(prediction.entity_id).toBe('user_123');
      expect(prediction.prediction_type).toBe('churn');
      expect(prediction.predicted_value).toBe(0 || 1); // Binary classification
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
      expect(prediction.feature_importance).toBeDefined();
      expect(prediction.primary_drivers).toBeDefined();
      expect(prediction.prediction_horizon).toBe('30d');
    });

    it('should make revenue predictions', async () => {
      // Train model if not already trained
      if (!revenueModel.isModelTrained()) {
        await revenueModel.trainModel();
      }

      const predictions = await revenueModel.predict(['user_456'], [mockUserFeatures]);

      expect(predictions).toHaveLength(1);
      const prediction = predictions[0];

      expect(prediction.entity_id).toBe('user_456');
      expect(prediction.prediction_type).toBe('revenue');
      expect(prediction.predicted_value).toBeGreaterThanOrEqual(0); // Revenue should be non-negative
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.feature_importance).toBeDefined();
      expect(prediction.prediction_horizon).toBe('90d');
    });

    it('should handle batch predictions', async () => {
      const userIds = ['user_1', 'user_2', 'user_3', 'user_4', 'user_5'];
      const features = userIds.map((_, i) => ({
        ...mockUserFeatures,
        account_age_days: 30 + i * 10,
        total_earned: 1000 + i * 500,
        task_completion_rate: 0.7 + (i * 0.05),
      }));

      if (!churnModel.isModelTrained()) {
        await churnModel.trainModel();
      }

      const predictions = await churnModel.predict(userIds, features);

      expect(predictions).toHaveLength(5);
      predictions.forEach((prediction, index) => {
        expect(prediction.entity_id).toBe(userIds[index]);
        expect(prediction.prediction_type).toBe('churn');
        expect(prediction.predicted_value).toBe(0 || 1);
      });
    });

    it('should calculate feature importance', async () => {
      if (!churnModel.isModelTrained()) {
        await churnModel.trainModel();
      }

      const importance = churnModel.getFeatureImportance();
      expect(importance.size).toBeGreaterThan(0);

      // Important features should have non-zero importance
      const importantFeatures = Array.from(importance.entries())
        .filter(([_, importance]) => importance > 0.01);

      expect(importantFeatures.length).toBeGreaterThan(0);
    });

    it('should handle missing features gracefully', async () => {
      const incompleteFeatures = {
        account_age_days: 30,
        // Missing other features
      } as UserBehaviorFeatures;

      if (!churnModel.isModelTrained()) {
        await churnModel.trainModel();
      }

      const predictions = await churnModel.predict(['user_incomplete'], [incompleteFeatures]);

      expect(predictions).toHaveLength(1);
      expect(predictions[0].predicted_value).toBeDefined();
    });
  });

  describe('PredictiveAnalyticsService', () => {
    beforeAll(async () => {
      // Initialize predictive analytics service
      await predictiveAnalyticsService.initialize();
    });

    afterAll(async () => {
      // Cleanup service
      await predictiveAnalyticsService.stop();
    });

    it('should initialize successfully', () => {
      expect(predictiveAnalyticsService.isActive()).toBe(true);
    });

    it('should make churn prediction', async () => {
      const request: PredictionRequest = {
        model_type: 'churn',
        entity_id: 'test_user_123',
        entity_type: 'user',
        features: mockUserFeatures,
        include_feature_importance: true,
      };

      const response = await predictiveAnalyticsService.predict(request);

      expect(response.prediction).toBeDefined();
      expect(response.prediction.entity_id).toBe('test_user_123');
      expect(response.prediction.prediction_type).toBe('churn');
      expect(response.prediction.predicted_value).toBe(0 || 1);
      expect(response.prediction.confidence).toBeGreaterThan(0);
      expect(response.processing_time_ms).toBeGreaterThan(0);
      expect(response.model_version).toBeDefined();
      expect(response.confidence_intervals).toBeDefined();
    });

    it('should make revenue prediction', async () => {
      const request: PredictionRequest = {
        model_type: 'revenue',
        entity_id: 'test_user_456',
        entity_type: 'user',
        features: mockUserFeatures,
      };

      const response = await predictiveAnalyticsService.predict(request);

      expect(response.prediction).toBeDefined();
      expect(response.prediction.entity_id).toBe('test_user_456');
      expect(response.prediction.prediction_type).toBe('revenue');
      expect(response.prediction.predicted_value).toBeGreaterThanOrEqual(0);
      expect(response.prediction.confidence).toBeGreaterThan(0);
    });

    it('should handle batch prediction requests', async () => {
      const entityIds = ['user_1', 'user_2', 'user_3'];
      const result = await predictiveAnalyticsService.batchPredict(entityIds, 'churn');

      expect(result.job_id).toBeDefined();
      expect(result.status).toMatch(/queued|processing|completed|failed/);
    });

    it('should get batch job status', async () => {
      const entityIds = ['user_batch_1', 'user_batch_2'];
      const batchResult = await predictiveAnalyticsService.batchPredict(entityIds, 'churn');

      if (batchResult.status !== 'failed') {
        const jobStatus = predictiveAnalyticsService.getBatchJobStatus(batchResult.job_id);
        expect(jobStatus).toBeDefined();
        expect(jobStatus?.status).toBeDefined();
      }
    });

    it('should get model statistics', async () => {
      const stats = predictiveAnalyticsService.getModelStats();

      expect(stats).toBeInstanceOf(Array);
      expect(stats.length).toBeGreaterThan(0);

      stats.forEach(stat => {
        expect(stat.name).toBeDefined();
        expect(stat.type).toBeDefined();
        expect(stat.isTrained).toBeDefined();
      });
    });

    it('should get service statistics', async () => {
      const stats = predictiveAnalyticsService.getServiceStats();

      expect(stats.isRunning).toBe(true);
      expect(stats.modelsCount).toBeGreaterThan(0);
      expect(stats.activeJobs).toBeGreaterThanOrEqual(0);
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
    });

    it('should cache predictions', async () => {
      const request: PredictionRequest = {
        model_type: 'churn',
        entity_id: 'cache_test_user',
        features: mockUserFeatures,
      };

      // First request
      const response1 = await predictiveAnalyticsService.predict(request);
      const startTime1 = Date.now();

      // Second request (should use cache)
      const response2 = await predictiveAnalyticsService.predict(request);
      const processingTime2 = Date.now() - startTime1;

      expect(response1.prediction.predicted_value).toBe(response2.prediction.predicted_value);
      expect(processingTime2).toBeLessThan(response1.processing_time_ms); // Cache should be faster
    });
  });

  describe('Feature Integration', () => {
    it('should update and retrieve user features', async () => {
      const userId = 'feature_test_user';

      await featureStore.updateFeatures(userId, 'user', {
        account_age_days: mockUserFeatures.account_age_days,
        login_frequency_24h: mockUserFeatures.login_frequency_24h,
        task_completion_rate: mockUserFeatures.task_completion_rate,
        total_earned: mockUserFeatures.total_earned,
      }, true);

      const retrievedFeatures = await featureStore.getFeatures(
        userId,
        'user',
        ['account_age_days', 'login_frequency_24h', 'task_completion_rate', 'total_earned']
      );

      expect(retrievedFeatures.account_age_days).toBe(mockUserFeatures.account_age_days);
      expect(retrievedFeatures.login_frequency_24h).toBe(mockUserFeatures.login_frequency_24h);
      expect(retrievedFeatures.task_completion_rate).toBe(mockUserFeatures.task_completion_rate);
      expect(retrievedFeatures.total_earned).toBe(mockUserFeatures.total_earned);
    });

    it('should get historical features', async () => {
      const userId = 'historical_test_user';
      const features = ['account_age_days', 'total_earned'];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      // This would normally return historical data
      // For testing, we expect it to not throw errors
      const historicalData = await featureStore.getHistoricalFeatures(
        userId,
        'user',
        features,
        startDate,
        endDate,
        'day'
      );

      expect(Array.isArray(historicalData)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid model type', async () => {
      const request: PredictionRequest = {
        model_type: 'invalid_model' as any,
        entity_id: 'test_user',
        features: mockUserFeatures,
      };

      await expect(predictiveAnalyticsService.predict(request)).rejects.toThrow();
    });

    it('should handle empty features', async () => {
      const request: PredictionRequest = {
        model_type: 'churn',
        entity_id: 'empty_features_user',
        features: {},
      };

      const response = await predictiveAnalyticsService.predict(request);

      expect(response.prediction).toBeDefined();
      // Should handle gracefully with default values
    });

    it('should handle very large feature values', async () => {
      const largeFeatures = {
        ...mockUserFeatures,
        total_earned: Number.MAX_SAFE_INTEGER,
        transaction_count: 1000000,
        account_age_days: 365 * 100, // 100 years
      };

      const request: PredictionRequest = {
        model_type: 'revenue',
        entity_id: 'large_features_user',
        features: largeFeatures,
      };

      const response = await predictiveAnalyticsService.predict(request);

      expect(response.prediction).toBeDefined();
      expect(response.prediction.predicted_value).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative feature values', async () => {
      const negativeFeatures = {
        ...mockUserFeatures,
        total_earned: -1000, // Negative earnings (shouldn't happen but test robustness)
        task_completion_rate: -0.5, // Invalid completion rate
      };

      const request: PredictionRequest = {
        model_type: 'churn',
        entity_id: 'negative_features_user',
        features: negativeFeatures,
      };

      const response = await predictiveAnalyticsService.predict(request);

      expect(response.prediction).toBeDefined();
      // Should handle gracefully
    });
  });

  describe('Performance Tests', () => {
    it('should handle prediction requests within reasonable time', async () => {
      const request: PredictionRequest = {
        model_type: 'churn',
        entity_id: 'performance_test_user',
        features: mockUserFeatures,
      };

      const startTime = Date.now();
      const response = await predictiveAnalyticsService.predict(request);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
      expect(response.processing_time_ms).toBeLessThan(500); // Model inference should be fast
    });

    it('should handle concurrent prediction requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        model_type: 'churn' as const,
        entity_id: `concurrent_user_${i}`,
        features: {
          ...mockUserFeatures,
          account_age_days: 30 + i * 5,
        },
      }));

      const startTime = Date.now();
      const promises = requests.map(request => predictiveAnalyticsService.predict(request));
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(responses).toHaveLength(10);
      expect(totalTime).toBeLessThan(5000); // Should handle 10 concurrent requests within 5 seconds
      responses.forEach(response => {
        expect(response.prediction).toBeDefined();
      });
    });
  });
});