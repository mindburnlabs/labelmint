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
  balance: number;
  createdAt: string;
}

interface CreateUserData {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: 'CLIENT' | 'WORKER' | 'ADMIN';
}

interface Project {
  id: string;
  title: string;
  type: 'IMG_CLS' | 'TXT_CLS' | 'RLHF_PAIR' | 'BBOX';
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'DONE' | 'CANCELLED';
  totalTasks: number;
  completedTasks: number;
  accuracy: number;
  budget: number;
  createdAt: string;
}

interface CreateProjectData {
  title: string;
  type: 'IMG_CLS' | 'TXT_CLS' | 'RLHF_PAIR' | 'BBOX';
  classes: string[];
  datasetUrl?: string;
  datasetFile?: File;
  budget: number;
  pricePerLabel: number;
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

    // Request interceptor for debugging
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

    // Response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        logger.error('API Response Error:', error.response?.data || error.message);
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

  async getUserBalance(userId: string): Promise<number> {
    const response = await this.paymentClient.get(`/api/balance/${userId}`);
    return response.data.balance;
  }

  // Project methods
  async createProject(userId: string, data: CreateProjectData): Promise<Project> {
    const response = await this.apiClient.post('/api/projects', {
      ...data,
      clientId: userId,
    });
    return response.data;
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    const response = await this.apiClient.get(`/api/projects?clientId=${userId}`);
    return response.data.projects;
  }

  async getProject(projectId: string): Promise<Project> {
    const response = await this.apiClient.get(`/api/projects/${projectId}`);
    return response.data;
  }

  async updateProjectStatus(projectId: string, status: string): Promise<void> {
    await this.apiClient.patch(`/api/projects/${projectId}`, { status });
  }

  async getProjectResults(projectId: string): Promise<string> {
    const response = await this.apiClient.get(`/api/projects/${projectId}/results`);
    return response.data.downloadUrl;
  }

  // File upload
  async uploadDataset(file: Buffer, filename: string): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([file]);
    formData.append('file', blob, filename);

    const response = await this.apiClient.post('/api/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.url;
  }

  // Payment methods
  async createStripePaymentIntent(userId: string, amount: number, projectId?: string): Promise<any> {
    const response = await this.paymentClient.post('/api/payments/stripe/create-intent', {
      userId,
      amount,
      projectId,
    });
    return response.data;
  }

  async getUserTransactions(userId: string): Promise<any[]> {
    const response = await this.paymentClient.get(`/api/transactions/${userId}`);
    return response.data.transactions;
  }
}

export const apiService = new ApiService();