import axios, { AxiosInstance, AxiosError } from 'axios';

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  getAuthToken?: () => string | null;
  onUnauthorized?: () => void;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

export interface TaskResponse {
  success: boolean;
  task: {
    id: string;
    project_id: number;
    title?: string;
    description?: string;
    type: string;
    sub_type?: string;
    data: any;
    options?: string[];
    categories?: string[];
    points: number;
    time_limit_seconds?: number;
    config?: Record<string, any>;
    mediaUrl?: string;
    mediaType?: string;
    reserved_until?: string;
  };
}

export interface SubmitTaskResponse {
  success: boolean;
  isHoneypot?: boolean;
  isCorrect?: boolean;
  pointsEarned: number;
  newBalance: number;
  message?: string;
  stats?: {
    tasksCompleted: number;
    totalEarned: number;
    trustScore: number;
  };
}

export interface SkipTaskResponse {
  success: boolean;
  message: string;
}

export interface UserProfile {
  id: number;
  telegram_id?: number;
  username?: string;
  balance: number;
  tasks_completed: number;
  total_earned: number;
  trust_score: number;
  created_at: string;
}

export class ApiService {
  private client: AxiosInstance;
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (requestConfig) => {
        const token = config.getAuthToken?.();
        if (token) {
          requestConfig.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        requestConfig.headers['X-Request-ID'] = this.generateRequestId();
        return requestConfig;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - trigger callback
          config.onUnauthorized?.();
        } else if (error.response?.status === 429) {
          // Handle rate limiting
          console.error('Rate limit exceeded');
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatError(error: AxiosError<ApiError>): Error {
    if (error.response?.data) {
      const apiError = error.response.data;
      return new Error(apiError.message || apiError.error || 'API request failed');
    }
    return new Error(error.message || 'Network error');
  }

  /**
   * Task Management
   */
  async getNextTask(): Promise<TaskResponse> {
    const response = await this.client.get<TaskResponse>('/api/tasks/next');
    return response.data;
  }

  async submitTask(taskId: string, answer: any, timeSpent: number): Promise<SubmitTaskResponse> {
    const response = await this.client.post<SubmitTaskResponse>(`/api/tasks/${taskId}/label`, {
      answer,
      time_spent: timeSpent,
    });
    return response.data;
  }

  async skipTask(taskId: string): Promise<SkipTaskResponse> {
    const response = await this.client.post<SkipTaskResponse>(`/api/tasks/${taskId}/skip`);
    return response.data;
  }

  /**
   * User Management
   */
  async getUserProfile(): Promise<UserProfile> {
    const response = await this.client.get<UserProfile>('/api/users/profile');
    return response.data;
  }

  async updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const response = await this.client.patch<UserProfile>('/api/users/profile', updates);
    return response.data;
  }

  /**
   * Statistics
   */
  async getUserStats(): Promise<any> {
    const response = await this.client.get('/api/users/stats');
    return response.data;
  }

  async getLeaderboard(limit: number = 10): Promise<any> {
    const response = await this.client.get('/api/leaderboard', {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Payment related
   */
  async initiateWithdrawal(amount: number, walletAddress: string): Promise<any> {
    const response = await this.client.post('/api/payments/withdraw', {
      amount,
      wallet_address: walletAddress,
    });
    return response.data;
  }

  async getTransactionHistory(limit: number = 20): Promise<any> {
    const response = await this.client.get('/api/payments/history', {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Project related
   */
  async getProjects(params?: { status?: string; limit?: number }): Promise<any> {
    const response = await this.client.get('/api/projects', { params });
    return response.data;
  }

  async getProjectById(projectId: number): Promise<any> {
    const response = await this.client.get(`/api/projects/${projectId}`);
    return response.data;
  }
}

/**
 * Default export for convenience
 * Note: Must be initialized with config before use
 */
let defaultApiService: ApiService | null = null;

export function initializeApiService(config: ApiConfig): ApiService {
  defaultApiService = new ApiService(config);
  return defaultApiService;
}

export function getApiService(): ApiService {
  if (!defaultApiService) {
    throw new Error('ApiService not initialized. Call initializeApiService first.');
  }
  return defaultApiService;
}

export default ApiService;

