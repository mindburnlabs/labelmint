import { EventEmitter } from 'events';
import { TaskState, StateTransitionEvent } from './TaskState';
import { Label, ConsensusResult } from './TaskStateMachine';

// ============================================================================
// EVENT TYPES
// ============================================================================

export enum TaskEventType {
  // Task lifecycle events
  TASK_CREATED = 'task.created',
  TASK_ASSIGNED = 'task.assigned',
  TASK_STARTED = 'task.started',
  TASK_SUBMITTED = 'task.submitted',
  TASK_COMPLETED = 'task.completed',
  TASK_CANCELLED = 'task.cancelled',
  TASK_EXPIRED = 'task.expired',
  TASK_FAILED = 'task.failed',

  // State transition events
  STATE_CHANGED = 'state.changed',

  // Consensus events
  CONSENSUS_REACHED = 'consensus.reached',
  CONSENSUS_FAILED = 'consensus.failed',
  CONFLICT_DETECTED = 'consensus.conflict',
  LABELS_SUBMITTED = 'labels.submitted',
  ADDITIONAL_REVIEWER_ASSIGNED = 'reviewer.assigned',

  // Honeypot events
  HONEYPOT_FAILED = 'honeypot.failed',
  HONEYPOT_PASSED = 'honeypot.passed',

  // Performance events
  WORKER_ACCURACY_UPDATED = 'worker.accuracy.updated',
  WORKER_TRUST_UPDATED = 'worker.trust.updated'
}

// ============================================================================
// BASE EVENT INTERFACE
// ============================================================================

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  timestamp: Date;
  userId?: string;
  data?: any;
  metadata?: Record<string, any>;
}

// ============================================================================
// SPECIFIC EVENT INTERFACES
// ============================================================================

export interface TaskCreatedEvent extends TaskEvent {
  type: TaskEventType.TASK_CREATED;
  data: {
    projectId: string;
    taskType: string;
    priority: number;
    dueAt?: Date;
  };
}

export interface TaskAssignedEvent extends TaskEvent {
  type: TaskEventType.TASK_ASSIGNED;
  data: {
    userId: string;
    assignedAt: Date;
  };
}

export interface TaskStartedEvent extends TaskEvent {
  type: TaskEventType.TASK_STARTED;
  data: {
    userId: string;
    startedAt: Date;
  };
}

export interface TaskSubmittedEvent extends TaskEvent {
  type: TaskEventType.TASK_SUBMITTED;
  data: {
    userId: string;
    label: string;
    confidence?: number;
    timeSpent?: number;
  };
}

export interface TaskCompletedEvent extends TaskEvent {
  type: TaskEventType.TASK_COMPLETED;
  data: {
    finalLabel?: string;
    consensusScore?: number;
    consensusResult?: ConsensusResult;
    completedAt: Date;
  };
}

export interface StateChangedEvent extends TaskEvent {
  type: TaskEventType.STATE_CHANGED;
  data: StateTransitionEvent;
}

export interface ConsensusReachedEvent extends TaskEvent {
  type: TaskEventType.CONSENSUS_REACHED;
  data: {
    agreedLabel: string;
    confidence: number;
    labelCounts: Record<string, number>;
    totalLabels: number;
  };
}

export interface ConflictDetectedEvent extends TaskEvent {
  type: TaskEventType.CONFLICT_DETECTED;
  data: {
    labelCounts: Record<string, number>;
    topLabels: Array<{ label: string; count: number }>;
    needsAdditionalReviewers: number;
  };
}

export interface LabelsSubmittedEvent extends TaskEvent {
  type: TaskEventType.LABELS_SUBMITTED;
  data: {
    labels: Label[];
    consensusResult: ConsensusResult;
  };
}

export interface HoneypotFailedEvent extends TaskEvent {
  type: TaskEventType.HONEYPOT_FAILED;
  data: {
    userId: string;
    expectedLabel: string;
    actualLabel: string;
    accuracyImpact: number;
  };
}

export interface HoneypotPassedEvent extends TaskEvent {
  type: TaskEventType.HONEYPOT_PASSED;
  data: {
    userId: string;
    accuracy: number;
    trustBonus: number;
  };
}

export interface WorkerAccuracyUpdatedEvent extends TaskEvent {
  type: TaskEventType.WORKER_ACCURACY_UPDATED;
  data: {
    userId: string;
    oldAccuracy: number;
    newAccuracy: number;
    taskId: string;
    isHoneypot: boolean;
  };
}

// ============================================================================
// EVENT HANDLER
// ============================================================================

export type EventHandler<T extends TaskEvent = TaskEvent> = (event: T) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: TaskEventType;
  handler: EventHandler;
  once?: boolean;
  createdAt: Date;
}

// ============================================================================
// TASK EVENT BUS
// ============================================================================

export class TaskEventBus extends EventEmitter {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventHistory: TaskEvent[] = [];
  private maxHistorySize: number = 10000;
  private subscriptionIdCounter: number = 0;

