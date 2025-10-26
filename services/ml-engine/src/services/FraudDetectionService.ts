/**
 * Fraud Detection Service
 * Orchestrates fraud detection models and provides real-time scoring
 */

import { EventEmitter } from 'events';
import { FraudDetectionModel } from '@/models/FraudDetectionModel';
import { featureStore } from '@/services/FeatureStore';
import { logger } from '@/utils/logger';
import {
  TransactionFeatures,
  FraudScore,
  FraudDetectionRequest,
  FraudDetectionResponse,
  RiskFactor,
  MLModelConfig
} from '@/types/ml.types';
import { mlConfig } from '@/config/ml.config';

interface FraudDetectionEvent {
  type: 'fraud_detected' | 'high_risk_transaction' | 'model_performance_alert';
  data: any;
  timestamp: Date;
}

export class FraudDetectionService extends EventEmitter {
  private fraudModel: FraudDetectionModel;
  private isRunning = false;
  private scoringCache: Map<string, { score: FraudScore; expires: number }> = new Map();
  private readonly cacheTTL = mlConfig.fraudDetection.cacheTTL * 1000;

  constructor() {
    super();
    this.fraudModel = new FraudDetectionModel();
  }

  /**
   * Initialize the fraud detection service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing fraud detection service');

      // Load existing model if available
      await this.loadModel();

      // Start background processes
      this.startBackgroundProcesses();

      this.isRunning = true;
      logger.info('Fraud detection service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize fraud detection service', { error });
      throw error;
    }
  }

  /**
   * Score a transaction for fraud risk
   */
  async scoreTransaction(request: FraudDetectionRequest): Promise<FraudDetectionResponse> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(request.transaction_id);
      const cached = this.scoringCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        logger.debug('Returning cached fraud score', { transactionId: request.transaction_id });
        return {
          fraud_score: cached.score,
          processing_time_ms: Date.now() - startTime,
          model_version: cached.score.model_version,
          recommendations: cached.score.recommendations,
        };
      }

      // Build transaction features
      const features = await this.buildTransactionFeatures(
        request.transaction_id,
        request.user_id,
        request.transaction_data,
        request.user_data
      );

      // Update feature store with new data
      await this.updateFeatureStore(request.transaction_id, request.user_id, features);

      // Get fraud score from model
      const fraudScore = await this.fraudModel.predictFraudScore(features);

      // Update transaction and user IDs
      fraudScore.transaction_id = request.transaction_id;
      fraudScore.user_id = request.user_id;

      // Cache the result
      if (mlConfig.fraudDetection.cacheResults) {
        this.scoringCache.set(cacheKey, {
          score: fraudScore,
          expires: Date.now() + this.cacheTTL,
        });
      }

      // Emit events for high-risk transactions
      if (fraudScore.risk_level === 'high' || fraudScore.risk_level === 'critical') {
        this.emit('fraud_detected', {
          type: 'high_risk_transaction',
          data: fraudScore,
          timestamp: new Date(),
        } as FraudDetectionEvent);

        // Log high-risk transaction
        logger.warn('High-risk transaction detected', {
          transactionId: request.transaction_id,
          userId: request.user_id,
          score: fraudScore.overall_score,
          riskLevel: fraudScore.risk_level,
          riskFactors: fraudScore.risk_factors.length,
        });
      }

      // Store fraud score for analytics
      await this.storeFraudScore(fraudScore);

      const processingTime = Date.now() - startTime;

      return {
        fraud_score: fraudScore,
        processing_time_ms: processingTime,
        model_version: fraudScore.model_version,
        recommendations: fraudScore.recommendations,
      };

    } catch (error) {
      logger.error('Failed to score transaction for fraud', {
        error,
        transactionId: request.transaction_id,
        userId: request.user_id,
      });
      throw error;
    }
  }

  /**
   * Batch score multiple transactions
   */
  async batchScoreTransactions(
    requests: FraudDetectionRequest[]
  ): Promise<FraudDetectionResponse[]> {
    const batchSize = mlConfig.fraudDetection.batchSize;
    const results: FraudDetectionResponse[] = [];

    logger.info('Starting batch fraud scoring', {
      totalRequests: requests.length,
      batchSize,
    });

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      const batchPromises = batch.map(request => this.scoreTransaction(request));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('Batch scoring failed for individual transaction', { error: result.reason });
        }
      }

      // Add delay to prevent overwhelming the system
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info('Batch fraud scoring completed', {
      totalProcessed: results.length,
      totalRequested: requests.length,
    });

    return results;
  }

  /**
   * Build transaction features from request data
   */
  private async buildTransactionFeatures(
    transactionId: string,
    userId: string,
    transactionData: Partial<TransactionFeatures>,
    userData?: any
  ): Promise<TransactionFeatures> {
    // Get current timestamp
    const now = new Date();

    // Get historical features for the user
    const userFeatures = userData || await this.getUserHistoricalFeatures(userId);

    // Build comprehensive transaction features
    const features: TransactionFeatures = {
      // Basic transaction features
      amount: transactionData.amount || 0,
      currency: transactionData.currency || 'USDT',
      timestamp: transactionData.timestamp || now,
      wallet_address: transactionData.wallet_address || '',
      recipient_address: transactionData.recipient_address || '',

      // Temporal features
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
      day_of_month: now.getDate(),
      month: now.getMonth() + 1,
      is_weekend: now.getDay() === 0 || now.getDay() === 6,
      is_holiday: this.isHoliday(now),

      // Behavioral features (calculated from historical data)
      transaction_frequency_1h: userFeatures.transaction_frequency_1h || 0,
      transaction_frequency_24h: userFeatures.transaction_frequency_24h || 1,
      transaction_frequency_7d: userFeatures.transaction_frequency_7d || 1,
      avg_transaction_amount_24h: userFeatures.avg_transaction_amount_24h || transactionData.amount || 100,
      avg_transaction_amount_7d: userFeatures.avg_transaction_amount_7d || transactionData.amount || 100,
      amount_deviation_from_avg: this.calculateAmountDeviation(
        transactionData.amount || 0,
        userFeatures.avg_transaction_amount_24h || transactionData.amount || 100
      ),

      // Geographic features
      ip_country: transactionData.ip_country || 'Unknown',
      ip_city: transactionData.ip_city || 'Unknown',
      device_fingerprint: transactionData.device_fingerprint || '',
      is_new_location: userFeatures.is_new_location || false,

      // Wallet features
      wallet_age_days: userFeatures.wallet_age_days || 0,
      wallet_transaction_count: userFeatures.wallet_transaction_count || 0,
      wallet_total_volume: userFeatures.wallet_total_volume || 0,
      is_new_wallet: (userFeatures.wallet_age_days || 0) < 7,

      // Risk features
      is_high_risk_country: this.isHighRiskCountry(transactionData.ip_country || 'Unknown'),
      is_vpn_or_proxy: transactionData.is_vpn_or_proxy || false,
      device_risk_score: transactionData.device_risk_score || 0.5,
      ip_risk_score: transactionData.ip_risk_score || 0.5,
    };

    return features;
  }

  /**
   * Get user's historical features
   */
  private async getUserHistoricalFeatures(userId: string): Promise<any> {
    try {
      const features = await featureStore.getFeatures(
        userId,
        'user',
        [
          'transaction_frequency_1h',
          'transaction_frequency_24h',
          'transaction_frequency_7d',
          'avg_transaction_amount_24h',
          'avg_transaction_amount_7d',
          'wallet_age_days',
          'wallet_transaction_count',
          'wallet_total_volume',
          'is_new_location',
          'typical_countries',
        ]
      );

      return features;
    } catch (error) {
      logger.warn('Failed to get user historical features', { error, userId });
      return {};
    }
  }

  /**
   * Calculate amount deviation from average
   */
  private calculateAmountDeviation(amount: number, avgAmount: number): number {
    if (avgAmount === 0) return 0;
    return Math.abs((amount - avgAmount) / avgAmount);
  }

  /**
   * Check if date is a holiday (simplified)
   */
  private isHoliday(date: Date): boolean {
    // Simplified holiday check - in production, use a proper holiday calendar
    const month = date.getMonth();
    const day = date.getDate();

    // Major holidays (simplified)
    const holidays = [
      [0, 1], // New Year's Day
      [11, 25], // Christmas
      [6, 4], // Independence Day (US)
      // Add more holidays as needed
    ];

    return holidays.some(([m, d]) => m === month && d === day);
  }

  /**
   * Check if country is high risk
   */
  private isHighRiskCountry(country: string): boolean {
    const highRiskCountries = [
      'AF', 'IR', 'KP', 'MM', 'SD', 'SY', 'YE', // Sanctioned countries
      // Add more based on risk assessment
    ];

    return highRiskCountries.includes(country.toUpperCase());
  }

  /**
   * Update feature store with new transaction data
   */
  private async updateFeatureStore(
    transactionId: string,
    userId: string,
    features: TransactionFeatures
  ): Promise<void> {
    try {
      // Update transaction features
      await featureStore.updateFeatures(
        transactionId,
        'transaction',
        {
          amount: features.amount,
          currency: features.currency,
          timestamp: features.timestamp,
          wallet_address: features.wallet_address,
          recipient_address: features.recipient_address,
          hour_of_day: features.hour_of_day,
          day_of_week: features.day_of_week,
          is_weekend: features.is_weekend,
          is_holiday: features.is_holiday,
          ip_country: features.ip_country,
          device_fingerprint: features.device_fingerprint,
          is_high_risk_country: features.is_high_risk_country,
          is_vpn_or_proxy: features.is_vpn_or_proxy,
          device_risk_score: features.device_risk_score,
          ip_risk_score: features.ip_risk_score,
        },
        true // Real-time update
      );

      // Update user aggregated features
      await this.updateUserAggregatedFeatures(userId, features);

    } catch (error) {
      logger.error('Failed to update feature store', {
        error,
        transactionId,
        userId,
      });
    }
  }

  /**
   * Update user's aggregated features
   */
  private async updateUserAggregatedFeatures(
    userId: string,
    newTransaction: TransactionFeatures
  ): Promise<void> {
    try {
      // Get current user features
      const currentFeatures = await this.getUserHistoricalFeatures(userId);

      // Calculate updated aggregated features
      const updatedFeatures = {
        // Increment transaction counts
        transaction_frequency_1h: (currentFeatures.transaction_frequency_1h || 0) + 1,
        transaction_frequency_24h: (currentFeatures.transaction_frequency_24h || 1) + 1,
        transaction_frequency_7d: (currentFeatures.transaction_frequency_7d || 1) + 1,

        // Update average amounts
        avg_transaction_amount_24h: this.calculateUpdatedAverage(
          currentFeatures.avg_transaction_amount_24h || newTransaction.amount,
          currentFeatures.transaction_frequency_24h || 1,
          newTransaction.amount
        ),
        avg_transaction_amount_7d: this.calculateUpdatedAverage(
          currentFeatures.avg_transaction_amount_7d || newTransaction.amount,
          currentFeatures.transaction_frequency_7d || 1,
          newTransaction.amount
        ),

        // Update wallet stats
        wallet_transaction_count: (currentFeatures.wallet_transaction_count || 0) + 1,
        wallet_total_volume: (currentFeatures.wallet_total_volume || 0) + newTransaction.amount,

        // Update location patterns
        last_country: newTransaction.ip_country,
        is_new_location: currentFeatures.last_country !== newTransaction.ip_country ? 1 : 0,
      };

      await featureStore.updateFeatures(userId, 'user', updatedFeatures, true);

    } catch (error) {
      logger.error('Failed to update user aggregated features', { error, userId });
    }
  }

  /**
   * Calculate updated average
   */
  private calculateUpdatedAverage(
    currentAvg: number,
    currentCount: number,
    newValue: number
  ): number {
    return (currentAvg * currentCount + newValue) / (currentCount + 1);
  }

  /**
   * Store fraud score for analytics
   */
  private async storeFraudScore(fraudScore: FraudScore): Promise<void> {
    try {
      // Store in feature store for analytics
      await featureStore.updateFeatures(
        fraudScore.transaction_id,
        'fraud_score',
        {
          overall_score: fraudScore.overall_score,
          risk_level: fraudScore.risk_level,
          confidence: fraudScore.confidence,
          transaction_pattern_score: fraudScore.transaction_pattern_score,
          behavioral_anomaly_score: fraudScore.behavioral_anomaly_score,
          network_analysis_score: fraudScore.network_analysis_score,
          device_fingerprint_score: fraudScore.device_fingerprint_score,
          geographic_anomaly_score: fraudScore.geographic_anomaly_score,
          requires_review: fraudScore.requires_review,
          blocked: fraudScore.blocked,
          model_version: fraudScore.model_version,
        },
        true
      );

    } catch (error) {
      logger.error('Failed to store fraud score', { error, transactionId: fraudScore.transaction_id });
    }
  }

  /**
   * Get cache key for transaction
   */
  private getCacheKey(transactionId: string): string {
    return `fraud_score:${transactionId}`;
  }

  /**
   * Load model from storage
   */
  private async loadModel(): Promise<void> {
    try {
      await this.fraudModel.loadModel(mlConfig.fraudDetection.modelPath);
      logger.info('Fraud detection model loaded successfully');
    } catch (error) {
      logger.warn('Failed to load existing fraud model, will need to train', { error });
    }
  }

  /**
   * Start background processes
   */
  private startBackgroundProcesses(): void {
    // Cache cleanup every 10 minutes
    setInterval(() => this.cleanupCache(), 10 * 60 * 1000);

    // Model performance monitoring every hour
    setInterval(() => this.monitorModelPerformance(), 60 * 60 * 1000);

    // Feature drift detection every 6 hours
    setInterval(() => this.checkFeatureDrift(), 6 * 60 * 60 * 1000);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.scoringCache.entries()) {
      if (value.expires <= now) {
        this.scoringCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cache cleanup completed', { cleaned, remaining: this.scoringCache.size });
    }
  }

  /**
   * Monitor model performance
   */
  private async monitorModelPerformance(): Promise<void> {
    try {
      // Get recent fraud scores and compare with actual outcomes
      const recentScores = await this.getRecentFraudScores(100); // Last 100 scores

      if (recentScores.length < 10) {
        logger.debug('Insufficient data for model performance monitoring');
        return;
      }

      // Calculate performance metrics
      const performance = await this.calculateModelPerformance(recentScores);

      // Check if performance degradation requires alert
      if (performance.accuracy < 0.85) {
        this.emit('fraud_detected', {
          type: 'model_performance_alert',
          data: {
            accuracy: performance.accuracy,
            threshold: 0.85,
            recommendation: 'Consider retraining the model',
          },
          timestamp: new Date(),
        } as FraudDetectionEvent);

        logger.warn('Model performance degradation detected', performance);
      }

      logger.debug('Model performance monitoring completed', performance);

    } catch (error) {
      logger.error('Model performance monitoring failed', { error });
    }
  }

  /**
   * Check for feature drift
   */
  private async checkFeatureDrift(): Promise<void> {
    try {
      const features = ['amount', 'hour_of_day', 'transaction_frequency_24h'];

      for (const feature of features) {
        const drift = await featureStore.getFeatureDrift('transaction', feature);

        if (drift.drift_score > mlConfig.monitoring.driftThreshold) {
          logger.warn('Feature drift detected', {
            feature,
            driftScore: drift.drift_score,
            psi: drift.population_stability_index,
          });

          // Emit alert
          this.emit('fraud_detected', {
            type: 'model_performance_alert',
            data: {
              type: 'feature_drift',
              feature,
              driftScore: drift.drift_score,
              recommendation: 'Consider retraining model with recent data',
            },
            timestamp: new Date(),
          } as FraudDetectionEvent);
        }
      }

    } catch (error) {
      logger.error('Feature drift check failed', { error });
    }
  }

  /**
   * Get recent fraud scores (placeholder implementation)
   */
  private async getRecentFraudScores(limit: number): Promise<FraudScore[]> {
    // In a real implementation, this would query the database
    // For now, return empty array
    return [];
  }

  /**
   * Calculate model performance (placeholder implementation)
   */
  private async calculateModelPerformance(scores: FraudScore[]): Promise<any> {
    // In a real implementation, this would compare predictions with actual outcomes
    return {
      accuracy: 0.92,
      precision: 0.89,
      recall: 0.87,
      f1Score: 0.88,
    };
  }

  /**
   * Get model statistics
   */
  async getModelStats(): Promise<{
    isTrained: boolean;
    modelConfig: MLModelConfig;
    cacheSize: number;
    recentScores: number;
  }> {
    return {
      isTrained: this.fraudModel.isModelTrained(),
      modelConfig: this.fraudModel.getModelConfig(),
      cacheSize: this.scoringCache.size,
      recentScores: 0, // Would be calculated from database
    };
  }

  /**
   * Get recent fraud alerts
   */
  async getRecentAlerts(limit: number = 50): Promise<FraudDetectionEvent[]> {
    // In a real implementation, this would query the alert storage
    return [];
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
    this.fraudModel.dispose();
    this.removeAllListeners();
    logger.info('Fraud detection service stopped');
  }
}

// Singleton instance
export const fraudDetectionService = new FraudDetectionService();