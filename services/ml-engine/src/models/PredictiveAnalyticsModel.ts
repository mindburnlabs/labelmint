/**
 * Predictive Analytics Model
 * Machine learning models for churn prediction, revenue forecasting, and quality prediction
 */

import * as tf from '@tensorflow/tfjs-node';
import { featureStore } from '@/services/FeatureStore';
import { logger } from '@/utils/logger';
import {
  UserBehaviorFeatures,
  Prediction,
  ModelMetrics,
  FeatureImportance
} from '@/types/ml.types';
import { mlConfig } from '@/config/ml.config';

interface PredictiveModelConfig {
  modelType: 'churn' | 'revenue' | 'quality' | 'engagement';
  algorithm: 'neural_network' | 'gradient_boosting' | 'linear_regression' | 'random_forest';
  features: string[];
  targetVariable: string;
  predictionHorizon: number; // days
  updateFrequency: string; // cron expression
  hyperparameters: Record<string, any>;
  isClassification: boolean;
}

interface TrainingData {
  features: number[][];
  targets: number[];
  timestamps: Date[];
}

export class PredictiveAnalyticsModel {
  private config: PredictiveModelConfig;
  private model: tf.LayersModel | null = null;
  private isTrained = false;
  private featureNormalizationParams: Map<string, { min: number; max: number; mean: number; std: number }> = new Map();
  private featureImportance: Map<string, number> = new Map();
  private lastTrained: Date | null = null;
  private modelMetrics: ModelMetrics | null = null;

  constructor(config: PredictiveModelConfig) {
    this.config = config;
  }

  /**
   * Train the predictive model
   */
  async trainModel(): Promise<ModelMetrics> {
    try {
      logger.info(`Training ${this.config.modelType} prediction model`, {
        algorithm: this.config.algorithm,
        features: this.config.features.length,
        horizon: this.config.predictionHorizon,
      });

      // Load and prepare training data
      const trainingData = await this.loadTrainingData();

      if (trainingData.features.length < 100) {
        throw new Error(`Insufficient training data: ${trainingData.features.length} samples`);
      }

      // Split data into train/validation/test
      const { trainData, valData, testData } = this.splitData(trainingData);

      // Calculate normalization parameters
      this.calculateNormalizationParams(trainData.features);

      // Build and train model
      await this.buildModel();
      const metrics = await this.trainAndEvaluate(trainData, valData, testData);

      // Calculate feature importance
      await this.calculateFeatureImportance(testData);

      this.isTrained = true;
      this.lastTrained = new Date();
      this.modelMetrics = metrics;

      logger.info(`${this.config.modelType} model training completed`, {
        accuracy: metrics.accuracy,
        samples: trainingData.features.length,
        features: this.config.features.length,
      });

      return metrics;

    } catch (error) {
      logger.error(`Failed to train ${this.config.modelType} model`, { error });
      throw error;
    }
  }

  /**
   * Make predictions for entities
   */
  async predict(
    entityIds: string[],
    features: UserBehaviorFeatures[]
  ): Promise<Prediction[]> {
    if (!this.isTrained || !this.model) {
      throw new Error('Model must be trained before making predictions');
    }

    try {
      const predictions: Prediction[] = [];

      for (let i = 0; i < entityIds.length; i++) {
        const entityId = entityIds[i];
        const entityFeatures = features[i];

        // Prepare features
        const featureVector = this.prepareFeatures(entityFeatures);
        const inputTensor = tf.tensor2d([featureVector]);

        // Make prediction
        const rawPrediction = this.model.predict(inputTensor) as tf.Tensor;
        const predictionValue = await rawPrediction.data();

        // Calculate confidence (using prediction probability or ensemble variance)
        const confidence = this.calculateConfidence(featureVector);

        // Get feature importance for this prediction
        const featureImportance = this.getPredictionFeatureImportance(entityFeatures);

        inputTensor.dispose();
        rawPrediction.dispose();

        const prediction: Prediction = {
          id: `${entityId}_${Date.now()}`,
          model_id: `predictive_${this.config.modelType}_model`,
          model_version: '1.0.0',
          entity_id: entityId,
          entity_type: 'user',
          prediction_type: this.config.modelType,
          predicted_value: this.config.isClassification ?
            (predictionValue[0] > 0.5 ? 1 : 0) : predictionValue[0],
          confidence: confidence,
          probability_distribution: this.config.isClassification ? {
            negative: 1 - predictionValue[0],
            positive: predictionValue[0],
          } : undefined,
          feature_importance: featureImportance,
          primary_drivers: featureImportance
            .sort((a, b) => b.importance_score - a.importance_score)
            .slice(0, 3)
            .map(f => f.feature_name),
          prediction_horizon: `${this.config.predictionHorizon}d`,
          input_features: this.extractRelevantFeatures(entityFeatures),
          predicted_at: new Date(),
          expires_at: new Date(Date.now() + this.config.predictionHorizon * 24 * 60 * 60 * 1000),
        };

        predictions.push(prediction);

        // Store prediction in feature store
        await this.storePrediction(prediction);
      }

      return predictions;

    } catch (error) {
      logger.error(`Failed to make ${this.config.modelType} predictions`, { error });
      throw error;
    }
  }

