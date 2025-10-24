import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Task {
  id: string;
  projectId: string;
  dataUrl: string;
  payload?: any;
  type: 'IMG_CLS' | 'TXT_CLS' | 'RLHF_PAIR' | 'BBOX';
  classes: string[];
  gold: boolean;
  goldAnswer?: any;
  reservedAt?: string;
  expiresAt?: string;
}

export interface SubmitResponse {
  success: boolean;
  earnings: number;
  accuracy: number;
  streak: number;
  nextTaskAvailable: boolean;
}

export class TaskApi {
  private static instance: TaskApi;
  private userId: string | null = null;
  private telegramId: number | null = null;

  static getInstance(): TaskApi {
    if (!TaskApi.instance) {
      TaskApi.instance = new TaskApi();
    }
    return TaskApi.instance;
  }

  setAuth(userId: string, telegramId: number) {
    this.userId = userId;
    this.telegramId = telegramId;
  }

  async getNextTask(): Promise<Task | null> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await axios.get(`${API_URL}/api/tasks/next`, {
        params: { userId: this.userId },
        timeout: 10000,
      });

      if (response.data.task) {
        // Set expiration time
        response.data.task.expiresAt = new Date(Date.now() + 30000).toISOString(); // 30 seconds
        return response.data.task;
      }

      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null; // No tasks available
      }
      throw error;
    }
  }

  async submitTaskAnswer(taskId: string, answer: any, timeSpentMs: number): Promise<SubmitResponse> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const response = await axios.post(`${API_URL}/api/tasks/${taskId}/submit`, {
      userId: this.userId,
      telegramId: this.telegramId,
      answer,
      timeSpentMs,
      submittedAt: new Date().toISOString(),
    });

    return response.data;
  }

  async skipTask(taskId: string): Promise<void> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    await axios.post(`${API_URL}/api/tasks/${taskId}/skip`, {
      userId: this.userId,
    });
  }

  async getWorkerStats(): Promise<any> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const response = await axios.get(`${API_URL}/api/workers/${this.userId}/stats`);
    return response.data;
  }

  async reserveTask(taskId: string): Promise<boolean> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    try {
      await axios.post(`${API_URL}/api/tasks/${taskId}/reserve`, {
        userId: this.userId,
      });
      return true;
    } catch (error: any) {
      if (error.response?.status === 409) {
        return false; // Task already reserved
      }
      throw error;
    }
  }

  async releaseTask(taskId: string): Promise<void> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    await axios.post(`${API_URL}/api/tasks/${taskId}/release`, {
      userId: this.userId,
    });
  }
}

export const taskApi = TaskApi.getInstance();