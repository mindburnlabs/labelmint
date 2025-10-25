/**
 * ML Engine Main Entry Point
 * Initializes all ML services and starts the API server
 */

import { mlLogger } from '@/utils/logger';
import { fraudDetectionService } from '@/services/FraudDetectionService';
import { anomalyDetectionService } from '@/services/AnomalyDetectionService';
import { predictiveAnalyticsService } from '@/services/PredictiveAnalyticsService';
import { modelMonitoringService } from '@/services/ModelMonitoringService';
import { featureStore } from '@/services/FeatureStore';
import apiServer from '@/api';

class MLEngine {
  private isInitialized = false;

  /**
   * Initialize all ML services
   */
  async initialize(): Promise<void> {
    try {
      mlLogger.info('Initializing LabelMint ML Engine', {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
      });

      // Initialize feature store first
      mlLogger.info('Initializing feature store');
      // Feature store is auto-initialized in constructor

      // Initialize core ML services
      mlLogger.info('Initializing fraud detection service');
      await fraudDetectionService.initialize();

      mlLogger.info('Initializing anomaly detection service');
      await anomalyDetectionService.initialize();

      mlLogger.info('Initializing predictive analytics service');
      await predictiveAnalyticsService.initialize();

      mlLogger.info('Initializing model monitoring service');
      await modelMonitoringService.initialize();

      // Register models for monitoring
      modelMonitoringService.registerModel('fraud_detection_v1', '1.0.0');
      modelMonitoringService.registerModel('churn_prediction_v1', '1.0.0');
      modelMonitoringService.registerModel('revenue_prediction_v1', '1.0.0');
      modelMonitoringService.registerModel('quality_prediction_v1', '1.0.0');
      modelMonitoringService.registerModel('user_behavior_anomaly_v1', '1.0.0');
      modelMonitoringService.registerModel('transaction_anomaly_v1', '1.0.0');

      this.isInitialized = true;

      mlLogger.info('LabelMint ML Engine initialized successfully', {
        services: [
          'fraud_detection',
          'anomaly_detection',
          'predictive_analytics',
          'model_monitoring',
          'feature_store',
        ],
        models: [
          'fraud_detection_v1',
          'churn_prediction_v1',
          'revenue_prediction_v1',
          'quality_prediction_v1',
          'user_behavior_anomaly_v1',
          'transaction_anomaly_v1',
        ],
      });

    } catch (error) {
      mlLogger.error('Failed to initialize ML Engine', error as Error);
      throw error;
    }
  }

  /**
   * Start the ML Engine
   */
  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Start API server
      mlLogger.info('Starting ML Engine API server');
      await apiServer.start();

      mlLogger.info('LabelMint ML Engine started successfully', {
        api: 'http://localhost:3003',
        health: 'http://localhost:3003/health',
        documentation: 'http://localhost:3003/api',
      });

    } catch (error) {
      mlLogger.error('Failed to start ML Engine', error as Error);
      throw error;
    }
  }

  /**
   * Stop the ML Engine
   */
  async stop(): Promise<void> {
    try {
      mlLogger.info('Stopping LabelMint ML Engine');

      // Stop all services
      await fraudDetectionService.stop();
      await anomalyDetectionService.stop();
      await predictiveAnalyticsService.stop();
      await modelMonitoringService.stop();
      await featureStore.close();

      this.isInitialized = false;

      mlLogger.info('LabelMint ML Engine stopped successfully');

    } catch (error) {
      mlLogger.error('Error during ML Engine shutdown', error as Error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    services: {
      fraudDetection: boolean;
      anomalyDetection: boolean;
      predictiveAnalytics: boolean;
      modelMonitoring: boolean;
      featureStore: boolean;
    };
  } {
    return {
      initialized: this.isInitialized,
      services: {
        fraudDetection: fraudDetectionService.isActive(),
        anomalyDetection: anomalyDetectionService.isActive(),
        predictiveAnalytics: predictiveAnalyticsService.isActive(),
        modelMonitoring: modelMonitoringService.isActive(),
        featureStore: true, // Feature store doesn't have active state
      },
    };
  }
}

// Create and export the ML Engine instance
const mlEngine = new MLEngine();

// Start the engine if this file is run directly
if (require.main === module) {
  mlEngine.start().catch(error => {
    mlLogger.error('Failed to start ML Engine', error);
    process.exit(1);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  mlLogger.info('Received SIGTERM, shutting down gracefully');
  try {
    await mlEngine.stop();
    process.exit(0);
  } catch (error) {
    mlLogger.error('Error during shutdown', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  mlLogger.info('Received SIGINT, shutting down gracefully');
  try {
    await mlEngine.stop();
    process.exit(0);
  } catch (error) {
    mlLogger.error('Error during shutdown', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
});

export default mlEngine;