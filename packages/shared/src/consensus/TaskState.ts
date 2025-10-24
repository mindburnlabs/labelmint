// ============================================================================
// TASK STATE MACHINE DEFINITIONS
// ============================================================================

/**
 * Task states following formal state machine pattern
 */
export enum TaskState {
  CREATED = 'created',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  PENDING_REVIEW = 'pending_review',
  CONSENSUS_REACHED = 'consensus_reached',
  CONFLICT_DETECTED = 'conflict_detected',
  UNDER_DISPUTE = 'under_dispute',
  RESOLVED = 'resolved',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  FAILED = 'failed'
}

/**
 * State transition definitions
 * Defines valid transitions from each state
 */
export const STATE_TRANSITIONS: Record<TaskState, TaskState[]> = {
  [TaskState.CREATED]: [
    TaskState.ASSIGNED,
    TaskState.CANCELLED,
    TaskState.EXPIRED
  ],
  [TaskState.ASSIGNED]: [
    TaskState.IN_PROGRESS,
    TaskState.CANCELLED,
    TaskState.EXPIRED,
    TaskState.FAILED
  ],
  [TaskState.IN_PROGRESS]: [
    TaskState.PENDING_REVIEW,
    TaskState.CANCELLED,
    TaskState.EXPIRED,
    TaskState.FAILED
  ],
  [TaskState.PENDING_REVIEW]: [
    TaskState.CONSENSUS_REACHED,
    TaskState.CONFLICT_DETECTED,
    TaskState.UNDER_DISPUTE
  ],
  [TaskState.CONSENSUS_REACHED]: [
    TaskState.COMPLETED
  ],
  [TaskState.CONFLICT_DETECTED]: [
    TaskState.ASSIGNED, // Assign additional reviewer
    TaskState.UNDER_DISPUTE
  ],
  [TaskState.UNDER_DISPUTE]: [
    TaskState.RESOLVED,
    TaskState.CONFLICT_DETECTED
  ],
  [TaskState.RESOLVED]: [
    TaskState.COMPLETED
  ],
  [TaskState.COMPLETED]: [
    // Terminal state - no transitions
  ],
  [TaskState.CANCELLED]: [
    // Terminal state - no transitions
  ],
  [TaskState.EXPIRED]: [
    TaskState.CREATED // Recreate expired tasks
  ],
  [TaskState.FAILED]: [
    TaskState.CREATED // Recreate failed tasks
  ]
};

/**
 * Terminal states that cannot be transitioned from
 */
export const TERMINAL_STATES = new Set([
  TaskState.COMPLETED,
  TaskState.CANCELLED
]);

/**
 * Active states that require processing
 */
export const ACTIVE_STATES = new Set([
  TaskState.CREATED,
  TaskState.ASSIGNED,
  TaskState.IN_PROGRESS,
  TaskState.PENDING_REVIEW,
  TaskState.CONFLICT_DETECTED,
  TaskState.UNDER_DISPUTE
]);

/**
 * States that can have consensus calculated
 */
export const CONSENSUS_STATES = new Set([
  TaskState.PENDING_REVIEW,
  TaskState.CONFLICT_DETECTED,
  TaskState.UNDER_DISPUTE
]);

/**
 * State transition validation
 */
export class InvalidStateTransition extends Error {
  constructor(
    public fromState: TaskState,
    public toState: TaskState,
    message?: string
  ) {
    super(
      message ||
      `Invalid state transition from ${fromState} to ${toState}. Valid transitions: ${STATE_TRANSITIONS[fromState]?.join(', ') || 'none'}`
    );
    this.name = 'InvalidStateTransition';
  }
}

/**
 * Transition context providing additional information for state changes
 */
export interface TransitionContext {
  taskId: string;
  userId?: string;
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * State transition event
 */
export interface StateTransitionEvent {
  taskId: string;
  fromState: TaskState;
  toState: TaskState;
  context: TransitionContext;
}

/**
 * Check if a state transition is valid
 */
export function isValidTransition(fromState: TaskState, toState: TaskState): boolean {
  const validTransitions = STATE_TRANSITIONS[fromState];
  return validTransitions?.includes(toState) || false;
}

/**
 * Get all possible next states from current state
 */
export function getNextStates(currentState: TaskState): TaskState[] {
  return STATE_TRANSITIONS[currentState] || [];
}

/**
 * Check if state is terminal
 */
export function isTerminalState(state: TaskState): boolean {
  return TERMINAL_STATES.has(state);
}

/**
 * Check if state is active
 */
export function isActiveState(state: TaskState): boolean {
  return ACTIVE_STATES.has(state);
}

/**
 * Check if state can have consensus calculated
 */
export function canCalculateConsensus(state: TaskState): boolean {
  return CONSENSUS_STATES.has(state);
}

/**
 * State metadata for tracking
 */
export interface StateMetadata {
  state: TaskState;
  enteredAt: Date;
  updatedAt: Date;
  duration?: number; // Duration in state in milliseconds
  userId?: string; // User who triggered state
  transitions: StateTransition[];
}

/**
 * Task state history for audit trail
 */
export interface TaskStateHistory {
  taskId: string;
  currentState: TaskState;
  history: StateMetadata[];
  lastTransition?: StateTransitionEvent;
}