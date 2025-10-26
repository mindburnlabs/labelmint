/**
 * Anomaly Detection Model
 * Isolation Forest and statistical methods for real-time anomaly detection
 */

import * as tf from '@tensorflow/tfjs-node';
import { featureStore } from '@/services/FeatureStore';
import { logger } from '@/utils/logger';
import {
  UserBehaviorFeatures,
  AnomalyDetection,
  ModelMetrics
} from '@/types/ml.types';
import { mlConfig } from '@/config/ml.config';

interface AnomalyDetectionConfig {
  algorithm: 'isolation_forest' | 'autoencoder' | 'statistical';
  contamination: number; // Expected proportion of anomalies
  nEstimators: number;
  maxSamples: number | 'auto';
  maxFeatures: number | 'auto';
  sensitivity: number; // 0-1, higher means more sensitive to anomalies
  windowSize: number; // Number of samples to consider for baseline
  updateInterval: number; // How often to update the baseline (seconds)
}

interface AnomalyThreshold {
  featureName: string;
  lowerBound?: number;
  upperBound?: number;
  method: 'iqr' | 'zscore' | 'isolation_forest';
  parameters: Record<string, number>;
}

export class AnomalyDetectionModel {
  private config: AnomalyDetectionConfig;
  private isolationForest: IsolationForest | null = null;
  private autoencoder: tf.Sequential | null = null;
  private baselineStats: Map<string, {
    mean: number;
    std: number;
    median: number;
    q25: number;
    q75: number;
    iqr: number;
    min: number;
    max: number;
  }> = new Map();
  private thresholds: Map<string, AnomalyThreshold> = new Map();
  private lastUpdated: Date = new Date();
  private isInitialized = false;

  constructor(config: Partial<AnomalyDetectionConfig> = {}) {
    this.config = {
      algorithm: 'isolation_forest',
      contamination: 0.1,
      nEstimators: 100,
      maxSamples: 'auto',
      maxFeatures: 1.0,
      sensitivity: mlConfig.anomalyDetection.sensitivity,
      windowSize: mlConfig.anomalyDetection.windowSize,
      updateInterval: mlConfig.anomalyDetection.updateInterval,
      ...config,
    };
  }

  /**
   * Initialize the anomaly detection model
   */
  async initialize(features: string[]): Promise<void> {
    try {
      logger.info('Initializing anomaly detection model', {
        algorithm: this.config.algorithm,
        features: features.length,
      });

      // Load historical data to establish baseline
      await this.establishBaseline(features);

      // Initialize algorithm-specific components
      switch (this.config.algorithm) {
        case 'isolation_forest':
          this.isolationForest = new IsolationForest({
            nEstimators: this.config.nEstimators,
            maxSamples: this.config.maxSamples,
            maxFeatures: this.config.maxFeatures,
            contamination: this.config.contamination,
          });
          break;

        case 'autoencoder':
          await this.initializeAutoencoder(features.length);
          break;

        case 'statistical':
          // Statistical method uses baseline stats, already initialized
          break;
      }

      this.isInitialized = true;
      this.lastUpdated = new Date();

      logger.info('Anomaly detection model initialized successfully', {
        algorithm: this.config.algorithm,
        baselineFeatures: this.baselineStats.size,
      });

    } catch (error) {
      logger.error('Failed to initialize anomaly detection model', { error });
      throw error;
    }
  }