  // ============================================================================
  // PUBLISHING EVENTS
  // ============================================================================

  /**
   * Publish event to bus
   */
  async publish<T extends TaskEvent>(event: T): Promise<void> {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Store in history
    this.addToHistory(event);

    // Emit to EventEmitter
    this.emit(event.type, event);
    this.emit('*', event);

    // Log event
    console.log(`[TaskEventBus] ${event.type}: ${event.taskId}`, {
      userId: event.userId,
      data: event.data
    });
  }

  /**
   * Convenience methods for common events
   */
  async publishTaskCreated(taskId: string, data: TaskCreatedEvent['data']): Promise<void> {
    await this.publish({
      type: TaskEventType.TASK_CREATED,
      taskId,
      data,
      timestamp: new Date()
    });
  }

  async publishTaskAssigned(taskId: string, userId: string): Promise<void> {
    await this.publish({
      type: TaskEventType.TASK_ASSIGNED,
      taskId,
      userId,
      data: {
        userId,
        assignedAt: new Date()
      },
      timestamp: new Date()
    });
  }

  async publishTaskStarted(taskId: string, userId: string): Promise<void> {
    await this.publish({
      type: TaskEventType.TASK_STARTED,
      taskId,
      userId,
      data: {
        userId,
        startedAt: new Date()
      },
      timestamp: new Date()
    });
  }

  async publishTaskSubmitted(
    taskId: string,
    userId: string,
    label: string,
    confidence?: number,
    timeSpent?: number
  ): Promise<void> {
    await this.publish({
      type: TaskEventType.TASK_SUBMITTED,
      taskId,
      userId,
      timestamp: new Date(),
      data: {
        userId,
        label,
        confidence,
        timeSpent
      }
    });
  }

  async publishTaskCompleted(
    taskId: string,
    finalLabel?: string,
    consensusResult?: ConsensusResult
  ): Promise<void> {
    await this.publish({
      type: TaskEventType.TASK_COMPLETED,
      taskId,
      timestamp: new Date(),
      data: {
        finalLabel,
        consensusScore: consensusResult?.confidence,
        consensusResult,
        completedAt: new Date()
      }
    });
  }

  async publishStateChanged(
    taskId: string,
    transition: StateTransitionEvent
  ): Promise<void> {
    await this.publish({
      type: TaskEventType.STATE_CHANGED,
      taskId,
      data: transition
    });
  }

  async publishConsensusReached(
    taskId: string,
    agreedLabel: string,
    confidence: number,
    labelCounts: Record<string, number>
  ): Promise<void> {
    await this.publish({
      type: TaskEventType.CONSENSUS_REACHED,
      taskId,
      data: {
        agreedLabel,
        confidence,
        labelCounts,
        totalLabels: Object.values(labelCounts).reduce((a, b) => a + b, 0)
      }
    });
  }

  async publishConflictDetected(
    taskId: string,
    labelCounts: Record<string, number>,
    needsAdditionalReviewers: number
  ): Promise<void> {
    const topLabels = Object.entries(labelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));

