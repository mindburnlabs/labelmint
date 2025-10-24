import axios from 'axios';
import { authClient } from './auth-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create axios instance with auth
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = authClient.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Project {
  id: string;
  title: string;
  description?: string;
  type: 'IMG_CLS' | 'TXT_CLS' | 'RLHF_PAIR' | 'BBOX';
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'DONE' | 'CANCELLED';
  classes: string[];
  datasetUrl?: string;
  budget: number;
  pricePerLabel: number;
  totalTasks: number;
  completedTasks: number;
  accuracy: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectData {
  title: string;
  description?: string;
  type: 'IMG_CLS' | 'TXT_CLS' | 'RLHF_PAIR' | 'BBOX';
  classes: string[];
  datasetUrl?: string;
  budget: number;
  pricePerLabel: number;
}

export interface Task {
  id: string;
  projectId: string;
  dataUrl: string;
  payload?: any;
  status: 'PENDING' | 'RESERVED' | 'LABELED' | 'COMPLETE';
  reservedBy?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedTasks: number;
  totalSpent: number;
  accuracy: number;
  avgTimePerTask: number;
}

export const apiClient = {
  // Dashboard
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    const response = await api.get(`/api/users/${userId}/dashboard/stats`);
    return response.data;
  },

  async getRecentProjects(userId: string): Promise<Project[]> {
    const response = await api.get(`/api/users/${userId}/projects?limit=5`);
    return response.data.projects;
  },

  // Projects
  async getProjects(userId: string, page = 1, limit = 10): Promise<{ projects: Project[]; total: number }> {
    const response = await api.get(`/api/users/${userId}/projects?page=${page}&limit=${limit}`);
    return response.data;
  },

  async getProject(projectId: string): Promise<Project> {
    const response = await api.get(`/api/projects/${projectId}`);
    return response.data;
  },

  async createProject(data: CreateProjectData): Promise<Project> {
    const response = await api.post('/api/projects', data);
    return response.data;
  },

  async updateProject(projectId: string, data: Partial<Project>): Promise<Project> {
    const response = await api.patch(`/api/projects/${projectId}`, data);
    return response.data;
  },

  async deleteProject(projectId: string): Promise<void> {
    await api.delete(`/api/projects/${projectId}`);
  },

  async pauseProject(projectId: string): Promise<void> {
    await api.post(`/api/projects/${projectId}/pause`);
  },

  async resumeProject(projectId: string): Promise<void> {
    await api.post(`/api/projects/${projectId}/resume`);
  },

  // Tasks
  async getProjectTasks(projectId: string, page = 1, limit = 20): Promise<{ tasks: Task[]; total: number }> {
    const response = await api.get(`/api/projects/${projectId}/tasks?page=${page}&limit=${limit}`);
    return response.data;
  },

  async getTaskResults(projectId: string, format: 'csv' | 'json' = 'csv'): Promise<string> {
    const response = await api.get(`/api/projects/${projectId}/results?format=${format}`);
    return response.data.downloadUrl;
  },

  // File Upload
  async uploadDataset(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  // Billing
  async getBillingInfo(userId: string): Promise<any> {
    const response = await api.get(`/api/billing/${userId}`);
    return response.data;
  },

  async getTransactionHistory(userId: string, page = 1, limit = 20): Promise<any> {
    const response = await api.get(`/api/billing/${userId}/transactions?page=${page}&limit=${limit}`);
    return response.data;
  },

  async addFunds(userId: string, amount: number): Promise<{ paymentUrl: string }> {
    const response = await api.post('/api/billing/add-funds', {
      userId,
      amount,
    });
    return response.data;
  },
};