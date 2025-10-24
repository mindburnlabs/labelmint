/**
 * Main API Client Implementation
 * Provides a robust HTTP client with error handling, retries, and circuit breakers
 */

import {
  ApiClientConfig,
  ApiResponse,
  RequestConfig,
  Logger,
  HealthCheckResult,
  CacheConfig
} from './types';
import { ApiErrorHandler } from './error-handler';
import { CircuitBreaker } from './circuit-breaker';
import { RetryStrategy } from './retry-strategy';
import { createLogger } from './logger';
import { InterceptorManager, AuthInterceptor, CorrelationIdInterceptor } from './interceptors';
import { AuthAdapter, JWTAuthAdapter, TelegramAuthAdapter, BotAuthAdapter } from './auth';
import { AuthType } from './auth/types';

export class ApiClient {
  private readonly config: Required<ApiClientConfig>;
  private readonly logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryStrategy: RetryStrategy;
  private readonly interceptors: InterceptorManager;
  private readonly cache: Map<string, { data: any; expires: Date }>;
  private readonly authAdapter?: AuthAdapter;

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      headers: {},
      logger: createLogger('api-client'),
      circuitBreaker: {},
      ...config
    };

    this.logger = this.config.logger!;
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker, this.logger);
    this.retryStrategy = new RetryStrategy(
      {
        maxRetries: this.config.retries,
        baseDelay: this.config.retryDelay
      },
      this.logger
    );
    this.interceptors = new InterceptorManager();
    this.cache = new Map();

    // Initialize auth adapter if auth config is provided
    this.authAdapter = this.createAuthAdapter(config.auth);

    // Add default interceptors
    this.interceptors.add(new CorrelationIdInterceptor());
    if (this.config.apiKey) {
      this.interceptors.add(new AuthInterceptor(this.config.apiKey));
    }
  }

  private createAuthAdapter(authConfig?: any): AuthAdapter | undefined {
    if (!authConfig) return undefined;

    switch (authConfig.type) {
      case AuthType.JWT:
        return new JWTAuthAdapter(authConfig);
      case AuthType.TELEGRAM:
        return new TelegramAuthAdapter(authConfig);
      case AuthType.BOT_TOKEN:
        return new BotAuthAdapter(authConfig);
      case AuthType.API_KEY:
        // API key auth is handled by existing AuthInterceptor
        return undefined;
      case AuthType.NONE:
      default:
        return undefined;
    }
  }

  async get<T = any>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'GET', url, ...config });
  }

  async post<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'POST', url, body: data, ...config });
  }

  async put<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PUT', url, body: data, ...config });
  }

  async patch<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PATCH', url, body: data, ...config });
  }

  async delete<T = any>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  private async request<T = any>(requestConfig: RequestConfig): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    let attempt = 0;

    try {
      const result = await this.retryStrategy.execute(async () => {
        attempt++;
        return this.circuitBreaker.execute(async () => {
          return this.executeRequest<T>(requestConfig, attempt);
        });
      });

      return result;
    } catch (error) {
      // Handle authentication errors with retry logic
      if (this.authAdapter && attempt === 1) {
        const apiError = error as any;
        const shouldRetry = await this.authAdapter.handleAuthError(apiError);

        if (shouldRetry) {
          // Retry the request once after auth handling
          return this.executeRequest<T>(requestConfig, attempt + 1);
        }
      }

      return ApiErrorHandler.handle(error, `${requestConfig.method} ${requestConfig.url}`, this.logger);
    }
  }

  private async executeRequest<T>(requestConfig: RequestConfig, attempt: number): Promise<ApiResponse<T>> {
    // Apply authentication first
    let config = requestConfig;
    if (this.authAdapter) {
      config = await this.authAdapter.authenticate(config);
    }

    // Apply request interceptors
    config = await this.interceptors.onRequest(config);

    // Build full URL
    const url = this.buildUrl(config.url);

    // Prepare fetch options
    const options: RequestInit = {
      method: config.method,
      headers: {
        ...this.config.headers,
        ...config.headers
      },
      signal: config.signal
    };

    // Add body if present
    if (config.body) {
      if (config.body instanceof FormData || config.body instanceof URLSearchParams) {
        options.body = config.body;
      } else {
        options.headers = {
          ...options.headers,
          'Content-Type': 'application/json'
        };
        options.body = JSON.stringify(config.body);
      }
    }

    // Check cache for GET requests
    if (config.method === 'GET') {
      const cached = this.getCached<T>(url);
      if (cached) {
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            fromCache: true,
            attempts: attempt
          }
        };
      }
    }

    // Execute request
    const response = await fetch(url, options);
    const duration = Date.now() - (this.config.metadata?.startTime || Date.now());

    // Parse response
    let data: T | undefined;
    let error: any;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else if (response.status !== 204) {
        data = (await response.text()) as unknown as T;
      }
    } catch (parseError) {
      error = parseError;
    }

    // Handle error responses
    if (!response.ok || error) {
      const apiError = {
        code: `HTTP_${response.status}`,
        message: data?.message || response.statusText || 'Request failed',
        statusCode: response.status,
        details: data,
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        }
      };

      throw apiError;
    }

    // Build success response
    const result: ApiResponse<T> = {
      success: true,
      data,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date(),
        duration,
        attempts: attempt,
        correlationId: config.metadata?.correlationId
      }
    };

    // Cache GET requests
    if (config.method === 'GET' && data) {
      this.setCached(url, result);
    }

    // Apply response interceptors
    return this.interceptors.onResponse(result);
  }

  private buildUrl(url: string): string {
    // Skip if URL is already absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    const baseURL = this.config.baseURL.replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;

    return `${baseURL}${path}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cache methods
  private getCached<T>(key: string): ApiResponse<T> | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (new Date() > cached.expires) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCached<T>(key: string, data: ApiResponse<T>, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      expires: new Date(Date.now() + ttl)
    });

    // Clean up expired entries
    this.cleanCache();
  }

  private cleanCache(): void {
    const now = new Date();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expires) {
        this.cache.delete(key);
      }
    }
  }

  // Public methods for advanced usage

  /**
   * Add a custom interceptor
   */
  addInterceptor(interceptor: import('./types').Interceptor): void {
    this.interceptors.add(interceptor);
  }

  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Force open circuit breaker
   */
  openCircuitBreaker(): void {
    this.circuitBreaker.forceOpen();
  }

  /**
   * Force close circuit breaker
   */
  closeCircuitBreaker(): void {
    this.circuitBreaker.forceClose();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Health check for the API service
   */
  async healthCheck(path: string = '/health'): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await this.get(path, {
        timeout: 5000,
        retries: 1
      });

      return {
        healthy: response.success,
        latency: Date.now() - startTime,
        timestamp: new Date(),
        error: response.error?.message
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        timestamp: new Date(),
        error: error.message || 'Health check failed'
      };
    }
  }
}

/**
 * Factory function to create API clients with sensible defaults
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

/**
 * Create a client for external APIs (Stripe, Claude, etc.)
 */
export function createExternalApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient({
    ...config,
    retries: 3,
    retryDelay: 2000,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000
    }
  });
}

/**
 * Create a client for internal microservices
 */
export function createInternalApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient({
    ...config,
    retries: 2,
    retryDelay: 500,
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 30000,
      monitoringPeriod: 5000
    }
  });
}