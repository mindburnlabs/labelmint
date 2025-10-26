/**
 * API Validation Middleware
 * Request validation for ML API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FraudDetectionRequest } from '@/types/ml.types';
import { mlLogger } from '@/utils/logger';
import { mlConfig } from '@/config/ml.config';

// Validation schemas
const fraudDetectionRequestSchema = z.object({
  transaction_id: z.string().min(1, 'Transaction ID is required'),
  user_id: z.string().min(1, 'User ID is required'),
  transaction_data: z.object({
    amount: z.number().positive('Amount must be positive').optional(),
    currency: z.string().optional(),
    timestamp: z.string().datetime().optional(),
    wallet_address: z.string().optional(),
    recipient_address: z.string().optional(),
    hour_of_day: z.number().min(0).max(23).optional(),
    day_of_week: z.number().min(0).max(6).optional(),
    is_weekend: z.boolean().optional(),
    transaction_frequency_1h: z.number().min(0).optional(),
    transaction_frequency_24h: z.number().min(0).optional(),
    avg_transaction_amount_24h: z.number().min(0).optional(),
    amount_deviation_from_avg: z.number().optional(),
    wallet_age_days: z.number().min(0).optional(),
    wallet_transaction_count: z.number().min(0).optional(),
    is_new_wallet: z.boolean().optional(),
    is_high_risk_country: z.boolean().optional(),
    device_risk_score: z.number().min(0).max(1).optional(),
    ip_risk_score: z.number().min(0).max(1).optional(),
  }).optional(),
  user_data: z.record(z.any()).optional(),
  include_explanation: z.boolean().optional(),
});

const predictionRequestSchema = z.object({
  model_type: z.enum(['churn', 'revenue', 'quality']),
  entity_id: z.string().min(1, 'Entity ID is required'),
  entity_type: z.enum(['user', 'transaction', 'wallet', 'session']).optional(),
  features: z.record(z.any()).optional(),
  include_feature_importance: z.boolean().optional(),
});

const userBehaviorFeaturesSchema = z.object({
  account_age_days: z.number().min(0).optional(),
  verification_status: z.string().optional(),
  risk_tier: z.string().optional(),
  login_frequency_24h: z.number().min(0).optional(),
  task_completion_rate: z.number().min(0).max(1).optional(),
  average_task_time: z.number().min(0).optional(),
  total_earned: z.number().min(0).optional(),
  total_spent: z.number().min(0).optional(),
  transaction_count: z.number().min(0).optional(),
  avg_transaction_amount: z.number().min(0).optional(),
  payment_method_count: z.number().min(0).optional(),
  average_quality_score: z.number().min(0).max(1).optional(),
  rejection_rate: z.number().min(0).max(1).optional(),
  dispute_count: z.number().min(0).optional(),
  consensus_agreement_rate: z.number().min(0).max(1).optional(),
  peak_activity_hours: z.array(z.number().min(0).max(23)).optional(),
  preferred_task_types: z.array(z.string()).optional(),
  device_usage_pattern: z.record(z.number()).optional(),
  location_consistency_score: z.number().min(0).max(1).optional(),
});

const transactionFeaturesSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  wallet_address: z.string().optional(),
  recipient_address: z.string().optional(),
  hour_of_day: z.number().min(0).max(23).optional(),
  day_of_week: z.number().min(0).max(6).optional(),
  is_weekend: z.boolean().optional(),
  transaction_frequency_1h: z.number().min(0).optional(),
  transaction_frequency_24h: z.number().min(0).optional(),
  avg_transaction_amount_24h: z.number().min(0).optional(),
  amount_deviation_from_avg: z.number().optional(),
  wallet_age_days: z.number().min(0).optional(),
  wallet_transaction_count: z.number().min(0).optional(),
  wallet_total_volume: z.number().min(0).optional(),
  is_new_wallet: z.boolean().optional(),
  is_high_risk_country: z.boolean().optional(),
  device_risk_score: z.number().min(0).max(1).optional(),
  ip_risk_score: z.number().min(0).max(1).optional(),
});

const systemMetricsSchema = z.object({
  cpu_usage: z.number().min(0).max(100),
  memory_usage: z.number().min(0).max(100),
  disk_io: z.number().min(0),
  network_io: z.number().min(0),
  response_time: z.number().min(0),
  error_rate: z.number().min(0).max(1),
  throughput: z.number().min(0),
});

/**
 * Validation middleware factory
 */
