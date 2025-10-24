import { TaskStateMachine, TaskState, TransitionContext } from './TaskStateMachine';
import { TaskEventBus, TaskEventType } from './TaskEventBus';

// ============================================================================
// HONEYPOT TYPES
// ============================================================================

export interface HoneypotTask {
  id: string;
  expectedLabel: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  data: any;
  points: number;
  trustBonus: number;
  accuracyPenalty: number;
  createdAt: Date;
}

export interface HoneypotSubmission {
  taskId: string;
  userId: string;
  submittedLabel: string;
  confidence?: number;
  timeSpent?: number;
}

export interface HoneypotResult {
  taskId: string;
  userId: string;
  expectedLabel: string;
  submittedLabel: string;
  isCorrect: boolean;
  accuracyImpact: number;
  trustScoreChange: number;
  pointsEarned: number;
  timeBonus?: number;
}

export interface WorkerHoneypotStats {
  userId: string;
  totalAttempted: number;
  totalCorrect: number;
  accuracyRate: number;
  trustScore: number;
  lastHoneypotAt?: Date;
  streak: number;
  bestStreak: number;
}

export interface HoneypotConfig {
  accuracyThreshold: number; // Minimum accuracy to pass
  trustScoreThreshold: number; // Minimum trust score for honeypots
  maxDailyAttempts: number; // Maximum honeypot attempts per day
  accuracyWeight: number; // How much accuracy affects trust score
  timeWeight: number; // How much time affects score
  streakBonus: number; // Bonus for consecutive correct answers
  maxStreak: number; // Maximum streak bonus multiplier
  penaltyMultiplier: number; // How much incorrect answers penalize
}

// ============================================================================
// HONEYPOT TASK HANDLER
// ============================================================================

export class HoneypotTaskHandler {
  private eventBus: TaskEventBus;
  private config: HoneypotConfig;
  private workerStats: Map<string, WorkerHoneypotStats> = new Map();
  private activeHoneypots: Map<string, HoneypotTask> = new Map();

  constructor(eventBus: TaskEventBus, config?: Partial<HoneypotConfig>) {
    this.eventBus = eventBus;

    // Default configuration
    this.config = {
      accuracyThreshold: 0.85,
      trustScoreThreshold: 50,
      maxDailyAttempts: 10,
      accuracyWeight: 0.7,
      timeWeight: 0.3,
      streakBonus: 0.1,
      maxStreak: 5,
      penaltyMultiplier: 2,
      ...config
    };

    // Setup event listeners
    this.setupEventListeners();
  }

  // ============================================================================
  // HONEYPOT PROCESSING
  // ============================================================================

