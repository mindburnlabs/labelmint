/**
 * API Error Handler
 * Provides centralized error handling with categorization and structured responses
 */

import { ApiError, ApiResponse, Logger } from './types';

export class ApiErrorHandler {
  private static readonly DEFAULT_ERROR: ApiError = {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    retryable: false
  };

  private static readonly RETRYABLE_ERRORS = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENOTFOUND',
    'NETWORK_ERROR',
    'TIMEOUT',
    'RATE_LIMIT'
  ];

  private static readonly RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

  static handle(error: any, context: string, logger?: Logger): ApiResponse<never> {
    const apiError = this.parseError(error);

    if (logger) {
      this.logError(logger, apiError, error, context);
    }

    return {
      success: false,
      error: apiError,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date(),
        duration: 0,
        attempts: 1
      }
    };
  }

  private static parseError(error: any): ApiError {
    // Network errors
    if (error.code && this.RETRYABLE_ERRORS.includes(error.code)) {
      return {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network connection failed',
        statusCode: 503,
        retryable: true,
        details: { originalCode: error.code }
      };
    }

    // HTTP Response errors
    if (error.response) {
      const statusCode = error.response.status;
      const message = error.response.data?.message || error.message || 'Request failed';

      return {
        code: this.getErrorCode(statusCode),
        message,
        statusCode,
        retryable: this.RETRYABLE_STATUS_CODES.includes(statusCode),
        details: {
          statusCode,
          response: error.response.data
        }
      };
    }

    // Timeout errors
    if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
      return {
        code: 'TIMEOUT',
        message: 'Request timed out',
        statusCode: 408,
        retryable: true
      };
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.code === 'VALIDATION_ERROR') {
      return {
        code: 'VALIDATION_ERROR',
        message: error.message || 'Invalid request data',
        statusCode: 400,
        retryable: false,
        details: { validationErrors: error.details }
      };
    }

    // Authentication errors
    if (error.statusCode === 401 || error.code === 'UNAUTHORIZED') {
      return {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
        retryable: false
      };
    }

    // Rate limiting
    if (error.statusCode === 429 || error.code === 'RATE_LIMIT') {
      return {
        code: 'RATE_LIMIT',
        message: 'Too many requests',
        statusCode: 429,
        retryable: true,
        details: { retryAfter: error.headers?.['retry-after'] }
      };
    }

    // Default error
    return {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      retryable: false,
      details: { originalError: error.toString() }
    };
  }

  private static getErrorCode(statusCode: number): string {
    switch (statusCode) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 405: return 'METHOD_NOT_ALLOWED';
      case 408: return 'TIMEOUT';
      case 409: return 'CONFLICT';
      case 422: return 'UNPROCESSABLE_ENTITY';
      case 429: return 'RATE_LIMIT';
      case 500: return 'INTERNAL_SERVER_ERROR';
      case 502: return 'BAD_GATEWAY';
      case 503: return 'SERVICE_UNAVAILABLE';
      case 504: return 'GATEWAY_TIMEOUT';
      default: return 'HTTP_ERROR';
    }
  }

  private static logError(
    logger: Logger,
    apiError: ApiError,
    originalError: any,
    context: string
  ): void {
    const logData = {
      context,
      error: apiError,
      originalError: originalError.stack || originalError.toString(),
      timestamp: new Date().toISOString()
    };

    if (apiError.statusCode && apiError.statusCode >= 500) {
      logger.error('Server API Error', originalError, logData);
    } else if (apiError.statusCode && apiError.statusCode >= 400) {
      logger.warn('Client API Error', logData);
    } else {
      logger.error('Unknown API Error', originalError, logData);
    }
  }

  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if an error is retryable
   */
  static isRetryable(error: ApiError): boolean {
    return Boolean(error.retryable);
  }

  /**
   * Get retry delay for specific error types
   */
  static getRetryDelay(error: ApiError, attempt: number): number {
    // Rate limiting - use retry-after header if available
    if (error.code === 'RATE_LIMIT' && error.details?.retryAfter) {
      return parseInt(error.details.retryAfter) * 1000;
    }

    // Exponential backoff for other retryable errors
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }
}