function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        mlLogger.warn('Validation failed', {
          url: req.url,
          method: req.method,
          errors: validationErrors,
          body: req.body,
        });

        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: validationErrors,
          },
        });
      }

      next(error);
    }
  };
}

/**
 * Fraud detection request validation
 */
export const validateFraudDetectionRequest = createValidationMiddleware(fraudDetectionRequestSchema);

/**
 * Prediction request validation
 */
export const validatePredictionRequest = createValidationMiddleware(predictionRequestSchema);

/**
 * User behavior features validation
 */
export const validateUserBehaviorFeatures = createValidationMiddleware(userBehaviorFeaturesSchema);

/**
 * Transaction features validation
 */
export const validateTransactionFeatures = createValidationMiddleware(transactionFeaturesSchema);

/**
 * System metrics validation
 */
export const validateSystemMetrics = createValidationMiddleware(systemMetricsSchema);

/**
 * Generic request ID validation
 */
export const validateRequestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;

  if (!requestId) {
    // Generate a request ID if not provided
    req.headers['x-request-id'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  next();
};

/**
 * Rate limiting based on user ID
 */
export const validateUserRateLimit = (maxRequests: number = 100, windowMs: number = 60000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.headers['x-user-id'] as string) || req.ip || 'unknown';
    const now = Date.now();

    if (!requests.has(userId)) {
      requests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const userRequests = requests.get(userId)!;

    if (now > userRequests.resetTime) {
      // Reset the counter
      userRequests.count = 1;
      userRequests.resetTime = now + windowMs;
      return next();
    }

    if (userRequests.count >= maxRequests) {
      const resetIn = Math.ceil((userRequests.resetTime - now) / 1000);

      mlLogger.warn('Rate limit exceeded', {
        userId,
        currentCount: userRequests.count,
        maxRequests,
        resetIn,
      });

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: {
            limit: maxRequests,
            windowMs,
            resetIn,
          },
        },
      });
    }

    userRequests.count++;
    next();
  };
};

/**
 * Validate API key for authentication
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers[mlConfig.api.authentication.apiKeyHeader] as string;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'API_KEY_REQUIRED',
        message: 'API key is required',
      },
    });
  }

  // In a real implementation, validate the API key against a database
  // For now, accept any non-empty key
  if (apiKey.length < 10) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key format',
      },
    });
  }

  // Add user context to request
  (req as any).user = {
    id: 'api_user',
    apiKey,
    permissions: ['read', 'write'],
  };

  next();
};

/**
 * Content type validation
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'];

    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONTENT_TYPE_REQUIRED',
          message: 'Content-Type header is required',
        },
      });
    }

    const isAllowed = allowedTypes.some(type => contentType.includes(type));

    if (!isAllowed) {
      return res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `Content-Type ${contentType} is not supported`,
          allowed: allowedTypes,
        },
      });
    }

    next();
  };
};

/**
 * Request size validation
 */
export const validateRequestSize = (maxSizeBytes: number = 1024 * 1024) => { // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];

    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'Request size exceeds maximum allowed',
          details: {
            size: parseInt(contentLength),
            maxSize: maxSizeBytes,
          },
        },
      });
    }

    next();
  };
};

/**
 * Async error handler wrapper
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request logging middleware
 */
export const logRequest = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    mlLogger.info('API Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id,
      requestId: req.headers['x-request-id'],
    });
  });

  next();
};