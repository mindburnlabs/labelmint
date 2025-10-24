import { EventEmitter } from 'events';
import {
  TaskState,
  TransitionContext,
  StateTransitionEvent,
  InvalidStateTransition,
  isValidTransition,
  getNextStates,
  isTerminalState,
  isActiveState,
  canCalculateConsensus
} from './TaskState';

// Re-export for use in other modules
export { TaskState, TransitionContext, StateTransitionEvent, InvalidStateTransition };

// ============================================================================
// LABEL AND CONSENSUS TYPES
// ============================================================================

export interface Label {
  id: string;
  taskId: string;
  userId: string;
  value: string;
  confidence?: number;
  timeSpent?: number;
  createdAt: Date;
}

export interface ConsensusResult {
  reached: boolean;
  confidence: number;
  agreedLabel?: string;
  labelCounts: Record<string, number>;
  totalLabels: number;
  requiredLabels: number;
  threshold: number;
  conflict?: boolean;
}

export interface ConsensusConfig {
  requiredLabels: number;
  threshold: number; // Number of agreements required
  honeypotThreshold: number;
  maxReviewers: number;
  conflictResolutionTimeout: number; // milliseconds
}

// ============================================================================
// TASK STATE MACHINE
// ============================================================================

export class TaskStateMachine extends EventEmitter {
  private _state: TaskState;
  private _taskId: string;
  private _config: ConsensusConfig;
  private _stateHistory: StateTransitionEvent[] = [];
  private _lastTransition?: Date;

  constructor(taskId: string, initialState: TaskState = TaskState.CREATED, config?: Partial<ConsensusConfig>) {
    super();
    this._taskId = taskId;
    this._state = initialState;
    this._lastTransition = new Date();

    // Default configuration
    this._config = {
      requiredLabels: 3,
      threshold: 2, // 2/3 consensus
      honeypotThreshold: 0.9, // 90% accuracy for honeypots
      maxReviewers: 5,
      conflictResolutionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  /**
   * Get current state
   */
  get state(): TaskState {
    return this._state;
  }

  /**
   * Get task ID
   */
  get taskId(): string {
    return this._taskId;
  }

  /**
   * Get configuration
   */
  get config(): ConsensusConfig {
    return { ...this._config };
  }

  /**
   * Get state history
   */
  getStateHistory(): StateTransitionEvent[] {
    return [...this._stateHistory];
  }

  /**
   * Transition to new state
   */
  transition(newState: TaskState, context: TransitionContext): boolean {
    // Validate transition
    if (!isValidTransition(this._state, newState)) {
      throw new InvalidStateTransition(this._state, newState);
    }

    const fromState = this._state;
    const toState = newState;

    // Update state
    this._state = newState;
    this._lastTransition = new Date();

    // Create transition event
    const transitionEvent: StateTransitionEvent = {
      taskId: this._taskId,
      fromState,
      toState,
      context: {
        ...context,
        timestamp: new Date()
      }
    };

    // Store in history
    this._stateHistory.push(transitionEvent);

    // Emit events
    this.emit('stateChanged', transitionEvent);
    this.emit(`state:${toState}`, transitionEvent);

    // Log transition
    console.log(`Task ${this._taskId} transitioned from ${fromState} to ${toState}`);

    return true;
  }

  /**
   * Check if can transition to state
   */
  canTransitionTo(state: TaskState): boolean {
    return isValidTransition(this._state, state);
  }

  /**
   * Get possible next states
   */
  getPossibleNextStates(): TaskState[] {
    return getNextStates(this._state);
  }

  /**
   * Check if state is terminal
   */
  isTerminal(): boolean {
    return isTerminalState(this._state);
  }

  /**
   * Check if state is active
   */
  isActive(): boolean {
    return isActiveState(this._state);
  }

  /**
   * Check if consensus can be calculated
   */
  canCalculateConsensus(): boolean {
    return canCalculateConsensus(this._state);
  }

  /**
   * Get time spent in current state
   */
  getTimeInCurrentState(): number {
    if (!this._lastTransition) {
      return 0;
    }
    return Date.now() - this._lastTransition.getTime();
  }

  // ============================================================================
  // CONSENSUS CALCULATION
  // ============================================================================

  /**
   * Calculate consensus from labels
   */
  checkConsensus(labels: Label[]): ConsensusResult {
    const totalLabels = labels.length;
    const labelCounts: Record<string, number> = {};

    // Count occurrences of each label
    for (const label of labels) {
      labelCounts[label.value] = (labelCounts[label.value] || 0) + 1;
    }

    // Sort labels by count
    const sortedLabels = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]);

    if (sortedLabels.length === 0) {
      return {
        reached: false,
        confidence: 0,
        labelCounts: {},
        totalLabels: 0,
        requiredLabels: this._config.requiredLabels,
        threshold: this._config.threshold
      };
    }

    const [topLabel, topCount] = sortedLabels[0];
    const confidence = topCount / totalLabels;
    // Check for conflict (tie or near-tie situation)
    // Conflict occurs when:
    // 1. There are multiple labels with counts
    // 2. The top two counts are very close (difference <= 1)
    // 3. We have enough total labels to make a decision
    // 4. It's not unanimous (all labels same)
    const voteDifference = sortedLabels.length > 1 ? Math.abs(topCount - sortedLabels[1][1]) : 0;
    const isTie = voteDifference === 0;
    const isUnanimous = topCount === totalLabels;
    const conflict = sortedLabels.length > 1 &&
      !isUnanimous && // Not unanimous
      voteDifference <= 1 && // Tie or near-tie (1 vote difference)
      totalLabels >= this._config.requiredLabels && // Have minimum labels
      (isTie || topCount < this._config.threshold); // Tie or doesn't reach threshold

    // Consensus is reached only if threshold is met AND there's no conflict
    const reached = totalLabels >= this._config.requiredLabels &&
      topCount >= this._config.threshold &&
      !conflict;

    return {
      reached,
      confidence,
      agreedLabel: reached && !conflict ? topLabel : undefined,
      labelCounts,
      totalLabels,
      requiredLabels: this._config.requiredLabels,
      threshold: this._config.threshold,
      conflict
    };
  }

