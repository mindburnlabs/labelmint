/**
 * Offline Storage Implementation for LabelMint PWA
 * Uses IndexedDB for local data persistence
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema definition
interface LabelMintDB extends DBSchema {
  // User data
  users: {
    key: string;
    value: {
      id: string;
      telegramId: number;
      username: string;
      firstName: string;
      lastName?: string;
      photoUrl?: string;
      tonWallet?: string;
      settings: any;
      lastSync: number;
    };
  };

  // Projects
  projects: {
    key: string;
    value: {
      id: string;
      name: string;
      description: string;
      status: 'active' | 'completed' | 'archived';
      ownerId: string;
      tasks: string[];
      createdAt: number;
      updatedAt: number;
      lastSync: number;
      synced: boolean;
    };
    indexes: {
      'by-owner': string;
      'by-status': string;
      'by-sync': boolean;
    };
  };

  // Tasks
  tasks: {
    key: string;
    value: {
      id: string;
      projectId: string;
      title: string;
      description: string;
      type: string;
      status: 'pending' | 'in_progress' | 'completed' | 'rejected';
      assignedTo?: string;
      data: any;
      result?: any;
      reward: number;
      currency: 'TON' | 'USDT';
      createdAt: number;
      updatedAt: number;
      deadline?: number;
      lastSync: number;
      synced: boolean;
      offlineAction?: 'create' | 'update' | 'delete';
    };
    indexes: {
      'by-project': string;
      'by-status': string;
      'by-assigned': string;
      'by-sync': boolean;
      'by-deadline': number;
    };
  };

  // Submissions
  submissions: {
    key: string;
    value: {
      id: string;
      taskId: string;
      userId: string;
      data: any;
      status: 'submitted' | 'approved' | 'rejected';
      submittedAt: number;
      reviewedAt?: number;
      reviewedBy?: string;
      feedback?: string;
      reward?: number;
      lastSync: number;
      synced: boolean;
      offlineAction?: 'create' | 'update';
    };
    indexes: {
      'by-task': string;
      'by-user': string;
      'by-status': string;
      'by-sync': boolean;
    };
  };

  // Messages
  messages: {
    key: string;
    value: {
      id: string;
      chatId: string;
      senderId: string;
      content: string;
      type: 'text' | 'image' | 'file';
      timestamp: number;
      read: boolean;
      lastSync: number;
      synced: boolean;
      offlineAction?: 'create' | 'delete';
    };
    indexes: {
      'by-chat': string;
      'by-user': string;
      'by-read': boolean;
      'by-sync': boolean;
      'by-timestamp': number;
    };
  };

  // Payments
  payments: {
    key: string;
    value: {
      id: string;
      userId: string;
      type: 'reward' | 'withdrawal' | 'deposit';
      amount: number;
      currency: 'TON' | 'USDT';
      status: 'pending' | 'completed' | 'failed';
      transactionHash?: string;
      createdAt: number;
      completedAt?: number;
      lastSync: number;
      synced: boolean;
      offlineAction?: 'create' | 'update';
    };
    indexes: {
      'by-user': string;
      'by-type': string;
      'by-status': string;
      'by-sync': boolean;
    };
  };

  // Cache for API responses
  cache: {
    key: string;
    value: {
      url: string;
      method: string;
      data: any;
      headers: any;
      timestamp: number;
      expiresAt: number;
      etag?: string;
    };
    indexes: {
      'by-expires': number;
    };
  };

  // Offline actions queue
  offlineQueue: {
    key: string;
    value: {
      id: string;
      type: 'create' | 'update' | 'delete';
      endpoint: string;
      method: string;
      data: any;
      timestamp: number;
      retries: number;
      maxRetries: number;
    };
    indexes: {
      'by-timestamp': number;
      'by-retries': number;
    };
  };

  // Settings and preferences
  settings: {
    key: string;
    value: {
      key: string;
      value: any;
      updatedAt: number;
      synced: boolean;
    };
  };
}

class OfflineStorage {
  private db: IDBPDatabase<LabelMintDB> | null = null;
  private dbName = 'LabelMintOffline';
  private dbVersion = 1;
  private isReady = false;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.isReady && this.db) return;

    try {
      this.db = await openDB<LabelMintDB>(this.dbName, this.dbVersion, {
        upgrade(db) {
          // Create stores
          db.createObjectStore('users', { keyPath: 'id' });

          const projectsStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectsStore.createIndex('by-owner', 'ownerId');
          projectsStore.createIndex('by-status', 'status');
          projectsStore.createIndex('by-sync', 'synced');

          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('by-project', 'projectId');
          tasksStore.createIndex('by-status', 'status');
          tasksStore.createIndex('by-assigned', 'assignedTo');
          tasksStore.createIndex('by-sync', 'synced');
          tasksStore.createIndex('by-deadline', 'deadline');

          const submissionsStore = db.createObjectStore('submissions', { keyPath: 'id' });
          submissionsStore.createIndex('by-task', 'taskId');
          submissionsStore.createIndex('by-user', 'userId');
          submissionsStore.createIndex('by-status', 'status');
          submissionsStore.createIndex('by-sync', 'synced');

          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('by-chat', 'chatId');
          messagesStore.createIndex('by-user', 'senderId');
          messagesStore.createIndex('by-read', 'read');
          messagesStore.createIndex('by-sync', 'synced');
          messagesStore.createIndex('by-timestamp', 'timestamp');

          const paymentsStore = db.createObjectStore('payments', { keyPath: 'id' });
          paymentsStore.createIndex('by-user', 'userId');
          paymentsStore.createIndex('by-type', 'type');
          paymentsStore.createIndex('by-status', 'status');
          paymentsStore.createIndex('by-sync', 'synced');

          const cacheStore = db.createObjectStore('cache', { keyPath: 'url' });
          cacheStore.createIndex('by-expires', 'expiresAt');

          const queueStore = db.createObjectStore('offlineQueue', { keyPath: 'id' });
          queueStore.createIndex('by-timestamp', 'timestamp');
          queueStore.createIndex('by-retries', 'retries');

          db.createObjectStore('settings', { keyPath: 'key' });
        },
      });

      this.isReady = true;
      console.log('Offline storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
      throw error;
    }
  }

  /**
   * Check if storage is ready
   */
  private async checkReady(): Promise<void> {
    if (!this.isReady) {
      await this.init();
    }
  }

  // ==================== User Operations ====================

  /**
   * Save user data
   */
  async saveUser(user: LabelMintDB['users']['value']): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const userData = {
      ...user,
      lastSync: Date.now(),
      synced: navigator.onLine
    };

    await this.db.put('users', userData);
  }

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<LabelMintDB['users']['value'] | undefined> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.get('users', id);
  }

  // ==================== Project Operations ====================

  /**
   * Save project
   */
  async saveProject(project: LabelMintDB['projects']['value']): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const projectData = {
      ...project,
      lastSync: Date.now(),
      synced: navigator.onLine
    };

    await this.db.put('projects', projectData);

    // Queue for sync if offline
    if (!navigator.onLine) {
      await this.queueAction({
        id: `project_${project.id}_${Date.now()}`,
        type: project.synced ? 'update' : 'create',
        endpoint: '/api/projects',
        method: project.synced ? 'PUT' : 'POST',
        data: projectData,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      });
    }
  }

  /**
   * Get projects for owner
   */
  async getProjectsByOwner(ownerId: string): Promise<LabelMintDB['projects']['value'][]> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAllFromIndex('projects', 'by-owner', ownerId);
  }

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<LabelMintDB['projects']['value'] | undefined> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.get('projects', id);
  }

  // ==================== Task Operations ====================

  /**
   * Save task
   */
  async saveTask(task: LabelMintDB['tasks']['value']): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const taskData = {
      ...task,
      lastSync: Date.now(),
      synced: navigator.onLine,
      offlineAction: task.synced ? 'update' : 'create'
    };

    await this.db.put('tasks', taskData);

    // Queue for sync if offline
    if (!navigator.onLine) {
      await this.queueAction({
        id: `task_${task.id}_${Date.now()}`,
        type: taskData.offlineAction!,
        endpoint: '/api/tasks',
        method: taskData.offlineAction === 'create' ? 'POST' : 'PUT',
        data: taskData,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      });
    }
  }

  /**
   * Get tasks for project
   */
  async getTasksByProject(projectId: string): Promise<LabelMintDB['tasks']['value'][]> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAllFromIndex('tasks', 'by-project', projectId);
  }

  /**
   * Get tasks assigned to user
   */
  async getTasksByUser(userId: string): Promise<LabelMintDB['tasks']['value'][]> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAllFromIndex('tasks', 'by-assigned', userId);
  }

  // ==================== Submission Operations ====================

  /**
   * Save submission
   */
  async saveSubmission(submission: LabelMintDB['submissions']['value']): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const submissionData = {
      ...submission,
      lastSync: Date.now(),
      synced: navigator.onLine,
      offlineAction: submission.synced ? 'update' : 'create'
    };

    await this.db.put('submissions', submissionData);

    // Queue for sync if offline
    if (!navigator.onLine) {
      await this.queueAction({
        id: `submission_${submission.id}_${Date.now()}`,
        type: submissionData.offlineAction!,
        endpoint: '/api/submissions',
        method: submissionData.offlineAction === 'create' ? 'POST' : 'PUT',
        data: submissionData,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      });
    }
  }

  /**
   * Get submissions for task
   */
  async getSubmissionsByTask(taskId: string): Promise<LabelMintDB['submissions']['value'][]> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAllFromIndex('submissions', 'by-task', taskId);
  }

  // ==================== Payment Operations ====================

  /**
   * Save payment
   */
  async savePayment(payment: LabelMintDB['payments']['value']): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const paymentData = {
      ...payment,
      lastSync: Date.now(),
      synced: navigator.onLine,
      offlineAction: payment.synced ? 'update' : 'create'
    };

    await this.db.put('payments', paymentData);

    // Queue for sync if offline
    if (!navigator.onLine) {
      await this.queueAction({
        id: `payment_${payment.id}_${Date.now()}`,
        type: paymentData.offlineAction!,
        endpoint: '/api/payments',
        method: paymentData.offlineAction === 'create' ? 'POST' : 'PUT',
        data: paymentData,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 5 // More retries for payments
      });
    }
  }

  /**
   * Get payments for user
   */
  async getPaymentsByUser(userId: string): Promise<LabelMintDB['payments']['value'][]> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAllFromIndex('payments', 'by-user', userId);
  }

  // ==================== Cache Operations ====================

  /**
   * Cache API response
   */
  async cacheResponse(url: string, method: string, data: any, headers: any, ttl: number = 300000): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const cacheEntry: LabelMintDB['cache']['value'] = {
      url,
      method,
      data,
      headers,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      etag: headers.etag
    };

    await this.db.put('cache', cacheEntry);
  }

  /**
   * Get cached response
   */
  async getCachedResponse(url: string, method: string): Promise<LabelMintDB['cache']['value'] | undefined> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const cached = await this.db.get('cache', url);

    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    // Remove expired cache
    if (cached) {
      await this.db.delete('cache', url);
    }

    return undefined;
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('cache', 'readwrite');
    const index = tx.store.index('by-expires');
    const now = Date.now();

    let cursor = await index.openCursor(IDBKeyRange.upperBound(now));

    while (cursor) {
      cursor.delete();
      cursor = await cursor.continue();
    }

    await tx.done;
  }

  // ==================== Offline Queue Operations ====================

  /**
   * Add action to offline queue
   */
  async queueAction(action: LabelMintDB['offlineQueue']['value']): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.put('offlineQueue', action);
  }

  /**
   * Get all queued actions
   */
  async getQueuedActions(): Promise<LabelMintDB['offlineQueue']['value'][]> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAll('offlineQueue');
  }

  /**
   * Remove action from queue
   */
  async removeQueuedAction(id: string): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.delete('offlineQueue', id);
  }

  /**
   * Increment retry count for action
   */
  async incrementRetryCount(id: string): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const action = await this.db.get('offlineQueue', id);
    if (action) {
      action.retries++;
      await this.db.put('offlineQueue', action);
    }
  }

  // ==================== Settings Operations ====================

  /**
   * Save setting
   */
  async saveSetting(key: string, value: any): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.put('settings', {
      key,
      value,
      updatedAt: Date.now(),
      synced: navigator.onLine
    });
  }

  /**
   * Get setting
   */
  async getSetting(key: string): Promise<any> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const setting = await this.db.get('settings', key);
    return setting?.value;
  }

  // ==================== Sync Operations ====================

  /**
   * Get all unsynced items
   */
  async getUnsyncedItems(): Promise<{
    projects: LabelMintDB['projects']['value'][];
    tasks: LabelMintDB['tasks']['value'][];
    submissions: LabelMintDB['submissions']['value'][];
    payments: LabelMintDB['payments']['value'][];
  }> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const [projects, tasks, submissions, payments] = await Promise.all([
      this.db.getAllFromIndex('projects', 'by-sync', false),
      this.db.getAllFromIndex('tasks', 'by-sync', false),
      this.db.getAllFromIndex('submissions', 'by-sync', false),
      this.db.getAllFromIndex('payments', 'by-sync', false)
    ]);

    return { projects, tasks, submissions, payments };
  }

  /**
   * Mark items as synced
   */
  async markAsSynced(type: 'projects' | 'tasks' | 'submissions' | 'payments', ids: string[]): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(type, 'readwrite');

    for (const id of ids) {
      const item = await tx.store.get(id);
      if (item) {
        item.synced = true;
        item.lastSync = Date.now();
        delete item.offlineAction;
        await tx.store.put(item);
      }
    }

    await tx.done;
  }

  /**
   * Clear all data (for logout/reset)
   */
  async clearAll(): Promise<void> {
    await this.checkReady();
    if (!this.db) throw new Error('Database not initialized');

    const stores = ['users', 'projects', 'tasks', 'submissions', 'messages', 'payments', 'cache', 'offlineQueue', 'settings'];

    for (const store of stores) {
      await this.db.clear(store);
    }

    console.log('All offline data cleared');
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    used: number;
    available: number;
    quota: number;
    usage: Record<string, number>;
  }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        available: (estimate.quota || 0) - (estimate.usage || 0),
        quota: estimate.quota || 0,
        usage: {} // Would need to implement per-store tracking
      };
    }

    return {
      used: 0,
      available: 0,
      quota: 0,
      usage: {}
    };
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorage();

// Export types
export type { LabelMintDB };

// Initialize storage when module is imported
if (typeof window !== 'undefined') {
  offlineStorage.init().catch(console.error);
}