  /**
   * Establish baseline statistics from historical data
   */
  private async establishBaseline(features: string[]): Promise<void> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - this.config.windowSize * 24 * 60 * 60 * 1000);

    logger.info('Establishing baseline statistics', {
      features,
      startDate,
      endDate,
    });

    for (const feature of features) {
      try {
        // Get historical feature statistics
        const stats = await featureStore.getFeatureStatistics('user', feature, this.config.windowSize * 24);

        if (stats.count > 0) {
          let baselineStats: any;

          if (stats.numeric_stats) {
            baselineStats = {
              mean: stats.numeric_stats.mean,
              std: stats.numeric_stats.std_dev,
              median: stats.numeric_stats.median,
              q25: stats.numeric_stats.q25,
              q75: stats.numeric_stats.q75,
              iqr: stats.numeric_stats.q75 - stats.numeric_stats.q25,
              min: stats.numeric_stats.min,
              max: stats.numeric_stats.max,
            };
          } else {
            // For categorical features, create dummy numeric stats
            baselineStats = {
              mean: 0.5,
              std: 0.5,
              median: 0.5,
              q25: 0.25,
              q75: 0.75,
              iqr: 0.5,
              min: 0,
              max: 1,
            };
          }

          this.baselineStats.set(feature, baselineStats);

          // Set anomaly thresholds
          this.setThresholds(feature, baselineStats);

          logger.debug('Baseline established for feature', {
            feature,
            count: stats.count,
            mean: baselineStats.mean,
            std: baselineStats.std,
          });
        } else {
          logger.warn('No historical data found for feature', { feature });
        }

      } catch (error) {
        logger.error('Failed to establish baseline for feature', { error, feature });
      }
    }

    if (this.baselineStats.size === 0) {
      throw new Error('No baseline statistics could be established');
    }
  }

  /**
   * Set anomaly detection thresholds for a feature
   */
  private setThresholds(feature: string, stats: any): void {
    const thresholds: AnomalyThreshold[] = [];

    // IQR-based thresholds
    thresholds.push({
      featureName: feature,
      lowerBound: stats.q25 - 3 * stats.iqr,
      upperBound: stats.q75 + 3 * stats.iqr,
      method: 'iqr',
      parameters: { multiplier: 3 },
    });

    // Z-score based thresholds
    thresholds.push({
      featureName: feature,
      lowerBound: stats.mean - 3 * stats.std,
      upperBound: stats.mean + 3 * stats.std,
      method: 'zscore',
      parameters: { threshold: 3 },
    });

    // Store the most appropriate threshold based on sensitivity
    const selectedThreshold = this.selectThreshold(thresholds);
    this.thresholds.set(feature, selectedThreshold);
  }

  /**
   * Select the best threshold based on sensitivity configuration
   */
  private selectThreshold(thresholds: AnomalyThreshold[]): AnomalyThreshold {
    // Higher sensitivity means tighter bounds
    const sensitivityFactor = this.config.sensitivity;

    if (sensitivityFactor > 0.8) {
      // Use strict thresholds
      return thresholds.find(t => t.method === 'zscore') || thresholds[0];
    } else if (sensitivityFactor > 0.5) {
      // Use moderate thresholds
      return thresholds.find(t => t.method === 'iqr') || thresholds[0];
    } else {
      // Use relaxed thresholds
      const relaxedThreshold = { ...thresholds[0] };
      if (relaxedThreshold.lowerBound && relaxedThreshold.upperBound) {
        const range = relaxedThreshold.upperBound - relaxedThreshold.lowerBound;
        relaxedThreshold.lowerBound -= range * 0.5;
        relaxedThreshold.upperBound += range * 0.5;
      }
      return relaxedThreshold;
    }
  }

  /**
   * Initialize autoencoder for anomaly detection
   */
  private async initializeAutoencoder(inputSize: number): Promise<void> {
    const encoderSize = Math.max(8, Math.floor(inputSize * 0.3));
    const bottleneckSize = Math.max(4, Math.floor(inputSize * 0.1));

    // Build encoder
    const encoder = tf.sequential();
    encoder.add(tf.layers.dense({
      inputShape: [inputSize],
      units: encoderSize,
      activation: 'relu',
      name: 'encoder_1'
    }));
    encoder.add(tf.layers.dense({
      units: bottleneckSize,
      activation: 'relu',
      name: 'bottleneck'
    }));

    // Build decoder
    const decoder = tf.sequential();
    decoder.add(tf.layers.dense({
      inputShape: [bottleneckSize],
      units: encoderSize,
      activation: 'relu',
      name: 'decoder_1'
    }));
    decoder.add(tf.layers.dense({
      units: inputSize,
      activation: 'sigmoid',
      name: 'output'
    }));

    // Build autoencoder
    this.autoencoder = tf.sequential();
    this.autoencoder.add(encoder);
    this.autoencoder.add(decoder);

    this.autoencoder.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
    });

    logger.info('Autoencoder initialized', {
      inputSize,
      encoderSize,
      bottleneckSize,
    });
  }

  /**
   * Detect anomalies in user behavior
   */
  async detectAnomalies(
    entityId: string,
    entityType: 'user' | 'transaction' | 'wallet' | 'session',
    features: UserBehaviorFeatures
  ): Promise<AnomalyDetection[]> {
    if (!this.isInitialized) {
      throw new Error('Model must be initialized before detecting anomalies');
    }

    const anomalies: AnomalyDetection[] = [];

    try {
      // Check each feature for anomalies
      for (const [featureName, value] of Object.entries(features)) {
        if (typeof value !== 'number' || isNaN(value)) continue;

        const anomaly = await this.detectFeatureAnomaly(
          entityId,
          entityType,
          featureName,
          value
        );

        if (anomaly) {
          anomalies.push(anomaly);
        }
      }

      // Detect multivariate anomalies using the selected algorithm
      if (this.config.algorithm !== 'statistical') {
        const multivariateAnomaly = await this.detectMultivariateAnomaly(
          entityId,
          entityType,
          features
        );

        if (multivariateAnomaly) {
          anomalies.push(multivariateAnomaly);
        }
      }

      logger.debug('Anomaly detection completed', {
        entityId,
        entityType,
        featuresChecked: Object.keys(features).length,
        anomaliesFound: anomalies.length,
      });

      return anomalies;

    } catch (error) {
      logger.error('Failed to detect anomalies', {
        error,
        entityId,
        entityType,
      });
      throw error;
    }
  }

  /**
   * Detect anomaly in a single feature
   */
  private async detectFeatureAnomaly(
    entityId: string,
    entityType: string,
    featureName: string,
    value: number
  ): Promise<AnomalyDetection | null> {
    const baseline = this.baselineStats.get(featureName);
    const threshold = this.thresholds.get(featureName);

    if (!baseline || !threshold) {
      return null; // No baseline or threshold for this feature
    }

    let isAnomaly = false;
    let anomalyScore = 0;
    let observedValue = value;
    let baselineValue = baseline.mean;

    switch (threshold.method) {
      case 'iqr':
        isAnomaly = value < threshold.lowerBound! || value > threshold.upperBound!;
        if (isAnomaly) {
          const distance = Math.min(
            Math.abs(value - threshold.lowerBound!),
            Math.abs(value - threshold.upperBound!)
          );
          anomalyScore = Math.min(100, (distance / baseline.iqr) * 25);
        }
        break;

      case 'zscore':
        const zscore = Math.abs((value - baseline.mean) / baseline.std);
        isAnomaly = zscore > threshold.parameters.threshold;
        anomalyScore = Math.min(100, zscore * 10);
        baselineValue = baseline.mean;
        break;

      case 'isolation_forest':
        if (this.isolationForest) {
          const isolationScore = await this.isolationForest.score([[value]]);
          anomalyScore = isolationScore[0] * 100;
          isAnomaly = anomalyScore > (1 - this.config.sensitivity) * 100;
        }
        break;
    }

    if (isAnomaly) {
      return {
        entity_id: entityId,
        entity_type: entityType as any,
        anomaly_type: 'statistical',
        anomaly_score: anomalyScore,
        is_anomaly: true,
        confidence: Math.min(0.99, anomalyScore / 100),
        baseline_value: baselineValue,
        observed_value: observedValue,
        deviation_factor: Math.abs(observedValue - baselineValue) / (baseline.std || 1),
        statistical_significance: anomalyScore / 100,
        time_window: `${this.config.windowSize}d`,
        comparison_group: 'historical_user_data',
        affected_metrics: [featureName],
        detected_at: new Date(),
        model_version: '1.0.0',
        requires_investigation: anomalyScore > 70,
      };
    }

    return null;
  }

  /**
   * Detect multivariate anomalies using the selected algorithm
   */
  private async detectMultivariateAnomaly(
    entityId: string,
    entityType: string,
    features: UserBehaviorFeatures
  ): Promise<AnomalyDetection | null> {
    const featureValues = Object.entries(features)
      .filter(([_, value]) => typeof value === 'number' && !isNaN(value))
      .map(([_, value]) => value as number);

    if (featureValues.length < 3) {
      return null; // Not enough features for multivariate analysis
    }

    let anomalyScore = 0;
    let anomalyType: 'statistical' | 'behavioral' | 'temporal' | 'network' | 'geographic' = 'behavioral';

    try {
      switch (this.config.algorithm) {
        case 'isolation_forest':
          if (this.isolationForest) {
            const scores = await this.isolationForest.score([featureValues]);
            anomalyScore = scores[0] * 100;
          }
          break;

        case 'autoencoder':
          if (this.autoencoder) {
            anomalyScore = await this.detectAutoencoderAnomaly(featureValues);
          }
          break;

        case 'statistical':
          // Use Mahalanobis distance for multivariate statistical anomaly detection
          anomalyScore = await this.detectMahalanobisAnomaly(featureValues);
          break;
      }

      const isAnomaly = anomalyScore > (1 - this.config.sensitivity) * 100;

      if (isAnomaly) {
        return {
          entity_id: entityId,
          entity_type: entityType as any,
          anomaly_type: anomalyType,
          anomaly_score: anomalyScore,
          is_anomaly: true,
          confidence: Math.min(0.99, anomalyScore / 100),
          baseline_value: 0, // Multivariate doesn't have single baseline
          observed_value: 0, // Multivariate doesn't have single observed value
          deviation_factor: anomalyScore / 100,
          statistical_significance: anomalyScore / 100,
          time_window: `${this.config.windowSize}d`,
          comparison_group: 'multivariate_user_patterns',
          affected_metrics: Object.keys(features),
          detected_at: new Date(),
          model_version: '1.0.0',
          requires_investigation: anomalyScore > 70,
        };
      }

    } catch (error) {
      logger.error('Multivariate anomaly detection failed', { error, entityId });
    }

    return null;
  }

  /**
   * Detect anomaly using autoencoder reconstruction error
   */
  private async detectAutoencoderAnomaly(features: number[]): Promise<number> {
    if (!this.autoencoder) {
      return 0;
    }

    const input = tf.tensor2d([features]);
    const reconstruction = this.autoencoder.predict(input) as tf.Tensor;
    const mse = tf.losses.meanSquaredError(features, reconstruction.dataSync());
    const score = await mse.data();

    // Normalize score to 0-100
    const normalizedScore = Math.min(100, score[0] * 1000);

    // Clean up tensors
    input.dispose();
    reconstruction.dispose();
    mse.dispose();

    return normalizedScore;
  }

  /**
   * Detect anomaly using Mahalanobis distance
   */
  private async detectMahalanobisAnomaly(features: number[]): Promise<number> {
    // Simplified Mahalanobis distance calculation
    // In production, you'd calculate the covariance matrix properly
    const n = features.length;
    let sum = 0;
    let sumSq = 0;

    for (const value of features) {
      sum += value;
      sumSq += value * value;
    }

    const mean = sum / n;
    const variance = (sumSq / n) - (mean * mean);
    const std = Math.sqrt(variance);

    // Calculate average z-score
    let totalZScore = 0;
    for (const value of features) {
      const zScore = Math.abs((value - mean) / (std || 1));
      totalZScore += zScore;
    }

    const avgZScore = totalZScore / n;
    return Math.min(100, avgZScore * 10);
  }

  /**
   * Update the model with new data
   */
  async updateModel(): Promise<void> {
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - this.lastUpdated.getTime()) / (1000 * 60 * 60);

    if (hoursSinceUpdate < this.config.updateInterval / 3600) {
      return; // Not time to update yet
    }

    try {
      logger.info('Updating anomaly detection model');

      // Re-establish baseline with recent data
      const featureNames = Array.from(this.baselineStats.keys());
      await this.establishBaseline(featureNames);

      // Retrain Isolation Forest if applicable
      if (this.config.algorithm === 'isolation_forest' && this.isolationForest) {
        // Fetch recent behavioral data for retraining
        // In production, this would fetch from feature store or database
        // For now, we'll skip retraining or implement with proper data fetching
        logger.info('Skipping Isolation Forest retraining - requires training data');
      }

      this.lastUpdated = now;

      logger.info('Anomaly detection model updated successfully', {
        featuresUpdated: featureNames.length,
        algorithm: this.config.algorithm,
      });

    } catch (error) {
      logger.error('Failed to update anomaly detection model', { error });
    }
  }

  /**
   * Get current model statistics
   */
  getModelStats(): {
    isInitialized: boolean;
    algorithm: string;
    baselineFeatures: number;
    thresholds: number;
    lastUpdated: Date;
    sensitivity: number;
  } {
    return {
      isInitialized: this.isInitialized,
      algorithm: this.config.algorithm,
      baselineFeatures: this.baselineStats.size,
      thresholds: this.thresholds.size,
      lastUpdated: this.lastUpdated,
      sensitivity: this.config.sensitivity,
    };
  }

  /**
   * Get baseline statistics for a feature
   */
  getBaselineStats(featureName: string): any {
    return this.baselineStats.get(featureName);
  }

  /**
   * Get threshold for a feature
   */
  getThreshold(featureName: string): AnomalyThreshold | undefined {
    return this.thresholds.get(featureName);
  }

  /**
   * Dispose of model resources
   */
  dispose(): void {
    if (this.autoencoder) {
      this.autoencoder.dispose();
      this.autoencoder = null;
    }

    if (this.isolationForest) {
      this.isolationForest.dispose();
      this.isolationForest = null;
    }

    this.isInitialized = false;
  }
}

