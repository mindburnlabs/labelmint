import { PrismaClient, Task, Worker, Project } from '@prisma/client';
import { RedisClient } from '@/lib/redis';
import { logger } from '@/utils/logger';

interface AssignmentOptions {
  userId: string;
  projectId?: string;
  taskType?: string;
  excludeCompleted?: boolean;
  limit?: number;
}

interface TaskWithPriority extends Task {
  priority: number;
  project: Project;
}

export class TaskAssignmentService {
  constructor(
    private prisma: PrismaClient,
    private redis: RedisClient
  ) {}

  /**
   * Get the next available task for a worker
   */
  async getNextTask(options: AssignmentOptions): Promise<Task | null> {
    const { userId, projectId, taskType, limit = 10 } = options;

    try {
      // Get worker stats
      const worker = await this.getWorkerStats(userId);
      if (!worker) {
        throw new Error('Worker not found');
      }

      // Check if worker is eligible for tasks
      if (!this.isWorkerEligible(worker)) {
        logger.info(`Worker ${userId} is not eligible for tasks`, {
          reason: 'Low accuracy or insufficient experience',
          accuracy: worker.accuracy,
          completedTasks: worker.completedTasks,
        });
        return null;
      }

      // Get candidate tasks
      const candidateTasks = await this.getCandidateTasks({
        userId,
        projectId,
        taskType,
        worker,
        limit,
      });

      if (candidateTasks.length === 0) {
        logger.info(`No tasks available for worker ${userId}`);
        return null;
      }

      // Select the best task based on multiple factors
      const selectedTask = await this.selectBestTask(candidateTasks, worker);

      if (selectedTask) {
        // Reserve the task for the worker
        await this.reserveTask(selectedTask.id, userId);

        logger.info(`Task ${selectedTask.id} assigned to worker ${userId}`, {
          taskId: selectedTask.id,
          projectId: selectedTask.projectId,
          taskType: selectedTask.type,
        });
      }

      return selectedTask;
    } catch (error) {
      logger.error('Error assigning task', { error, userId, options });
      throw error;
    }
  }

  /**
   * Get worker statistics
   */
  private async getWorkerStats(userId: string): Promise<Worker | null> {
    const cacheKey = `worker:${userId}:stats`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const worker = await this.prisma.worker.findUnique({
      where: { userId },
    });

    if (worker) {
      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(worker));
    }