  /**
   * Get top label from counts
   */
  getTopLabel(labelCounts: Record<string, number>): string | null {
    const sorted = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }

  /**
   * Determine if additional reviewers needed
   */
  needsAdditionalReviewers(labels: Label[]): boolean {
    const consensus = this.checkConsensus(labels);

    // Need more labels if we haven't reached required count
    if (labels.length < this._config.requiredLabels) {
      return true;
    }

    // Need more labels if there's a conflict
    if (consensus.conflict && labels.length < this._config.maxReviewers) {
      return true;
    }

    return false;
  }

  /**
   * Calculate number of additional reviewers needed
   */
  getAdditionalReviewersNeeded(labels: Label[]): number {
    const totalLabels = labels.length;

    if (totalLabels >= this._config.requiredLabels) {
      const consensus = this.checkConsensus(labels);

      if (consensus.conflict) {
        // Add reviewers to break tie
        return Math.min(
          this._config.maxReviewers - totalLabels,
          2 // Add 2 more reviewers for tie-break
        );
      }

      return 0;
    }

    // Need to reach minimum required
    return this._config.requiredLabels - totalLabels;
  }

  // ============================================================================
  // AUTOMATED TRANSITIONS
  // ============================================================================

  /**
   * Auto-assign task to user
   */
  async assignTo(userId: string): Promise<void> {
    if (this._state === TaskState.CREATED) {
      this.transition(TaskState.ASSIGNED, {
        taskId: this._taskId,
        userId,
        reason: 'Task assigned to worker'
      });
    } else {
      throw new InvalidStateTransition(this._state, TaskState.ASSIGNED, 'Task must be in CREATED state to assign');
    }
  }

  /**
   * Start task work
   */
  async startWork(userId: string): Promise<void> {
    if (this._state === TaskState.ASSIGNED) {
      this.transition(TaskState.IN_PROGRESS, {
        taskId: this._taskId,
        userId,
        reason: 'Worker started task'
      });
    } else {
      throw new InvalidStateTransition(this._state, TaskState.IN_PROGRESS, 'Task must be ASSIGNED to start work');
    }
  }

  /**
   * Submit work for review
   */
  async submitForReview(userId: string): Promise<void> {
    if (this._state === TaskState.IN_PROGRESS) {
      this.transition(TaskState.PENDING_REVIEW, {
        taskId: this._taskId,
        userId,
        reason: 'Work submitted for consensus review'
      });
    } else {
      throw new InvalidStateTransition(this._state, TaskState.PENDING_REVIEW, 'Task must be IN_PROGRESS to submit for review');
    }
  }

