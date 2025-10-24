/**
 * Project Service
 * Handles project-related API operations
 */

import { BaseService } from './base-service';
import { ApiResponse } from '../types';
import { ApiClient } from '../client';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  owner: string;
  budget: {
    total: number;
    spent: number;
    remaining: number;
  };
  settings: {
    autoApproval: boolean;
    minAccuracy: number;
    maxWorkers?: number;
    deadline?: string;
  };
  stats: {
    totalTasks: number;
    completedTasks: number;
    activeWorkers: number;
    averageAccuracy: number;
  };
  createdAt: string;
  updatedAt: string;
}

export enum ProjectStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export class ProjectService extends BaseService {
  constructor(client: ApiClient) {
    super(client, '/projects');
  }

  /**
   * Get user's projects
   */
  async getUserProjects(role?: 'owner' | 'worker' | 'reviewer'): Promise<ApiResponse<Project[]>> {
    const url = role ? `/projects/user?role=${role}` : '/projects/user';
    return this.client.get<Project[]>(url);
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<ApiResponse<Project>> {
    return this.client.get<Project>(`/projects/${projectId}`);
  }

  /**
   * Create a new project
   */
  async createProject(data: Partial<Project>): Promise<ApiResponse<Project>> {
    return this.client.post<Project>('/projects', data);
  }

  /**
   * Update project
   */
  async updateProject(projectId: string, data: Partial<Project>): Promise<ApiResponse<Project>> {
    return this.client.put<Project>(`/projects/${projectId}`, data);
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/projects/${projectId}`);
  }

  /**
   * Add worker to project
   */
  async addWorker(projectId: string, userId: string): Promise<ApiResponse<void>> {
    return this.client.post<void>(`/projects/${projectId}/workers`, { userId });
  }

  /**
   * Remove worker from project
   */
  async removeWorker(projectId: string, userId: string): Promise<ApiResponse<void>> {
    return this.client.delete<void>(`/projects/${projectId}/workers/${userId}`);
  }

  /**
   * Get project workers
   */
  async getWorkers(projectId: string): Promise<ApiResponse<any[]>> {
    return this.client.get<any[]>(`/projects/${projectId}/workers`);
  }

  /**
   * Upload project dataset
   */
  async uploadDataset(projectId: string, file: File): Promise<ApiResponse<{ id: string; name: string }>> {
    const formData = new FormData();
    formData.append('dataset', file);

    return this.client.post<{ id: string; name: string }>(`/projects/${projectId}/dataset`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  /**
   * Get project statistics
   */
  async getStats(projectId: string): Promise<ApiResponse<any>> {
    return this.client.get<any>(`/projects/${projectId}/stats`);
  }

  /**
   * Update project settings
   */
  async updateSettings(projectId: string, settings: Partial<Project['settings']>): Promise<ApiResponse<Project>> {
    return this.client.put<Project>(`/projects/${projectId}/settings`, settings);
  }

  /**
   * Pause project
   */
  async pauseProject(projectId: string, reason?: string): Promise<ApiResponse<Project>> {
    return this.client.post<Project>(`/projects/${projectId}/pause`, { reason });
  }

  /**
   * Resume project
   */
  async resumeProject(projectId: string): Promise<ApiResponse<Project>> {
    return this.client.post<Project>(`/projects/${projectId}/resume`);
  }

  /**
   * Complete project
   */
  async completeProject(projectId: string): Promise<ApiResponse<Project>> {
    return this.client.post<Project>(`/projects/${projectId}/complete`);
  }

  /**
   * Get project leaderboard
   */
  async getLeaderboard(projectId: string, period?: 'week' | 'month' | 'all'): Promise<ApiResponse<any[]>> {
    const url = period ? `/projects/${projectId}/leaderboard?period=${period}` : `/projects/${projectId}/leaderboard`;
    return this.client.get<any[]>(url);
  }
}