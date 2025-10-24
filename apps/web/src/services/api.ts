import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          this.clearToken();
          window.location.href = '/login';
        } else if (error.response?.status === 429) {
          // Handle rate limiting
          console.error('Rate limit exceeded');
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  /**
   * Get stored auth token
   */
  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    }
    return null;
  }

  /**
   * Clear auth token
   */
  private clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format API error
   */
  private formatError(error: any): ApiError {
    if (error.response?.data) {
      return error.response.data;
    }

    if (error.code === 'NETWORK_ERROR') {
      return {
        error: 'Network Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        error: 'Timeout Error',
        message: 'The request took too long to complete. Please try again.',
      };
    }

    return {
      error: 'Unknown Error',
      message: 'An unexpected error occurred.',
    };
  }

  /**
   * Generic GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await this.client.get<T>(url, config);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generic POST request
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    try {
      return await this.client.post<T>(url, data, config);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generic PUT request
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    try {
      return await this.client.put<T>(url, data, config);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generic PATCH request
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    try {
      return await this.client.patch<T>(url, data, config);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generic DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await this.client.delete<T>(url, config);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload file
   */
  async upload<T = any>(
    url: string,
    file: File,
    onProgress?: (progress: number) => void,
    additionalData?: Record<string, any>
  ): Promise<AxiosResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
    }

    try {
      return await this.client.post<T>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Download file
   */
  async download(url: string, filename?: string): Promise<void> {
    try {
      const response = await this.client.get(url, {
        responseType: 'blob',
      });

      // Create download link
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel request
   */
  createCancelToken() {
    return axios.CancelToken.source();
  }

  /**
   * Check if error is a cancellation
   */
  isCancel(error: any): boolean {
    return axios.isCancel(error);
  }

  /**
   * Set auth token for future requests
   */
  setAuthToken(token: string, rememberMe: boolean = false): void {
    if (typeof window !== 'undefined') {
      if (rememberMe) {
        localStorage.setItem('authToken', token);
      } else {
        sessionStorage.setItem('authToken', token);
      }
    }
  }

  /**
   * Remove auth token
   */
  removeAuthToken(): void {
    this.clearToken();
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(
    onFulfilled?: (config: AxiosRequestConfig) => AxiosRequestConfig,
    onRejected?: (error: any) => any
  ): number {
    return this.client.interceptors.request.use(onFulfilled, onRejected);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(
    onFulfilled?: (response: AxiosResponse) => AxiosResponse,
    onRejected?: (error: any) => any
  ): number {
    return this.client.interceptors.response.use(onFulfilled, onRejected);
  }

  /**
   * Remove interceptor
   */
  removeInterceptor(interceptorId: number): void {
    this.client.interceptors.request.eject(interceptorId);
    this.client.interceptors.response.eject(interceptorId);
  }
}

export const apiClient = new ApiClient();

export default apiClient;