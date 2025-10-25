// ============================================================================
// API CLIENT
// ============================================================================

import type { ApiResponse, ApiError } from '../types/api';
import { AppError, createError } from '../utils/error';

export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  headers: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'api_key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
  };
  interceptors?: {
    request?: (config: any) => any;
    response?: (response: any) => any;
    error?: (error: any) => any;
  };
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

/**
 * HTTP API Client
 */
export class ApiClient {
  private config: ApiClientConfig;
  private defaultHeaders: Record<string, string>;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseURL: '',
      timeout: 10000,
      retries: 3,
      retryDelay: 1000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      ...config
    };

    this.defaultHeaders = {
      ...this.config.headers,
      ...(this.config.auth && this.getAuthHeaders())
    };
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const { auth } = this.config;
    if (!auth) return {};

    switch (auth.type) {
      case 'bearer':
        return auth.token ? { Authorization: `Bearer ${auth.token}` } : {};
      case 'basic':
        return auth.username && auth.password
          ? { Authorization: `Basic ${btoa(`${auth.username}:${auth.password}`)}` }
          : {};
      case 'api_key':
        return auth.apiKey ? { 'X-API-Key': auth.apiKey } : {};
      default:
        return {};
    }
  }

  /**
   * Build URL with parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint, this.config.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      params,
      data,
      timeout = this.config.timeout,
      retries = this.config.retries,
      signal
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const url = this.buildUrl(endpoint, params);
        const requestHeaders = {
          ...this.defaultHeaders,
          ...headers,
          ...(this.config.auth && this.getAuthHeaders())
        };

        // Apply request interceptor
        const requestConfig = {
          method,
          headers: requestHeaders,
          body: data ? JSON.stringify(data) : undefined,
          signal
        };

        const finalConfig = this.config.interceptors?.request
          ? this.config.interceptors.request(requestConfig)
          : requestConfig;

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Combine signals
        if (signal) {
          signal.addEventListener('abort', () => controller.abort());
        }

        const response = await fetch(url, {
          ...finalConfig,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error: ApiError = {
            code: (errorData as any)?.code || `HTTP_${response.status}`,
            message: (errorData as any)?.message || `HTTP ${response.status}: ${response.statusText}`,
            details: (errorData as any)?.details,
            timestamp: new Date(),
            stack: new Error().stack
          };
          throw createError(error.message);
        }

        let responseData: any;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else if (contentType?.includes('text/')) {
          responseData = await response.text();
        } else {
          responseData = await response.blob();
        }

        const apiResponse: ApiResponse<T> = {
          success: true,
          data: responseData,
          meta: {
            timestamp: new Date(),
            requestId: crypto.randomUUID?.() || Math.random().toString(36)
          }
        };

        // Apply response interceptor
        return this.config.interceptors?.response
          ? this.config.interceptors.response(apiResponse)
          : apiResponse;

      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          break;
        }

        // Don't retry on 4xx errors (except 429)
        if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          break;
        }

        // If this is the last attempt, break
        if (attempt === retries) {
          break;
        }

        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, attempt)));
      }
    }

    // Apply error interceptor
    const finalError = this.config.interceptors?.error
      ? this.config.interceptors.error(lastError)
      : lastError;

    throw finalError || new Error('Request failed');
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method' | 'data'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'POST', data });
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method' | 'data'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'PUT', data });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method' | 'data'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'PATCH', data });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Upload file
   */
  async upload<T = any>(endpoint: string, file: File, options: {
    method?: string;
    headers?: Record<string, string>;
    params?: Record<string, any>;
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  } = {}): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new (globalThis.XMLHttpRequest || ({} as any))();

    return new Promise((resolve, reject) => {
      // Handle progress
      if (options.onProgress) {
        xhr.upload.addEventListener('progress', (event: ProgressEvent) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            options.onProgress!(progress);
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({
              success: true,
              data,
              meta: {
                timestamp: new Date(),
                requestId: crypto.randomUUID?.() || Math.random().toString(36)
              }
            });
          } catch {
            resolve({
              success: true,
              data: xhr.responseText,
              meta: {
                timestamp: new Date(),
                requestId: crypto.randomUUID?.() || Math.random().toString(36)
              }
            });
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'));
      });

      // Configure and send request
      const url = this.buildUrl(endpoint, options.params);
      xhr.open(options.method || 'POST', url);

      // Set headers
      const headers = {
        ...this.defaultHeaders,
        ...options.headers,
        ...(this.config.auth && this.getAuthHeaders())
      };

      // Remove Content-Type header for FormData (browser will set it with boundary)
      delete headers['Content-Type'];

      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Set abort signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          xhr.abort();
        });
      }

      xhr.send(formData);
    });
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.config.auth = {
      type: 'bearer',
      token
    };
    this.defaultHeaders = {
      ...this.defaultHeaders,
      Authorization: `Bearer ${token}`
    };
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.config.auth = {
      type: 'api_key',
      apiKey
    };
    this.defaultHeaders = {
      ...this.defaultHeaders,
      'X-API-Key': apiKey
    };
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.config.auth = undefined as any;
    delete this.defaultHeaders.Authorization;
    delete this.defaultHeaders['X-API-Key'];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.headers) {
      this.defaultHeaders = { ...this.defaultHeaders, ...config.headers };
    }
    if (config.auth) {
      this.defaultHeaders = {
        ...this.defaultHeaders,
        ...(config.auth && this.getAuthHeaders())
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ApiClientConfig {
    return { ...this.config };
  }
}

/**
 * Create API client
 */
export function createApiClient(config: Partial<ApiClientConfig> = {}): ApiClient {
  return new ApiClient(config);
}

/**
 * Default API client instance
 */
export const apiClient = createApiClient();

export default apiClient;