  /**
   * Process consensus result
   */
  async processConsensusResult(result: ConsensusResult, userId?: string): Promise<void> {
    if (!this.canCalculateConsensus()) {
      throw new Error(`Cannot process consensus in state: ${this._state}`);
    }

    if (result.reached && result.agreedLabel) {
      // Consensus reached - move to completed
      this.transition(TaskState.CONSENSUS_REACHED, {
        taskId: this._taskId,
        userId,
        reason: `Consensus reached with ${result.confidence.toFixed(2)} confidence`,
        metadata: {
          agreedLabel: result.agreedLabel,
          confidence: result.confidence,
          labelCounts: result.labelCounts
        }
      });

      // Immediately move to completed
      this.transition(TaskState.COMPLETED, {
        taskId: this._taskId,
        userId,
        reason: 'Task completed with consensus',
        metadata: {
          finalLabel: result.agreedLabel,
          consensusConfidence: result.confidence
        }
      });
    } else if (result.conflict) {
      // Conflict detected - assign more reviewers
      this.transition(TaskState.CONFLICT_DETECTED, {
        taskId: this._taskId,
        userId,
        reason: 'Consensus conflict detected',
        metadata: {
          labelCounts: result.labelCounts,
          topLabels: Object.entries(result.labelCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
        }
      });
    } else if (result.totalLabels < this._config.requiredLabels) {
      // Need more labels - assign additional reviewers
      this.transition(TaskState.ASSIGNED, {
        taskId: this._taskId,
        userId,
        reason: 'Need additional labels for consensus',
        metadata: {
          currentLabels: result.totalLabels,
          requiredLabels: result.requiredLabels
        }
      });
    }
  }

  /**
   * Handle task expiration
   */
  async handleExpiration(): Promise<void> {
    if (this._state === TaskState.ASSIGNED || this._state === TaskState.IN_PROGRESS) {
      this.transition(TaskState.EXPIRED, {
        taskId: this._taskId,
        reason: 'Task expired'
      });
    }
  }

  /**
   * Handle task failure
   */
  async handleFailure(reason: string, userId?: string): Promise<void> {
    if (this._state !== TaskState.COMPLETED && this._state !== TaskState.CANCELLED) {
      this.transition(TaskState.FAILED, {
        taskId: this._taskId,
        userId,
        reason
      });
    }
  }

  /**
   * Cancel task
   */
  async cancel(reason: string, userId?: string): Promise<void> {
    if (this._state !== TaskState.COMPLETED) {
      this.transition(TaskState.CANCELLED, {
        taskId: this._taskId,
        userId,
        reason
      });
    }
  }

  // ============================================================================
  // STATE SERIALIZATION
  // ============================================================================

  /**
   * Serialize state machine to JSON
   */
  toJSON(): {
    taskId: string;
    state: TaskState;
    config: ConsensusConfig;
    lastTransition: Date;
    stateHistory: StateTransitionEvent[];
  } {
    return {
      taskId: this._taskId,
      state: this._state,
      config: this._config,
      lastTransition: this._lastTransition!,
      stateHistory: this._stateHistory
    };
  }

  /**
   * Create state machine from JSON
   */
  static fromJSON(data: {
    taskId: string;
    state: TaskState;
    config: ConsensusConfig;
    lastTransition: string;
    stateHistory: StateTransitionEvent[];
  }): TaskStateMachine {
    const machine = new TaskStateMachine(data.taskId, data.state, data.config);
    machine._lastTransition = new Date(data.lastTransition);
    machine._stateHistory = data.stateHistory;
    return machine;
  }

  /**
   * Create state machine with default configuration
   */
  static create(taskId: string): TaskStateMachine {
    return new TaskStateMachine(taskId);
  }

  /**
   * Create state machine for honeypot task
   */
  static createHoneypot(taskId: string): TaskStateMachine {
    return new TaskStateMachine(taskId, TaskState.CREATED, {
      requiredLabels: 1, // Honeypots only need 1 label
      threshold: 1,
      honeypotThreshold: 0.9
    });
  }
}

// ============================================================================
// STATE HISTORY TYPES
// ============================================================================

interface StateMetadata {
  state: TaskState;
  enteredAt: Date;
  updatedAt: Date;
  duration?: number;
  userId?: string;
  transitions: StateTransitionEvent[];
}

interface StateTransition {
  fromState: TaskState;
  toState: TaskState;
  timestamp: Date;
  context: TransitionContext;
}

// Export constants for use in other modules
export const STATE_TRANSITIONS = {
  [TaskState.CREATED]: [TaskState.ASSIGNED, TaskState.CANCELLED, TaskState.EXPIRED],
  [TaskState.ASSIGNED]: [TaskState.IN_PROGRESS, TaskState.CANCELLED, TaskState.EXPIRED, TaskState.FAILED],
  [TaskState.IN_PROGRESS]: [TaskState.PENDING_REVIEW, TaskState.CANCELLED, TaskState.EXPIRED, TaskState.FAILED],
  [TaskState.PENDING_REVIEW]: [TaskState.CONSENSUS_REACHED, TaskState.CONFLICT_DETECTED, TaskState.UNDER_DISPUTE],
  [TaskState.CONSENSUS_REACHED]: [TaskState.COMPLETED],
  [TaskState.CONFLICT_DETECTED]: [TaskState.ASSIGNED, TaskState.UNDER_DISPUTE],
  [TaskState.UNDER_DISPUTE]: [TaskState.RESOLVED, TaskState.CONFLICT_DETECTED],
  [TaskState.RESOLVED]: [TaskState.COMPLETED],
  [TaskState.COMPLETED]: [],
  [TaskState.CANCELLED]: [],
  [TaskState.EXPIRED]: [TaskState.CREATED],
  [TaskState.FAILED]: [TaskState.CREATED]
};

export const TERMINAL_STATES = new Set([
  TaskState.COMPLETED,
  TaskState.CANCELLED
]);

export const ACTIVE_STATES = new Set([
  TaskState.CREATED,
  TaskState.ASSIGNED,
  TaskState.IN_PROGRESS,
  TaskState.PENDING_REVIEW,
  TaskState.CONFLICT_DETECTED,
  TaskState.UNDER_DISPUTE
]);

export const CONSENSUS_STATES = new Set([
  TaskState.PENDING_REVIEW,
  TaskState.CONFLICT_DETECTED,
  TaskState.UNDER_DISPUTE
]);