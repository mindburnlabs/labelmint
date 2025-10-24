import { apiClient } from './api';

export interface Delegate {
  id: string;
  user_id: string;
  status: 'active' | 'inactive' | 'suspended';
  daily_limit: number;
  monthly_limit: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
  last_active_at: string;
  allowed_actions: string[];
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    telegram_username?: string;
  };
  stats?: {
    completed_tasks: number;
    success_rate: number;
    earnings_today?: number;
    earnings_month?: number;
    avg_task_time?: number;
  };
}

export interface CreateDelegateRequest {
  email: string;
  first_name: string;
  last_name: string;
  daily_limit?: number;
  monthly_limit?: number;
  allowed_actions?: string[];
}

export interface UpdateDelegateRequest {
  status?: 'active' | 'inactive' | 'suspended';
  daily_limit?: number;
  monthly_limit?: number;
  allowed_actions?: string[];
}

export interface DelegateStats {
  total_delegates: number;
  active_delegates: number;
  total_spent_month: number;
  avg_success_rate: number;
  total_tasks_completed: number;
  top_performers: Array<{
    delegate_id: string;
    delegate_name: string;
    tasks_completed: number;
    success_rate: number;
    earnings: number;
  }>;
}

class DelegatesService {
  private baseUrl = '/api/delegates';

  /**
   * Get all delegates for the current user
   */
  async getDelegates(): Promise<Delegate[]> {
    const response = await apiClient.get(`${this.baseUrl}`);
    return response.data;
  }

  /**
   * Get a specific delegate by ID
   */
  async getDelegate(delegateId: string): Promise<Delegate> {
    const response = await apiClient.get(`${this.baseUrl}/${delegateId}`);
    return response.data;
  }

  /**
   * Create a new delegate
   */
  async createDelegate(data: CreateDelegateRequest): Promise<Delegate> {
    const response = await apiClient.post(`${this.baseUrl}`, data);
    return response.data;
  }

  /**
   * Update a delegate
   */
  async updateDelegate(delegateId: string, data: UpdateDelegateRequest): Promise<Delegate> {
    const response = await apiClient.put(`${this.baseUrl}/${delegateId}`, data);
    return response.data;
  }

  /**
   * Delete a delegate
   */
  async deleteDelegate(delegateId: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${delegateId}`);
  }

  /**
   * Get delegate statistics
   */
  async getDelegateStats(): Promise<DelegateStats> {
    const response = await apiClient.get(`${this.baseUrl}/stats`);
    return response.data;
  }

  /**
   * Get delegate activity log
   */
  async getDelegateActivity(
    delegateId: string,
    options?: {
      limit?: number;
      offset?: number;
      start_date?: string;
      end_date?: string;
    }
  ): Promise<any[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.start_date) params.append('start_date', options.start_date);
    if (options?.end_date) params.append('end_date', options.end_date);

    const response = await apiClient.get(
      `${this.baseUrl}/${delegateId}/activity?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get delegate earnings
   */
  async getDelegateEarnings(
    delegateId: string,
    period: 'week' | 'month' | 'year' = 'month'
  ): Promise<any> {
    const response = await apiClient.get(
      `${this.baseUrl}/${delegateId}/earnings?period=${period}`
    );
    return response.data;
  }

  /**
   * Suspend a delegate
   */
  async suspendDelegate(delegateId: string, reason?: string): Promise<void> {
    await apiClient.post(`${this.baseUrl}/${delegateId}/suspend`, { reason });
  }

  /**
   * Reactivate a suspended delegate
   */
  async reactivateDelegate(delegateId: string): Promise<void> {
    await apiClient.post(`${this.baseUrl}/${delegateId}/reactivate`);
  }

  /**
   * Update delegate permissions
   */
  async updateDelegatePermissions(
    delegateId: string,
    permissions: string[]
  ): Promise<Delegate> {
    const response = await apiClient.put(
      `${this.baseUrl}/${delegateId}/permissions`,
      { allowed_actions: permissions }
    );
    return response.data;
  }

  /**
   * Get delegate performance metrics
   */
  async getDelegatePerformance(delegateId: string): Promise<any> {
    const response = await apiClient.get(
      `${this.baseUrl}/${delegateId}/performance`
    );
    return response.data;
  }

  /**
   * Bulk operations on delegates
   */
  async bulkUpdateDelegates(
    updates: Array<{ id: string; data: UpdateDelegateRequest }>
  ): Promise<Delegate[]> {
    const response = await apiClient.post(`${this.baseUrl}/bulk-update`, { updates });
    return response.data;
  }

  /**
   * Export delegates data
   */
  async exportDelegates(format: 'csv' | 'xlsx' = 'csv'): Promise<Blob> {
    const response = await apiClient.get(
      `${this.baseUrl}/export?format=${format}`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  /**
   * Search delegates
   */
  async searchDelegates(query: string): Promise<Delegate[]> {
    const response = await apiClient.get(
      `${this.baseUrl}/search?q=${encodeURIComponent(query)}`
    );
    return response.data;
  }

  /**
   * Get delegate financial summary
   */
  async getDelegateFinancialSummary(delegateId: string): Promise<any> {
    const response = await apiClient.get(
      `${this.baseUrl}/${delegateId}/financial-summary`
    );
    return response.data;
  }

  /**
   * Set spending limits for delegate
   */
  async setSpendingLimits(
    delegateId: string,
    limits: {
      daily?: number;
      weekly?: number;
      monthly?: number;
      per_task?: number;
    }
  ): Promise<Delegate> {
    const response = await apiClient.post(
      `${this.baseUrl}/${delegateId}/spending-limits`,
      limits
    );
    return response.data;
  }

  /**
   * Get delegate rankings
   */
  async getDelegateRankings(period: 'week' | 'month' | 'year' = 'month'): Promise<any> {
    const response = await apiClient.get(
      `${this.baseUrl}/rankings?period=${period}`
    );
    return response.data;
  }
}

export const delegatesService = new DelegatesService();