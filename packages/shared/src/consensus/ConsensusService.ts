import { TaskStateMachine, Label, ConsensusResult, ConsensusConfig } from './TaskStateMachine';
import { TaskEventBus, TaskEventType } from './TaskEventBus';
import { TaskState, TransitionContext } from './TaskState';

// ============================================================================
// CONSENSUS SERVICE INTERFACES
// ============================================================================

export interface LabelSubmission {
  taskId: string;
  userId: string;
  value: string;
  confidence?: number;
  timeSpent?: number;
  metadata?: Record<string, any>;
}

export interface ConsensusServiceConfig extends ConsensusConfig {
  enableEventPublishing: boolean;
  enableBatchProcessing: boolean;
  maxBatchSize: number;
  batchTimeoutMs: number;
}

export interface ConsensusMetrics {
  totalConsensusCalculations: number;
  averageConsensusTime: number;
  consensusReachedRate: number;
  conflictRate: number;
  averageLabelsPerTask: number;
}

// ============================================================================
// CONSENSUS SERVICE
// ============================================================================

export class ConsensusService {
  private eventBus: TaskEventBus;
  private config: ConsensusServiceConfig;
  private metrics: ConsensusMetrics;

  // In-memory caches (would use Redis in production)
  private taskMachines: Map<string, TaskStateMachine> = new Map();
  private taskLabels: Map<string, Label[]> = new Map();
  private pendingBatch: Map<string, LabelSubmission[]> = new Map();

  constructor(eventBus: TaskEventBus, config?: Partial<ConsensusServiceConfig>) {
    this.eventBus = eventBus;

    // Default configuration
    this.config = {
      requiredLabels: 3,
      threshold: 2,
      honeypotThreshold: 0.9,
      maxReviewers: 5,
      conflictResolutionTimeout: 24 * 60 * 60 * 1000,
      enableEventPublishing: true,
      enableBatchProcessing: true,
      maxBatchSize: 100,
      batchTimeoutMs: 5000,
      ...config
    };

    // Initialize metrics
    this.metrics = {
      totalConsensusCalculations: 0,
      averageConsensusTime: 0,
      consensusReachedRate: 0,
      conflictRate: 0,
      averageLabelsPerTask: 0
    };

    // Setup event listeners
    this.setupEventListeners();
  }

  // ============================================================================
  // LABEL SUBMISSION
  // ============================================================================

