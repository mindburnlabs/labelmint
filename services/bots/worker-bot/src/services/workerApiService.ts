import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface Worker {
  id: string;
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  email?: string;
  is_verified: boolean;
  balance: number;
  total_earned: number;
  rank?: string;
  rating?: number;
  stats: {
    total_completed: number;
    avg_accuracy: number;
    avg_time_per_task: number;
    streak_days: number;
  };
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'text';
  categories: string[];
  payment: number;
  time_limit?: number;
  difficulty: number;
  estimated_time?: number;
  instructions?: string;
  data?: any;
  is_urgent: boolean;
  high_payment: boolean;
  project_id: string;
  requester_id: string;
  status: 'available' | 'accepted' | 'in_progress' | 'completed' | 'approved' | 'rejected';
  created_at: string;
}

export interface Earnings {
  total_earned: number;
  pending_withdrawals: number;
  daily: Record<string, number>;
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  bonuses: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  is_unlocked: boolean;
  progress?: number;
  reward?: number;
  unlocked_at?: string;
}

export interface LeaderboardEntry {
  telegram_id: number;
  first_name: string;
  username?: string;
  total_earned: number;
  tasks_completed: number;
  avg_time?: number;
  accuracy?: number;
  rank?: number;
}

export class WorkerApiService {
  private client: AxiosInstance;
  private baseURL = process.env.LABELING_API_URL || 'http://localhost:3001';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LabelMint-WorkerBot/1.0'
      }
    });

    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Worker API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Worker API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Worker API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Worker API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Worker management
  async getWorker(telegramId: number): Promise<Worker | null> {
    try {
      const response = await this.client.get<ApiResponse<Worker>>('/api/workers/telegram', {
        params: { telegram_id: telegramId }
      });
      return response.data.success ? response.data.data || null : null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error('Error fetching worker:', error);
      throw error;
    }
  }

  async createWorker(workerData: Partial<Worker>): Promise<Worker> {
    try {
      const response = await this.client.post<ApiResponse<Worker>>('/api/workers', workerData);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to create worker');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error creating worker:', error);
      throw error;
    }
  }

  async updateWorker(workerId: string, updateData: Partial<Worker>): Promise<Worker> {
    try {
      const response = await this.client.put<ApiResponse<Worker>>(`/api/workers/${workerId}`, updateData);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to update worker');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error updating worker:', error);
      throw error;
    }
  }

  // Task management
  async getAvailableTasks(page: number = 0, limit: number = 10, filters: any = {}): Promise<ApiResponse<Task[] & { categories: string[] }>> {
    try {
      const response = await this.client.get<ApiResponse<Task[] & { categories: string[] }>>('/api/tasks/available', {
        params: { page, limit, ...filters }
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching available tasks:', error);
      throw error;
    }
  }

  async getTaskDetails(taskId: string): Promise<Task | null> {
    try {
      const response = await this.client.get<ApiResponse<Task>>(`/api/tasks/${taskId}`);
      return response.data.success ? response.data.data || null : null;
    } catch (error) {
      logger.error('Error fetching task details:', error);
      throw error;
    }
  }

  async acceptTask(taskId: string, workerId: number): Promise<ApiResponse<{ task: Task }>> {
    try {
      const response = await this.client.post<ApiResponse<{ task: Task }>>(`/api/tasks/${taskId}/accept`, {
        worker_id: workerId
      });
      return response.data;
    } catch (error) {
      logger.error('Error accepting task:', error);
      throw error;
    }
  }

  async startTask(taskId: string, workerId: number): Promise<Task | null> {
    try {
      const response = await this.client.post<ApiResponse<Task>>(`/api/tasks/${taskId}/start`, {
        worker_id: workerId
      });
      return response.data.success ? response.data.data || null : null;
    } catch (error) {
      logger.error('Error starting task:', error);
      throw error;
    }
  }

  async submitTask(taskId: string, answer: any, timeSpent?: number): Promise<ApiResponse<{ earned: number; xp: number; accuracy: number }>> {
    try {
      const response = await this.client.post<ApiResponse<{ earned: number; xp: number; accuracy: number }>>(`/api/tasks/${taskId}/submit`, {
        answer,
        time_spent: timeSpent
      });
      return response.data;
    } catch (error) {
      logger.error('Error submitting task:', error);
      throw error;
    }
  }

  async getWorkerTasks(workerId: string, status?: string): Promise<ApiResponse<Task[]>> {
    try {
      const response = await this.client.get<ApiResponse<Task[]>>(`/api/workers/${workerId}/tasks`, {
        params: { status }
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching worker tasks:', error);
      throw error;
    }
  }

  // Earnings and payments
  async getWorkerEarnings(workerId?: string): Promise<Earnings> {
    try {
      const url = workerId ? `/api/workers/${workerId}/earnings` : '/api/workers/earnings';
      const response = await this.client.get<ApiResponse<Earnings>>(url);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to fetch earnings');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching earnings:', error);
      throw error;
    }
  }

  async getWorkerBalance(workerId?: string): Promise<number> {
    try {
      const url = workerId ? `/api/workers/${workerId}/balance` : '/api/workers/balance';
      const response = await this.client.get<ApiResponse<{ balance: number }>>(url);
      if (!response.data.success || response.data.balance === undefined) {
        throw new Error(response.data.error || 'Failed to fetch balance');
      }
      return response.data.balance;
    } catch (error) {
      logger.error('Error fetching balance:', error);
      throw error;
    }
  }

  async requestWithdrawal(amount: number, method: string = 'usdt'): Promise<ApiResponse<{ withdrawal_id: string }>> {
    try {
      const response = await this.client.post<ApiResponse<{ withdrawal_id: string }>>('/api/workers/withdraw', {
        amount,
        method
      });
      return response.data;
    } catch (error) {
      logger.error('Error requesting withdrawal:', error);
      throw error;
    }
  }

  async getWithdrawalHistory(workerId?: string): Promise<ApiResponse<any[]>> {
    try {
      const url = workerId ? `/api/workers/${workerId}/withdrawals` : '/api/workers/withdrawals';
      const response = await this.client.get<ApiResponse<any[]>>(url);
      return response.data;
    } catch (error) {
      logger.error('Error fetching withdrawal history:', error);
      throw error;
    }
  }

  // Profile and stats
  async getWorkerProfile(workerId?: string): Promise<Worker> {
    try {
      const url = workerId ? `/api/workers/${workerId}` : '/api/workers/profile';
      const response = await this.client.get<ApiResponse<Worker>>(url);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to fetch profile');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching profile:', error);
      throw error;
    }
  }

  async getWorkerStats(workerId?: string): Promise<ApiResponse<any>> {
    try {
      const url = workerId ? `/api/workers/${workerId}/stats` : '/api/workers/stats';
      const response = await this.client.get<ApiResponse<any>>(url);
      return response.data;
    } catch (error) {
      logger.error('Error fetching stats:', error);
      throw error;
    }
  }

  // Leaderboard
  async getLeaderboard(type: string = 'earners', limit: number = 50): Promise<LeaderboardEntry[]> {
    try {
      const response = await this.client.get<ApiResponse<LeaderboardEntry[]>>('/api/workers/leaderboard', {
        params: { type, limit }
      });
      return response.data.data || [];
    } catch (error) {
      logger.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  // Achievements
  async getWorkerAchievements(workerId?: string): Promise<Achievement[]> {
    try {
      const url = workerId ? `/api/workers/${workerId}/achievements` : '/api/workers/achievements';
      const response = await this.client.get<ApiResponse<Achievement[]>>(url);
      return response.data.data || [];
    } catch (error) {
      logger.error('Error fetching achievements:', error);
      throw error;
    }
  }

  async unlockAchievement(workerId: string, achievementId: string): Promise<ApiResponse<Achievement>> {
    try {
      const response = await this.client.post<ApiResponse<Achievement>>(`/api/workers/${workerId}/achievements/${achievementId}/unlock`);
      return response.data;
    } catch (error) {
      logger.error('Error unlocking achievement:', error);
      throw error;
    }
  }

  // Training modules
  async getTrainingModules(): Promise<ApiResponse<any[]>> {
    try {
      const response = await this.client.get<ApiResponse<any[]>>('/api/training/modules');
      return response.data;
    } catch (error) {
      logger.error('Error fetching training modules:', error);
      throw error;
    }
  }

  async completeTrainingModule(workerId: string, moduleId: string): Promise<ApiResponse<{ xp: number; bonus: number }>> {
    try {
      const response = await this.client.post<ApiResponse<{ xp: number; bonus: number }>>(`/api/workers/${workerId}/training/${moduleId}/complete`);
      return response.data;
    } catch (error) {
      logger.error('Error completing training module:', error);
      throw error;
    }
  }

  // Notifications
  async getNotifications(limit: number = 20): Promise<ApiResponse<any[]>> {
    try {
      const response = await this.client.get<ApiResponse<any[]>>('/api/workers/notifications', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      throw error;
    }
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await this.client.put(`/api/workers/notifications/${notificationId}/read`);
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{ labeling: boolean; payment: boolean }> {
    try {
      const response = await this.client.get('/health');
      return {
        labeling: response.status === 200,
        payment: true // Assuming payment service is available if labeling is
      };
    } catch (error) {
      logger.error('Error during health check:', error);
      return {
        labeling: false,
        payment: false
      };
    }
  }
}

// Export singleton instance
export const workerApiService = new WorkerApiService();