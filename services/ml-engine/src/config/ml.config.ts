/**
 * ML Engine Configuration
 * Central configuration for all ML services, models, and infrastructure
 */

import { z } from 'zod';

const MLConfigSchema = z.object({
  // Database configuration
  database: z.object({
    host: z.string(),
    port: z.number(),
    database: z.string(),
    username: z.string(),
    password: z.string(),
    ssl: z.boolean().default(false),
    maxConnections: z.number().default(20),
    connectionTimeout: z.number().default(30000),
  }),

  // Redis configuration
  redis: z.object({
    host: z.string(),
    port: z.number(),
    password: z.string().optional(),
    db: z.number().default(0),
    maxRetriesPerRequest: z.number().default(3),
    retryDelayOnFailover: z.number().default(100),
    enableOfflineQueue: z.boolean().default(false),
  }),

  // Model storage
  modelStorage: z.object({
    type: z.enum(['local', 's3', 'gcs']),
    basePath: z.string(),
    bucket: z.string().optional(),
    region: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
  }),

  // Feature store
  featureStore: z.object({
    enabled: z.boolean().default(true),
    cacheTTL: z.number().default(3600), // 1 hour
    batchSize: z.number().default(1000),
    updateInterval: z.number().default(300), // 5 minutes
    retentionDays: z.number().default(90),
  }),

  // Fraud detection
  fraudDetection: z.object({
    enabled: z.boolean().default(true),
    modelPath: z.string(),
    threshold: z.number().default(0.7),
    realtimeScoring: z.boolean().default(true),
    batchSize: z.number().default(100),
    cacheResults: z.boolean().default(true),
    cacheTTL: z.number().default(300), // 5 minutes
    alertThresholds: z.object({
      medium: z.number().default(50),
      high: z.number().default(70),
      critical: z.number().default(90),
    }),
  }),

  // Anomaly detection
  anomalyDetection: z.object({
    enabled: z.boolean().default(true),
    sensitivity: z.number().default(0.8),
    windowSize: z.number().default(100),
    minSamples: z.number().default(30),
    updateInterval: z.number().default(3600), // 1 hour
    alertOnAnomaly: z.boolean().default(true),
    autoRetraining: z.boolean().default(true),
    retrainingThreshold: z.number().default(0.1), // 10% drift
  }),

  // Predictive analytics
  prediction: z.object({
    enabled: z.boolean().default(true),
    models: z.object({
      churn: z.object({
        enabled: z.boolean().default(true),
        horizonDays: z.number().default(30),
        updateFrequency: z.string().default('daily'),
        features: z.array(z.string()).default([
          'account_age_days',
          'login_frequency',
          'task_completion_rate',
          'average_quality_score',
          'transaction_count',
          'dispute_count',
        ]),
      }),
      revenue: z.object({
        enabled: z.boolean().default(true),
        horizonDays: z.number().default(90),
        updateFrequency: z.string().default('weekly'),
        features: z.array(z.string()).default([
          'historical_revenue',
          'user_growth_rate',
          'task_volume',
          'average_task_value',
          'market_trends',
        ]),
      }),
      quality: z.object({
        enabled: z.boolean().default(true),
        updateFrequency: z.string().default('daily'),
        features: z.array(z.string()).default([
          'user_experience',
          'task_complexity',
          'time_spent',
          'historical_quality',
          'peer_reviews',
        ]),
      }),
    }),
  }),

  // Model training
  training: z.object({
    maxConcurrentJobs: z.number().default(3),
    defaultEpochs: z.number().default(100),
    earlyStoppingPatience: z.number().default(10),
    validationSplit: z.number().default(0.2),
    testSplit: z.number().default(0.1),
    randomSeed: z.number().default(42),
    autoRetraining: z.object({
      enabled: z.boolean().default(true),
      schedule: z.string().default('0 2 * * *'), // Daily at 2 AM
      minAccuracy: z.number().default(0.85),
      minDataSize: z.number().default(1000),
    }),
  }),

  // Monitoring
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsInterval: z.number().default(60), // 1 minute
    driftThreshold: z.number().default(0.1),
    performanceThreshold: z.number().default(0.05),
    alerting: z.object({
      enabled: z.boolean().default(true),
      webhookUrl: z.string().optional(),
      emailRecipients: z.array(z.string()).default([]),
      slackWebhook: z.string().optional(),
    }),
    retention: z.object({
      metrics: z.number().default(30), // days
      predictions: z.number().default(90), // days
      models: z.number().default(365), // days
    }),
  }),

  // API configuration
  api: z.object({
    port: z.number().default(3003),
    host: z.string().default('0.0.0.0'),
    cors: z.object({
      enabled: z.boolean().default(true),
      origins: z.array(z.string()).default(['*']),
      credentials: z.boolean().default(true),
    }),
    rateLimit: z.object({
      enabled: z.boolean().default(true),
      windowMs: z.number().default(60000), // 1 minute
      maxRequests: z.number().default(100),
      skipSuccessfulRequests: z.boolean().default(true),
    }),
    authentication: z.object({
      enabled: z.boolean().default(true),
      jwtSecret: z.string(),
      jwtExpiry: z.string().default('24h'),
      apiKeyHeader: z.string().default('X-API-Key'),
    }),
  }),

  // TensorFlow configuration
  tensorflow: z.object({
    backend: z.enum(['tensorflow', 'cpu', 'webgl']).default('tensorflow'),
    gpuMemoryFraction: z.number().default(0.8),
    allowGrowth: z.boolean().default(true),
    profiling: z.boolean().default(false),
    parallelism: z.number().default(0), // 0 = auto
  }),

  // Experiment configuration
  experiments: z.object({
    enabled: z.boolean().default(true),
    maxConcurrentExperiments: z.number().default(5),
    defaultSampleSize: z.number().default(10000),
    defaultTrafficSplit: z.object({
      control: z.number().default(0.5),
      treatment: z.number().default(0.5),
    }),
    statisticalConfig: z.object({
      significanceLevel: z.number().default(0.05),
      statisticalPower: z.number().default(0.8),
      minimumDetectableEffect: z.number().default(0.05),
    }),
  }),

  // Logging configuration
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    format: z.enum(['json', 'text']).default('json'),
    file: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('./logs/ml-engine.log'),
      maxSize: z.string().default('100MB'),
      maxFiles: z.number().default(10),
    }),
    console: z.object({
      enabled: z.boolean().default(true),
      colorize: z.boolean().default(true),
    }),
  }),

  // Security
  security: z.object({
    encryptionKey: z.string(),
    hashingRounds: z.number().default(12),
    maxRequestSize: z.string().default('10mb'),
    trustProxy: z.boolean().default(true),
    helmet: z.object({
      enabled: z.boolean().default(true),
      contentSecurityPolicy: z.boolean().default(true),
      crossOriginEmbedderPolicy: z.boolean().default(false),
    }),
  }),

  // Performance
  performance: z.object({
    cache: z.object({
      enabled: z.boolean().default(true),
      provider: z.enum(['redis', 'memory', 'none']).default('redis'),
      ttl: z.number().default(3600),
      maxSize: z.number().default(10000),
    }),
    queue: z.object({
      enabled: z.boolean().default(true),
      provider: z.enum(['redis', 'memory', 'none']).default('redis'),
      maxConcurrency: z.number().default(10),
      timeout: z.number().default(30000),
    }),
    compression: z.object({
      enabled: z.boolean().default(true),
      threshold: z.number().default(1024),
    }),
  }),
});

