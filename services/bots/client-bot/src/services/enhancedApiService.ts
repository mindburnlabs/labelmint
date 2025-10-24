import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: 'image' | 'text';
  status: 'pending' | 'in_progress' | 'completed' | 'paused';
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  accuracy?: number;
  budget?: number;
  total_spent: number;
  cost_per_label: number;
  avg_time_per_task: number;
  active_workers: number;
  total_workers: number;
  created_at: string;
  updated_at: string;
  categories: string[];
  instructions?: string;
}

export interface User {
  id: string;
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  email?: string;
  language_code?: string;
  balance: number;
  total_spent: number;
  is_active: boolean;
  created_at: string;
}

export interface Analytics {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  total_spent: number;
  monthly_spend: number;
  avg_cost_per_label: number;
  avg_completion_time: number;
  avg_accuracy: number;
  total_workers: number;
}

export interface BillingInfo {
  balance: number;
  pending: number;
  total_spent: number;
  usage: Array<{
    description: string;
    amount: number;
    date: string;
  }>;
  transactions: Array<{
    id: string;
    amount: number;
    type: 'deposit' | 'withdraw' | 'payment';
    status: string;
    created_at: string;
  }>;
}

export interface Notification {
  id: string;
  type: 'task_completed' | 'project_updated' | 'payment_received' | 'worker_assigned' | 'quality_alert';
  title: string;
  message: string;
  project_id?: string;
  read: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  telegram_id: number;
  username: string;
  first_name: string;
  last_name?: string;
  email?: string;
  role: 'owner' | 'admin' | 'member';
  is_active: boolean;
  joined_at: string;
}

export interface UserSettings {
  language: string;
  notifications_enabled: boolean;
  dark_mode: boolean;
  email_reports: string;
  timezone: string;
  preferences: {
    project_updates: boolean;
    payment_alerts: boolean;
    team_activity: boolean;
    daily_reports: boolean;
  };
}

export class EnhancedApiService {
  private labelingClient: AxiosInstance;
  private paymentClient: AxiosInstance;
  private baseURLs = {
    labeling: process.env.LABELING_API_URL || 'http://localhost:3001',
    payment: process.env.PAYMENT_API_URL || 'http://localhost:3000'
  };

  constructor() {
    // Initialize labeling API client
    this.labelingClient = axios.create({
      baseURL: this.baseURLs.labeling,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LabelMint-ClientBot/1.0'
      }
    });

