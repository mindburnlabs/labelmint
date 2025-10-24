/**
 * Circuit Breaker Implementation
 * Prevents cascading failures by stopping requests to failing services
 */

import { CircuitBreakerConfig, CircuitBreakerState, CircuitBreakerMetrics, Logger } from './types';

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttempt?: Date;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly monitoringPeriod: number;
  private readonly logger?: Logger;

  constructor(config: CircuitBreakerConfig = {}, logger?: Logger) {
    this.failureThreshold = config.failureThreshold || 5;
    this.resetTimeout = config.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = config.monitoringPeriod || 10000; // 10 seconds
    this.logger = logger;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.logInfo('Circuit breaker transitioning to HALF_OPEN');
      } else {
        const error = new Error('Circuit breaker is OPEN');
        (error as any).code = 'CIRCUIT_BREAKER_OPEN';
        (error as any).retryable = false;
        throw error;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.lastSuccessTime = new Date();
    this.successCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.logInfo('Circuit breaker reset to CLOSED');
    }
  }

  private onFailure(): void {
    this.lastFailureTime = new Date();
    this.failureCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.resetTimeout);
      this.logWarn('Circuit breaker opening from HALF_OPEN');
    } else if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failureCount >= this.failureThreshold
    ) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.resetTimeout);
      this.logWarn(`Circuit breaker opening after ${this.failureCount} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? new Date() >= this.nextAttempt : false;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime
    };
  }

  forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.resetTimeout);
    this.logInfo('Circuit breaker forced OPEN');
  }

  forceClose(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = undefined;
    this.logInfo('Circuit breaker forced CLOSED');
  }

  reset(): void {
    this.forceClose();
  }

  private logInfo(message: string): void {
    if (this.logger) {
      this.logger.info(message, {
        circuitBreaker: {
          state: this.state,
          failureCount: this.failureCount,
          successCount: this.successCount
        }
      });
    }
  }

  private logWarn(message: string): void {
    if (this.logger) {
      this.logger.warn(message, {
        circuitBreaker: {
          state: this.state,
          failureCount: this.failureCount,
          successCount: this.successCount,
          lastFailureTime: this.lastFailureTime
        }
      });
    }
  }
}