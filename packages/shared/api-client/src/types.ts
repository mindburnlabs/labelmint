/**
 * Shared API Client Types
 * Defines common interfaces and types used across all API clients
 */

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  apiKey?: string;
  retries?: number;
  retryDelay?: number;
  circuitBreaker?: CircuitBreakerConfig;
  headers?: Record<string, string>;
  logger?: Logger;
  auth?: any; // AuthConfig from auth/types
}

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode?: number;
  retryable?: boolean;
}

export interface ResponseMetadata {
  requestId: string;
  timestamp: Date;
  duration: number;
  attempts: number;
  fromCache?: boolean;
}

export interface RequestConfig {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: any, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: string[];
  jitter?: boolean;
}

export interface Interceptor {
  onRequest?(config: RequestConfig): RequestConfig | Promise<RequestConfig>;
  onResponse?<T>(response: ApiResponse<T>): ApiResponse<T> | Promise<ApiResponse<T>>;
  onError?(error: any): any | Promise<any>;
}

export interface CacheConfig {
  enabled: boolean;
  ttl?: number; // Time to live in milliseconds
  maxSize?: number;
  keyGenerator?: (config: RequestConfig) => string;
}

export interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  timestamp: Date;
  error?: string;
}