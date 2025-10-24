import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { telegramService } from './telegram';
import type { ApiResponse, LabelingTask, UserResponse } from 'shared';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth
    this.client.interceptors.request.use(
      (config) => {
        const initData = telegramService.getInitData();
        if (initData) {
          config.headers['X-Telegram-Init-Data'] = new URLSearchParams({
            ...initData,
            user: JSON.stringify(initData.user),
          }).toString();
        }
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
        console.error('API Error:', error);
        if (error.response?.status === 401) {
          // Unauthorized - redirect to login or show error
          telegramService.showAlert('Authentication required. Please open this app from Telegram.');
        }
        return Promise.reject(error);
      }
    );
  }

  // User related endpoints
  async getUserProfile() {
    const response = await this.client.get<ApiResponse<{ user: any; balance: number }>>('/user/profile');
    return response.data;
  }

  async getUserStats() {
    const response = await this.client.get<ApiResponse<{ totalEarnings: number; tasksCompleted: number; accuracy: number }>>('/user/stats');
    return response.data;
  }

  // Task related endpoints
  async getNextTask() {
    const response = await this.client.get<ApiResponse<{ task: LabelingTask }>>('/tasks/next');
    return response.data;
  }

  async submitTaskResponse(taskId: string, answer: string, timeSpent: number) {
    const response = await this.client.post<ApiResponse<{ response: UserResponse; earned: number }>>('/tasks/response', {
      taskId,
      answer,
      timeSpent,
    });
    return response.data;
  }

  async skipTask(taskId: string, reason?: string) {
    const response = await this.client.post<ApiResponse>('/tasks/skip', {
      taskId,
      reason,
    });
    return response.data;
  }

  async getTaskHistory(page: number = 1, limit: number = 20) {
    const response = await this.client.get<ApiResponse<{ responses: UserResponse[]; total: number; page: number }>>(
      `/tasks/history?page=${page}&limit=${limit}`
    );
    return response.data;
  }

  // Earnings related endpoints
  async getEarnings() {
    const response = await this.client.get<ApiResponse<{ balance: number; totalEarned: number; todayEarned: number }>>('/earnings');
    return response.data;
  }

  async getEarningsHistory(page: number = 1, limit: number = 20) {
    const response = await this.client.get<ApiResponse<{ transactions: any[]; total: number; page: number }>>(
      `/earnings/history?page=${page}&limit=${limit}`
    );
    return response.data;
  }

  // Leaderboard
  async getLeaderboard(period: 'daily' | 'weekly' | 'monthly' | 'all' = 'daily') {
    const response = await this.client.get<ApiResponse<{ leaders: any[]; userRank: number }>>(
      `/leaderboard?period=${period}`
    );
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;