/**
 * Fraud Detection System Tests
 * Comprehensive tests for fraud detection models and services
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FraudDetectionModel } from '@/models/FraudDetectionModel';
import { fraudDetectionService } from '@/services/FraudDetectionService';
import { featureStore } from '@/services/FeatureStore';
import { TransactionFeatures, FraudDetectionRequest } from '@/types/ml.types';
import { mlLogger } from '@/utils/logger';

describe('Fraud Detection System', () => {
  let fraudModel: FraudDetectionModel;
  let mockFeatures: TransactionFeatures;

  beforeAll(async () => {
    // Initialize test environment
    mlLogger.info('Initializing fraud detection test environment');

    // Create test model
    fraudModel = new FraudDetectionModel({
      inputFeatures: [
        'amount',
        'hour_of_day',
        'day_of_week',
        'transaction_frequency_1h',
        'transaction_frequency_24h',
        'avg_transaction_amount_24h',
        'amount_deviation_from_avg',
        'wallet_age_days',
        'is_new_wallet',
        'device_risk_score',
      ],
      hiddenLayers: [32, 16],
      dropoutRate: 0.2,
      learningRate: 0.01,
      batchSize: 16,
      epochs: 10,
      validationSplit: 0.2,
      earlyStoppingPatience: 5,
      threshold: 0.7,
    });

    // Mock features for testing
    mockFeatures = {
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
    fraudModel.dispose();
  });

  describe('FraudDetectionModel', () => {
    it('should initialize with correct configuration', () => {
      expect(fraudModel.isModelTrained()).toBe(false);

      const config = fraudModel.getModelConfig();
      expect(config.name).toBe('Fraud Detection Model');
      expect(config.type).toBe('fraud_detection');
      expect(config.algorithm).toBe('neural_network');
    });

    it('should train model with synthetic data', async () => {
      // Generate synthetic training data
      const trainingData = Array.from({ length: 200 }, (_, i) => ({
        features: {
          ...mockFeatures,
          amount: Math.random() * 5000 + 100,
          hour_of_day: Math.floor(Math.random() * 24),
          day_of_week: Math.floor(Math.random() * 7),
          transaction_frequency_1h: Math.floor(Math.random() * 10),
          transaction_frequency_24h: Math.floor(Math.random() * 50),
          avg_transaction_amount_24h: Math.random() * 1000 + 100,
          amount_deviation_from_avg: Math.random() * 5,
          wallet_age_days: Math.random() * 365,
          wallet_transaction_count: Math.floor(Math.random() * 100),
          device_risk_score: Math.random(),
          ip_risk_score: Math.random(),
        },
        isFraud: i < 20, // 10% fraud rate in training data
      }));

      const metrics = await fraudModel.trainModel(trainingData);

      expect(metrics.accuracy).toBeGreaterThan(0.8);
      expect(metrics.precision).toBeGreaterThan(0.7);
      expect(metrics.recall).toBeGreaterThan(0.7);
      expect(fraudModel.isModelTrained()).toBe(true);
    });

    it('should predict fraud scores for legitimate transactions', async () => {
      // Train model first if not already trained
      if (!fraudModel.isModelTrained()) {
        const trainingData = Array.from({ length: 100 }, (_, i) => ({
          features: {
            ...mockFeatures,
            amount: Math.random() * 1000 + 100,
            transaction_frequency_24h: Math.floor(Math.random() * 10) + 1,
            device_risk_score: Math.random() * 0.5,
            ip_risk_score: Math.random() * 0.5,
          },
          isFraud: false,
        }));
        await fraudModel.trainModel(trainingData);
      }

      const fraudScore = await fraudModel.predictFraudScore(mockFeatures);

      expect(fraudScore.overall_score).toBeGreaterThanOrEqual(0);
      expect(fraudScore.overall_score).toBeLessThanOrEqual(100);
      expect(fraudScore.risk_level).toBeDefined();
      expect(fraudScore.confidence).toBeGreaterThan(0);
      expect(fraudScore.confidence).toBeLessThanOrEqual(1);
      expect(fraudScore.risk_factors).toBeDefined();
      expect(fraudScore.recommendations).toBeDefined();
      expect(fraudScore.transaction_pattern_score).toBeGreaterThanOrEqual(0);
      expect(fraudScore.behavioral_anomaly_score).toBeGreaterThanOrEqual(0);
      expect(fraudScore.device_fingerprint_score).toBeGreaterThanOrEqual(0);
      expect(fraudScore.geographic_anomaly_score).toBeGreaterThanOrEqual(0);
    });

    it('should identify high-risk transactions correctly', async () => {
      // Create high-risk features
      const highRiskFeatures: TransactionFeatures = {
        ...mockFeatures,
        amount: 50000, // Very high amount
        hour_of_day: 3, // Unusual hours (3 AM)
        transaction_frequency_1h: 15, // High frequency
        amount_deviation_from_avg: 10, // Large deviation
        wallet_age_days: 1, // New wallet
        is_new_wallet: 1,
        device_risk_score: 0.9, // High device risk
        ip_risk_score: 0.8, // High IP risk
        is_high_risk_country: 1, // High risk country
      };

      const fraudScore = await fraudModel.predictFraudScore(highRiskFeatures);

      expect(fraudScore.overall_score).toBeGreaterThan(50);
      expect(['high', 'critical']).toContain(fraudScore.risk_level);
      expect(fraudScore.requires_review).toBe(true);
    });

    it('should handle missing features gracefully', async () => {
      const incompleteFeatures = {
        amount: 1000,
        currency: 'USDT',
        timestamp: new Date(),
        wallet_address: 'EQD1234567890abcdef1234567890abcdef12345678',
        // Missing other features
      } as TransactionFeatures;

      const fraudScore = await fraudModel.predictFraudScore(incompleteFeatures);

      expect(fraudScore.overall_score).toBeGreaterThanOrEqual(0);
      expect(fraudScore.risk_level).toBeDefined();
    });
  });

  describe('FraudDetectionService', () => {
    beforeAll(async () => {
      // Initialize fraud detection service
      await fraudDetectionService.initialize();
    });

    afterAll(async () => {
      // Cleanup service
      await fraudDetectionService.stop();
    });

    it('should initialize successfully', () => {
      expect(fraudDetectionService.isActive()).toBe(true);
    });

    it('should score transaction for fraud risk', async () => {
      const request: FraudDetectionRequest = {
        transaction_id: 'test_tx_123',
        user_id: 'test_user_456',
        transaction_data: mockFeatures,
        include_explanation: true,
      };

      const response = await fraudDetectionService.scoreTransaction(request);

      expect(response.fraud_score).toBeDefined();
      expect(response.fraud_score.overall_score).toBeGreaterThanOrEqual(0);
      expect(response.fraud_score.risk_level).toBeDefined();
      expect(response.processing_time_ms).toBeGreaterThan(0);
      expect(response.model_version).toBeDefined();
      expect(response.recommendations).toBeDefined();
    });

    it('should handle batch fraud scoring', async () => {
      const requests: FraudDetectionRequest[] = Array.from({ length: 5 }, (_, i) => ({
        transaction_id: `test_tx_${i}`,
        user_id: `test_user_${i}`,
        transaction_data: {
          ...mockFeatures,
          amount: Math.random() * 2000 + 100,
          hour_of_day: Math.floor(Math.random() * 24),
        },
      }));

      const responses = await fraudDetectionService.batchScoreTransactions(requests);

      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.fraud_score).toBeDefined();
        expect(response.processing_time_ms).toBeGreaterThan(0);
      });
    });

    it('should cache fraud scores', async () => {
      const request: FraudDetectionRequest = {
        transaction_id: 'cache_test_tx',
        user_id: 'cache_test_user',
        transaction_data: mockFeatures,
      };

      // First request
      const response1 = await fraudDetectionService.scoreTransaction(request);
      const startTime1 = Date.now();

      // Second request (should use cache)
      const response2 = await fraudDetectionService.scoreTransaction(request);
      const processingTime2 = Date.now() - startTime1;

      expect(response1.fraud_score.overall_score).toBe(response2.fraud_score.overall_score);
      expect(processingTime2).toBeLessThan(response1.processing_time_ms); // Cache should be faster
    });

    it('should emit events for high-risk transactions', async () => {
      let eventEmitted = false;

      fraudDetectionService.once('fraud_detected', (event) => {
        expect(event.type).toBe('high_risk_transaction');
        expect(event.data.risk_level).toMatch(/high|critical/);
        eventEmitted = true;
      });

      const highRiskRequest: FraudDetectionRequest = {
        transaction_id: 'high_risk_tx',
        user_id: 'high_risk_user',
        transaction_data: {
          ...mockFeatures,
          amount: 100000, // Very high amount
          device_risk_score: 0.95,
          ip_risk_score: 0.9,
        },
      };

      await fraudDetectionService.scoreTransaction(highRiskRequest);

      // Event should be emitted for high-risk transactions
      expect(eventEmitted).toBe(true);
    });

    it('should get model statistics', async () => {
      const stats = await fraudDetectionService.getModelStats();

      expect(stats.isTrained).toBeDefined();
      expect(stats.modelConfig).toBeDefined();
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
      expect(stats.recentScores).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Feature Integration', () => {
    it('should update feature store with transaction data', async () => {
      const transactionId = 'feature_test_tx';
      const userId = 'feature_test_user';

      await featureStore.updateFeatures(transactionId, 'transaction', {
        amount: mockFeatures.amount,
        currency: mockFeatures.currency,
        hour_of_day: mockFeatures.hour_of_day,
        device_risk_score: mockFeatures.device_risk_score,
      }, true);

      const retrievedFeatures = await featureStore.getFeatures(
        transactionId,
        'transaction',
        ['amount', 'currency', 'hour_of_day', 'device_risk_score']
      );

      expect(retrievedFeatures.amount).toBe(mockFeatures.amount);
      expect(retrievedFeatures.currency).toBe(mockFeatures.currency);
      expect(retrievedFeatures.hour_of_day).toBe(mockFeatures.hour_of_day);
      expect(retrievedFeatures.device_risk_score).toBe(mockFeatures.device_risk_score);
    });

    it('should get feature statistics', async () => {
      const stats = await featureStore.getFeatureStatistics('transaction', 'amount', 1);

      expect(stats.count).toBeGreaterThanOrEqual(0);
      expect(stats.last_updated).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty transaction data', async () => {
      const request: FraudDetectionRequest = {
        transaction_id: 'empty_tx',
        user_id: 'empty_user',
        transaction_data: {},
      };

      const response = await fraudDetectionService.scoreTransaction(request);

      expect(response.fraud_score).toBeDefined();
      expect(response.fraud_score.overall_score).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid transaction amounts', async () => {
      const invalidRequest: FraudDetectionRequest = {
        transaction_id: 'invalid_tx',
        user_id: 'invalid_user',
        transaction_data: {
          ...mockFeatures,
          amount: -100, // Negative amount
        },
      };

      const response = await fraudDetectionService.scoreTransaction(invalidRequest);

      expect(response.fraud_score).toBeDefined();
      // Should handle gracefully without throwing errors
    });

    it('should handle very large transaction amounts', async () => {
      const largeAmountRequest: FraudDetectionRequest = {
        transaction_id: 'large_tx',
        user_id: 'large_user',
        transaction_data: {
          ...mockFeatures,
          amount: Number.MAX_SAFE_INTEGER,
        },
      };

      const response = await fraudDetectionService.scoreTransaction(largeAmountRequest);

      expect(response.fraud_score).toBeDefined();
      expect(response.fraud_score.overall_score).toBeLessThanOrEqual(100);
    });
  });
});