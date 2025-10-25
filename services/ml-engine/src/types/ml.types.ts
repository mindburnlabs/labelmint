/**
 * Machine Learning System Types
 * Comprehensive type definitions for ML models, features, and predictions
 */

export interface User {
  id: string;
  email?: string;
  role?: string;
}

export interface MLModelConfig {
  id: string;
  name: string;
  version: string;
  type: 'fraud_detection' | 'behavior_analysis' | 'prediction' | 'classification' | 'regression' | 'clustering';
  algorithm: 'neural_network' | 'random_forest' | 'gradient_boosting' | 'logistic_regression' | 'svm' | 'kmeans' | 'isolation_forest';
  status: 'training' | 'trained' | 'deployed' | 'failed' | 'deprecated';
  hyperparameters: Record<string, any>;
  features: string[];
  targetVariable?: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  aucRoc?: number;
  lastTrainedAt?: Date;
  deployedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureStore {
  entity_id: string;
  entity_type: 'user' | 'transaction' | 'task' | 'wallet' | 'session';
  feature_name: string;
  feature_value: number | string | boolean;
  feature_type: 'numeric' | 'categorical' | 'boolean' | 'text' | 'timestamp';
  is_real_time: boolean;
  updated_at: Date;
  version: number;
}

export interface TransactionFeatures {
  // Basic transaction features
  amount: number;
  currency: string;
  timestamp: Date;
  wallet_address: string;
  recipient_address: string;

  // Temporal features
  hour_of_day: number;
  day_of_week: number;
  day_of_month: number;
  month: number;
  is_weekend: boolean;
  is_holiday: boolean;

  // Behavioral features
  transaction_frequency_1h: number;
  transaction_frequency_24h: number;
  transaction_frequency_7d: number;
  avg_transaction_amount_24h: number;
  avg_transaction_amount_7d: number;
  amount_deviation_from_avg: number;

  // Geographic features
  ip_country: string;
  ip_city: string;
  device_fingerprint: string;
  is_new_location: boolean;

  // Wallet features
  wallet_age_days: number;
  wallet_transaction_count: number;
  wallet_total_volume: number;
  is_new_wallet: boolean;

  // Risk features
  is_high_risk_country: boolean;
  is_vpn_or_proxy: boolean;
  device_risk_score: number;
  ip_risk_score: number;
}

export interface UserBehaviorFeatures {
  // User profile features
  user_id: string;
  account_age_days: number;
  verification_status: string;
  risk_tier: string;

  // Activity features
  login_frequency_24h: number;
  task_completion_rate: number;
  average_task_time: number;
  session_duration_avg: number;

  // Financial features
  total_earned: number;
  total_spent: number;
  transaction_count: number;
  avg_transaction_amount: number;
  payment_method_count: number;

  // Quality features
  average_quality_score: number;
  rejection_rate: number;
  dispute_count: number;
  consensus_agreement_rate: number;

  // Behavioral patterns
  peak_activity_hours: number[];
  preferred_task_types: string[];
  device_usage_pattern: Record<string, number>;
  location_consistency_score: number;
}

export interface FraudScore {
  transaction_id: string;
  user_id: string;
  overall_score: number; // 0-100, higher is more suspicious
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1, model confidence

  // Component scores
  transaction_pattern_score: number;
  behavioral_anomaly_score: number;
  network_analysis_score: number;
  device_fingerprint_score: number;
  geographic_anomaly_score: number;

  // Risk factors
  risk_factors: RiskFactor[];
  recommendations: string[];

  // Metadata
  model_version: string;
  scored_at: Date;
  requires_review: boolean;
  blocked: boolean;
}

export interface RiskFactor {
  type: 'amount_anomaly' | 'frequency_anomaly' | 'location_anomaly' | 'device_anomaly' | 'network_anomaly' | 'behavioral_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  weight: number; // Contribution to overall score
  value: any; // Raw value that triggered this factor
}

export interface AnomalyDetection {
  entity_id: string;
  entity_type: 'user' | 'transaction' | 'wallet' | 'session';
  anomaly_type: 'statistical' | 'behavioral' | 'temporal' | 'network' | 'geographic';
  anomaly_score: number; // 0-100
  is_anomaly: boolean;
  confidence: number;

  // Anomaly details
  baseline_value: number;
  observed_value: number;
  deviation_factor: number;
  statistical_significance: number;

  // Context
  time_window: string;
  comparison_group: string;
  affected_metrics: string[];

  // Metadata
  detected_at: Date;
  model_version: string;
  requires_investigation: boolean;
}

export interface Prediction {
  id: string;
  model_id: string;
  model_version: string;
  entity_id: string;
  entity_type: 'user' | 'transaction' | 'task' | 'wallet';
  prediction_type: 'churn' | 'revenue' | 'quality' | 'fraud' | 'engagement' | 'demand';

  // Prediction results
  predicted_value: number | string | boolean;
  confidence: number;
  probability_distribution?: Record<string, number>;

  // Feature importance
  feature_importance: FeatureImportance[];
  primary_drivers: string[];

  // Context
  prediction_horizon: string; // e.g., "7d", "30d", "90d"
  input_features: Record<string, any>;

