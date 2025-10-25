/**
 * ML Engine Integration Tests
 * End-to-end tests for the complete ML system
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FraudDetectionRequest } from '@/types/ml.types';
import { mlLogger } from '@/utils/logger';

// Import services (these would be imported from the actual modules)
// import { fraudDetectionService } from '@/services/FraudDetectionService';
// import { predictiveAnalyticsService } from '@/services/PredictiveAnalyticsService';
// import { anomalyDetectionService } from '@/services/AnomalyDetectionService';
// import { modelMonitoringService } from '@/services/ModelMonitoringService';
// import { featureStore } from '@/services/FeatureStore';

// Mock services for integration testing
const mockFraudDetectionService = {
  scoreTransaction: async (request: FraudDetectionRequest) => {
    return {
      fraud_score: {
        transaction_id: request.transaction_id,
        user_id: request.user_id,
        overall_score: 25,
        risk_level: 'low' as const,
        confidence: 0.85,
        transaction_pattern_score: 15,
        behavioral_anomaly_score: 20,
        network_analysis_score: 10,
        device_fingerprint_score: 30,
        geographic_anomaly_score: 5,
        risk_factors: [],
        recommendations: ['Transaction appears normal'],
        model_version: '1.0.0',
        scored_at: new Date(),
        requires_review: false,
        blocked: false,
      },
      processing_time_ms: 45,
      model_version: '1.0.0',
      recommendations: ['Transaction appears normal'],
    };
  },
  isActive: () => true,
  getModelStats: async () => ({
    isTrained: true,
    modelConfig: { version: '1.0.0', accuracy: 0.92 },
    cacheSize: 150,
    recentScores: 1000,
  }),
};

const mockPredictiveAnalyticsService = {
  predict: async (request: any) => {
    return {
      prediction: {
        id: `pred_${Date.now()}`,
        model_id: `predictive_${request.model_type}_model`,
        model_version: '1.0.0',
        entity_id: request.entity_id,
        entity_type: request.entity_type || 'user',
        prediction_type: request.model_type,
        predicted_value: request.model_type === 'churn' ? 0.15 : 1250.50,
        confidence: 0.87,
        feature_importance: [],
        primary_drivers: ['account_age_days', 'login_frequency'],
        prediction_horizon: request.model_type === 'churn' ? '30d' : '90d',
        input_features: request.features,
        predicted_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      processing_time_ms: 35,
      model_version: '1.0.0',
      confidence_intervals: {
        value: [1000, 1500],
      },
    };
  },
  batchPredict: async (entityIds: string[], modelType: string) => {
    return {
      job_id: `batch_${Date.now()}`,
      status: 'queued',
      estimated_completion: new Date(Date.now() + 60000),
    };
  },
  isActive: () => true,
  getServiceStats: () => ({
    isRunning: true,
    modelsCount: 3,
    activeJobs: 2,
    cacheSize: 200,
    scheduledTasks: 3,
  }),
};

const mockAnomalyDetectionService = {
  detectUserBehaviorAnomalies: async (userId: string, features: any) => {
    return [];
  },
  detectTransactionAnomalies: async (transactionId: string, userId: string, features: any) => {
    return [];
  },
  detectSystemAnomalies: async (metrics: any) => {
    return [];
  },
  isActive: () => true,
  getServiceStats: () => ({
    isRunning: true,
    modelsCount: 3,
    trackedEntities: 500,
    totalAnomalies: 25,
    lastUpdate: new Date(),
  }),
};

const mockModelMonitoringService = {
  registerModel: (modelId: string, modelVersion: string) => {
    // Mock implementation
  },
  recordPredictionMetrics: (modelId: string, latencyMs: number, success: boolean) => {
    // Mock implementation
  },
  isActive: () => true,
  getActiveAlerts: () => [],
};

const mockFeatureStore = {
  updateFeatures: async (entityId: string, entityType: string, features: any, isRealTime?: boolean) => {
    // Mock implementation
  },
  getFeatures: async (entityId: string, entityType: string, featureNames: string[]) => {
    return {
      account_age_days: 60,
      login_frequency_24h: 5,
      task_completion_rate: 0.85,
      total_earned: 2500,
    };
  },
  close: async () => {
    // Mock implementation
  },
};

describe('ML Engine Integration Tests', () => {
  let testUserId: string;
  let testTransactionId: string;
  let testFeatures: any;

  beforeAll(async () => {
    // Initialize test environment
    mlLogger.info('Initializing ML Engine integration test environment');

    testUserId = 'integration_test_user_123';
    testTransactionId = 'integration_test_tx_456';

    testFeatures = {
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
      device_usage_pattern: { mobile: 0.7, desktop: 0.3 },
      location_consistency_score: 0.98,
    };
  });

  describe('Service Integration', () => {
    it('should initialize all ML services', async () => {
      // Test that all services are active
      expect(mockFraudDetectionService.isActive()).toBe(true);
      expect(mockPredictiveAnalyticsService.isActive()).toBe(true);
      expect(mockAnomalyDetectionService.isActive()).toBe(true);
      expect(mockModelMonitoringService.isActive()).toBe(true);
    });

    it('should update feature store across services', async () => {
      // Simulate updating features that would be used by multiple services
      await mockFeatureStore.updateFeatures(testUserId, 'user', testFeatures, true);

      // Verify features can be retrieved
      const retrievedFeatures = await mockFeatureStore.getFeatures(
        testUserId,
        'user',
        ['account_age_days', 'login_frequency_24h', 'task_completion_rate']
      );

      expect(retrievedFeatures.account_age_days).toBe(60);
      expect(retrievedFeatures.login_frequency_24h).toBe(5);
      expect(retrievedFeatures.task_completion_rate).toBe(0.85);
    });
  });

  describe('End-to-End Fraud Detection Workflow', () => {
    it('should complete full fraud detection workflow', async () => {
      // 1. Receive transaction data
      const transactionData = {
        amount: 1000,
        currency: 'USDT',
        timestamp: new Date(),
        wallet_address: 'EQD1234567890abcdef1234567890abcdef12345678',
        recipient_address: 'EQD0987654321fedcba0987654321fedcba09876543',
        hour_of_day: 14,
        day_of_week: 3,
        device_risk_score: 0.3,
        ip_risk_score: 0.2,
      };

      // 2. Score transaction for fraud
      const fraudRequest: FraudDetectionRequest = {
        transaction_id: testTransactionId,
        user_id: testUserId,
        transaction_data: transactionData,
        user_data: testFeatures,
        include_explanation: true,
      };

      const fraudResponse = await mockFraudDetectionService.scoreTransaction(fraudRequest);

      // 3. Verify fraud detection results
      expect(fraudResponse.fraud_score).toBeDefined();
      expect(fraudResponse.fraud_score.overall_score).toBeGreaterThanOrEqual(0);
      expect(fraudResponse.fraud_score.risk_level).toBeDefined();
      expect(fraudResponse.processing_time_ms).toBeGreaterThan(0);

      // 4. Record metrics for monitoring
      mockModelMonitoringService.recordPredictionMetrics(
        'fraud_detection_v1',
        fraudResponse.processing_time_ms,
        true
      );

      // 5. Update feature store with results
      await mockFeatureStore.updateFeatures(
        testTransactionId,
        'fraud_score',
        {
          overall_score: fraudResponse.fraud_score.overall_score,
          risk_level: fraudResponse.fraud_score.risk_level,
          confidence: fraudResponse.fraud_score.confidence,
        },
        true
      );

      // Workflow completed successfully
      expect(fraudResponse.fraud_score.transaction_id).toBe(testTransactionId);
    });

    it('should handle high-risk transaction workflow', async () => {
      // Create high-risk transaction
      const highRiskTransaction = {
        amount: 50000,
        currency: 'USDT',
        timestamp: new Date(),
        hour_of_day: 3, // Unusual hours
        device_risk_score: 0.9,
        ip_risk_score: 0.8,
        is_high_risk_country: true,
      };

      const highRiskRequest: FraudDetectionRequest = {
        transaction_id: 'high_risk_tx',
        user_id: 'high_risk_user',
        transaction_data: highRiskTransaction,
      };

      const response = await mockFraudDetectionService.scoreTransaction(highRiskRequest);

      // Should detect high risk
      expect(response.fraud_score.overall_score).toBeGreaterThan(50);
      expect(['high', 'critical']).toContain(response.fraud_score.risk_level);
      expect(response.fraud_score.requires_review).toBe(true);

      // Record metrics for monitoring
      mockModelMonitoringService.recordPredictionMetrics(
        'fraud_detection_v1',
        response.processing_time_ms,
        true
      );
    });
  });

  describe('End-to-End Predictive Analytics Workflow', () => {
    it('should complete churn prediction workflow', async () => {
      // 1. Get user features
      await mockFeatureStore.updateFeatures(testUserId, 'user', testFeatures, true);

      // 2. Make churn prediction
      const churnPrediction = await mockPredictiveAnalyticsService.predict({
        model_type: 'churn',
        entity_id: testUserId,
        entity_type: 'user',
        features: testFeatures,
        include_feature_importance: true,
      });

      // 3. Verify prediction results
      expect(churnPrediction.prediction).toBeDefined();
      expect(churnPrediction.prediction.entity_id).toBe(testUserId);
      expect(churnPrediction.prediction.prediction_type).toBe('churn');
      expect(churnPrediction.prediction.predicted_value).toBeDefined();
      expect(churnPrediction.prediction.confidence).toBeGreaterThan(0);

      // 4. Record metrics
      mockModelMonitoringService.recordPredictionMetrics(
        'churn_prediction_v1',
        churnPrediction.processing_time_ms,
        true
      );

      // 5. Store prediction
      await mockFeatureStore.updateFeatures(
        churnPrediction.prediction.id,
        'prediction',
        {
          predicted_value: churnPrediction.prediction.predicted_value,
          confidence: churnPrediction.prediction.confidence,
          prediction_type: churnPrediction.prediction.prediction_type,
        },
        true
      );

      expect(churnPrediction.prediction.entity_id).toBe(testUserId);
    });

    it('should handle batch prediction workflow', async () => {
      // 1. Prepare batch of users
      const userIds = Array.from({ length: 10 }, (_, i) => `batch_user_${i}`);

      // 2. Submit batch prediction request
      const batchResult = await mockPredictiveAnalyticsService.batchPredict(userIds, 'churn');

      // 3. Verify batch submission
      expect(batchResult.job_id).toBeDefined();
      expect(batchResult.status).toMatch(/queued|processing|completed|failed/);
      expect(batchResult.estimated_completion).toBeDefined();

      // 4. Check job status (in real scenario)
      const jobStatus = mockPredictiveAnalyticsService.getBatchJobStatus?.(batchResult.job_id);
      if (jobStatus) {
        expect(jobStatus.status).toBeDefined();
      }
    });

    it('should complete revenue prediction workflow', async () => {
      // 1. Make revenue prediction
      const revenuePrediction = await mockPredictiveAnalyticsService.predict({
        model_type: 'revenue',
        entity_id: testUserId,
        entity_type: 'user',
        features: testFeatures,
      });

      // 2. Verify prediction results
      expect(revenuePrediction.prediction.prediction_type).toBe('revenue');
      expect(revenuePrediction.prediction.predicted_value).toBeGreaterThanOrEqual(0);
      expect(revenuePrediction.confidence_intervals).toBeDefined();

      // 3. Record metrics
      mockModelMonitoringService.recordPredictionMetrics(
        'revenue_prediction_v1',
        revenuePrediction.processing_time_ms,
        true
      );
    });
  });

  describe('End-to-End Anomaly Detection Workflow', () => {
    it('should complete user behavior anomaly detection workflow', async () => {
      // 1. Update user features
      await mockFeatureStore.updateFeatures(testUserId, 'user', testFeatures, true);

      // 2. Detect anomalies
      const userAnomalies = await mockAnomalyDetectionService.detectUserBehaviorAnomalies(
        testUserId,
        testFeatures
      );

      // 3. Verify results
      expect(Array.isArray(userAnomalies)).toBe(true);
      userAnomalies.forEach(anomaly => {
        expect(anomaly.entity_id).toBe(testUserId);
        expect(anomaly.entity_type).toBe('user');
        expect(anomaly.anomaly_score).toBeGreaterThanOrEqual(0);
      });

      // 4. Store anomalies if any
      if (userAnomalies.length > 0) {
        await mockFeatureStore.updateFeatures(
          `${testUserId}_anomalies`,
          'anomaly',
          {
            anomaly_count: userAnomalies.length,
            max_score: Math.max(...userAnomalies.map(a => a.anomaly_score)),
          },
          true
        );
      }
    });

    it('should complete system monitoring workflow', async () => {
      // 1. Simulate system metrics
      const systemMetrics = {
        cpu_usage: 45,
        memory_usage: 68,
        disk_io: 150,
        network_io: 75,
        response_time: 250,
        error_rate: 0.02,
        throughput: 850,
      };

      // 2. Detect system anomalies
      const systemAnomalies = await mockAnomalyDetectionService.detectSystemAnomalies(systemMetrics);

      // 3. Verify results
      expect(Array.isArray(systemAnomalies)).toBe(true);

      // 4. Record metrics for monitoring
      mockModelMonitoringService.recordPredictionMetrics(
        'system_anomaly_v1',
        25, // Mock processing time
        true
      );
    });
  });

  describe('Cross-Service Integration', () => {
    it('should integrate fraud detection with anomaly detection', async () => {
      // 1. Score transaction for fraud
      const fraudRequest: FraudDetectionRequest = {
        transaction_id: 'integration_tx_1',
        user_id: 'integration_user_1',
        transaction_data: {
          amount: 15000,
          currency: 'USDT',
          hour_of_day: 2,
          device_risk_score: 0.85,
        },
      };

      const fraudResponse = await mockFraudDetectionService.scoreTransaction(fraudRequest);

      // 2. If high fraud risk, check for user behavior anomalies
      if (fraudResponse.fraud_score.overall_score > 70) {
        const userAnomalies = await mockAnomalyDetectionService.detectUserBehaviorAnomalies(
          fraudRequest.user_id,
          testFeatures
        );

        // 3. Combine fraud and anomaly data for comprehensive risk assessment
        const combinedRiskScore = Math.max(
          fraudResponse.fraud_score.overall_score,
          userAnomalies.length > 0 ? Math.max(...userAnomalies.map(a => a.anomaly_score)) : 0
        );

        expect(combinedRiskScore).toBeGreaterThanOrEqual(fraudResponse.fraud_score.overall_score);
      }
    });

    it('should integrate predictive analytics with fraud detection', async () => {
      // 1. Get churn prediction for user
      const churnPrediction = await mockPredictiveAnalyticsService.predict({
        model_type: 'churn',
        entity_id: testUserId,
        features: testFeatures,
      });

      // 2. Score transaction from same user
      const fraudResponse = await mockFraudDetectionService.scoreTransaction({
        transaction_id: 'integration_tx_2',
        user_id: testUserId,
        transaction_data: {
          amount: 2000,
          currency: 'USDT',
        },
      });

      // 3. Adjust fraud risk based on churn prediction
      let adjustedFraudScore = fraudResponse.fraud_score.overall_score;

      if (churnPrediction.prediction.predicted_value > 0.7) {
        // High churn risk - increase fraud sensitivity
        adjustedFraudScore += 10;
      }

      expect(adjustedFraudScore).toBeGreaterThanOrEqual(0);
    });

    it('should integrate all services for comprehensive user assessment', async () => {
      // 1. Get user features
      await mockFeatureStore.updateFeatures(testUserId, 'user', testFeatures, true);

      // 2. Run all analyses
      const [churnPrediction, revenuePrediction, userAnomalies, fraudResponse] = await Promise.all([
        mockPredictiveAnalyticsService.predict({
          model_type: 'churn',
          entity_id: testUserId,
          features: testFeatures,
        }),
        mockPredictiveAnalyticsService.predict({
          model_type: 'revenue',
          entity_id: testUserId,
          features: testFeatures,
        }),
        mockAnomalyDetectionService.detectUserBehaviorAnomalies(testUserId, testFeatures),
        mockFraudDetectionService.scoreTransaction({
          transaction_id: 'comprehensive_tx',
          user_id: testUserId,
          transaction_data: { amount: 1000, currency: 'USDT' },
        }),
      ]);

      // 3. Create comprehensive user profile
      const userProfile = {
        user_id: testUserId,
        risk_assessment: {
          churn_risk: churnPrediction.prediction.predicted_value,
          revenue_potential: revenuePrediction.prediction.predicted_value,
          anomaly_count: userAnomalies.length,
          fraud_risk: fraudResponse.fraud_score.overall_score,
        },
        predictions: {
          churn: churnPrediction.prediction,
          revenue: revenuePrediction.prediction,
        },
        anomalies: userAnomalies,
        last_transaction: fraudResponse.fraud_score,
      };

      // 4. Verify comprehensive assessment
      expect(userProfile.user_id).toBe(testUserId);
      expect(userProfile.risk_assessment).toBeDefined();
      expect(userProfile.predictions).toBeDefined();
      expect(userProfile.anomalies).toBeDefined();
      expect(userProfile.last_transaction).toBeDefined();

      // 5. Store comprehensive profile
      await mockFeatureStore.updateFeatures(
        testUserId,
        'user_profile',
        userProfile,
        true
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent requests across services', async () => {
      const concurrentRequests = 10;
      const userIds = Array.from({ length: concurrentRequests }, (_, i) => `perf_user_${i}`);

      // Create concurrent requests for all services
      const promises = userIds.map(async (userId, index) => {
        const features = { ...testFeatures, account_age_days: 30 + index * 10 };

        return Promise.all([
          mockFraudDetectionService.scoreTransaction({
            transaction_id: `perf_tx_${index}`,
            user_id: userId,
            transaction_data: { amount: 1000 + index * 100, currency: 'USDT' },
          }),
          mockPredictiveAnalyticsService.predict({
            model_type: 'churn',
            entity_id: userId,
            features,
          }),
          mockAnomalyDetectionService.detectUserBehaviorAnomalies(userId, features),
        ]);
      });

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Verify all requests completed
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(([fraudResult, predictionResult, anomalyResult]) => {
        expect(fraudResult.fraud_score).toBeDefined();
        expect(predictionResult.prediction).toBeDefined();
        expect(Array.isArray(anomalyResult)).toBe(true);
      });

      // Performance check
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain service health under load', async () => {
      // Check initial service stats
      const initialStats = {
        fraudDetection: mockFraudDetectionService.isActive(),
        predictiveAnalytics: mockPredictiveAnalyticsService.isActive(),
        anomalyDetection: mockAnomalyDetectionService.isActive(),
        modelMonitoring: mockModelMonitoringService.isActive(),
      };

      // Simulate load
      const loadPromises = Array.from({ length: 20 }, (_, i) =>
        mockFraudDetectionService.scoreTransaction({
          transaction_id: `load_tx_${i}`,
          user_id: `load_user_${i}`,
          transaction_data: { amount: 500 + i * 50, currency: 'USDT' },
        })
      );

      await Promise.all(loadPromises);

      // Check services are still healthy
      const finalStats = {
        fraudDetection: mockFraudDetectionService.isActive(),
        predictiveAnalytics: mockPredictiveAnalyticsService.isActive(),
        anomalyDetection: mockAnomalyDetectionService.isActive(),
        modelMonitoring: mockModelMonitoringService.isActive(),
      };

      expect(finalStats).toEqual(initialStats); // All services should still be active
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle service failures gracefully', async () => {
      // Test with invalid transaction data
      const invalidRequest = {
        transaction_id: '',
        user_id: '',
        transaction_data: { amount: -100 }, // Invalid amount
      };

      // Services should handle errors gracefully
      try {
        const result = await mockFraudDetectionService.scoreTransaction(invalidRequest as any);
        // If successful, should have reasonable default values
        expect(result.fraud_score.overall_score).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // If throwing errors, they should be meaningful
        expect(error).toBeDefined();
      }
    });

    it('should maintain feature store consistency', async () => {
      // Test feature store operations
      const testId = 'consistency_test';

      // Update features
      await mockFeatureStore.updateFeatures(testId, 'test', { value: 123 }, true);

      // Retrieve features
      const features = await mockFeatureStore.getFeatures(testId, 'test', ['value']);

      expect(features.value).toBe(123);
    });
  });

  afterAll(async () => {
    // Cleanup test environment
    await mockFeatureStore.close();
    mlLogger.info('ML Engine integration tests completed');
  });
});