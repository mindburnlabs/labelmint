/**
 * Fraud Detection Model
 * Neural network-based fraud detection with real-time scoring capabilities
 */

import * as tf from '@tensorflow/tfjs-node';
import { featureStore } from '@/services/FeatureStore';
import { logger } from '@/utils/logger';
import {
  TransactionFeatures,
  FraudScore,
  RiskFactor,
  MLModelConfig,
  ModelMetrics
} from '@/types/ml.types';
import { mlConfig } from '@/config/ml.config';

interface FraudDetectionModelConfig {
  inputFeatures: string[];
  hiddenLayers: number[];
  dropoutRate: number;
  learningRate: number;
  batchSize: number;
  epochs: number;
  validationSplit: number;
  earlyStoppingPatience: number;
  threshold: number;
}

export class FraudDetectionModel {
  private model: tf.LayersModel | null = null;
  private isTrained = false;
  private featureNormalizationParams: Map<string, { min: number; max: number; mean: number; std: number }> = new Map();
  private config: FraudDetectionModelConfig;
  private modelConfig: MLModelConfig;

  constructor(config: Partial<FraudDetectionModelConfig> = {}) {
    this.config = {
      inputFeatures: mlConfig.MODEL_TEMPLATES.fraudDetection.features as string[],
      hiddenLayers: mlConfig.MODEL_TEMPLATES.fraudDetection.hyperparameters.hiddenLayers as number[],
      dropoutRate: mlConfig.MODEL_TEMPLATES.fraudDetection.hyperparameters.dropout as number,
      learningRate: mlConfig.MODEL_TEMPLATES.fraudDetection.hyperparameters.learningRate as number,
      batchSize: mlConfig.MODEL_TEMPLATES.fraudDetection.hyperparameters.batchSize as number,
      epochs: mlConfig.MODEL_TEMPLATES.fraudDetection.hyperparameters.epochs as number,
      validationSplit: mlConfig.MODEL_TEMPLATES.fraudDetection.validationSplit,
      earlyStoppingPatience: mlConfig.training.earlyStoppingPatience,
      threshold: mlConfig.MODEL_TEMPLATES.fraudDetection.threshold as number,
      ...config,
    };

    this.modelConfig = {
      id: 'fraud-detection-v1',
      name: 'Fraud Detection Model',
      version: '1.0.0',
      type: 'fraud_detection',
      algorithm: 'neural_network',
      status: 'training',
      hyperparameters: this.config,
      features: this.config.inputFeatures,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Build the neural network architecture
   */
  private buildModel(): tf.LayersModel {
    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.dense({
      inputShape: [this.config.inputFeatures.length],
      units: this.config.hiddenLayers[0],
      activation: 'relu',
      name: 'input_layer'
    }));

    // Hidden layers
    for (let i = 1; i < this.config.hiddenLayers.length; i++) {
      model.add(tf.layers.dense({
        units: this.config.hiddenLayers[i],
        activation: 'relu',
        name: `hidden_layer_${i}`
      }));

      model.add(tf.layers.dropout({
        rate: this.config.dropoutRate,
        name: `dropout_${i}`
      }));
    }

    // Output layer (binary classification: fraud or not fraud)
    model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      name: 'output_layer'
    }));

    // Compile model
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall'],
    });

    return model;
  }

  /**
   * Prepare features for model input
   */
  private async prepareFeatures(transactionFeatures: TransactionFeatures): Promise<number[]> {
    const features: number[] = [];

    for (const featureName of this.config.inputFeatures) {
      let value = (transactionFeatures as any)[featureName];

      // Handle missing values
      if (value === undefined || value === null) {
        value = this.getDefaultValue(featureName);
      }

      // Normalize the feature
      const normalizedValue = this.normalizeFeature(featureName, value);
      features.push(normalizedValue);
    }

    return features;
  }

  /**
   * Get default value for missing features
   */
  private getDefaultValue(featureName: string): number {
    const defaults: Record<string, number> = {
      amount: 0,
      hour_of_day: 12,
      day_of_week: 3,
      day_of_month: 15,
      month: 6,
      is_weekend: 0,
      is_holiday: 0,
      transaction_frequency_1h: 0,
      transaction_frequency_24h: 1,
      transaction_frequency_7d: 1,
      avg_transaction_amount_24h: 100,
      avg_transaction_amount_7d: 100,
      amount_deviation_from_avg: 0,
      wallet_age_days: 30,
      wallet_transaction_count: 0,
      wallet_total_volume: 0,
      is_new_wallet: 1,
      is_high_risk_country: 0,
      is_vpn_or_proxy: 0,
      device_risk_score: 0.5,
      ip_risk_score: 0.5,
    };

    return defaults[featureName] || 0;
  }

  /**
   * Normalize feature value
   */
  private normalizeFeature(featureName: string, value: any): number {
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    if (typeof value === 'string') {
      // Handle categorical features
      const categoricalMappings: Record<string, Record<string, number>> = {
        currency: { 'USDT': 1, 'TON': 0.5, 'USD': 0.8 },
        ip_country: { 'US': 0.3, 'CN': 0.9, 'RU': 0.8, 'GB': 0.2, 'DE': 0.2 },
      };

      if (categoricalMappings[featureName]) {
        return categoricalMappings[featureName][value] || 0.5;
      }

      // Hash unknown strings
      return this.hashString(value) / 1000000;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) return 0;

    // Apply normalization if we have parameters
    const params = this.featureNormalizationParams.get(featureName);
    if (params) {
      if (params.max !== params.min) {
        return (numValue - params.min) / (params.max - params.min);
      }
      return (numValue - params.mean) / (params.std || 1);
    }

    return numValue;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & 0xFFFFFF; // Limit to 24 bits
    }
    return Math.abs(hash);
  }

  /**
   * Train the model with historical transaction data
   */
  async trainModel(
    trainingData: Array<{ features: TransactionFeatures; isFraud: boolean }>
  ): Promise<ModelMetrics> {
    logger.info('Starting fraud detection model training', {
      sampleCount: trainingData.length,
      features: this.config.inputFeatures.length,
    });

    try {
      // Prepare training data
      const { xs, ys, normalizationParams } = await this.prepareTrainingData(trainingData);
      this.featureNormalizationParams = normalizationParams;

      // Build model
      this.model = this.buildModel();
      logger.info('Model architecture built', {
        layers: this.model.layers.length,
        params: this.model.countParams(),
      });

      // Training configuration
      const trainConfig: tf.ModelFitConfig = {
        epochs: this.config.epochs,
        batchSize: this.config.batchSize,
        validationSplit: this.config.validationSplit,
        shuffle: true,
        callbacks: [
          tf.callbacks.earlyStopping({
            patience: this.config.earlyStoppingPatience,
            monitor: 'val_loss',
            restoreBestWeights: true,
          }),
          {
            onEpochEnd: async (epoch, logs) => {
              if (epoch % 10 === 0) {
                logger.info('Training progress', {
                  epoch,
                  loss: logs?.loss,
                  accuracy: logs?.accuracy,
                  valLoss: logs?.val_loss,
                  valAccuracy: logs?.val_accuracy,
                });
              }
            },
          },
        ],
      };

      // Train the model
      const history = await this.model.fit(xs, ys, trainConfig);

      // Clean up tensors
      xs.dispose();
      ys.dispose();

      // Calculate metrics
      const metrics = await this.calculateMetrics(trainingData);

      this.isTrained = true;
      this.modelConfig.status = 'trained';
      this.modelConfig.lastTrainedAt = new Date();
      this.modelConfig.accuracy = metrics.accuracy;
      this.modelConfig.precision = metrics.precision;
      this.modelConfig.recall = metrics.recall;
      this.modelConfig.f1Score = metrics.f1_score;

      logger.info('Model training completed successfully', {
        accuracy: metrics.accuracy,
        precision: metrics.precision,
        recall: metrics.recall,
        f1Score: metrics.f1_score,
        epochs: history.epoch.length,
      });

      return metrics;

    } catch (error) {
      logger.error('Model training failed', { error });
      this.modelConfig.status = 'failed';
      throw error;
    }
  }

  /**
   * Prepare training data tensors
   */
  private async prepareTrainingData(
    trainingData: Array<{ features: TransactionFeatures; isFraud: boolean }>
  ): Promise<{ xs: tf.Tensor2D; ys: tf.Tensor2D; normalizationParams: Map<string, any> }> {
    const featureMatrix: number[][] = [];
    const labels: number[] = [];

    // Calculate normalization parameters
    const featureValues: Map<string, number[]> = new Map();

    for (const dataPoint of trainingData) {
      for (const featureName of this.config.inputFeatures) {
        if (!featureValues.has(featureName)) {
          featureValues.set(featureName, []);
        }

        let value = (dataPoint.features as any)[featureName];
        if (value === undefined || value === null) {
          value = this.getDefaultValue(featureName);
        }

        if (typeof value === 'number' && !isNaN(value)) {
          featureValues.get(featureName)!.push(value);
        }
      }
    }

    // Calculate normalization parameters
    const normalizationParams = new Map();
    for (const [featureName, values] of featureValues) {
      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const std = Math.sqrt(variance);

        normalizationParams.set(featureName, { min, max, mean, std });
      }
    }

    // Prepare feature matrix and labels
    for (const dataPoint of trainingData) {
      const features = await this.prepareFeatures(dataPoint.features);
      featureMatrix.push(features);
      labels.push(dataPoint.isFraud ? 1 : 0);
    }

    // Create tensors
    const xs = tf.tensor2d(featureMatrix);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    return { xs, ys, normalizationParams };
  }

  /**
   * Calculate model metrics
   */
  private async calculateMetrics(
    testData: Array<{ features: TransactionFeatures; isFraud: boolean }>
  ): Promise<ModelMetrics> {
    if (!this.model || !this.isTrained) {
      throw new Error('Model must be trained before calculating metrics');
    }

    const predictions: number[] = [];
    const actualLabels: number[] = [];

    for (const dataPoint of testData) {
      const prediction = await this.predictFraudScore(dataPoint.features);
      predictions.push(prediction.overall_score / 100); // Convert to 0-1
      actualLabels.push(dataPoint.isFraud ? 1 : 0);
    }

    // Calculate confusion matrix
    let tp = 0, fp = 0, fn = 0, tn = 0;
    const threshold = this.config.threshold;

    for (let i = 0; i < predictions.length; i++) {
      const predicted = predictions[i] >= threshold ? 1 : 0;
      const actual = actualLabels[i];

      if (predicted === 1 && actual === 1) tp++;
      else if (predicted === 1 && actual === 0) fp++;
      else if (predicted === 0 && actual === 1) fn++;
      else if (predicted === 0 && actual === 0) tn++;
    }

    // Calculate metrics
    const accuracy = (tp + tn) / (tp + fp + fn + tn);
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    return {
      accuracy,
      precision,
      recall,
      f1_score: f1Score,
      confusion_matrix: [[tn, fp], [fn, tp]],
      business_impact: {
        fraud_detection_rate: recall,
        false_positive_rate: fp / (fp + tn) || 0,
        false_negative_rate: fn / (fn + tp) || 0,
        cost_savings: recall * 1000, // Estimated savings
        revenue_impact: -fp * 100, // Estimated loss from false positives
      },
    };
  }

  /**
   * Predict fraud score for a transaction
   */
  async predictFraudScore(transactionFeatures: TransactionFeatures): Promise<FraudScore> {
    if (!this.model || !this.isTrained) {
      throw new Error('Model must be trained before making predictions');
    }

    const startTime = Date.now();

    try {
      // Prepare features
      const features = await this.prepareFeatures(transactionFeatures);
      const inputTensor = tf.tensor2d([features]);

      // Make prediction
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const score = await prediction.data();

      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();

      const fraudProbability = score[0];
      const overallScore = Math.round(fraudProbability * 100);

      // Calculate component scores
      const componentScores = await this.calculateComponentScores(transactionFeatures);

      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(transactionFeatures, fraudProbability);

      // Generate recommendations
      const recommendations = this.generateRecommendations(riskFactors, overallScore);

      const processingTime = Date.now() - startTime;

      const fraudScore: FraudScore = {
        transaction_id: transactionFeatures.wallet_address, // Will be overridden by caller
        user_id: '', // Will be overridden by caller
        overall_score: overallScore,
        risk_level: this.getRiskLevel(overallScore),
        confidence: Math.min(Math.max(fraudProbability, 0.1), 0.99), // Clamp to 0.1-0.99
        ...componentScores,
        risk_factors: riskFactors,
        recommendations: recommendations,
        model_version: this.modelConfig.version,
        scored_at: new Date(),
        requires_review: overallScore >= mlConfig.fraudDetection.alertThresholds.medium,
        blocked: overallScore >= mlConfig.fraudDetection.alertThresholds.critical,
      };

      logger.debug('Fraud score calculated', {
        overallScore,
        riskLevel: fraudScore.risk_level,
        processingTime,
        riskFactorsCount: riskFactors.length,
      });

      return fraudScore;

    } catch (error) {
      logger.error('Failed to calculate fraud score', { error, transactionId: transactionFeatures.wallet_address });
      throw error;
    }
  }

  /**
   * Calculate component scores for different fraud dimensions
   */
  private async calculateComponentScores(transactionFeatures: TransactionFeatures): Promise<{
    transaction_pattern_score: number;
    behavioral_anomaly_score: number;
    network_analysis_score: number;
    device_fingerprint_score: number;
    geographic_anomaly_score: number;
  }> {
    // Transaction pattern analysis
    const transactionPatternScore = this.analyzeTransactionPattern(transactionFeatures);

    // Behavioral anomaly score
    const behavioralAnomalyScore = await this.analyzeBehavioralAnomaly(transactionFeatures);

    // Network analysis score (simplified - would include graph analysis in production)
    const networkAnalysisScore = this.analyzeNetworkPattern(transactionFeatures);

    // Device fingerprint score
    const deviceFingerprintScore = this.analyzeDeviceRisk(transactionFeatures);

    // Geographic anomaly score
    const geographicAnomalyScore = this.analyzeGeographicRisk(transactionFeatures);

    return {
      transaction_pattern_score: transactionPatternScore,
      behavioral_anomaly_score: behavioralAnomalyScore,
      network_analysis_score: networkAnalysisScore,
      device_fingerprint_score: deviceFingerprintScore,
      geographic_anomaly_score: geographicAnomalyScore,
    };
  }

  /**
   * Analyze transaction patterns for fraud indicators
   */
  private analyzeTransactionPattern(features: TransactionFeatures): number {
    let score = 0;

    // Amount-based analysis
    const amount = features.amount;
    if (amount > 10000) score += 20; // High amount
    if (amount < 1) score += 15; // Very small amount (potential testing)

    // Frequency analysis
    const freq1h = features.transaction_frequency_1h;
    const freq24h = features.transaction_frequency_24h;
    if (freq1h > 10) score += 25; // High frequency
    if (freq24h > 100) score += 20;

    // Time-based analysis
    const hour = features.hour_of_day;
    if (hour >= 2 && hour <= 5) score += 10; // Unusual hours

    // Amount deviation
    const amountDeviation = Math.abs(features.amount_deviation_from_avg);
    if (amountDeviation > 5) score += 15; // Large deviation from normal

    return Math.min(score, 100);
  }

  /**
   * Analyze behavioral patterns
   */
  private async analyzeBehavioralAnomaly(features: TransactionFeatures): Promise<number> {
    let score = 0;

    // New wallet behavior
    if (features.is_new_wallet && features.amount > 1000) {
      score += 30;
    }

    // Transaction patterns for new wallets
    if (features.wallet_age_days < 7 && features.transaction_frequency_24h > 5) {
      score += 25;
    }

    // Inconsistent transaction amounts
    if (features.amount_deviation_from_avg > 3) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Analyze network patterns (simplified)
   */
  private analyzeNetworkPattern(features: TransactionFeatures): number {
    let score = 0;

    // High transaction count could indicate bot activity
    if (features.wallet_transaction_count > 1000) {
      score += 20;
    }

    // Large total volume from new wallet
    if (features.is_new_wallet && features.wallet_total_volume > 50000) {
      score += 25;
    }

    return Math.min(score, 100);
  }

  /**
   * Analyze device-related risks
   */
  private analyzeDeviceRisk(features: TransactionFeatures): number {
    let score = 0;

    // Device risk score from external service
    if (features.device_risk_score > 0.7) {
      score += 30;
    } else if (features.device_risk_score > 0.5) {
      score += 15;
    }

    // VPN/Proxy usage
    if (features.is_vpn_or_proxy) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Analyze geographic risks
   */
  private analyzeGeographicRisk(features: TransactionFeatures): number {
    let score = 0;

    // High-risk country
    if (features.is_high_risk_country) {
      score += 25;
    }

    // IP risk score
    if (features.ip_risk_score > 0.8) {
      score += 30;
    } else if (features.ip_risk_score > 0.6) {
      score += 15;
    }

    // New location (would need historical data in production)
    if (features.is_new_location) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Identify specific risk factors
   */
  private identifyRiskFactors(features: TransactionFeatures, fraudProbability: number): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];

    // Amount-related risks
    if (features.amount > 10000) {
      riskFactors.push({
        type: 'amount_anomaly',
        severity: fraudProbability > 0.7 ? 'high' : 'medium',
        description: `High transaction amount: ${features.amount} USDT`,
        weight: 0.2,
        value: features.amount,
      });
    }

    // Frequency-related risks
    if (features.transaction_frequency_1h > 10) {
      riskFactors.push({
        type: 'frequency_anomaly',
        severity: 'high',
        description: `High transaction frequency: ${features.transaction_frequency_1h} transactions in last hour`,
        weight: 0.25,
        value: features.transaction_frequency_1h,
      });
    }

    // Location-related risks
    if (features.is_high_risk_country) {
      riskFactors.push({
        type: 'location_anomaly',
        severity: 'medium',
        description: 'Transaction from high-risk geographic location',
        weight: 0.15,
        value: features.ip_country,
      });
    }

    // Device-related risks
    if (features.device_risk_score > 0.7) {
      riskFactors.push({
        type: 'device_anomaly',
        severity: 'medium',
        description: `Suspicious device fingerprint (risk score: ${features.device_risk_score})`,
        weight: 0.15,
        value: features.device_risk_score,
      });
    }

    // New wallet risks
    if (features.is_new_wallet && features.amount > 1000) {
      riskFactors.push({
        type: 'behavioral_anomaly',
        severity: 'high',
        description: `Large transaction from new wallet: ${features.amount} USDT`,
        weight: 0.25,
        value: features.wallet_age_days,
      });
    }

    return riskFactors.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Generate recommendations based on risk factors
   */
  private generateRecommendations(riskFactors: RiskFactor[], overallScore: number): string[] {
    const recommendations: string[] = [];

    if (overallScore >= mlConfig.fraudDetection.alertThresholds.critical) {
      recommendations.push('BLOCK: Immediate action required - high fraud risk detected');
      recommendations.push('Require manual review and additional verification');
    } else if (overallScore >= mlConfig.fraudDetection.alertThresholds.high) {
      recommendations.push('REVIEW: Transaction requires manual verification');
      recommendations.push('Consider implementing additional authentication');
    } else if (overallScore >= mlConfig.fraudDetection.alertThresholds.medium) {
      recommendations.push('MONITOR: Keep transaction under observation');
      recommendations.push('Flag for future pattern analysis');
    }

    // Specific recommendations based on risk factors
    for (const factor of riskFactors) {
      switch (factor.type) {
        case 'amount_anomaly':
          recommendations.push('Verify transaction legitimacy with user');
          break;
        case 'frequency_anomaly':
          recommendations.push('Implement rate limiting for this user');
          break;
        case 'location_anomaly':
          recommendations.push('Verify user location and travel patterns');
          break;
        case 'device_anomaly':
          recommendations.push('Require device verification or 2FA');
          break;
        case 'behavioral_anomaly':
          recommendations.push('Monitor user behavior for pattern changes');
          break;
      }
    }

    return Array.from(new Set(recommendations)); // Remove duplicates
  }

  /**
   * Get risk level based on score
   */
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= mlConfig.fraudDetection.alertThresholds.critical) return 'critical';
    if (score >= mlConfig.fraudDetection.alertThresholds.high) return 'high';
    if (score >= mlConfig.fraudDetection.alertThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Save model to storage
   */
  async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save');
    }

    try {
      await this.model.save(`file://${path}`);

      // Save normalization parameters
      const normalizationData = Object.fromEntries(this.featureNormalizationParams);
      await require('fs').promises.writeFile(
        `${path}_normalization.json`,
        JSON.stringify(normalizationData, null, 2)
      );

      logger.info('Model saved successfully', { path });
    } catch (error) {
      logger.error('Failed to save model', { error, path });
      throw error;
    }
  }

  /**
   * Load model from storage
   */
  async loadModel(path: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${path}`);

      // Load normalization parameters
      const normalizationData = JSON.parse(
        await require('fs').promises.readFile(`${path}_normalization.json`, 'utf8')
      );
      this.featureNormalizationParams = new Map(Object.entries(normalizationData));

      this.isTrained = true;
      this.modelConfig.status = 'deployed';

      logger.info('Model loaded successfully', { path });
    } catch (error) {
      logger.error('Failed to load model', { error, path });
      throw error;
    }
  }

  /**
   * Get model configuration
   */
  getModelConfig(): MLModelConfig {
    return { ...this.modelConfig };
  }

  /**
   * Check if model is trained
   */
  isModelTrained(): boolean {
    return this.isTrained;
  }

  /**
   * Dispose of model resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isTrained = false;
  }
}