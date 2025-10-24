/**
 * User Service
 * Handles user-related API operations
 */

import { BaseService } from './base-service';
import { ApiResponse } from '../types';
import { ApiClient } from '../client';

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  avatar?: string;
  bio?: string;
  preferences: Record<string, any>;
  stats: UserStats;
}

export interface UserStats {
  totalTasks: number;
  completedTasks: number;
  accuracy: number;
  averageTime: number;
  earnings: {
    total: number;
    thisMonth: number;
    thisWeek: number;
  };
  rank?: number;
}

export class UserService extends BaseService {
  constructor(client: ApiClient) {
    super(client, '/users');
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    return this.client.get<UserProfile>('/users/profile');
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    return this.client.put<UserProfile>('/users/profile', data);
  }

  /**
   * Get user statistics
   */
  async getStats(userId?: string): Promise<ApiResponse<UserStats>> {
    const url = userId ? `${this.basePath}/${userId}/stats` : '/users/stats';
    return this.client.get<UserStats>(url);
  }

  /**
   * Get user earnings
   */
  async getEarnings(userId?: string, period?: 'week' | 'month' | 'year'): Promise<ApiResponse<any>> {
    const params = period ? `?period=${period}` : '';
    const url = userId ? `${this.basePath}/${userId}/earnings${params}` : `/users/earnings${params}`;
    return this.client.get<any>(url);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: Record<string, any>): Promise<ApiResponse<void>> {
    return this.client.put<void>('/users/preferences', { preferences });
  }

  /**
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.client.post<void>('/users/change-password', {
      oldPassword,
      newPassword
    });
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.client.post<{ url: string }>('/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<ApiResponse<void>> {
    return this.client.delete<void>('/users/account');
  }

  /**
   * Get user activity log
   */
  async getActivity(page = 1, limit = 20): Promise<ApiResponse<any>> {
    return this.client.get<any>(`/users/activity?page=${page}&limit=${limit}`);
  }
}