  /**
   * Load training data from feature store
   */
  private async loadTrainingData(): Promise<TrainingData> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days

    logger.info('Loading training data', {
      features: this.config.features,
      target: this.config.targetVariable,
      startDate,
      endDate,
    });

    // Get historical data for all features
    const featureData: Record<string, any[]> = {};

    for (const feature of this.config.features) {
      const stats = await featureStore.getFeatureStatistics('user', feature, 90);
      if (stats.numeric_stats) {
        featureData[feature] = [stats.numeric_stats]; // Simplified - in production, query actual data points
      }
    }

    // Get target variable data
    const targetStats = await featureStore.getFeatureStatistics('user', this.config.targetVariable, 90);

    if (!targetStats.numeric_stats) {
      throw new Error(`No numeric data found for target variable: ${this.config.targetVariable}`);
    }

    // For demonstration, create synthetic training data
    // In production, this would query actual historical data
    const numSamples = 1000;
    const features: number[][] = [];
    const targets: number[] = [];
    const timestamps: Date[] = [];

    for (let i = 0; i < numSamples; i++) {
      const featureVector: number[] = [];

      for (const feature of this.config.features) {
        const stats = featureData[feature]?.[0];
        if (stats) {
          // Generate synthetic data based on feature statistics
          const value = this.generateSyntheticFeatureValue(stats, i, numSamples);
          featureVector.push(value);
        } else {
          featureVector.push(Math.random()); // Default random value
        }
      }

      // Generate target based on features with some noise
      const target = this.generateSyntheticTarget(featureVector, i, numSamples);

      features.push(featureVector);
      targets.push(target);
      timestamps.push(new Date(startDate.getTime() + (i / numSamples) * (endDate.getTime() - startDate.getTime())));
    }