    return worker;
  }

  /**
   * Check if worker is eligible for tasks
   */
  private isWorkerEligible(worker: Worker): boolean {
    const MIN_ACCURACY = 0.7;
    const MIN_COMPLETED_TASKS = 5;

    return (
      worker.accuracy >= MIN_ACCURACY &&
      worker.completedTasks >= MIN_COMPLETED_TASKS &&
      worker.status === 'ACTIVE'
    );
  }

  /**
   * Get candidate tasks for a worker
   */
  private async getCandidateTasks(options: {
    userId: string;
    projectId?: string;
    taskType?: string;
    worker: Worker;
    limit: number;
  }): Promise<TaskWithPriority[]> {
    const { userId, projectId, taskType, worker, limit } = options;

    // Build where clause
    const where: any = {
      status: 'PENDING',
      project: {
        status: 'RUNNING',
        budgetRemaining: { gt: 0 },
      },
    };

    if (projectId) {
      where.projectId = projectId;
    }

    if (taskType) {
      where.type = taskType;
    }

    // Get tasks the worker has already completed
    const completedTaskIds = await this.prisma.taskAnswer.findMany({
      where: { workerId: userId },
      select: { taskId: true },
    }).then(answers => answers.map(a => a.taskId));

    if (completedTaskIds.length > 0) {
      where.id = { notIn: completedTaskIds };
    }

    // Get tasks with priority scoring
    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        project: true,
        _count: {
          select: {
            answers: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' }, // Older tasks first
        { project: { priority: 'desc' } }, // Higher priority projects first
      ],
      take: limit * 2, // Get more than needed for scoring
    });

    // Filter and score tasks
    const scoredTasks: TaskWithPriority[] = tasks
      .filter(task => this.isTaskSuitableForWorker(task, worker))
      .map(task => ({
        ...task,
        priority: this.calculateTaskPriority(task, worker),
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);

    return scoredTasks;
  }

  /**
   * Check if a task is suitable for a worker
   */
  private isTaskSuitableForWorker(task: Task, worker: Worker): boolean {
    // Check if worker has completed similar tasks with good accuracy
    // This could be enhanced with more sophisticated matching

    // For now, all active task types are suitable for eligible workers
    return true;
  }

  /**
   * Calculate task priority based on multiple factors
   */
  private calculateTaskPriority(task: Task & { project: Project; _count: { answers: number } }, worker: Worker): number {
    let priority = 0;

    // Base priority from project
    priority += task.project.priority * 100;

    // Age factor (older tasks get higher priority)
    const ageInHours = (Date.now() - task.createdAt.getTime()) / (1000 * 60 * 60);
    priority += Math.min(ageInHours * 2, 100);

    // Urgency factor (tasks close to deadline get higher priority)
    if (task.project.deadline) {
      const hoursToDeadline = (task.project.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursToDeadline < 24) {
        priority += 50;
      }
    }

    // Worker experience with this task type
    // (This would require tracking worker performance by task type)
    priority += worker.level * 10;

    // Tasks with fewer completions get higher priority
    const completionRate = task._count.answers / 3; // Target 3 judgments per task
    if (completionRate < 1) {
      priority += 30;
    } else if (completionRate < 2) {
      priority += 10;
    }

    // Random factor to prevent all workers from getting the same tasks
    priority += Math.random() * 20;

    return priority;
  }

  /**
   * Select the best task from candidates
   */
  private async selectBestTask(candidates: TaskWithPriority[], worker: Worker): Promise<Task | null> {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Try to find a gold task (quality check) if needed
    const goldTaskFrequency = 0.15; // 15% of tasks should be gold
    const shouldUseGoldTask = Math.random() < goldTaskFrequency;

    if (shouldUseGoldTask) {
      const goldTask = candidates.find(t => t.gold);
      if (goldTask) {
        return goldTask;
      }
    }

    // Otherwise, return the highest priority task
    return candidates[0];
  }

  /**
   * Reserve a task for a worker
   */
  private async reserveTask(taskId: string, userId: string): Promise<void> {
    const reservationKey = `task:${taskId}:reserved`;
    const reservation = {
      userId,
      reservedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 1000).toISOString(), // 30 seconds
    };

    // Set reservation in Redis with expiration
    await this.redis.setex(reservationKey, 30, JSON.stringify(reservation));

    // Also update in database
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        reservedAt: new Date(),
        reservedBy: userId,
      },
    });
  }

  /**
   * Release a task reservation
   */
  async releaseTask(taskId: string, userId: string): Promise<void> {
    const reservationKey = `task:${taskId}:reserved`;
    await this.redis.del(reservationKey);

    await this.prisma.task.updateMany({
      where: {
        id: taskId,
        reservedBy: userId,
      },
      data: {
        reservedAt: null,
        reservedBy: null,
      },
    });
  }

  /**
   * Check if a task is reserved
   */
  async isTaskReserved(taskId: string): Promise<boolean> {
    const reservationKey = `task:${taskId}:reserved`;
    const reservation = await this.redis.get(reservationKey);

    if (!reservation) return false;

    const { expiresAt } = JSON.parse(reservation);
    return new Date(expiresAt) > new Date();
  }

  /**
   * Get task reservation info
   */
  async getTaskReservation(taskId: string): Promise<{
    userId: string;
    reservedAt: string;
    expiresAt: string;
  } | null> {
    const reservationKey = `task:${taskId}:reserved`;
    const reservation = await this.redis.get(reservationKey);

    if (!reservation) return null;

    const parsed = JSON.parse(reservation);
    if (new Date(parsed.expiresAt) <= new Date()) {
      await this.redis.del(reservationKey);
      return null;
    }

    return parsed;
  }

  /**
   * Clean up expired reservations
   */
  async cleanupExpiredReservations(): Promise<void> {
    const tasks = await this.prisma.task.findMany({
      where: {
        reservedAt: {
          lt: new Date(Date.now() - 30 * 1000), // Older than 30 seconds
        },
        status: 'PENDING',
      },
    });

    if (tasks.length > 0) {
      await this.prisma.task.updateMany({
        where: {
          id: { in: tasks.map(t => t.id) },
        },
        data: {
          reservedAt: null,
          reservedBy: null,
        },
      });

      logger.info(`Cleaned up ${tasks.length} expired task reservations`);
    }
  }

  /**
   * Get assignment statistics
   */
  async getAssignmentStats(timeRange: 'hour' | 'day' | 'week' = 'day'): Promise<{
    totalAssigned: number;
    totalCompleted: number;
    averageTime: number;
    byTaskType: Record<string, number>;
  }> {
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    const stats = await this.prisma.taskAnswer.aggregate({
      where: {
        createdAt: { gte: startTime },
      },
      _count: true,
      _avg: {
        timeSpentMs: true,
      },
    });

    const byType = await this.prisma.taskAnswer.groupBy({
      by: ['taskType'],
      where: {
        createdAt: { gte: startTime },
      },
      _count: true,
    });

    return {
      totalAssigned: stats._count,
      totalCompleted: stats._count,
      averageTime: stats._avg.timeSpentMs || 0,
      byTaskType: byType.reduce((acc, item) => {
        acc[item.taskType] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}