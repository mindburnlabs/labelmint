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
export {
  TaskState,
  STATE_TRANSITIONS,
  TERMINAL_STATES,
  ACTIVE_STATES,
  CONSENSUS_STATES,
  InvalidStateTransition,
  TransitionContext,
  StateTransitionEvent,
  StateMetadata,
  TaskStateHistory
} from './TaskState';

export {
  TaskStateMachine,
  Label,
  ConsensusResult,
  ConsensusConfig
} from './TaskStateMachine';

export {
  TaskEventBus,
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
  WorkerTrustUpdatedEvent,
  EventHandler,
  EventSubscription,
  globalTaskEventBus
} from './TaskEventBus';

export {
  ConsensusService,
  LabelSubmission,
  ConsensusServiceConfig,
  ConsensusMetrics
} from './ConsensusService';

export {
  HoneypotTaskHandler,
  HoneypotTask,
  HoneypotSubmission,
  HoneypotResult,
  WorkerHoneypotStats,
  HoneypotConfig
} from './HoneypotTaskHandler';