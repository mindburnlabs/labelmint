/**
 * Logger Utility
 * Centralized logging for the ML Engine
 */

import winston from 'winston';
import { mlConfig } from '@/config/ml.config';

// Create logger instance
export const logger = winston.createLogger({
  level: mlConfig.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    mlConfig.logging.format === 'json'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
  ),
  defaultMeta: {
    service: 'ml-engine',
    version: '1.0.0',
  },
  transports: [
    // Console transport
    ...(mlConfig.logging.console.enabled
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
              })
            ),
          }),
        ]
      : []),

    // File transport
    ...(mlConfig.logging.file.enabled
      ? [
          new winston.transports.File({
            filename: mlConfig.logging.file.path,
            maxsize: parseSize(mlConfig.logging.file.maxSize),
            maxFiles: mlConfig.logging.file.maxFiles,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
          }),
        ]
      : []),
  ],
});

// Helper function to parse size strings (e.g., "100MB")
function parseSize(sizeStr: string): number {
  const units: { [key: string]: number } = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };

  const match = sizeStr.match(/^(\d+)(B|KB|MB|GB)$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`);
  }

  const [, size, unit] = match;
  return parseInt(size, 10) * (units[unit.toUpperCase()] || 1);
}

// Create child logger with additional context
export function createChildLogger(context: Record<string, any>): winston.Logger {
  return logger.child(context);
}

// ML-specific logging functions
export const mlLogger = {
  // General info logging
  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },

  // Warning logging
  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },

  // Model training logs
  modelTraining: (message: string, meta?: any) => {
    logger.info(message, { ...meta, category: 'model_training' });
  },

  // Prediction logs
  prediction: (message: string, meta?: any) => {
    logger.debug(message, { ...meta, category: 'prediction' });
  },

  // Feature store logs
  featureStore: (message: string, meta?: any) => {
    logger.debug(message, { ...meta, category: 'feature_store' });
  },

  // Fraud detection logs
  fraudDetection: (message: string, meta?: any) => {
    logger.info(message, { ...meta, category: 'fraud_detection' });
  },

  // Anomaly detection logs
  anomalyDetection: (message: string, meta?: any) => {
    logger.info(message, { ...meta, category: 'anomaly_detection' });
  },

  // Model monitoring logs
  modelMonitoring: (message: string, meta?: any) => {
    logger.info(message, { ...meta, category: 'model_monitoring' });
  },

  // Performance logs
  performance: (message: string, meta?: any) => {
    logger.info(message, { ...meta, category: 'performance' });
  },

  // Error logs with context
  error: (message: string, error: Error, meta?: any) => {
    logger.error(message, {
      ...meta,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    });
  },

  // Security logs
  security: (message: string, meta?: any) => {
    logger.warn(message, { ...meta, category: 'security' });
  },
};

export default logger;