  /**
   * Submit label for task consensus
   */
  async submitLabel(submission: LabelSubmission): Promise<ConsensusResult> {
    const startTime = Date.now();

    try {
      // Get or create task state machine
      let machine = this.taskMachines.get(submission.taskId);
      if (!machine) {
        // In production, would load from database
        machine = new TaskStateMachine(submission.taskId);
        this.taskMachines.set(submission.taskId, machine);
      }

      // Check if user can submit label
      await this.validateLabelSubmission(machine, submission);

      // Create label object
      const label: Label = {
        id: this.generateLabelId(),
        task_id: submission.taskId,
        user_id: submission.userId,
        type: 'text_classification' as any, // This should come from submission or task
        data: {
          type: 'text_classification' as any,
          labels: [submission.value]
        },
        confidence: submission.confidence,
        time_spent: submission.timeSpent || 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Store label
      const labels = this.taskLabels.get(submission.taskId) || [];
      labels.push(label);
      this.taskLabels.set(submission.taskId, labels);

      // Publish label submission event
      if (this.config.enableEventPublishing) {
        await this.eventBus.publishTaskSubmitted(
          submission.taskId,
          submission.userId,
          submission.value,
          submission.confidence,
          submission.timeSpent
        );
      }

      // Calculate consensus
      const result = machine.checkConsensus(labels);

      // Update metrics
      this.updateMetrics(startTime, result);

      // Process consensus result
      await this.processConsensusResult(machine, result, submission);

      return result;
    } catch (error) {
      console.error(`Error submitting label for task ${submission.taskId}:`, error);
      throw error;
    }
  }

  /**
   * Submit multiple labels in batch
   */
  async submitLabelsBatch(submissions: LabelSubmission[]): Promise<ConsensusResult[]> {
    if (!this.config.enableBatchProcessing) {
      // Process individually if batch processing disabled
      return Promise.all(submissions.map(s => this.submitLabel(s)));
    }

    // Group by task
    const taskGroups = new Map<string, LabelSubmission[]>();
    for (const submission of submissions) {
      const group = taskGroups.get(submission.taskId) || [];
      group.push(submission);
      taskGroups.set(submission.taskId, group);
    }

    // Process each task group
    const results: ConsensusResult[] = [];
    for (const [taskId, group] of taskGroups) {
      const result = await this.processTaskBatch(taskId, group);
      results.push(result);
    }

    return results;
  }

  /**
   * Process batch of labels for a single task
   */
  private async processTaskBatch(taskId: string, submissions: LabelSubmission[]): Promise<ConsensusResult> {
    const machine = this.taskMachines.get(taskId);
    if (!machine) {
      throw new Error(`Task machine not found for ${taskId}`);
    }

    // Validate all submissions
    for (const submission of submissions) {
      await this.validateLabelSubmission(machine, submission);
    }

    // Add all labels
    const labels = this.taskLabels.get(taskId) || [];
    const newLabels: Label[] = [];

    for (const submission of submissions) {
      const label: Label = {
        id: this.generateLabelId(),
        task_id: submission.taskId,
        user_id: submission.userId,
        type: 'text_classification' as any, // This should come from submission or task
        data: {
          type: 'text_classification' as any,
          labels: [submission.value]
        },
        confidence: submission.confidence,
        time_spent: submission.timeSpent || 0,
        created_at: new Date(),
        updated_at: new Date()
      };
      labels.push(label);
      newLabels.push(label);
    }

    this.taskLabels.set(taskId, labels);

    // Calculate consensus once
    const result = machine.checkConsensus(labels);

    // Publish events for each new label
    if (this.config.enableEventPublishing) {
      for (const submission of submissions) {
        await this.eventBus.publishTaskSubmitted(
          submission.taskId,
          submission.userId,
          submission.value,
          submission.confidence,
          submission.timeSpent
        );
      }
    }

    // Process consensus result
    await this.processConsensusResult(machine, result, submissions[0]);

    return result;
  }

  // ============================================================================
  // CONSENSUS PROCESSING
  // ============================================================================

  /**
   * Process consensus result and update task state
   */
  private async processConsensusResult(
    machine: TaskStateMachine,
    result: ConsensusResult,
    submission: LabelSubmission | LabelSubmission[]
  ): Promise<void> {
    const userId = Array.isArray(submission) ? submission[0]?.userId : submission.userId;

    try {
      await machine.processConsensusResult(result, userId);

      // Publish consensus events
      if (this.config.enableEventPublishing) {
        if (result.reached && result.agreedLabel) {
          await this.eventBus.publishConsensusReached(
            machine.taskId,
            result.agreedLabel,
            result.confidence,
            result.labelCounts
          );
        } else if (result.conflict) {
          await this.eventBus.publishConflictDetected(
            machine.taskId,
            result.labelCounts,
            machine.getAdditionalReviewersNeeded(this.taskLabels.get(machine.taskId) || [])
          );
        }
      }
    } catch (error) {
      console.error(`Error processing consensus result for task ${machine.taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get consensus for task
   */
  async getConsensus(taskId: string): Promise<ConsensusResult | null> {
    const labels = this.taskLabels.get(taskId);
    if (!labels || labels.length === 0) {
      return null;
    }

    const machine = this.taskMachines.get(taskId);
    if (!machine) {
      return null;
    }

    return machine.checkConsensus(labels);
  }

  /**
   * Check if task needs additional reviewers
   */
  async needsAdditionalReviewers(taskId: string): Promise<boolean> {
    const machine = this.taskMachines.get(taskId);
    const labels = this.taskLabels.get(taskId);

    if (!machine || !labels) {
      return false;
    }

    return machine.needsAdditionalReviewers(labels);
  }

  /**
   * Get additional reviewers needed
   */
  async getAdditionalReviewersNeeded(taskId: string): Promise<number> {
    const machine = this.taskMachines.get(taskId);
    const labels = this.taskLabels.get(taskId);

    if (!machine || !labels) {
      return 0;
    }

    return machine.getAdditionalReviewersNeeded(labels);
  }

  // ============================================================================
  // TASK STATE MACHINE MANAGEMENT
  // ============================================================================

  /**
   * Create task state machine
   */
  async createTaskMachine(
    taskId: string,
    isHoneypot: boolean = false
  ): Promise<TaskStateMachine> {
    const machine = isHoneypot
      ? TaskStateMachine.createHoneypot(taskId)
      : TaskStateMachine.create(taskId);

    this.taskMachines.set(taskId, machine);

    // Publish creation event
    if (this.config.enableEventPublishing) {
      await this.eventBus.publishTaskCreated(taskId, {
        projectId: 'unknown', // Would be populated from database
        taskType: 'unknown',
        priority: 1
      });
    }

    return machine;
  }

  /**
   * Get task state machine
   */
  getTaskMachine(taskId: string): TaskStateMachine | undefined {
    return this.taskMachines.get(taskId);
  }

  /**
   * Remove task state machine
   */
  removeTaskMachine(taskId: string): void {
    this.taskMachines.delete(taskId);
    this.taskLabels.delete(taskId);
  }

  /**
   * Get all active task machines
   */
  getActiveTaskMachines(): Map<string, TaskStateMachine> {
    const active = new Map<string, TaskStateMachine>();

    for (const [taskId, machine] of this.taskMachines) {
      if (machine.isActive()) {
        active.set(taskId, machine);
      }
    }

    return active;
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Validate label submission
   */
  private async validateLabelSubmission(
    machine: TaskStateMachine,
    submission: LabelSubmission
  ): Promise<void> {
      // Check if task is in appropriate state for label submission
      if (machine.state !== TaskState.ASSIGNED && machine.state !== TaskState.IN_PROGRESS) {
        throw new Error(`Cannot submit label to task in state: ${machine.state}`);
      }

      // Check if user already submitted label
      const labels = this.taskLabels.get(submission.taskId) || [];
      const existingLabel = labels.find(l => l.userId === submission.userId);

      if (existingLabel) {
        throw new Error(`User ${submission.userId} already submitted label for task ${submission.taskId}`);
      }

      // Validate label value
      if (!submission.value || submission.value.trim().length === 0) {
        throw new Error('Label value cannot be empty');
      }

      // Validate confidence if provided
      if (submission.confidence !== undefined) {
        if (submission.confidence < 0 || submission.confidence > 1) {
          throw new Error('Confidence must be between 0 and 1');
        }
      }

      // Validate time spent if provided
      if (submission.timeSpent !== undefined) {
        if (submission.timeSpent < 0) {
          throw new Error('Time spent cannot be negative');
        }
        if (submission.timeSpent > 3600 * 1000) { // 1 hour max
          throw new Error('Time spent exceeds maximum allowed (1 hour)');
        }
      }
  }

  // ============================================================================
  // METRICS
  // ============================================================================

  /**
   * Get consensus service metrics
   */
  getMetrics(): ConsensusMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalConsensusCalculations: 0,
      averageConsensusTime: 0,
      consensusReachedRate: 0,
      conflictRate: 0,
      averageLabelsPerTask: 0
    };
  }

  /**
   * Update metrics after consensus calculation
   */
  private updateMetrics(startTime: number, result: ConsensusResult): void {
    const duration = Date.now() - startTime;

    // Update total calculations
    this.metrics.totalConsensusCalculations++;

    // Update average time
    this.metrics.averageConsensusTime =
      (this.metrics.averageConsensusTime * (this.metrics.totalConsensusCalculations - 1) + duration) /
      this.metrics.totalConsensusCalculations;

    // Update rates (simplified - would use more sophisticated tracking)
    if (result.reached) {
      this.metrics.consensusReachedRate =
        (this.metrics.consensusReachedRate * (this.metrics.totalConsensusCalculations - 1) + 1) /
        this.metrics.totalConsensusCalculations;
    }

    if (result.conflict) {
      this.metrics.conflictRate =
        (this.metrics.conflictRate * (this.metrics.totalConsensusCalculations - 1) + 1) /
        this.metrics.totalConsensusCalculations;
    }

    // Update average labels per task
    this.metrics.averageLabelsPerTask =
      (this.metrics.averageLabelsPerTask * (this.metrics.totalConsensusCalculations - 1) + result.totalLabels) /
      this.metrics.totalConsensusCalculations;
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for task completion to clean up
    this.eventBus.subscribe(TaskEventType.TASK_COMPLETED, async (event) => {
      this.removeTaskMachine(event.taskId);
    });

    // Listen for task cancellation to clean up
    this.eventBus.subscribe(TaskEventType.TASK_CANCELLED, async (event) => {
      this.removeTaskMachine(event.taskId);
    });

    // Listen for task failure to clean up
    this.eventBus.subscribe(TaskEventType.TASK_FAILED, async (event) => {
      this.removeTaskMachine(event.taskId);
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate unique label ID
   */
  private generateLabelId(): string {
    return `label_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get configuration
   */
  getConfig(): ConsensusServiceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ConsensusServiceConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Get task labels
   */
  getTaskLabels(taskId: string): Label[] {
    return this.taskLabels.get(taskId) || [];
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.taskMachines.clear();
    this.taskLabels.clear();
    this.pendingBatch.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    taskMachines: number;
    taskLabels: number;
    pendingBatches: number;
  } {
    return {
      taskMachines: this.taskMachines.size,
      taskLabels: this.taskLabels.size,
      pendingBatches: this.pendingBatch.size
    };
  }
}