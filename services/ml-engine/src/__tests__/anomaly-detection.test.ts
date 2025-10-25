/**
 * Anomaly Detection System Tests
 * Comprehensive tests for anomaly detection models and services
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AnomalyDetectionModel } from '@/models/AnomalyDetectionModel';
import { anomalyDetectionService } from '@/services/AnomalyDetectionService';
import { featureStore } from '@/services/FeatureStore';
import { UserBehaviorFeatures, TransactionFeatures } from '@/types/ml.types';
import { mlLogger } from '@/utils/logger';

describe('Anomaly Detection System', () => {
  let userAnomalyModel: AnomalyDetectionModel;
  let transactionAnomalyModel: AnomalyDetectionModel;
  let mockUserFeatures: UserBehaviorFeatures;
  let mockTransactionFeatures: TransactionFeatures;

  beforeAll(async () => {
    // Initialize test environment
    mlLogger.info('Initializing anomaly detection test environment');

    // Create test models
    userAnomalyModel = new AnomalyDetectionModel({
      algorithm: 'isolation_forest',
      contamination: 0.1,
      nEstimators: 50,
      maxSamples: 'auto',
      maxFeatures: 1.0,
      sensitivity: 0.8,
      windowSize: 100,
      updateInterval: 3600,
    });

    transactionAnomalyModel = new AnomalyDetectionModel({
      algorithm: 'statistical',
      sensitivity: 0.7,
      windowSize: 50,
      updateInterval: 1800,
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

    // Mock transaction features
    mockTransactionFeatures = {
      amount: 1000,
      currency: 'USDT',
      timestamp: new Date(),
      wallet_address: 'EQD1234567890abcdef1234567890abcdef12345678',
      recipient_address: 'EQD0987654321fedcba0987654321fedcba09876543',
      hour_of_day: 14,
      day_of_week: 3,
      is_weekend: 0,
      is_holiday: 0,
      transaction_frequency_1h: 2,
      transaction_frequency_24h: 8,
      avg_transaction_amount_24h: 500,
      amount_deviation_from_avg: 1.0,
      wallet_age_days: 30,
      wallet_transaction_count: 25,
      wallet_total_volume: 5000,
      is_new_wallet: 0,
      is_high_risk_country: 0,
      is_vpn_or_proxy: 0,
      device_fingerprint: 'fp_123456',
      is_new_location: 0,
      ip_country: 'US',
      ip_city: 'New York',
      device_risk_score: 0.3,
      ip_risk_score: 0.2,
    };
  });

  afterAll(async () => {
    // Cleanup test environment
    userAnomalyModel.dispose();
    transactionAnomalyModel.dispose();
  });

  describe('AnomalyDetectionModel', () => {
    it('should initialize with correct configuration', () => {
      const userStats = userAnomalyModel.getModelStats();
      const transactionStats = transactionAnomalyModel.getModelStats();

      expect(userStats.algorithm).toBe('isolation_forest');
      expect(userStats.sensitivity).toBe(0.8);
      expect(transactionStats.algorithm).toBe('statistical');
      expect(transactionStats.sensitivity).toBe(0.7);
    });

    it('should initialize user behavior anomaly model', async () => {
      const features = [
        'account_age_days',
        'login_frequency_24h',
        'task_completion_rate',
        'total_earned',
        'total_spent',
        'transaction_count',
        'avg_transaction_amount',
        'average_quality_score',
        'rejection_rate',
        'dispute_count',
      ];

      await userAnomalyModel.initialize(features);

      const stats = userAnomalyModel.getModelStats();
      expect(stats.isInitialized).toBe(true);
      expect(stats.baselineFeatures).toBe(features.length);
    });

    it('should initialize transaction anomaly model', async () => {
      const features = [
        'amount',
        'hour_of_day',
        'day_of_week',
        'transaction_frequency_1h',
        'transaction_frequency_24h',
        'avg_transaction_amount_24h',
        'wallet_age_days',
      ];

      await transactionAnomalyModel.initialize(features);

      const stats = transactionAnomalyModel.getModelStats();
      expect(stats.isInitialized).toBe(true);
      expect(stats.baselineFeatures).toBe(features.length);
    });

    it('should detect anomalies in normal user behavior', async () => {
      const features = [
        'account_age_days',
        'login_frequency_24h',
        'task_completion_rate',
        'total_earned',
        'average_quality_score',
      ];

      await userAnomalyModel.initialize(features);

      const anomalies = await userAnomalyModel.detectAnomalies(
        'user_123',
        'user',
        mockUserFeatures
      );

      expect(Array.isArray(anomalies)).toBe(true);
      // Normal behavior should not generate many anomalies
      expect(anomalies.length).toBeLessThan(3);
    });

    it('should detect anomalies in unusual user behavior', async () => {
      const features = [
        'account_age_days',
        'login_frequency_24h',
        'task_completion_rate',
        'total_earned',
        'average_quality_score',
      ];

      await userAnomalyModel.initialize(features);

      // Create anomalous features
      const anomalousFeatures: UserBehaviorFeatures = {
        ...mockUserFeatures,
        login_frequency_24h: 100, // Extremely high login frequency
        task_completion_rate: 0.1, // Very low completion rate
        average_quality_score: 0.2, // Very low quality score
        rejection_rate: 0.9, // Very high rejection rate
        dispute_count: 50, // Many disputes
      };

      const anomalies = await userAnomalyModel.detectAnomalies(
        'user_anomalous',
        'user',
        anomalousFeatures
      );

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.every(a => a.anomaly_score >= 0)).toBe(true);
      expect(anomalies.every(a => a.anomaly_score <= 100)).toBe(true);
    });

    it('should detect anomalies in transaction patterns', async () => {
      const features = [
        'amount',
        'hour_of_day',
        'transaction_frequency_1h',
        'transaction_frequency_24h',
        'avg_transaction_amount_24h',
      ];

      await transactionAnomalyModel.initialize(features);

      // Create anomalous transaction features
      const anomalousTransaction: TransactionFeatures = {
        ...mockTransactionFeatures,
        amount: 100000, // Very large amount
        hour_of_day: 3, // Unusual time (3 AM)
        transaction_frequency_1h: 20, // High frequency
        amount_deviation_from_avg: 20, // Large deviation
      };

      const anomalies = await transactionAnomalyModel.detectAnomalies(
        'tx_anomalous',
        'transaction',
        anomalousTransaction
      );

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.every(a => a.anomaly_type)).toBeDefined();
      expect(anomalies.every(a => a.affected_metrics)).toBeDefined();
    });

    it('should handle missing features gracefully', async () => {
      const features = ['account_age_days', 'total_earned'];

      await userAnomalyModel.initialize(features);

      const incompleteFeatures = {
        account_age_days: 30,
        // Missing other features
      } as UserBehaviorFeatures;

      const anomalies = await userAnomalyModel.detectAnomalies(
        'user_incomplete',
        'user',
        incompleteFeatures
      );

      expect(Array.isArray(anomalies)).toBe(true);
      // Should handle gracefully without throwing errors
    });

    it('should update model with new data', async () => {
      const features = ['account_age_days', 'login_frequency_24h', 'task_completion_rate'];

      await userAnomalyModel.initialize(features);

      const initialStats = userAnomalyModel.getModelStats();
      const initialUpdateTime = initialStats.lastUpdated;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await userAnomalyModel.updateModel();

      const updatedStats = userAnomalyModel.getModelStats();
      expect(updatedStats.lastUpdated.getTime()).toBeGreaterThan(initialUpdateTime.getTime());
    });
  });

  describe('AnomalyDetectionService', () => {
    beforeAll(async () => {
      // Initialize anomaly detection service
      await anomalyDetectionService.initialize();
    });

    afterAll(async () => {
      // Cleanup service
      await anomalyDetectionService.stop();
    });

    it('should initialize successfully', () => {
      expect(anomalyDetectionService.isActive()).toBe(true);
    });

    it('should detect user behavior anomalies', async () => {
      const anomalies = await anomalyDetectionService.detectUserBehaviorAnomalies(
        'test_user_123',
        mockUserFeatures
      );

      expect(Array.isArray(anomalies)).toBe(true);
      anomalies.forEach(anomaly => {
        expect(anomaly.entity_id).toBe('test_user_123');
        expect(anomaly.entity_type).toBe('user');
        expect(anomaly.anomaly_score).toBeGreaterThanOrEqual(0);
        expect(anomaly.anomaly_score).toBeLessThanOrEqual(100);
        expect(anomaly.anomaly_type).toBeDefined();
        expect(anomaly.affected_metrics).toBeDefined();
      });
    });

    it('should detect transaction anomalies', async () => {
      const anomalies = await anomalyDetectionService.detectTransactionAnomalies(
        'test_tx_456',
        'test_user_123',
        mockTransactionFeatures
      );

      expect(Array.isArray(anomalies)).toBe(true);
      anomalies.forEach(anomaly => {
        expect(anomaly.entity_id).toBe('test_tx_456');
        expect(anomaly.entity_type).toBe('transaction');
        expect(anomaly.anomaly_score).toBeGreaterThanOrEqual(0);
        expect(anomaly.anomaly_score).toBeLessThanOrEqual(100);
      });
    });

    it('should detect system performance anomalies', async () => {
      const systemMetrics = {
        cpu_usage: 15,
        memory_usage: 60,
        disk_io: 100,
        network_io: 50,
        response_time: 150,
        error_rate: 0.02,
        throughput: 1000,
      };

      const anomalies = await anomalyDetectionService.detectSystemAnomalies(systemMetrics);

      expect(Array.isArray(anomalies)).toBe(true);
      // Normal system metrics should not generate anomalies
      expect(anomalies.length).toBeLessThan(2);
    });

    it('should detect anomalies in unusual system metrics', async () => {
      const unusualSystemMetrics = {
        cpu_usage: 95, // Very high CPU usage
        memory_usage: 98, // Very high memory usage
        disk_io: 1000, // High disk I/O
        network_io: 500, // High network I/O
        response_time: 5000, // Very slow response time
        error_rate: 0.15, // High error rate
        throughput: 50, // Low throughput
      };

      const anomalies = await anomalyDetectionService.detectSystemAnomalies(unusualSystemMetrics);

      expect(anomalies.length).toBeGreaterThan(0);
      anomalies.forEach(anomaly => {
        expect(anomaly.entity_type).toBe('session');
        expect(anomaly.anomaly_score).toBeGreaterThan(50); // Should detect high anomaly scores
      });
    });

    it('should analyze anomaly trends', async () => {
      const trends = await anomalyDetectionService.analyzeAnomalyTrends(24);

      expect(trends.totalAnomalies).toBeGreaterThanOrEqual(0);
      expect(trends.anomalyRate).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(trends.topAnomalyTypes)).toBe(true);
      expect(Array.isArray(trends.topAffectedEntities)).toBe(true);
      expect(typeof trends.severityDistribution).toBe('object');
      expect(Array.isArray(trends.timeSeriesData)).toBe(true);
    });

    it('should get entity anomalies', async () => {
      // First, detect some anomalies to populate data
      await anomalyDetectionService.detectUserBehaviorAnomalies(
        'entity_test_user',
        mockUserFeatures
      );

      const entityAnomalies = anomalyDetectionService.getEntityAnomalies(
        'entity_test_user'
      );

      expect(Array.isArray(entityAnomalies)).toBe(true);
      entityAnomalies.forEach(anomaly => {
        expect(anomaly.entity_id).toBe('entity_test_user');
      });
    });

    it('should get model statistics', async () => {
      const stats = anomalyDetectionService.getModelStats();

      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);

      stats.forEach(stat => {
        expect(stat.name).toBeDefined();
        expect(stat.stats).toBeDefined();
        expect(stat.stats.algorithm).toBeDefined();
        expect(stat.stats.sensitivity).toBeDefined();
      });
    });

    it('should get service statistics', async () => {
      const stats = anomalyDetectionService.getServiceStats();

      expect(stats.isRunning).toBe(true);
      expect(stats.modelsCount).toBeGreaterThan(0);
      expect(stats.trackedEntities).toBeGreaterThanOrEqual(0);
      expect(stats.totalAnomalies).toBeGreaterThanOrEqual(0);
    });

    it('should emit events for significant anomalies', async () => {
      let eventEmitted = false;

      anomalyDetectionService.once('anomaly_detected', (event) => {
        expect(event.type).toMatch(/anomaly_detected|behavioral_anomaly|performance_anomaly/);
        expect(event.data).toBeDefined();
        eventEmitted = true;
      });

      // Create highly anomalous features
      const highlyAnomalousFeatures: UserBehaviorFeatures = {
        ...mockUserFeatures,
        login_frequency_24h: 1000, // Extremely high
        task_completion_rate: 0, // No tasks completed
        average_quality_score: 0, // No quality
        rejection_rate: 1, // All rejected
        dispute_count: 100, // Many disputes
      };

      await anomalyDetectionService.detectUserBehaviorAnomalies(
        'high_anomaly_user',
        highlyAnomalousFeatures
      );

      // Should emit event for high anomalies
      expect(eventEmitted).toBe(true);
    });
  });

  describe('Feature Integration', () => {
    it('should update feature store with user data', async () => {
      const userId = 'anomaly_feature_test_user';

      await featureStore.updateFeatures(userId, 'user', {
        account_age_days: mockUserFeatures.account_age_days,
        login_frequency_24h: mockUserFeatures.login_frequency_24h,
        task_completion_rate: mockUserFeatures.task_completion_rate,
      }, true);

      const retrievedFeatures = await featureStore.getFeatures(
        userId,
        'user',
        ['account_age_days', 'login_frequency_24h', 'task_completion_rate']
      );

      expect(retrievedFeatures.account_age_days).toBe(mockUserFeatures.account_age_days);
      expect(retrievedFeatures.login_frequency_24h).toBe(mockUserFeatures.login_frequency_24h);
      expect(retrievedFeatures.task_completion_rate).toBe(mockUserFeatures.task_completion_rate);
    });

    it('should detect feature drift', async () => {
      const drift = await featureStore.getFeatureDrift(
        'user',
        'login_frequency_24h',
        7, // days
        1   // current period
      );

      expect(drift.drift_score).toBeGreaterThanOrEqual(0);
      expect(drift.population_stability_index).toBeGreaterThanOrEqual(0);
      expect(drift.reference_stats).toBeDefined();
      expect(drift.production_stats).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty user features', async () => {
      const emptyFeatures = {} as UserBehaviorFeatures;

      const anomalies = await anomalyDetectionService.detectUserBehaviorAnomalies(
        'empty_features_user',
        emptyFeatures
      );

      expect(Array.isArray(anomalies)).toBe(true);
      // Should handle gracefully without throwing errors
    });

    it('should handle invalid numeric values', async () => {
      const invalidFeatures: UserBehaviorFeatures = {
        ...mockUserFeatures,
        login_frequency_24h: NaN,
        task_completion_rate: Infinity,
        total_earned: -1000, // Negative earnings
      };

      const anomalies = await anomalyDetectionService.detectUserBehaviorAnomalies(
        'invalid_features_user',
        invalidFeatures
      );

      expect(Array.isArray(anomalies)).toBe(true);
      // Should handle gracefully
    });

    it('should handle extreme values', async () => {
      const extremeFeatures: UserBehaviorFeatures = {
        ...mockUserFeatures,
        login_frequency_24h: Number.MAX_SAFE_INTEGER,
        total_earned: Number.MAX_VALUE,
        account_age_days: 36500, // 100 years
      };

      const anomalies = await anomalyDetectionService.detectUserBehaviorAnomalies(
        'extreme_features_user',
        extremeFeatures
      );

      expect(Array.isArray(anomalies)).toBe(true);
      // Should handle gracefully without crashing
    });

    it('should handle zero values', async () => {
      const zeroFeatures: UserBehaviorFeatures = {
        ...mockUserFeatures,
        login_frequency_24h: 0,
        task_completion_rate: 0,
        total_earned: 0,
        total_spent: 0,
        transaction_count: 0,
        average_quality_score: 0,
      };

      const anomalies = await anomalyDetectionService.detectUserBehaviorAnomalies(
        'zero_features_user',
        zeroFeatures
      );

      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should handle anomaly detection within reasonable time', async () => {
      const startTime = Date.now();
      const anomalies = await anomalyDetectionService.detectUserBehaviorAnomalies(
        'performance_test_user',
        mockUserFeatures
      );
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should handle concurrent anomaly detection requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        userId: `concurrent_anomaly_user_${i}`,
        features: {
          ...mockUserFeatures,
          account_age_days: 30 + i * 10,
        },
      }));

      const startTime = Date.now();
      const promises = requests.map(req =>
        anomalyDetectionService.detectUserBehaviorAnomalies(req.userId, req.features)
      );
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(totalTime).toBeLessThan(3000); // Should handle 5 concurrent requests within 3 seconds
      results.forEach(anomalies => {
        expect(Array.isArray(anomalies)).toBe(true);
      });
    });
  });
});