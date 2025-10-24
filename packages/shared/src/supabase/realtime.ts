// ============================================================================
// SUPABASE REALTIME UTILITIES
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

export interface RealtimeSubscription {
  id: string;
  channel: any;
  unsubscribe: () => void;
}

export interface RealtimeEvent<T = any> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  errors: any[];
}

export interface RealtimeConfig {
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  table?: string;
  filter?: string;
}

/**
 * Realtime manager for Supabase subscriptions
 */
export class SupabaseRealtimeManager {
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  /**
   * Subscribe to table changes
   */
  subscribeToTable<T = any>(
    table: string,
    callback: (event: RealtimeEvent<T>) => void,
    config: RealtimeConfig = {}
  ): RealtimeSubscription {
    const channelId = `table-${table}-${Date.now()}`;

    const channel = this.client
      .channel(channelId)
      .on('postgres_changes', {
        event: config.event || '*',
        schema: config.schema || 'public',
        table,
        filter: config.filter
      }, (payload) => {
        callback(payload as RealtimeEvent<T>);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to table: ${table}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error subscribing to table: ${table}`);
        }
      });

    const subscription: RealtimeSubscription = {
      id: channelId,
      channel,
      unsubscribe: () => {
        this.client.removeChannel(channel);
        this.subscriptions.delete(channelId);
      }
    };

    this.subscriptions.set(channelId, subscription);
    return subscription;
  }

  /**
   * Subscribe to user-specific changes
   */
  subscribeToUserChanges(
    userId: string,
    callback: (event: RealtimeEvent) => void
  ): RealtimeSubscription {
    return this.subscribeToTable('users', callback, {
      filter: `id=eq.${userId}`
    });
  }

  /**
   * Subscribe to task updates for a user
   */
  subscribeToUserTasks(
    userId: string,
    callback: (event: RealtimeEvent) => void
  ): RealtimeSubscription {
    return this.subscribeToTable('tasks', callback, {
      filter: `assigned_to=eq.${userId}`
    });
  }

  /**
   * Subscribe to project changes
   */
  subscribeToProjectChanges(
    projectId: string,
    callback: (event: RealtimeEvent) => void
  ): RealtimeSubscription {
    return this.subscribeToTable('projects', callback, {
      filter: `id=eq.${projectId}`
    });
  }

  /**
   * Subscribe to project members changes
   */
  subscribeToProjectMembers(
    projectId: string,
    callback: (event: RealtimeEvent) => void
  ): RealtimeSubscription {
    return this.subscribeToTable('project_members', callback, {
      filter: `project_id=eq.${projectId}`
    });
  }

  /**
   * Subscribe to label updates for a task
   */
  subscribeToTaskLabels(
    taskId: string,
    callback: (event: RealtimeEvent) => void
  ): RealtimeSubscription {
    return this.subscribeToTable('labels', callback, {
      filter: `task_id=eq.${taskId}`
    });
  }

  /**
   * Subscribe to transaction updates for a user
   */
  subscribeToUserTransactions(
    userId: string,
    callback: (event: RealtimeEvent) => void
  ): RealtimeSubscription {
    return this.subscribeToTable('transactions', callback, {
      filter: `user_id=eq.${userId}`
    });
  }

  /**
   * Subscribe to withdrawal requests for a user
   */
  subscribeToUserWithdrawals(
    userId: string,
    callback: (event: RealtimeEvent) => void
  ): RealtimeSubscription {
    return this.subscribeToTable('withdrawal_requests', callback, {
      filter: `user_id=eq.${userId}`
    });
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.unsubscribe();
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Check if subscription exists
   */
  hasSubscription(subscriptionId: string): boolean {
    return this.subscriptions.has(subscriptionId);
  }
}

/**
 * Create realtime manager
 */
export function createRealtimeManager(client: SupabaseClient<Database>): SupabaseRealtimeManager {
  return new SupabaseRealtimeManager(client);
}

/**
 * Realtime event type guards
 */
export function isInsertEvent<T>(event: RealtimeEvent<T>): event is RealtimeEvent<T> & { eventType: 'INSERT' } {
  return event.eventType === 'INSERT';
}

export function isUpdateEvent<T>(event: RealtimeEvent<T>): event is RealtimeEvent<T> & { eventType: 'UPDATE' } {
  return event.eventType === 'UPDATE';
}

export function isDeleteEvent<T>(event: RealtimeEvent<T>): event is RealtimeEvent<T> & { eventType: 'DELETE' } {
  return event.eventType === 'DELETE';
}

/**
 * Realtime helper functions
 */
export const RealtimeHelpers = {
  /**
   * Create a filter for user-specific records
   */
  userFilter(userId: string): string {
    return `user_id=eq.${userId}`;
  },

  /**
   * Create a filter for project-specific records
   */
  projectFilter(projectId: string): string {
    return `project_id=eq.${projectId}`;
  },

  /**
   * Create a filter for task-specific records
   */
  taskFilter(taskId: string): string {
    return `task_id=eq.${taskId}`;
  },

  /**
   * Create a filter for active records
   */
  activeFilter(): string {
    return 'status=eq.active';
  },

  /**
   * Create a filter for recent records (within last 24 hours)
   */
  recentFilter(): string {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return `created_at=gte.${yesterday}`;
  }
};