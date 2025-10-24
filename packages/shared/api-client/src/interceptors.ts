/**
 * Request/Response Interceptors
 * Provides middleware-like functionality for API requests
 */

import { Interceptor, RequestConfig, ApiResponse, Logger } from './types';

export class InterceptorManager {
  private readonly interceptors: Interceptor[] = [];

  add(interceptor: Interceptor): void {
    this.interceptors.push(interceptor);
  }

  remove(interceptor: Interceptor): void {
    const index = this.interceptors.indexOf(interceptor);
    if (index > -1) {
      this.interceptors.splice(index, 1);
    }
  }

  async onRequest(config: RequestConfig): Promise<RequestConfig> {
    let processedConfig = config;

    for (const interceptor of this.interceptors) {
      if (interceptor.onRequest) {
        processedConfig = await interceptor.onRequest(processedConfig);
      }
    }

    return processedConfig;
  }

  async onResponse<T>(response: ApiResponse<T>): Promise<ApiResponse<T>> {
    let processedResponse = response;

    for (const interceptor of this.interceptors) {
      if (interceptor.onResponse) {
        processedResponse = await interceptor.onResponse(processedResponse);
      }
    }

    return processedResponse;
  }

  async onError(error: any): Promise<any> {
    let processedError = error;

    for (const interceptor of this.interceptors) {
      if (interceptor.onError) {
        processedError = await interceptor.onError(processedError);
      }
    }

    return processedError;
  }
}

/**
 * Common built-in interceptors
 */

export class AuthInterceptor implements Interceptor {
  constructor(private apiKey: string, private scheme: string = 'Bearer') {}

  onRequest(config: RequestConfig): RequestConfig {
    return {
      ...config,
      headers: {
        ...config.headers,
        Authorization: `${this.scheme} ${this.apiKey}`
      }
    };
  }
}

export class CorrelationIdInterceptor implements Interceptor {
  private static correlationId = 0;

  onRequest(config: RequestConfig): RequestConfig {
    const id = ++CorrelationIdInterceptor.correlationId;
    const correlationId = `cid_${Date.now()}_${id}`;

    return {
      ...config,
      headers: {
        ...config.headers,
        'X-Correlation-ID': correlationId
      },
      // Store correlation ID for later use
      metadata: { ...config.metadata, correlationId }
    };
  }
}

export class RequestLoggingInterceptor implements Interceptor {
  constructor(private logger: Logger) {}

  onRequest(config: RequestConfig): RequestConfig {
    this.logger.debug('API Request', {
      method: config.method,
      url: config.url,
      headers: this.sanitizeHeaders(config.headers),
      hasBody: !!config.body,
      correlationId: config.metadata?.correlationId
    });

    return config;
  }

  onResponse<T>(response: ApiResponse<T>): ApiResponse<T> {
    this.logger.debug('API Response', {
      success: response.success,
      hasData: !!response.data,
      errorCode: response.error?.code,
      requestId: response.metadata?.requestId,
      duration: response.metadata?.duration,
      correlationId: response.metadata?.correlationId
    });

    return response;
  }

  onError(error: any): void {
    this.logger.error('API Request Error', error, {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    });
  }

  private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
    if (!headers) return undefined;

    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '***';
      }
    }

    return sanitized;
  }
}

export class TimeoutInterceptor implements Interceptor {
  constructor(private defaultTimeout: number = 30000) {}

  onRequest(config: RequestConfig): RequestConfig {
    const timeout = config.timeout || this.defaultTimeout;

    return {
      ...config,
      timeout,
      signal: config.signal || AbortSignal.timeout(timeout)
    };
  }
}

export class ContentTypeInterceptor implements Interceptor {
  onRequest(config: RequestConfig): RequestConfig {
    // Skip if content-type is already set
    if (config.headers?.['Content-Type']) {
      return config;
    }

    // Set content-type based on body
    let contentType = 'application/json';
    if (config.body) {
      if (config.body instanceof FormData) {
        contentType = 'multipart/form-data';
      } else if (config.body instanceof URLSearchParams) {
        contentType = 'application/x-www-form-urlencoded';
      } else if (typeof config.body === 'string') {
        contentType = 'text/plain';
      }
    }

    return {
      ...config,
      headers: {
        ...config.headers,
        'Content-Type': contentType
      }
    };
  }
}

export class RateLimitInterceptor implements Interceptor {
  private requestCount = 0;
  private lastReset = Date.now();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async onRequest(config: RequestConfig): Promise<RequestConfig> {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - this.lastReset > this.windowMs) {
      this.requestCount = 0;
      this.lastReset = now;
    }

    // Check rate limit
    if (this.requestCount >= this.maxRequests) {
      const error = new Error('Rate limit exceeded');
      (error as any).code = 'RATE_LIMIT';
      (error as any).statusCode = 429;
      (error as any).retryable = true;
      (error as any).details = { retryAfter: Math.ceil(this.windowMs / 1000) };
      throw error;
    }

    this.requestCount++;

    return config;
  }
}