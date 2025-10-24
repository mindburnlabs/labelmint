/**
 * Task Service
 * Handles task-related API operations
 */

import { BaseService } from './base-service';
import { ApiResponse } from '../types';
import { ApiClient } from '../client';

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId: string;
  assignedTo?: string;
  data: any; // Task-specific data
  metadata: {
    timeLimit?: number;
    maxAttempts?: number;
    reward: number;
    difficulty: 'easy' | 'medium' | 'hard';
  };
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskResponse {
  id: string;
  taskId: string;
  userId: string;
  response: any;
  confidence?: number;
  timeSpent: number;
  submittedAt: string;
  reviewedAt?: string;
  approved: boolean;
  feedback?: string;
  score?: number;
}

export interface TaskType {
  id: string;
  name: string;
  description: string;
  schema: any; // JSON schema for task data
  template: any; // Template for task rendering
  config: {
    timeLimit?: number;
    maxRetries?: number;
    autoApprove?: boolean;
    reviewRequired?: boolean;
  };
}

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  REVIEWING = 'reviewing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export class TaskService extends BaseService {
  constructor(client: ApiClient) {
    super(client, '/tasks');
  }

  /**
   * Get next available task for the current user
   */
  async getNextTask(): Promise<ApiResponse<Task>> {
    return this.client.get<Task>('/tasks/next');
  }

  /**
   * Submit task response
   */
  async submitResponse(taskId: string, response: any, timeSpent?: number): Promise<ApiResponse<TaskResponse>> {
    return this.client.post<TaskResponse>(`/tasks/${taskId}/response`, {
      response,
      timeSpent
    });
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<ApiResponse<Task>> {
    return this.client.get<Task>(`/tasks/${taskId}`);
  }

  /**
   * Get user's tasks
   */
  async getUserTasks(status?: TaskStatus, page = 1, limit = 20): Promise<ApiResponse<Task[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit)
    });

    if (status) {
      params.append('status', status);
    }

    return this.client.get<Task[]>(`/tasks/user?${params}`);
  }

  /**
   * Get task responses
   */
  async getResponses(taskId: string, page = 1, limit = 20): Promise<ApiResponse<TaskResponse[]>> {
    return this.client.get<TaskResponse[]>(`/tasks/${taskId}/responses?page=${page}&limit=${limit}`);
  }

  /**
   * Review a task response
   */
  async reviewResponse(responseId: string, approved: boolean, feedback?: string, score?: number): Promise<ApiResponse<TaskResponse>> {
    return this.client.post<TaskResponse>(`/tasks/responses/${responseId}/review`, {
      approved,
      feedback,
      score
    });
  }

  /**
   * Get task statistics
   */
  async getStats(taskId?: string): Promise<ApiResponse<any>> {
    const url = taskId ? `/tasks/${taskId}/stats` : '/tasks/stats';
    return this.client.get<any>(url);
  }

  /**
   * Get task types
   */
  async getTaskTypes(): Promise<ApiResponse<TaskType[]>> {
    return this.client.get<TaskType[]>('/tasks/types');
  }

  /**
   * Create a new task (admin only)
   */
  async createTask(data: Partial<Task>): Promise<ApiResponse<Task>> {
    return this.client.post<Task>('/tasks', data);
  }

  /**
   * Assign task to user
   */
  async assignTask(taskId: string, userId: string): Promise<ApiResponse<Task>> {
    return this.client.post<Task>(`/tasks/${taskId}/assign`, { userId });
  }

  /**
   * Start working on a task
   */
  async startTask(taskId: string): Promise<ApiResponse<Task>> {
    return this.client.post<Task>(`/tasks/${taskId}/start`);
  }

  /**
   * Skip a task
   */
  async skipTask(taskId: string, reason?: string): Promise<ApiResponse<void>> {
    return this.client.post<void>(`/tasks/${taskId}/skip`, { reason });
  }

  /**
   * Report issue with task
   */
  async reportIssue(taskId: string, issue: string, details?: string): Promise<ApiResponse<void>> {
    return this.client.post<void>(`/tasks/${taskId}/report`, {
      issue,
      details
    });
  }

  /**
   * Get task history for user
   */
  async getHistory(period?: 'day' | 'week' | 'month', page = 1, limit = 20): Promise<ApiResponse<TaskResponse[]>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit)
    });

    if (period) {
      params.append('period', period);
    }

    return this.client.get<TaskResponse[]>(`/tasks/history?${params}`);
  }
}