  /**
   * Process honeypot task submission
   */
  async processSubmission(submission: HoneypotSubmission): Promise<HoneypotResult> {
    const honeypot = this.activeHoneypots.get(submission.taskId);
    if (!honeypot) {
      throw new Error(`Honeypot task not found: ${submission.taskId}`);
    }

    // Check daily attempt limit
    await this.checkDailyLimit(submission.userId);

    // Create or update worker stats
    let stats = this.workerStats.get(submission.userId);
    if (!stats) {
      stats = this.initializeWorkerStats(submission.userId);
      this.workerStats.set(submission.userId, stats);
    }

    // Evaluate submission
    const isCorrect = submission.submittedLabel === honeypot.expectedLabel;
    const accuracyImpact = this.calculateAccuracyImpact(stats, isCorrect);
    const trustScoreChange = this.calculateTrustScoreChange(stats, isCorrect, submission);
    const pointsEarned = this.calculatePointsEarned(honeypot, isCorrect, submission);

    // Update stats
    stats.totalAttempted++;
    if (isCorrect) {
      stats.totalCorrect++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else {
      stats.streak = 0;
    }
    stats.accuracyRate = stats.totalCorrect / stats.totalAttempted;
    stats.trustScore = Math.max(0, Math.min(100, stats.trustScore + trustScoreChange));
    stats.lastHoneypotAt = new Date();

    // Create result
    const result: HoneypotResult = {
      taskId: submission.taskId,
      userId: submission.userId,
      expectedLabel: honeypot.expectedLabel,
      submittedLabel: submission.submittedLabel,
      isCorrect,
      accuracyImpact,
      trustScoreChange,
      pointsEarned
    };

    // Handle state transitions
    await this.handleStateTransition(submission, isCorrect);

    // Publish events
    await this.publishEvents(result);

    return result;
  }

  /**
   * Create new honeypot task
   */
  createHoneypot(honeypot: Omit<HoneypotTask, 'id' | 'createdAt'>): HoneypotTask {
    const task: HoneypotTask = {
      ...honeypot,
      id: this.generateHoneypotId(),
      createdAt: new Date()
    };

    this.activeHoneypots.set(task.id, task);
    return task;
  }

  /**
   * Get active honeypot task
   */
  getHoneypot(taskId: string): HoneypotTask | undefined {
    return this.activeHoneypots.get(taskId);
  }

  /**
   * Get worker honeypot statistics
   */
  getWorkerStats(userId: string): WorkerHoneypotStats | undefined {
    return this.workerStats.get(userId);
  }

  /**
   * Check if user is eligible for honeypot
   */
  async isEligibleForHoneypot(userId: string, trustScore?: number): Promise<boolean> {
    const stats = this.workerStats.get(userId);
    const currentTrustScore = trustScore ?? stats?.trustScore ?? 0;

    // Check trust score threshold
    if (currentTrustScore < this.config.trustScoreThreshold) {
      return false;
    }

    // Check daily limit
    const todayAttempts = await this.getTodayAttempts(userId);
    if (todayAttempts >= this.config.maxDailyAttempts) {
      return false;
    }

    // Check accuracy rate (if enough attempts)
    if (stats && stats.totalAttempted >= 5) {
      if (stats.accuracyRate < this.config.accuracyThreshold) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get next appropriate honeypot for user
   */
  async getNextHoneypot(userId: string, workerLevel?: number): Promise<HoneypotTask | null> {
    // Check eligibility first
    if (!(await this.isEligibleForHoneypot(userId))) {
      return null;
    }

    // Get available honeypots
    const available = Array.from(this.activeHoneypots.values())
      .filter(h => this.isHoneypotAppropriate(h, workerLevel));

    if (available.length === 0) {
      return null;
    }

    // Select honeypot based on user performance
    const stats = this.workerStats.get(userId);
    return this.selectHoneypot(available, stats);
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  /**
   * Handle state transition for honeypot task
   */
  private async handleStateTransition(
    submission: HoneypotSubmission,
    isCorrect: boolean
  ): Promise<void> {
    const machine = new TaskStateMachine(
      submission.taskId,
      TaskState.CREATED,
      {
        requiredLabels: 1,
        threshold: 1
      }
    );

    const context: TransitionContext = {
      taskId: submission.taskId,
      userId: submission.userId,
      reason: isCorrect ? 'Honeypot completed correctly' : 'Honeypot failed',
      timestamp: new Date(),
      metadata: {
        isHoneypot: true,
        expectedLabel: this.activeHoneypots.get(submission.taskId)?.expectedLabel,
        submittedLabel: submission.submittedLabel,
        isCorrect
      }
    };

    if (isCorrect) {
      machine.transition(TaskState.COMPLETED, context);
    } else {
      machine.transition(TaskState.FAILED, context);
    }
  }

  // ============================================================================
  // CALCULATIONS
  // ============================================================================

  /**
   * Calculate accuracy impact on trust score
   */
  private calculateAccuracyImpact(stats: WorkerHoneypotStats, isCorrect: boolean): number {
    const baseImpact = isCorrect ? 0.1 : -0.2;

    // Apply streak bonus
    const streakMultiplier = Math.min(stats.streak, this.config.maxStreak) * this.config.streakBonus;
    const finalImpact = baseImpact * (1 + streakMultiplier);

    return Math.round(finalImpact * 100) / 100;
  }

  /**
   * Calculate trust score change
   */
  private calculateTrustScoreChange(
    stats: WorkerHoneypotStats,
    isCorrect: boolean,
    submission: HoneypotSubmission
  ): number {
    const accuracyChange = this.calculateAccuracyImpact(stats, isCorrect);
    let timeChange = 0;

    // Time bonus for quick, accurate answers
    if (isCorrect && submission.timeSpent) {
      const idealTime = 30000; // 30 seconds ideal
      const timeRatio = Math.min(submission.timeSpent / idealTime, 2);

      if (timeRatio < 0.5) {
        timeChange = 0.05; // Bonus for being quick
      } else if (timeRatio > 1.5) {
        timeChange = -0.03; // Penalty for being slow
      }
    }

    // Combine changes
    let totalChange = accuracyChange * this.config.accuracyWeight +
                     timeChange * this.config.timeWeight;

    // Apply penalty multiplier for incorrect answers
    if (!isCorrect) {
      totalChange *= this.config.penaltyMultiplier;
    }

    return Math.round(totalChange * 100) / 100;
  }

  /**
   * Calculate points earned from honeypot
   */
  private calculatePointsEarned(
    honeypot: HoneypotTask,
    isCorrect: boolean,
    submission: HoneypotSubmission
  ): number {
    let points = honeypot.points;

    if (!isCorrect) {
      points = 0;
    } else {
      // Add trust bonus
      points += honeypot.trustBonus;

      // Add time bonus for quick completion
      if (submission.timeSpent) {
        const idealTime = this.getIdealTimeForDifficulty(honeypot.difficulty);
        if (submission.timeSpent < idealTime) {
          const timeBonus = Math.floor((idealTime - submission.timeSpent) / 1000) * 0.1;
          points += Math.round(timeBonus);
        }
      }
    }

    return points;
  }

  /**
   * Get ideal time for honeypot difficulty
   */
  private getIdealTimeForDifficulty(difficulty: string): number {
    switch (difficulty) {
      case 'easy': return 10000; // 10 seconds
      case 'medium': return 30000; // 30 seconds
      case 'hard': return 60000; // 1 minute
      default: return 30000;
    }
  }

  // ============================================================================
  // VALIDATION AND LIMITS
  // ============================================================================

  /**
   * Check daily attempt limit
   */
  private async checkDailyLimit(userId: string): Promise<void> {
    const todayAttempts = await this.getTodayAttempts(userId);

    if (todayAttempts >= this.config.maxDailyAttempts) {
      throw new Error(`Daily honeypot limit exceeded (${this.config.maxDailyAttempts})`);
    }
  }

  /**
   * Get today's attempts for user
   */
  private async getTodayAttempts(userId: string): Promise<number> {
    const stats = this.workerStats.get(userId);
    if (!stats || !stats.lastHoneypotAt) {
      return 0;
    }

    const now = new Date();
    const lastHoneypot = stats.lastHoneypotAt;

    // Check if last honeypot was today
    if (lastHoneypot.toDateString() === now.toDateString()) {
      // Count from today's events (simplified - would use database in production)
      return 1;
    }

    return 0;
  }

  /**
   * Check if honeypot is appropriate for worker level
   */
  private isHoneypotAppropriate(honeypot: HoneypotTask, workerLevel?: number): boolean {
    // If no level provided, assume appropriate
    if (!workerLevel) {
      return true;
    }

    // Simple difficulty mapping (could be more sophisticated)
    switch (honeypot.difficulty) {
      case 'easy':
        return workerLevel <= 10;
      case 'medium':
        return workerLevel >= 5 && workerLevel <= 50;
      case 'hard':
        return workerLevel >= 20;
      default:
        return true;
    }
  }

  /**
   * Select appropriate honeypot for worker
   */
  private selectHoneypot(
    available: HoneypotTask[],
    stats?: WorkerHoneypotStats
  ): HoneypotTask {
    if (!stats) {
      // Return easiest honeypot for new workers
      return available.sort((a, b) => {
        const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
        return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      })[0];
    }

    // Select honeypot based on performance
    const accuracyRate = stats.accuracyRate;

    if (accuracyRate < 0.7) {
      // Return easier honeypots for struggling workers
      return available.filter(h => h.difficulty === 'easy')[0] || available[0];
    } else if (accuracyRate > 0.95) {
      // Return harder honeypots for high performers
      return available.filter(h => h.difficulty === 'hard')[0] || available[0];
    }

    // Return medium difficulty for average performers
    return available.filter(h => h.difficulty === 'medium')[0] || available[0];
  }

  // ============================================================================
  // WORKER STATS MANAGEMENT
  // ============================================================================

  /**
   * Initialize worker statistics
   */
  private initializeWorkerStats(userId: string): WorkerHoneypotStats {
    return {
      userId,
      totalAttempted: 0,
      totalCorrect: 0,
      accuracyRate: 0,
      trustScore: 50, // Default trust score
      streak: 0,
      bestStreak: 0
    };
  }

  /**
   * Update worker statistics
   */
  updateWorkerStats(userId: string, updates: Partial<WorkerHoneypotStats>): void {
    const stats = this.workerStats.get(userId);
    if (stats) {
      Object.assign(stats, updates);
      this.workerStats.set(userId, stats);
    }
  }

  /**
   * Reset worker statistics (for testing or manual intervention)
   */
  resetWorkerStats(userId: string): void {
    this.workerStats.set(userId, this.initializeWorkerStats(userId));
  }

  // ============================================================================
  // EVENT PUBLISHING
  // ============================================================================

  /**
   * Publish honeypot events
   */
  private async publishEvents(result: HoneypotResult): Promise<void> {
    if (result.isCorrect) {
      await this.eventBus.publishHoneypotPassed(
        result.taskId,
        result.userId,
        this.workerStats.get(result.userId)?.accuracyRate || 0,
        result.trustScoreChange
      );
    } else {
      await this.eventBus.publishHoneypotFailed(
        result.taskId,
        result.userId,
        result.expectedLabel,
        result.submittedLabel,
        result.accuracyImpact
      );
    }
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for worker accuracy updates from other systems
    this.eventBus.subscribe(TaskEventType.WORKER_ACCURACY_UPDATED, (event) => {
      const stats = this.workerStats.get(event.data.userId);
      if (stats) {
        stats.accuracyRate = event.data.newAccuracy;
      }
    });

    // Listen for worker trust score updates
    this.eventBus.subscribe(TaskEventType.WORKER_TRUST_UPDATED, (event) => {
      const stats = this.workerStats.get(event.data.userId);
      if (stats) {
        stats.trustScore = event.data.newTrustScore || 0;
      }
    });
  }

  /* ============================================================================
   * UTILITY METHODS
   * ============================================================================ */
  /* ============================================================================
   * UTILITY METHODS
   * ============================================================================ */
  /* ============================================================================
   * UTILITY METHODS
   * ============================================================================ */

  /**
   * Generate unique honeypot ID
   */
  private generateHoneypotId(): string {
    return `hp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get configuration
   */
  getConfig(): HoneypotConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<HoneypotConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Get all active honeypots
   */
  getActiveHoneypots(): HoneypotTask[] {
    return Array.from(this.activeHoneypots.values());
  }

  /**
   * Remove honeypot
   */
  removeHoneypot(taskId: string): boolean {
    return this.activeHoneypots.delete(taskId);
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.activeHoneypots.clear();
    this.workerStats.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalHoneypots: number;
    totalWorkers: number;
    averageAccuracy: number;
    averageTrustScore: number;
    totalAttempts: number;
    successRate: number;
  } {
    const workers = Array.from(this.workerStats.values());

    if (workers.length === 0) {
      return {
        totalHoneypots: this.activeHoneypots.size,
        totalWorkers: 0,
        averageAccuracy: 0,
        averageTrustScore: 0,
        totalAttempts: 0,
        successRate: 0
      };
    }

    const totalAttempts = workers.reduce((sum, w) => sum + w.totalAttempted, 0);
    const totalCorrect = workers.reduce((sum, w) => sum + w.totalCorrect, 0);
    const totalTrust = workers.reduce((sum, w) => sum + w.trustScore, 0);

    return {
      totalHoneypots: this.activeHoneypots.size,
      totalWorkers: workers.length,
      averageAccuracy: totalCorrect / totalAttempts,
      averageTrustScore: totalTrust / workers.length,
      totalAttempts,
      successRate: totalCorrect / totalAttempts
    };
  }
}