  // Metadata
  predicted_at: Date;
  expires_at: Date;
  actual_value?: number; // Filled in when known
  accuracy?: number; // Calculated after actual value is known
}

export interface FeatureImportance {
  feature_name: string;
  importance_score: number; // 0-1
  contribution: number; // Positive or negative contribution
  value: any; // Feature value for this prediction
}

export interface ModelTrainingJob {
  id: string;
  model_id: string;
  training_type: 'initial' | 'retrain' | 'incremental';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

  // Data configuration
  data_source: string;
  training_size: number;
  validation_size: number;
  test_size: number;
  features_used: string[];

  // Training configuration
  hyperparameters: Record<string, any>;
  random_seed: number;
  cross_validation_folds: number;

  // Progress
  progress_percentage: number;
  current_epoch?: number;
  total_epochs?: number;
  estimated_completion?: Date;

  // Results (when completed)
  training_metrics?: ModelMetrics;
  validation_metrics?: ModelMetrics;
  test_metrics?: ModelMetrics;
  training_time_seconds?: number;

  // Metadata
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  created_by: string;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  auc_roc?: number;
  confusion_matrix?: number[][];
  classification_report?: Record<string, any>;

  // Regression metrics
  mean_squared_error?: number;
  mean_absolute_error?: number;
  r2_score?: number;

  // Custom metrics
  custom_metrics?: Record<string, number>;

  // Business metrics
  business_impact?: {
    fraud_detection_rate: number;
    false_positive_rate: number;
    false_negative_rate: number;
    cost_savings: number;
    revenue_impact: number;
  };
}

export interface ModelMonitoring {
  model_id: string;
  model_version: string;
  monitoring_period: string;

  // Performance metrics
  prediction_count: number;
  accuracy_over_time: DataPoint[];
  drift_score: number;
  data_drift_metrics: DataDriftMetrics;

  // Resource metrics
  average_inference_time_ms: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;

  // Alert thresholds
  performance_degradation_threshold: number;
  drift_threshold: number;
  resource_usage_threshold: number;

  // Alerts
  active_alerts: MonitoringAlert[];

  // Metadata
  last_updated: Date;
  health_status: 'healthy' | 'warning' | 'critical';
}

export interface DataDriftMetrics {
  overall_drift_score: number;
  feature_drift_scores: Record<string, number>;
  population_stability_index: number;
  kolmogorov_smirnov_statistic: number;

  // Feature statistics comparison
  training_stats: Record<string, FeatureStatistics>;
  production_stats: Record<string, FeatureStatistics>;
}

export interface FeatureStatistics {
  mean: number;
  std_dev: number;
  min: number;
  max: number;
  median: number;
  q25: number;
  q75: number;
  missing_count: number;
  unique_count: number;
}

export interface MonitoringAlert {
  id: string;
  type: 'performance_degradation' | 'data_drift' | 'resource_usage' | 'prediction_quality';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details: Record<string, any>;

  // Status
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;

  // Metadata
  created_at: Date;
  auto_resolve_after?: Date;
}

export interface DataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface MLExperiment {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';

  // Experiment configuration
  hypothesis: string;
  baseline_model_id: string;
  treatment_model_ids: string[];
  traffic_split: Record<string, number>; // model_id -> percentage

  // Success metrics
  primary_metric: string;
  secondary_metrics: string[];
  target_sample_size: number;
  minimum_detectable_effect: number;
  statistical_power: number;
  significance_level: number;

  // Results
  current_sample_size: number;
  statistical_results?: StatisticalResults;
  winner?: string;

  // Metadata
  started_at: Date;
  completed_at?: Date;
  created_by: string;
}

export interface StatisticalResults {
  p_value: number;
  confidence_interval: [number, number];
  effect_size: number;
  statistical_significance: boolean;
  practical_significance: boolean;

  // Per-variant results
  variant_results: Record<string, VariantResult>;
}

export interface VariantResult {
  sample_size: number;
  conversion_rate: number;
  improvement_over_baseline: number;
  confidence_interval: [number, number];
  p_value: number;
  is_winner: boolean;
}

// API Request/Response Types
export interface FraudDetectionRequest {
  transaction_id: string;
  user_id: string;
  transaction_data: Partial<TransactionFeatures>;
  user_data?: Partial<UserBehaviorFeatures>;
  include_explanation?: boolean;
}

export interface FraudDetectionResponse {
  fraud_score: FraudScore;
  processing_time_ms: number;
  model_version: string;
  recommendations: string[];
}

export interface PredictionRequest {
  model_type: string;
  entity_id: string;
  entity_type: string;
  features: Record<string, any>;
  include_feature_importance?: boolean;
}

export interface PredictionResponse {
  prediction: Prediction;
  processing_time_ms: number;
  model_version: string;
  confidence_intervals?: Record<string, [number, number]>;
}

export interface BatchPredictionRequest {
  model_id: string;
  entity_ids: string[];
  features: Record<string, any>[];
  priority?: 'low' | 'normal' | 'high';
}

export interface BatchPredictionResponse {
  job_id: string;
  estimated_completion: Date;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  results?: Prediction[];
  errors?: string[];
}

export interface ModelTrainingRequest {
  model_type: string;
  training_config: {
    data_source: string;
    hyperparameters?: Record<string, any>;
    features?: string[];
    validation_split?: number;
    test_split?: number;
  };
  priority?: 'low' | 'normal' | 'high';
}

export interface ModelTrainingResponse {
  job_id: string;
  model_id: string;
  status: string;
  estimated_completion?: Date;
}