// Load configuration from environment variables
function loadConfig() {
  const config = {
    database: {
      host: process.env.ML_DB_HOST || 'localhost',
      port: parseInt(process.env.ML_DB_PORT || '5432'),
      database: process.env.ML_DB_NAME || 'labelmint_ml',
      username: process.env.ML_DB_USER || 'postgres',
      password: process.env.ML_DB_PASSWORD || '',
      ssl: process.env.ML_DB_SSL === 'true',
      maxConnections: parseInt(process.env.ML_DB_MAX_CONNECTIONS || '20'),
      connectionTimeout: parseInt(process.env.ML_DB_TIMEOUT || '30000'),
    },

    redis: {
      host: process.env.ML_REDIS_HOST || 'localhost',
      port: parseInt(process.env.ML_REDIS_PORT || '6379'),
      password: process.env.ML_REDIS_PASSWORD,
      db: parseInt(process.env.ML_REDIS_DB || '0'),
      maxRetriesPerRequest: parseInt(process.env.ML_REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.ML_REDIS_RETRY_DELAY || '100'),
      enableOfflineQueue: process.env.ML_REDIS_OFFLINE_QUEUE !== 'false',
    },

    modelStorage: {
      type: (process.env.ML_MODEL_STORAGE_TYPE as 'local' | 's3' | 'gcs') || 'local',
      basePath: process.env.ML_MODEL_STORAGE_PATH || './models',
      bucket: process.env.ML_MODEL_STORAGE_BUCKET,
      region: process.env.ML_MODEL_STORAGE_REGION,
      accessKeyId: process.env.ML_MODEL_STORAGE_ACCESS_KEY,
      secretAccessKey: process.env.ML_MODEL_STORAGE_SECRET_KEY,
    },

    featureStore: {
      enabled: process.env.ML_FEATURE_STORE_ENABLED !== 'false',
      cacheTTL: parseInt(process.env.ML_FEATURE_CACHE_TTL || '3600'),
      batchSize: parseInt(process.env.ML_FEATURE_BATCH_SIZE || '1000'),
      updateInterval: parseInt(process.env.ML_FEATURE_UPDATE_INTERVAL || '300'),
      retentionDays: parseInt(process.env.ML_FEATURE_RETENTION_DAYS || '90'),
    },

    fraudDetection: {
      enabled: process.env.ML_FRAUD_DETECTION_ENABLED !== 'false',
      modelPath: process.env.ML_FRAUD_MODEL_PATH || './models/fraud',
      threshold: parseFloat(process.env.ML_FRAUD_THRESHOLD || '0.7'),
      realtimeScoring: process.env.ML_FRAUD_REALTIME !== 'false',
      batchSize: parseInt(process.env.ML_FRAUD_BATCH_SIZE || '100'),
      cacheResults: process.env.ML_FRAUD_CACHE_RESULTS !== 'false',
      cacheTTL: parseInt(process.env.ML_FRAUD_CACHE_TTL || '300'),
      alertThresholds: {
        medium: parseFloat(process.env.ML_FRAUD_ALERT_MEDIUM || '50'),
        high: parseFloat(process.env.ML_FRAUD_ALERT_HIGH || '70'),
        critical: parseFloat(process.env.ML_FRAUD_ALERT_CRITICAL || '90'),
      },
    },

    anomalyDetection: {
      enabled: process.env.ML_ANOMALY_DETECTION_ENABLED !== 'false',
      sensitivity: parseFloat(process.env.ML_ANOMALY_SENSITIVITY || '0.8'),
      windowSize: parseInt(process.env.ML_ANOMALY_WINDOW_SIZE || '100'),
      minSamples: parseInt(process.env.ML_ANOMALY_MIN_SAMPLES || '30'),
      updateInterval: parseInt(process.env.ML_ANOMALY_UPDATE_INTERVAL || '3600'),
      alertOnAnomaly: process.env.ML_ANOMALY_ALERT_ENABLED !== 'false',
      autoRetraining: process.env.ML_ANOMALY_AUTO_RETRAIN !== 'false',
      retrainingThreshold: parseFloat(process.env.ML_ANOMALY_RETRAIN_THRESHOLD || '0.1'),
    },

    prediction: {
      enabled: process.env.ML_PREDICTION_ENABLED !== 'false',
      models: {
        churn: {
          enabled: process.env.ML_CHURN_PREDICTION_ENABLED !== 'false',
          horizonDays: parseInt(process.env.ML_CHURN_HORIZON || '30'),
          updateFrequency: process.env.ML_CHURN_UPDATE_FREQ || 'daily',
          features: (process.env.ML_CHURN_FEATURES || '').split(',').filter(Boolean),
        },
        revenue: {
          enabled: process.env.ML_REVENUE_PREDICTION_ENABLED !== 'false',
          horizonDays: parseInt(process.env.ML_REVENUE_HORIZON || '90'),
          updateFrequency: process.env.ML_REVENUE_UPDATE_FREQ || 'weekly',
          features: (process.env.ML_REVENUE_FEATURES || '').split(',').filter(Boolean),
        },
        quality: {
          enabled: process.env.ML_QUALITY_PREDICTION_ENABLED !== 'false',
          updateFrequency: process.env.ML_QUALITY_UPDATE_FREQ || 'daily',
          features: (process.env.ML_QUALITY_FEATURES || '').split(',').filter(Boolean),
        },
      },
    },

    training: {
      maxConcurrentJobs: parseInt(process.env.ML_TRAINING_MAX_JOBS || '3'),
      defaultEpochs: parseInt(process.env.ML_TRAINING_EPOCHS || '100'),
      earlyStoppingPatience: parseInt(process.env.ML_TRAINING_PATIENCE || '10'),
      validationSplit: parseFloat(process.env.ML_TRAINING_VALIDATION_SPLIT || '0.2'),
      testSplit: parseFloat(process.env.ML_TRAINING_TEST_SPLIT || '0.1'),
      randomSeed: parseInt(process.env.ML_TRAINING_RANDOM_SEED || '42'),
      autoRetraining: {
        enabled: process.env.ML_AUTO_RETRAINING_ENABLED !== 'false',
        schedule: process.env.ML_AUTO_RETRAINING_SCHEDULE || '0 2 * * *',
        minAccuracy: parseFloat(process.env.ML_AUTO_RETRAIN_MIN_ACCURACY || '0.85'),
        minDataSize: parseInt(process.env.ML_AUTO_RETRAIN_MIN_DATA || '1000'),
      },
    },

    monitoring: {
      enabled: process.env.ML_MONITORING_ENABLED !== 'false',
      metricsInterval: parseInt(process.env.ML_MONITORING_INTERVAL || '60'),
      driftThreshold: parseFloat(process.env.ML_DRIFT_THRESHOLD || '0.1'),
      performanceThreshold: parseFloat(process.env.ML_PERFORMANCE_THRESHOLD || '0.05'),
      alerting: {
        enabled: process.env.ML_ALERTING_ENABLED !== 'false',
        webhookUrl: process.env.ML_ALERT_WEBHOOK_URL,
        emailRecipients: (process.env.ML_ALERT_EMAILS || '').split(',').filter(Boolean),
        slackWebhook: process.env.ML_ALERT_SLACK_WEBHOOK,
      },
      retention: {
        metrics: parseInt(process.env.ML_METRICS_RETENTION_DAYS || '30'),
        predictions: parseInt(process.env.ML_PREDICTIONS_RETENTION_DAYS || '90'),
        models: parseInt(process.env.ML_MODELS_RETENTION_DAYS || '365'),
      },
    },

    api: {
      port: parseInt(process.env.ML_API_PORT || '3003'),
      host: process.env.ML_API_HOST || '0.0.0.0',
      cors: {
        enabled: process.env.ML_CORS_ENABLED !== 'false',
        origins: (process.env.ML_CORS_ORIGINS || '*').split(','),
        credentials: process.env.ML_CORS_CREDENTIALS !== 'false',
      },
      rateLimit: {
        enabled: process.env.ML_RATE_LIMIT_ENABLED !== 'false',
        windowMs: parseInt(process.env.ML_RATE_LIMIT_WINDOW || '60000'),
        maxRequests: parseInt(process.env.ML_RATE_LIMIT_MAX || '100'),
        skipSuccessfulRequests: process.env.ML_RATE_LIMIT_SKIP_SUCCESS !== 'false',
      },
      authentication: {
        enabled: process.env.ML_AUTH_ENABLED !== 'false',
        jwtSecret: process.env.ML_JWT_SECRET || 'default-secret-change-in-production',
        jwtExpiry: process.env.ML_JWT_EXPIRY || '24h',
        apiKeyHeader: process.env.ML_API_KEY_HEADER || 'X-API-Key',
      },
    },

    tensorflow: {
      backend: (process.env.ML_TF_BACKEND as 'tensorflow' | 'cpu' | 'webgl') || 'tensorflow',
      gpuMemoryFraction: parseFloat(process.env.ML_TF_GPU_MEMORY || '0.8'),
      allowGrowth: process.env.ML_TF_ALLOW_GROWTH !== 'false',
      profiling: process.env.ML_TF_PROFILING === 'true',
      parallelism: parseInt(process.env.ML_TF_PARALLELISM || '0'),
    },

    experiments: {
      enabled: process.env.ML_EXPERIMENTS_ENABLED !== 'false',
      maxConcurrentExperiments: parseInt(process.env.ML_EXPERIMENTS_MAX_CONCURRENT || '5'),
      defaultSampleSize: parseInt(process.env.ML_EXPERIMENTS_SAMPLE_SIZE || '10000'),
      defaultTrafficSplit: {
        control: parseFloat(process.env.ML_EXPERIMENTS_CONTROL_SPLIT || '0.5'),
        treatment: parseFloat(process.env.ML_EXPERIMENTS_TREATMENT_SPLIT || '0.5'),
      },
      statisticalConfig: {
        significanceLevel: parseFloat(process.env.ML_EXPERIMENTS_SIGNIFICANCE || '0.05'),
        statisticalPower: parseFloat(process.env.ML_EXPERIMENTS_POWER || '0.8'),
        minimumDetectableEffect: parseFloat(process.env.ML_EXPERIMENTS_MDE || '0.05'),
      },
    },

    logging: {
      level: (process.env.ML_LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
      format: (process.env.ML_LOG_FORMAT as 'json' | 'text') || 'json',
      file: {
        enabled: process.env.ML_LOG_FILE_ENABLED !== 'false',
        path: process.env.ML_LOG_FILE_PATH || './logs/ml-engine.log',
        maxSize: process.env.ML_LOG_FILE_MAX_SIZE || '100MB',
        maxFiles: parseInt(process.env.ML_LOG_FILE_MAX_FILES || '10'),
      },
      console: {
        enabled: process.env.ML_LOG_CONSOLE_ENABLED !== 'false',
        colorize: process.env.ML_LOG_CONSOLE_COLORIZE !== 'false',
      },
    },

    security: {
      encryptionKey: process.env.ML_ENCRYPTION_KEY || 'default-encryption-key-change-me',
      hashingRounds: parseInt(process.env.ML_HASHING_ROUNDS || '12'),
      maxRequestSize: process.env.ML_MAX_REQUEST_SIZE || '10mb',
      trustProxy: process.env.ML_TRUST_PROXY === 'true',
      helmet: {
        enabled: process.env.ML_HELMET_ENABLED !== 'false',
        contentSecurityPolicy: process.env.ML_HELMET_CSP !== 'false',
        crossOriginEmbedderPolicy: process.env.ML_HELMET_COEP === 'true',
      },
    },

    performance: {
      cache: {
        enabled: process.env.ML_CACHE_ENABLED !== 'false',
        provider: (process.env.ML_CACHE_PROVIDER as 'redis' | 'memory' | 'none') || 'redis',
        ttl: parseInt(process.env.ML_CACHE_TTL || '3600'),
        maxSize: parseInt(process.env.ML_CACHE_MAX_SIZE || '10000'),
      },
      queue: {
        enabled: process.env.ML_QUEUE_ENABLED !== 'false',
        provider: (process.env.ML_QUEUE_PROVIDER as 'redis' | 'memory' | 'none') || 'redis',
        maxConcurrency: parseInt(process.env.ML_QUEUE_MAX_CONCURRENCY || '10'),
        timeout: parseInt(process.env.ML_QUEUE_TIMEOUT || '30000'),
      },
      compression: {
        enabled: process.env.ML_COMPRESSION_ENABLED !== 'false',
        threshold: parseInt(process.env.ML_COMPRESSION_THRESHOLD || '1024'),
      },
    },
  };

  return MLConfigSchema.parse(config);
}

export const mlConfig = loadConfig();

// Export typed config
export type MLConfig = z.infer<typeof MLConfigSchema>;

// Feature configurations
export const FEATURE_CONFIGS = {
  transaction: [
    'amount',
    'currency',
    'timestamp',
    'hour_of_day',
    'day_of_week',
    'is_weekend',
    'transaction_frequency_1h',
    'transaction_frequency_24h',
    'avg_transaction_amount_24h',
    'amount_deviation_from_avg',
    'wallet_age_days',
    'wallet_transaction_count',
    'is_new_wallet',
    'is_high_risk_country',
    'device_risk_score',
    'ip_risk_score',
  ],

  user: [
    'account_age_days',
    'verification_status',
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
    'consensus_agreement_rate',
    'peak_activity_hours',
    'location_consistency_score',
  ],
} as const;

// Model configuration templates
export const MODEL_TEMPLATES = {
  fraudDetection: {
    algorithm: 'neural_network',
    features: FEATURE_CONFIGS.transaction,
    hyperparameters: {
      hiddenLayers: [128, 64, 32],
      activation: 'relu',
      dropout: 0.3,
      learningRate: 0.001,
      batchSize: 32,
      epochs: 100,
    },
    threshold: 0.7,
    metrics: ['accuracy', 'precision', 'recall', 'f1_score', 'auc_roc'],
  },

  churnPrediction: {
    algorithm: 'gradient_boosting',
    features: FEATURE_CONFIGS.user,
    hyperparameters: {
      nEstimators: 100,
      maxDepth: 6,
      learningRate: 0.1,
      subsample: 0.8,
    },
    predictionHorizon: 30,
    metrics: ['accuracy', 'precision', 'recall', 'f1_score', 'auc_roc'],
  },

  anomalyDetection: {
    algorithm: 'isolation_forest',
    features: FEATURE_CONFIGS.transaction,
    hyperparameters: {
      nEstimators: 100,
      maxSamples: 'auto',
      contamination: 0.1,
    },
    sensitivity: 0.8,
    metrics: ['precision', 'recall', 'f1_score'],
  },
} as const;