    return { features, targets, timestamps };
  }

  /**
   * Generate synthetic feature value for demonstration
   */
  private generateSyntheticFeatureValue(stats: any, index: number, totalSamples: number): number {
    const { mean, std_dev, min, max } = stats;

    // Add trend and seasonality
    const trend = (index / totalSamples) * 0.2 * mean;
    const seasonality = Math.sin(2 * Math.PI * (index / (totalSamples / 12))) * 0.1 * mean;

    // Generate normal random value
    let value = mean + trend + seasonality;
    value += (Math.random() - 0.5) * 2 * std_dev;

    // Clamp to min/max
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Generate synthetic target value based on features
   */
  private generateSyntheticTarget(features: number[], index: number, totalSamples: number): number {
    // Create a relationship between features and target
    let target = 0;

    // Weight features differently
    const weights = [0.3, -0.2, 0.4, 0.1, -0.15, 0.25, 0.2, -0.1, 0.15, 0.3];

    for (let i = 0; i < Math.min(features.length, weights.length); i++) {
      target += features[i] * weights[i];
    }

    // Add some non-linearity
    target += 0.1 * Math.sin(features[0]) + 0.05 * features[1] * features[2];

    // Add noise
    target += (Math.random() - 0.5) * 0.2;

    if (this.config.isClassification) {
      // Convert to binary classification
      return target > 0.5 ? 1 : 0;
    } else {
      // For regression, ensure positive values for revenue/quality predictions
      return Math.max(0, target);
    }
  }

  /**
   * Split data into train/validation/test sets
   */
  private splitData(data: TrainingData): {
    trainData: TrainingData;
    valData: TrainingData;
    testData: TrainingData;
  } {
    const totalSamples = data.features.length;
    const trainSize = Math.floor(totalSamples * 0.7);
    const valSize = Math.floor(totalSamples * 0.15);

    return {
      trainData: {
        features: data.features.slice(0, trainSize),
        targets: data.targets.slice(0, trainSize),
        timestamps: data.timestamps.slice(0, trainSize),
      },
      valData: {
        features: data.features.slice(trainSize, trainSize + valSize),
        targets: data.targets.slice(trainSize, trainSize + valSize),
        timestamps: data.timestamps.slice(trainSize, trainSize + valSize),
      },
      testData: {
        features: data.features.slice(trainSize + valSize),
        targets: data.targets.slice(trainSize + valSize),
        timestamps: data.timestamps.slice(trainSize + valSize),
      },
    };
  }

  /**
   * Calculate normalization parameters
   */
  private calculateNormalizationParams(features: number[][]): void {
    const numFeatures = features[0].length;

    for (let i = 0; i < numFeatures; i++) {
      const values = features.map(row => row[i]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);

      this.featureNormalizationParams.set(this.config.features[i], { min, max, mean, std });
    }
  }

  /**
   * Build the model architecture
   */
  private async buildModel(): Promise<void> {
    switch (this.config.algorithm) {
      case 'neural_network':
        await this.buildNeuralNetwork();
        break;
      case 'linear_regression':
        await this.buildLinearModel();
        break;
      default:
        // For now, default to neural network
        await this.buildNeuralNetwork();
    }
  }

  /**
   * Build neural network model
   */
  private async buildNeuralNetwork(): Promise<void> {
    this.model = tf.sequential();

    const inputSize = this.config.features.length;
    const hiddenLayers = this.config.hyperparameters.hiddenLayers || [64, 32, 16];
    const dropoutRate = this.config.hyperparameters.dropoutRate || 0.3;
    const learningRate = this.config.hyperparameters.learningRate || 0.001;

    // Input layer
    this.model.add(tf.layers.dense({
      inputShape: [inputSize],
      units: hiddenLayers[0],
      activation: 'relu',
      name: 'input_layer'
    }));

    // Hidden layers
    for (let i = 1; i < hiddenLayers.length; i++) {
      this.model.add(tf.layers.dense({
        units: hiddenLayers[i],
        activation: 'relu',
        name: `hidden_layer_${i}`
      }));

      if (dropoutRate > 0) {
        this.model.add(tf.layers.dropout({
          rate: dropoutRate,
          name: `dropout_${i}`
        }));
      }
    }

    // Output layer
    const outputUnits = this.config.isClassification ? 1 : 1;
    const outputActivation = this.config.isClassification ? 'sigmoid' : 'linear';

    this.model.add(tf.layers.dense({
      units: outputUnits,
      activation: outputActivation,
      name: 'output_layer'
    }));

    // Compile model
    const lossFunction = this.config.isClassification ? 'binaryCrossentropy' : 'meanSquaredError';
    const metrics = this.config.isClassification ?
      ['accuracy', 'precision', 'recall'] :
      ['mae', 'mse'];

    this.model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: lossFunction,
      metrics: metrics,
    });

    logger.info('Neural network model built', {
      layers: this.model.layers.length,
      parameters: this.model.countParams(),
    });
  }

  /**
   * Build linear model
   */
  private async buildLinearModel(): Promise<void> {
    this.model = tf.sequential();

    this.model.add(tf.layers.dense({
      inputShape: [this.config.features.length],
      units: 1,
      activation: this.config.isClassification ? 'sigmoid' : 'linear',
      name: 'linear_layer'
    }));

    const lossFunction = this.config.isClassification ? 'binaryCrossentropy' : 'meanSquaredError';

    this.model.compile({
      optimizer: tf.train.adam(0.01),
      loss: lossFunction,
      metrics: this.config.isClassification ? ['accuracy'] : ['mae'],
    });

    logger.info('Linear model built');
  }

  /**
   * Train and evaluate the model
   */
  private async trainAndEvaluate(
    trainData: TrainingData,
    valData: TrainingData,
    testData: TrainingData
  ): Promise<ModelMetrics> {
    if (!this.model) {
      throw new Error('Model must be built before training');
    }

    // Prepare tensors
    const trainFeatures = tf.tensor2d(this.normalizeFeatures(trainData.features));
    const trainTargets = tf.tensor2d(trainData.targets, [trainData.targets.length, 1]);

    const valFeatures = tf.tensor2d(this.normalizeFeatures(valData.features));
    const valTargets = tf.tensor2d(valData.targets, [valData.targets.length, 1]);

    const testFeatures = tf.tensor2d(this.normalizeFeatures(testData.features));
    const testTargets = tf.tensor2d(testData.targets, [testData.targets.length, 1]);

    // Training configuration
    const epochs = this.config.hyperparameters.epochs || 100;
    const batchSize = this.config.hyperparameters.batchSize || 32;
    const patience = this.config.hyperparameters.earlyStoppingPatience || 10;

    // Train model
    const history = await this.model.fit(trainFeatures, trainTargets, {
      epochs,
      batchSize,
      validationData: [valFeatures, valTargets],
      callbacks: [
        tf.callbacks.earlyStopping({
          patience,
          monitor: 'val_loss',
          restoreBestWeights: true,
        }),
      ],
      shuffle: true,
    });

    // Evaluate on test set
    const evaluation = this.model.evaluate(testFeatures, testTargets) as tf.Scalar[];
    const testLoss = await evaluation[0].data();
    const testMetric = await evaluation[1].data();

    // Make predictions for metrics calculation
    const predictions = this.model.predict(testFeatures) as tf.Tensor;
    const predValues = await predictions.data();

    // Calculate metrics
    const metrics = this.calculateMetrics(
      testData.targets,
      Array.from(predValues),
      testLoss[0],
      testMetric[0]
    );

    // Clean up tensors
    trainFeatures.dispose();
    trainTargets.dispose();
    valFeatures.dispose();
    valTargets.dispose();
    testFeatures.dispose();
    testTargets.dispose();
    predictions.dispose();

    return metrics;
  }

  /**
   * Normalize features using pre-calculated parameters
   */
  private normalizeFeatures(features: number[][]): number[][] {
    return features.map(row =>
      row.map((value, index) => {
        const featureName = this.config.features[index];
        const params = this.featureNormalizationParams.get(featureName);

        if (!params) return value;

        if (params.max !== params.min) {
          return (value - params.min) / (params.max - params.min);
        }
        return (value - params.mean) / (params.std || 1);
      })
    );
  }

  /**
   * Calculate model metrics
   */
  private calculateMetrics(
    trueTargets: number[],
    predictions: number[],
    testLoss: number,
    testMetric: number
  ): ModelMetrics {
    const metrics: ModelMetrics = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1_score: 0,
    };

    if (this.config.isClassification) {
      // Classification metrics
      const binaryPredictions = predictions.map(p => p > 0.5 ? 1 : 0);

      let tp = 0, fp = 0, fn = 0, tn = 0;
      for (let i = 0; i < trueTargets.length; i++) {
        if (binaryPredictions[i] === 1 && trueTargets[i] === 1) tp++;
        else if (binaryPredictions[i] === 1 && trueTargets[i] === 0) fp++;
        else if (binaryPredictions[i] === 0 && trueTargets[i] === 1) fn++;
        else if (binaryPredictions[i] === 0 && trueTargets[i] === 0) tn++;
      }

      metrics.accuracy = (tp + tn) / (tp + fp + fn + tn);
      metrics.precision = tp / (tp + fp) || 0;
      metrics.recall = tp / (tp + fn) || 0;
      metrics.f1_score = 2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall) || 0;
    } else {
      // Regression metrics
      const mse = trueTargets.reduce((sum, trueVal, i) => {
        return sum + Math.pow(trueVal - predictions[i], 2);
      }, 0) / trueTargets.length;

      const mae = trueTargets.reduce((sum, trueVal, i) => {
        return sum + Math.abs(trueVal - predictions[i]);
      }, 0) / trueTargets.length;

      const meanTrue = trueTargets.reduce((sum, val) => sum + val, 0) / trueTargets.length;
      const ssRes = trueTargets.reduce((sum, trueVal, i) => {
        return sum + Math.pow(trueVal - predictions[i], 2);
      }, 0);
      const ssTot = trueTargets.reduce((sum, trueVal) => {
        return sum + Math.pow(trueVal - meanTrue, 2);
      }, 0);

      metrics.mean_squared_error = mse;
      metrics.mean_absolute_error = mae;
      metrics.r2_score = 1 - (ssRes / ssTot);
      metrics.accuracy = Math.max(0, metrics.r2_score || 0); // Use R² as accuracy for regression
    }

    // Add business impact metrics
    metrics.business_impact = {
      fraud_detection_rate: metrics.recall,
      false_positive_rate: 0, // Would be calculated based on business context
      false_negative_rate: 0,
      cost_savings: metrics.accuracy * 1000, // Estimated
      revenue_impact: metrics.accuracy * 500, // Estimated
    };

    return metrics;
  }

  /**
   * Calculate feature importance using permutation importance
   */
  private async calculateFeatureImportance(testData: TrainingData): Promise<void> {
    if (!this.model) return;

    const testFeatures = tf.tensor2d(this.normalizeFeatures(testData.features));
    const baselinePredictions = await (this.model.predict(testFeatures) as tf.Tensor).data();

    const baselineLoss = this.calculateLoss(testData.targets, Array.from(baselinePredictions));

    for (let i = 0; i < this.config.features.length; i++) {
      // Shuffle feature i
      const shuffledFeatures = testData.features.map(row => [...row]);
      for (let j = 0; j < shuffledFeatures.length; j++) {
        const randomIndex = Math.floor(Math.random() * shuffledFeatures.length);
        [shuffledFeatures[j][i], shuffledFeatures[randomIndex][i]] =
          [shuffledFeatures[randomIndex][i], shuffledFeatures[j][i]];
      }

      const shuffledTensor = tf.tensor2d(this.normalizeFeatures(shuffledFeatures));
      const shuffledPredictions = await (this.model.predict(shuffledTensor) as tf.Tensor).data();
      const shuffledLoss = this.calculateLoss(testData.targets, Array.from(shuffledPredictions));

      // Feature importance is the increase in loss when feature is shuffled
      const importance = (shuffledLoss - baselineLoss) / baselineLoss;
      this.featureImportance.set(this.config.features[i], importance);

      shuffledTensor.dispose();
    }

    testFeatures.dispose();
  }

  /**
   * Calculate loss for feature importance
   */
  private calculateLoss(trueTargets: number[], predictions: number[]): number {
    if (this.config.isClassification) {
      // Binary crossentropy
      return -trueTargets.reduce((sum, trueVal, i) => {
        const pred = Math.max(Math.min(predictions[i], 0.999), 0.001);
        return sum + (trueVal * Math.log(pred) + (1 - trueVal) * Math.log(1 - pred));
      }, 0) / trueTargets.length;
    } else {
      // Mean squared error
      return trueTargets.reduce((sum, trueVal, i) => {
        return sum + Math.pow(trueVal - predictions[i], 2);
      }, 0) / trueTargets.length;
    }
  }

  /**
   * Prepare features for prediction
   */
  private prepareFeatures(features: UserBehaviorFeatures): number[] {
    return this.config.features.map(featureName => {
      let value = (features as any)[featureName];

      if (value === undefined || value === null) {
        value = this.getDefaultValue(featureName);
      }

      // Normalize
      const params = this.featureNormalizationParams.get(featureName);
      if (params) {
        if (params.max !== params.min) {
          return (value - params.min) / (params.max - params.min);
        }
        return (value - params.mean) / (params.std || 1);
      }

      return value;
    });
  }

  /**
   * Get default value for missing features
   */
  private getDefaultValue(featureName: string): number {
    const defaults: Record<string, number> = {
      account_age_days: 30,
      login_frequency_24h: 1,
      task_completion_rate: 0.8,
      average_task_time: 300, // 5 minutes
      total_earned: 100,
      total_spent: 50,
      transaction_count: 10,
      avg_transaction_amount: 25,
      average_quality_score: 0.85,
      rejection_rate: 0.1,
      dispute_count: 0,
      consensus_agreement_rate: 0.9,
    };

    return defaults[featureName] || 0;
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(features: number[]): number {
    // Simple confidence calculation based on feature value ranges
    // In production, this could use Monte Carlo dropout or ensemble variance
    const featureRanges = Array.from(this.featureNormalizationParams.values());
    let confidenceScore = 0;

    for (let i = 0; i < features.length; i++) {
      const normalizedValue = features[i];
      // Values closer to 0.5 (normalized center) have higher confidence
      const deviation = Math.abs(normalizedValue - 0.5);
      confidenceScore += (1 - deviation * 2);
    }

    return Math.max(0.1, Math.min(0.99, confidenceScore / features.length));
  }

  /**
   * Get feature importance for a specific prediction
   */
  private getPredictionFeatureImportance(features: UserBehaviorFeatures): FeatureImportance[] {
    return Array.from(this.featureImportance.entries()).map(([featureName, importance]) => ({
      feature_name: featureName,
      importance_score: Math.abs(importance),
      contribution: importance * ((features as any)[featureName] || 0),
      value: (features as any)[featureName] || 0,
    })).sort((a, b) => b.importance_score - a.importance_score);
  }

  /**
   * Extract relevant features from input
   */
  private extractRelevantFeatures(features: UserBehaviorFeatures): Record<string, any> {
    const relevant: Record<string, any> = {};
    for (const feature of this.config.features) {
      relevant[feature] = (features as any)[feature];
    }
    return relevant;
  }

  /**
   * Store prediction in feature store
   */
  private async storePrediction(prediction: Prediction): Promise<void> {
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
        },
        true
      );
    } catch (error) {
      logger.error('Failed to store prediction', { error, predictionId: prediction.id });
    }
  }

  /**
   * Get model configuration
   */
  getConfig(): PredictiveModelConfig {
    return { ...this.config };
  }

  /**
   * Get model metrics
   */
  getMetrics(): ModelMetrics | null {
    return this.modelMetrics;
  }

  /**
   * Get feature importance
   */
  getFeatureImportance(): Map<string, number> {
    return new Map(this.featureImportance);
  }

  /**
   * Check if model is trained
   */
  isModelTrained(): boolean {
    return this.isTrained;
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

      // Save additional metadata
      const metadata = {
        config: this.config,
        featureNormalizationParams: Object.fromEntries(this.featureNormalizationParams),
        featureImportance: Object.fromEntries(this.featureImportance),
        lastTrained: this.lastTrained,
        metrics: this.modelMetrics,
      };

      await require('fs').promises.writeFile(
        `${path}_metadata.json`,
        JSON.stringify(metadata, null, 2)
      );

      logger.info(`${this.config.modelType} model saved`, { path });

    } catch (error) {
      logger.error(`Failed to save ${this.config.modelType} model`, { error, path });
      throw error;
    }
  }

  /**
   * Load model from storage
   */
  async loadModel(path: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${path}`);

      // Load metadata
      const metadata = JSON.parse(
        await require('fs').promises.readFile(`${path}_metadata.json`, 'utf8')
      );

      this.featureNormalizationParams = new Map(Object.entries(metadata.featureNormalizationParams));
      this.featureImportance = new Map(Object.entries(metadata.featureImportance));
      this.lastTrained = new Date(metadata.lastTrained);
      this.modelMetrics = metadata.metrics;

      this.isTrained = true;

      logger.info(`${this.config.modelType} model loaded`, { path });

    } catch (error) {
      logger.error(`Failed to load ${this.config.modelType} model`, { error, path });
      throw error;
    }
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