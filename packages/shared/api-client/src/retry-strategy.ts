/**
 * Retry Strategy Implementation
 * Handles retry logic with exponential backoff and jitter
 */

import { RetryOptions, Logger } from './types';
import { ApiErrorHandler } from './error-handler';

export class RetryStrategy {
  private readonly options: Required<RetryOptions>;
  private readonly logger?: Logger;

  constructor(options: Partial<RetryOptions> = {}, logger?: Logger) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      baseDelay: options.baseDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      backoffFactor: options.backoffFactor ?? 2,
      retryableErrors: options.retryableErrors ?? [],
      jitter: options.jitter ?? true
    };
    this.logger = logger;
  }

  async execute<T>(operation: () => Promise<T>, context?: string): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.options.maxRetries + 1; attempt++) {
      try {
        const result = await operation();

        if (attempt > 1 && this.logger) {
          this.logger.info('Operation succeeded after retries', {
            context,
            attempt,
            totalAttempts: attempt
          });
        }

        return result;
      } catch (error) {
        lastError = error;

        // Parse error to determine if retryable
        const apiError = ApiErrorHandler.handle(error, context || 'unknown', this.logger).error;

        if (!ApiErrorHandler.isRetryable(apiError)) {
          if (this.logger) {
            this.logger.debug('Error is not retryable', {
              context,
              errorCode: apiError.code,
              attempt
            });
          }
          throw error;
        }

        // Don't retry on last attempt
        if (attempt > this.options.maxRetries) {
          break;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, apiError);

        if (this.logger) {
          this.logger.warn('Retrying operation after error', {
            context,
            attempt,
            maxRetries: this.options.maxRetries,
            errorCode: apiError.code,
            delay,
            nextAttemptIn: `${delay}ms`
          });
        }

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    if (this.logger) {
      this.logger.error('All retries exhausted', lastError, {
        context,
        maxRetries: this.options.maxRetries,
        totalAttempts: this.options.maxRetries + 1
      });
    }

    throw lastError;
  }

  private calculateDelay(attempt: number, error?: any): number {
    // Use custom delay from error if available (e.g., rate limiting)
    if (error && error.code === 'RATE_LIMIT' && error.details?.retryAfter) {
      return parseInt(error.details.retryAfter) * 1000;
    }

    // Exponential backoff: delay = baseDelay * backoffFactor^(attempt-1)
    let delay = this.options.baseDelay * Math.pow(this.options.backoffFactor, attempt - 1);

    // Cap at maxDelay
    delay = Math.min(delay, this.options.maxDelay);

    // Add jitter to prevent thundering herd
    if (this.options.jitter) {
      // Add up to ±25% random jitter
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    // Ensure minimum delay
    return Math.max(delay, 100);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry strategy for network operations
   */
  static forNetwork(logger?: Logger): RetryStrategy {
    return new RetryStrategy(
      {
        maxRetries: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
        jitter: true,
        retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNRESET', 'ETIMEDOUT']
      },
      logger
    );
  }

  /**
   * Create a retry strategy for external API calls
   */
  static forExternalApi(logger?: Logger): RetryStrategy {
    return new RetryStrategy(
      {
        maxRetries: 3,
        baseDelay: 2000,
        maxDelay: 60000,
        backoffFactor: 2.5,
        jitter: true,
        retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'SERVICE_UNAVAILABLE']
      },
      logger
    );
  }

  /**
   * Create a retry strategy for database operations
   */
  static forDatabase(logger?: Logger): RetryStrategy {
    return new RetryStrategy(
      {
        maxRetries: 2,
        baseDelay: 500,
        maxDelay: 5000,
        backoffFactor: 2,
        jitter: false,
        retryableErrors: ['CONNECTION_ERROR', 'DEADLOCK', 'TIMEOUT']
      },
      logger
    );
  }
}