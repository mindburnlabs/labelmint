import axios, { AxiosInstance } from 'axios';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

interface User {
  id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: 'CLIENT' | 'WORKER' | 'ADMIN';
  isVerified: boolean;
  createdAt: string;
}

interface CreateUserData {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: 'CLIENT' | 'WORKER' | 'ADMIN';
}

interface WorkerStats {
  earnings: number;
  completedTasks: number;
  accuracy: number;
  streak: number;
  trustScore: number;
  avgTimePerTask: number;
}

interface WithdrawalRequest {
  amount: number;
  method: 'TON_INTERNAL' | 'TON_EXTERNAL' | 'FIAT';
  address?: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  createdAt: string;
}

class ApiService {
  private apiClient: AxiosInstance;
  private paymentClient: AxiosInstance;

  constructor() {
    // Labeling API client
    this.apiClient = axios.create({
      baseURL: config.LABELING_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Payment API client
    this.paymentClient = axios.create({
      baseURL: config.PAYMENT_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.apiClient.interceptors.request.use(
      (config) => {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // User methods
  async getUserByTelegramId(telegramId: number): Promise<User> {
    const response = await this.apiClient.get(`/api/users/telegram/${telegramId}`);
    return response.data;
  }

  async createUser(data: CreateUserData): Promise<User> {
    const response = await this.apiClient.post('/api/users', data);
    return response.data;
  }

  async updateUserRole(userId: string, role: 'ADMIN'): Promise<User> {
    const response = await this.apiClient.patch(`/api/users/${userId}`, { role });
    return response.data;
  }

  // Worker stats methods
  async getWorkerStats(userId: string): Promise<WorkerStats> {
    const response = await this.apiClient.get(`/api/workers/${userId}/stats`);
    return response.data;
  }

  async getDetailedWorkerStats(userId: string): Promise<WorkerStats & { position: number }> {
    const response = await this.apiClient.get(`/api/workers/${userId}/stats/detailed`);
    return response.data;
  }

  async getWeeklyStats(userId: string): Promise<{ tasksCompleted: number; earnings: number; avgTimePerTask: number }> {
    const response = await this.apiClient.get(`/api/workers/${userId}/stats/weekly`);
    return response.data;
  }

  async getWorkerAchievements(userId: string): Promise<Array<{ id: string; name: string; icon: string; description: string }>> {
    const response = await this.apiClient.get(`/api/workers/${userId}/achievements`);
    return response.data;
  }

  // Balance and earnings
  async getUserBalance(userId: string): Promise<number> {
    const response = await this.paymentClient.get(`/api/balance/${userId}`);
    return response.data.balance;
  }

  async getTodayEarnings(userId: string): Promise<number> {
    const response = await this.apiClient.get(`/api/workers/${userId}/earnings/today`);
    return response.data.earnings;
  }

  async getPendingWithdrawals(userId: string): Promise<number> {
    const response = await this.paymentClient.get(`/api/withdrawals/pending/${userId}`);
    return response.data.total || 0;
  }

  async getLastWithdrawal(userId: string): Promise<string | null> {
    const response = await this.paymentClient.get(`/api/withdrawals/last/${userId}`);
    return response.data.createdAt || null;
  }

  // Withdrawals
  async createWithdrawal(userId: string, data: WithdrawalRequest): Promise<Withdrawal> {
    const response = await this.paymentClient.post('/api/withdrawals', {
      userId,
      ...data,
    });
    return response.data;
  }

  async getUserWithdrawals(userId: string): Promise<Withdrawal[]> {
    const response = await this.paymentClient.get(`/api/withdrawals/${userId}`);
    return response.data.withdrawals;
  }

  // Task methods
  async getActiveTask(userId: string): Promise<any> {
    const response = await this.apiClient.get(`/api/tasks/active/${userId}`);
    return response.data;
  }

  async reserveTask(userId: string): Promise<any> {
    const response = await this.apiClient.post(`/api/tasks/reserve`, { userId });
    return response.data;
  }

  async submitTaskAnswer(taskId: string, userId: string, answer: any): Promise<void> {
    await this.apiClient.post(`/api/tasks/${taskId}/submit`, {
      userId,
      answer,
      timestamp: new Date().toISOString(),
    });
  }

  async skipTask(taskId: string, userId: string): Promise<void> {
    await this.apiClient.post(`/api/tasks/${taskId}/skip`, { userId });
  }
}

export const apiService = new ApiService();