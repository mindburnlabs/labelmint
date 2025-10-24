// ============================================================================
// CONSENSUS MODULE EXPORTS
// ============================================================================

// Core state machine
export * from './TaskState';
export * from './TaskStateMachine';
export * from './TaskEventBus';
export * from './ConsensusService';
export * from './HoneypotTaskHandler';

// Re-export commonly used types
export type {
  TaskState,
  InvalidStateTransition,
  TransitionContext,
  StateTransitionEvent,
  StateMetadata,
  TaskStateHistory,
  Label,
  ConsensusResult,
  ConsensusConfig
} from './TaskState';

export {
  TaskStateMachine,
  STATE_TRANSITIONS,
  TERMINAL_STATES,
  ACTIVE_STATES,
  CONSENSUS_STATES
} from './TaskStateMachine';

export type {
  TaskEventType,
  TaskEvent,
  TaskCreatedEvent,
  TaskAssignedEvent,
  TaskStartedEvent,
  TaskSubmittedEvent,
  TaskCompletedEvent,
  StateChangedEvent,
  ConsensusReachedEvent,
  ConflictDetectedEvent,
  LabelsSubmittedEvent,
  HoneypotFailedEvent,
  HoneypotPassedEvent,
  WorkerAccuracyUpdatedEvent,
  EventHandler,
  EventSubscription,
  LabelSubmission,
  ConsensusServiceConfig,
  ConsensusMetrics,
  HoneypotTask,
  HoneypotSubmission,
  HoneypotResult,
  WorkerHoneypotStats,
  HoneypotConfig
} from './TaskEventBus';

export {
  TaskEventBus,
  globalTaskEventBus
} from './TaskEventBus';

export {
  ConsensusService
} from './ConsensusService';

export {
  HoneypotTaskHandler
} from './HoneypotTaskHandler';