/**
 * Simple Isolation Forest implementation
 */
class IsolationForest {
  private trees: IsolationTree[];
  private config: {
    nEstimators: number;
    maxSamples: number | 'auto';
    maxFeatures: number | 'auto';
    contamination: number;
  };

  constructor(config: any) {
    this.config = config;
    this.trees = [];
  }

  async fit(features: number[][]): Promise<void> {
    const maxSamples = this.config.maxSamples === 'auto'
      ? Math.min(256, features.length)
      : this.config.maxSamples;

    logger.info('Training Isolation Forest', {
      nEstimators: this.config.nEstimators,
      maxSamples,
      dataPoints: features.length,
    });

    this.trees = [];
    for (let i = 0; i < this.config.nEstimators; i++) {
      // Sample data for this tree
      const sample = this.sampleData(features, maxSamples);
      const tree = new IsolationTree();
      tree.fit(sample);
      this.trees.push(tree);
    }

    logger.info('Isolation Forest training completed', {
      treesTrained: this.trees.length,
    });
  }

  async score(data: number[][]): Promise<number[]> {
    if (this.trees.length === 0) {
      throw new Error('Model must be trained before scoring');
    }

    const scores: number[] = [];

    for (const point of data) {
      let totalDepth = 0;

      for (const tree of this.trees) {
        totalDepth += tree.pathLength(point);
      }

      const avgDepth = totalDepth / this.trees.length;
      const score = Math.pow(2, -avgDepth / this.averagePathLength(data.length));
      scores.push(score);
    }

    return scores;
  }

