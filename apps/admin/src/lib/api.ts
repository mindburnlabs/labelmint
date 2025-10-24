import axios, { AxiosInstance, AxiosError } from 'axios';
import { getAccessToken, refreshToken, clearTokens } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest) {
      try {
        await refreshToken();
        const token = getAccessToken();
        if (token && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        clearTokens();
        window.location.href = '/auth/login';
      }
    }

    return Promise.reject(error);
  }
);

// Dashboard API
export const dashboardApi = {
  getMetrics: async () => {
    const response = await apiClient.get('/admin/analytics/overview');
    return response.data;
  },
  getRealTimeUpdates: async () => {
    const response = await apiClient.get('/admin/analytics/realtime');
    return response.data;
  },
};

// Users API
export const usersApi = {
  getUsers: async (filters: any) => {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`/admin/users?${params}`);
    return response.data;
  },
  getUser: async (id: string) => {
    const response = await apiClient.get(`/admin/users/${id}`);
    return response.data;
  },
  updateUser: async (id: string, data: any) => {
    const response = await apiClient.put(`/admin/users/${id}`, data);
    return response.data;
  },
  suspendUser: async (id: string, reason: string) => {
    const response = await apiClient.post(`/admin/users/${id}/suspend`, { reason });
    return response.data;
  },
  activateUser: async (id: string) => {
    const response = await apiClient.post(`/admin/users/${id}/activate`);
    return response.data;
  },
  bulkAction: async (userIds: string[], action: string, data?: any) => {
    const response = await apiClient.post('/admin/users/bulk', {
      userIds,
      action,
      data,
    });
    return response.data;
  },
};

// Projects API
export const projectsApi = {
  getProjects: async (filters: any) => {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`/admin/projects?${params}`);
    return response.data;
  },
  getProject: async (id: string) => {
    const response = await apiClient.get(`/admin/projects/${id}`);
    return response.data;
  },
  updateProject: async (id: string, data: any) => {
    const response = await apiClient.put(`/admin/projects/${id}`, data);
    return response.data;
  },
  pauseProject: async (id: string) => {
    const response = await apiClient.post(`/admin/projects/${id}/pause`);
    return response.data;
  },
  resumeProject: async (id: string) => {
    const response = await apiClient.post(`/admin/projects/${id}/resume`);
    return response.data;
  },
  getProjectAnalytics: async (id: string) => {
    const response = await apiClient.get(`/admin/projects/${id}/analytics`);
    return response.data;
  },
  getQualityMetrics: async (id: string) => {
    const response = await apiClient.get(`/admin/projects/${id}/quality`);
    return response.data;
  },
};

// Finance API
export const financeApi = {
  getTransactions: async (filters: any) => {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`/admin/transactions?${params}`);
    return response.data;
  },
  getRevenueMetrics: async (dateRange: string) => {
    const response = await apiClient.get(`/admin/revenue?range=${dateRange}`);
    return response.data;
  },
  getWithdrawalRequests: async (status?: string) => {
    const params = status ? `?status=${status}` : '';
    const response = await apiClient.get(`/admin/withdrawals${params}`);
    return response.data;
  },
  approveWithdrawal: async (id: string) => {
    const response = await apiClient.post(`/admin/withdrawals/${id}/approve`);
    return response.data;
  },
  rejectWithdrawal: async (id: string, reason: string) => {
    const response = await apiClient.post(`/admin/withdrawals/${id}/reject`, { reason });
    return response.data;
  },
  generateInvoice: async (clientId: string, data: any) => {
    const response = await apiClient.post(`/admin/invoices/${clientId}`, data);
    return response.data;
  },
};

// Disputes API
export const disputesApi = {
  getDisputes: async (filters: any) => {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`/admin/disputes?${params}`);
    return response.data;
  },
  getDispute: async (id: string) => {
    const response = await apiClient.get(`/admin/disputes/${id}`);
    return response.data;
  },
  assignDispute: async (id: string, adminId: string) => {
    const response = await apiClient.post(`/admin/disputes/${id}/assign`, { adminId });
    return response.data;
  },
  resolveDispute: async (id: string, resolution: any) => {
    const response = await apiClient.post(`/admin/disputes/${id}/resolve`, resolution);
    return response.data;
  },
  addEvidence: async (id: string, evidence: any) => {
    const response = await apiClient.post(`/admin/disputes/${id}/evidence`, evidence);
    return response.data;
  },
};

// Analytics API
export const analyticsApi = {
  getOverview: async (dateRange: string) => {
    const response = await apiClient.get(`/admin/analytics/overview?range=${dateRange}`);
    return response.data;
  },
  getUserMetrics: async (dateRange: string) => {
    const response = await apiClient.get(`/admin/analytics/users?range=${dateRange}`);
    return response.data;
  },
  getProjectMetrics: async (dateRange: string) => {
    const response = await apiClient.get(`/admin/analytics/projects?range=${dateRange}`);
    return response.data;
  },
  getFinancialMetrics: async (dateRange: string) => {
    const response = await apiClient.get(`/admin/analytics/financial?range=${dateRange}`);
    return response.data;
  },
  getQualityMetrics: async (dateRange: string) => {
    const response = await apiClient.get(`/admin/analytics/quality?range=${dateRange}`);
    return response.data;
  },
  generateReport: async (type: string, filters: any) => {
    const response = await apiClient.post('/admin/reports/generate', { type, filters });
    return response.data;
  },
  exportData: async (type: string, format: string, filters: any) => {
    const response = await apiClient.post(`/admin/export/${type}`, { format, filters });
    return response.data;
  },
};

// Activity Logs API
export const activityApi = {
  getLogs: async (filters: any) => {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(`/admin/activity?${params}`);
    return response.data;
  },
  logActivity: async (action: string, resource: string, resourceId: string, details?: any) => {
    const response = await apiClient.post('/admin/activity', {
      action,
      resource,
      resourceId,
      details,
    });
    return response.data;
  },
};