    await this.publish({
      type: TaskEventType.CONFLICT_DETECTED,
      taskId,
      data: {
        labelCounts,
        topLabels,
        needsAdditionalReviewers
      }
    });
  }

  async publishHoneypotFailed(
    taskId: string,
    userId: string,
    expectedLabel: string,
    actualLabel: string,
    accuracyImpact: number
  ): Promise<void> {
    await this.publish({
      type: TaskEventType.HONEYPOT_FAILED,
      taskId,
      userId,
      data: {
        userId,
        expectedLabel,
        actualLabel,
        accuracyImpact
      }
    });
  }

  async publishHoneypotPassed(
    taskId: string,
    userId: string,
    accuracy: number,
    trustBonus: number
  ): Promise<void> {
    await this.publish({
      type: TaskEventType.HONEYPOT_PASSED,
      taskId,
      userId,
      data: {
        userId,
        accuracy,
        trustBonus
      }
    });
  }

  // ============================================================================
  // SUBSCRIBING TO EVENTS
  // ============================================================================

  /**
   * Subscribe to specific event type
   */
  subscribe<T extends TaskEvent>(
    eventType: TaskEventType,
    handler: EventHandler<T>,
    options: { once?: boolean; id?: string } = {}
  ): string {
    const id = options.id || this.generateSubscriptionId();

    const subscription: EventSubscription = {
      id,
      eventType,
      handler: handler as EventHandler,
      once: options.once || false,
      createdAt: new Date()
    };

    this.subscriptions.set(id, subscription);

    if (options.once) {
      this.once(eventType, handler);
    } else {
      this.on(eventType, handler);
    }

    return id;
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll(handler: EventHandler): string {
    const id = this.generateSubscriptionId();

    const subscription: EventSubscription = {
      id,
      eventType: TaskEventType.STATE_CHANGED, // Placeholder
      handler,
      once: false,
      createdAt: new Date()
    };

    this.subscriptions.set(id, subscription);
    this.on('*', handler);

    return id;
  }

  /**
   * Subscribe with pattern matching
   */
  subscribePattern(
    pattern: string | RegExp,
    handler: EventHandler
  ): string {
    const id = this.generateSubscriptionId();

    const subscription: EventSubscription = {
      id,
      eventType: TaskEventType.STATE_CHANGED, // Placeholder
      handler,
      once: false,
      createdAt: new Date()
    };

    this.subscriptions.set(id, subscription);

    // Pattern matching
    const wrappedHandler = (event: TaskEvent) => {
      if (typeof pattern === 'string') {
        if (event.type.includes(pattern)) {
          handler(event);
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(event.type)) {
          handler(event);
        }
      }
    };

    this.on('*', wrappedHandler);

    return id;
  }

  /**
   * Unsubscribe from event
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      return false;
    }

    this.removeListener(subscription.eventType, subscription.handler);
    this.subscriptions.delete(subscriptionId);

    return true;
  }

  /**
   * Unsubscribe all handlers for event type
   */
  unsubscribeAll(eventType: TaskEventType): void {
    this.removeAllListeners(eventType);

    // Remove from subscriptions
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.eventType === eventType) {
        this.subscriptions.delete(id);
      }
    }
  }

  // ============================================================================
  // EVENT HISTORY
  // ============================================================================

  /**
   * Get event history
   */
  getHistory(
    taskId?: string,
    eventType?: TaskEventType,
    limit?: number
  ): TaskEvent[] {
    let events = this.eventHistory;

    // Filter by task ID
    if (taskId) {
      events = events.filter(e => e.taskId === taskId);
    }

    // Filter by event type
    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (limit) {
      events = events.slice(0, limit);
    }

    return events;
  }

  /**
   * Get events for task
   */
  getTaskEvents(taskId: string, limit?: number): TaskEvent[] {
    return this.getHistory(taskId, undefined, limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: TaskEventType, limit?: number): TaskEvent[] {
    return this.getHistory(undefined, eventType, limit);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get subscription info
   */
  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateSubscriptionId(): string {
    return `sub_${++this.subscriptionIdCounter}_${Date.now()}`;
  }

  private addToHistory(event: TaskEvent): void {
    this.eventHistory.push(event);

    // Maintain max history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get event statistics
   */
  getStats(): {
    totalEvents: number;
    subscriptionsCount: number;
    eventTypeCounts: Record<TaskEventType, number>;
  } {
    const eventTypeCounts: Record<string, number> = {};

    for (const event of this.eventHistory) {
      eventTypeCounts[event.type] = (eventTypeCounts[event.type] || 0) + 1;
    }

    return {
      totalEvents: this.eventHistory.length,
      subscriptionsCount: this.subscriptions.size,
      eventTypeCounts: eventTypeCounts as Record<TaskEventType, number>
    };
  }

  /**
   * Create event bus instance
   */
  static create(): TaskEventBus {
    return new TaskEventBus();
  }
}

// ============================================================================
// ADDITIONAL TYPE EXPORTS
// ============================================================================

export interface LabelSubmission {
  taskId: string;
  userId: string;
  label: any;
  confidence?: number;
  timeSpent: number;
  submittedAt: Date;
}

export interface ConsensusServiceConfig {
  requiredSubmissions: number;
  consensusThreshold: number;
  honeypotPercentage: number;
  maxRetries: number;
  conflictResolutionTimeout: number;
}

export interface ConsensusMetrics {
  totalTasks: number;
  consensusReached: number;
  conflictsDetected: number;
  averageConsensusTime: number;
  averageSubmissionsPerTask: number;
  honeypotAccuracy: number;
}

export interface HoneypotTask {
  taskId: string;
  expectedAnswer: any;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  createdAt: Date;
}

export interface HoneypotSubmission {
  taskId: string;
  userId: string;
  submittedAnswer: any;
  isCorrect: boolean;
  confidence?: number;
  timeSpent: number;
  submittedAt: Date;
}

export interface HoneypotResult {
  taskId: string;
  userId: string;
  isCorrect: boolean;
  expectedAnswer: any;
  submittedAnswer: any;
  confidence?: number;
  timeSpent: number;
  submittedAt: Date;
}

export interface WorkerHoneypotStats {
  userId: string;
  totalHoneypots: number;
  correctHoneypots: number;
  accuracy: number;
  averageTimeSpent: number;
  lastHoneypotDate?: Date;
  consecutiveFailures: number;
  isBlocked: boolean;
}

export interface HoneypotConfig {
  enabled: boolean;
  percentage: number;
  minTasksBeforeHoneypot: number;
  blockAfterFailures: number;
  blockDurationHours: number;
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
}

// ============================================================================
// GLOBAL EVENT BUS INSTANCE
// ============================================================================

export const globalTaskEventBus = TaskEventBus.create();