    // Initialize payment API client
    this.paymentClient = axios.create({
      baseURL: this.baseURLs.payment,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LabelMint-ClientBot/1.0'
      }
    });

    // Request interceptors
    this.labelingClient.interceptors.request.use(
      (config) => {
        logger.debug(`Labeling API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Labeling API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.paymentClient.interceptors.request.use(
      (config) => {
        logger.debug(`Payment API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Payment API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptors
    this.labelingClient.interceptors.response.use(
      (response) => {
        logger.debug(`Labeling API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Labeling API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );

    this.paymentClient.interceptors.response.use(
      (response) => {
        logger.debug(`Payment API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Payment API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // User management
  async getUser(telegramId: number): Promise<User | null> {
    try {
      const response = await this.labelingClient.get<ApiResponse<User>>('/api/users/telegram', {
        params: { telegram_id: telegramId }
      });
      return response.data.success ? response.data.data || null : null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error('Error fetching user:', error);
      throw error;
    }
  }

  async createUser(userData: Partial<User>): Promise<User> {
    try {
      const response = await this.labelingClient.post<ApiResponse<User>>('/api/users', userData);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to create user');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  // Project management
  async getProjects(page: number = 0, limit: number = 10): Promise<ApiResponse<Project[]>> {
    try {
      const response = await this.labelingClient.get<ApiResponse<Project[]>>('/api/projects', {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching projects:', error);
      throw error;
    }
  }

  async getProject(projectId: string): Promise<Project> {
    try {
      const response = await this.labelingClient.get<ApiResponse<Project>>(`/api/projects/${projectId}`);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Project not found');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching project:', error);
      throw error;
    }
  }

  async createProject(projectData: Partial<Project>): Promise<Project> {
    try {
      const response = await this.labelingClient.post<ApiResponse<Project>>('/api/projects', projectData);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to create project');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error creating project:', error);
      throw error;
    }
  }

  async updateProject(projectId: string, updateData: Partial<Project>): Promise<Project> {
    try {
      const response = await this.labelingClient.put<ApiResponse<Project>>(`/api/projects/${projectId}`, updateData);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to update project');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error updating project:', error);
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      const response = await this.labelingClient.delete<ApiResponse>(`/api/projects/${projectId}`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete project');
      }
    } catch (error) {
      logger.error('Error deleting project:', error);
      throw error;
    }
  }

  async uploadProjectData(projectId: string, data: any[], format: string = 'json'): Promise<any> {
    try {
      const response = await this.labelingClient.post<ApiResponse>(`/api/projects/${projectId}/upload`, {
        data,
        format
      });
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to upload data');
      }
      return response.data;
    } catch (error) {
      logger.error('Error uploading project data:', error);
      throw error;
    }
  }

  async getProjectResults(projectId: string, format: string = 'json', limit: number = 10000): Promise<any> {
    try {
      const response = await this.labelingClient.get<ApiResponse>(`/api/projects/${projectId}/results`, {
        params: { format, limit }
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching project results:', error);
      throw error;
    }
  }

  async getProjectStatus(projectId: string): Promise<any> {
    try {
      const response = await this.labelingClient.get<ApiResponse>(`/api/projects/${projectId}/status`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching project status:', error);
      throw error;
    }
  }

  // Analytics
  async getAnalytics(): Promise<Analytics> {
    try {
      const response = await this.labelingClient.get<ApiResponse<Analytics>>('/api/analytics/overview');
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to fetch analytics');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching analytics:', error);
      throw error;
    }
  }

  async getProjectAnalytics(projectId: string): Promise<any> {
    try {
      const response = await this.labelingClient.get<ApiResponse>(`/api/projects/${projectId}/analytics`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching project analytics:', error);
      throw error;
    }
  }

  // Billing and payments
  async getBillingInfo(): Promise<BillingInfo> {
    try {
      const response = await this.paymentClient.get<ApiResponse<BillingInfo>>('/api/billing/info');
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to fetch billing info');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching billing info:', error);
      throw error;
    }
  }

  async getBalance(): Promise<number> {
    try {
      const response = await this.paymentClient.get<ApiResponse<{ balance: number }>>('/api/balance');
      if (!response.data.success || response.data.balance === undefined) {
        throw new Error(response.data.error || 'Failed to fetch balance');
      }
      return response.data.balance;
    } catch (error) {
      logger.error('Error fetching balance:', error);
      throw error;
    }
  }

  async getTransactions(limit: number = 50): Promise<any> {
    try {
      const response = await this.paymentClient.get<ApiResponse>('/api/transactions', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async createDeposit(amount: number, method: string): Promise<any> {
    try {
      const response = await this.paymentClient.post<ApiResponse>('/api/deposits', {
        amount,
        method
      });
      return response.data;
    } catch (error) {
      logger.error('Error creating deposit:', error);
      throw error;
    }
  }

  // Notifications
  async getNotifications(limit: number = 20): Promise<Notification[]> {
    try {
      const response = await this.labelingClient.get<ApiResponse<Notification[]>>('/api/notifications', {
        params: { limit }
      });
      return response.data.data || [];
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      throw error;
    }
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await this.labelingClient.put(`/api/notifications/${notificationId}/read`);
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Team management
  async getTeamMembers(): Promise<TeamMember[]> {
    try {
      const response = await this.labelingClient.get<ApiResponse<TeamMember[]>>('/api/team/members');
      return response.data.data || [];
    } catch (error) {
      logger.error('Error fetching team members:', error);
      throw error;
    }
  }

  async inviteTeamMember(email: string, role: string = 'member'): Promise<any> {
    try {
      const response = await this.labelingClient.post<ApiResponse>('/api/team/invite', {
        email,
        role
      });
      return response.data;
    } catch (error) {
      logger.error('Error inviting team member:', error);
      throw error;
    }
  }

  async updateTeamMember(memberId: string, updateData: Partial<TeamMember>): Promise<TeamMember> {
    try {
      const response = await this.labelingClient.put<ApiResponse<TeamMember>>(`/api/team/members/${memberId}`, updateData);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to update team member');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error updating team member:', error);
      throw error;
    }
  }

  async removeTeamMember(memberId: string): Promise<void> {
    try {
      const response = await this.labelingClient.delete<ApiResponse>(`/api/team/members/${memberId}`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to remove team member');
      }
    } catch (error) {
      logger.error('Error removing team member:', error);
      throw error;
    }
  }

  // Settings
  async getUserSettings(): Promise<UserSettings> {
    try {
      const response = await this.labelingClient.get<ApiResponse<UserSettings>>('/api/user/settings');
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to fetch user settings');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching user settings:', error);
      throw error;
    }
  }

  async updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    try {
      const response = await this.labelingClient.put<ApiResponse<UserSettings>>('/api/user/settings', settings);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to update settings');
      }
      return response.data.data;
    } catch (error) {
      logger.error('Error updating user settings:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{ labeling: boolean; payment: boolean }> {
    try {
      const labelingResponse = await this.labelingClient.get('/health').catch(() => null);
      const paymentResponse = await this.paymentClient.get('/health').catch(() => null);

      return {
        labeling: labelingResponse?.status === 200,
        payment: paymentResponse?.status === 200
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
export const enhancedApiService = new EnhancedApiService();