  private sampleData(data: number[][], nSamples: number): number[][] {
    const sampled: number[][] = [];
    const used = new Set<number>();

    while (sampled.length < nSamples && sampled.length < data.length) {
      const index = Math.floor(Math.random() * data.length);
      if (!used.has(index)) {
        used.add(index);
        sampled.push(data[index]);
      }
    }

    return sampled;
  }

  private averagePathLength(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }

  dispose(): void {
    this.trees = [];
  }
}

/**
 * Simple Isolation Tree implementation
 */
class IsolationTree {
  private root: IsolationNode | null = null;

  fit(data: number[][]): void {
    this.root = this.buildTree(data, 0);
  }

  pathLength(point: number[]): number {
    if (!this.root) return 0;
    return this.root.pathLength(point, 0);
  }

  private buildTree(data: number[][], depth: number): IsolationNode {
    if (data.length <= 1 || depth > 10) {
      return new IsolationNode(null, null, null, data.length, depth);
    }

    // Randomly select feature and split point
    const featureIndex = Math.floor(Math.random() * data[0].length);
    const values = data.map(point => point[featureIndex]);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    if (minVal === maxVal) {
      return new IsolationNode(null, null, null, data.length, depth);
    }

    const splitValue = minVal + Math.random() * (maxVal - minVal);

    // Split data
    const leftData = data.filter(point => point[featureIndex] < splitValue);
    const rightData = data.filter(point => point[featureIndex] >= splitValue);

    const leftChild = this.buildTree(leftData, depth + 1);
    const rightChild = this.buildTree(rightData, depth + 1);

    return new IsolationNode(leftChild, rightChild, { featureIndex, splitValue }, data.length, depth);
  }
}

/**
 * Isolation Tree Node
 */
class IsolationNode {
  constructor(
    public left: IsolationNode | null,
    public right: IsolationNode | null,
    public split: { featureIndex: number; splitValue: number } | null,
    public size: number,
    public depth: number
  ) {}

  pathLength(point: number[], currentDepth: number): number {
    if (!this.left && !this.right) {
      return currentDepth + this.c(this.size);
    }

    if (!this.split) {
      return currentDepth + this.c(this.size);
    }

    const { featureIndex, splitValue } = this.split;
    const child = point[featureIndex] < splitValue ? this.left : this.right;

    if (!child) {
      return currentDepth + this.c(this.size);
    }

    return child.pathLength(point, currentDepth + 1);
  }

  private c(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}