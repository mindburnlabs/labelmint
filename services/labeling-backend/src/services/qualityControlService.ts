import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { consensusService } from './consensusService.js';

const prisma = new PrismaClient();

export interface HoneypotConfig {
  enabled: boolean;
  frequency: number; // Percentage of tasks that should be honeypots
  difficulty: 'easy' | 'medium' | 'hard';
  minWorkerLevel: number; // Minimum trust score to receive honeypots
}

export class QualityControlService {
  private static instance: QualityControlService;
  private config: HoneypotConfig = {
    enabled: true,
    frequency: 0.15, // 15% of tasks
    difficulty: 'medium',
    minWorkerLevel: 0.75, // Silver+ workers
  };

  static getInstance(): QualityControlService {
    if (!QualityControlService.instance) {
      QualityControlService.instance = new QualityControlService();
    }
    return QualityControlService.instance;
  }

  /**
   * Check if a task should be a honeypot for a given worker
   */
  async shouldInsertHoneypot(workerId: string, projectId: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      // Get worker stats
      const worker = await prisma.worker.findUnique({
        where: { id: workerId },
      });

      if (!worker || worker.trustScore < this.config.minWorkerLevel) {
        return false;
      }

      // Check recent honeypot frequency
      const recentHoneypots = await prisma.task.count({
        where: {
          gold: true,
          labels: {
            some: {
              workerId,
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
              },
            },
          },
        },
      });

      // Limit honeypots to 20% of daily tasks
      const dailyTasks = await prisma.label.count({
        where: {
          workerId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (recentHoneypots / Math.max(dailyTasks, 1) > 0.2) {
        return false;
      }

      // Random check based on frequency
      const random = Math.random();
      return random < this.config.frequency;
    } catch (error) {
      logger.error('Error checking honeypot eligibility:', error);
      return false;
    }
  }

  /**
   * Create a honeypot task
   */
  async createHoneypotTask(
    projectId: string,
    taskType: string,
    classes: string[],
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ): Promise<string> {
    try {
      // Get project samples to create realistic honeypot
      const sampleTask = await prisma.task.findFirst({
        where: {
          projectId,
          gold: false,
          status: 'COMPLETE',
          finalAnswer: {
            not: null,
          },
        },
      });

      if (!sampleTask) {
        throw new Error('No sample task found to create honeypot');
      }

      // Generate honeypot based on difficulty
      const honeypotAnswer = this.generateHoneypotAnswer(
        sampleTask.finalAnswer,
        classes,
        difficulty
      );

      // Create honeypot task
      const honeypotTask = await prisma.task.create({
        data: {
          projectId,
          dataUrl: sampleTask.dataUrl,
          payload: sampleTask.payload,
          kind: taskType,
          gold: true,
          goldAnswer: sampleTask.finalAnswer,
          status: 'PENDING',
        },
      });

      logger.info(`Created honeypot task ${honeypotTask.id} with difficulty ${difficulty}`);
      return honeypotTask.id;
    } catch (error) {
      logger.error('Error creating honeypot task:', error);
      throw error;
    }
  }

  /**
   * Generate honeypot answer based on difficulty
   */
  private generateHoneypotAnswer(
    correctAnswer: any,
    classes: string[],
    difficulty: 'easy' | 'medium' | 'hard'
  ): any {
    switch (difficulty) {
      case 'easy':
        // 100% wrong answer
        return this.getWrongAnswer(correctAnswer, classes);

      case 'medium':
        // 70% chance of wrong answer
        return Math.random() < 0.7
          ? this.getWrongAnswer(correctAnswer, classes)
          : correctAnswer;

      case 'hard':
        // Subtle mistake that's easy to make
        return this.getSubtleWrongAnswer(correctAnswer, classes);

      default:
        return correctAnswer;
    }
  }

  /**
   * Get a clearly wrong answer
   */
  private getWrongAnswer(correctAnswer: any, classes: string[]): any {
    if (typeof correctAnswer === 'string') {
      // For classification: pick a different class
      const wrongAnswers = classes.filter(c => c !== correctAnswer);
      return wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
    }

    if (Array.isArray(correctAnswer)) {
      // For multi-label: remove one label or add a wrong one
      if (Math.random() < 0.5 && correctAnswer.length > 1) {
        return correctAnswer.slice(0, -1);
      } else {
        const wrongLabel = classes.find(c => !correctAnswer.includes(c));
        return wrongLabel ? [...correctAnswer, wrongLabel] : correctAnswer;
      }
    }

    return correctAnswer;
  }

  /**
   * Get a subtly wrong answer
   */
  private getSubtleWrongAnswer(correctAnswer: any, classes: string[]): any {
    if (typeof correctAnswer === 'string') {
      // For classification: pick a similar-sounding or visually similar class
      const similarPairs: Record<string, string> = {
        'cat': 'dog',
        'car': 'truck',
        'positive': 'neutral',
        'happy': 'excited',
      };

      return similarPairs[correctAnswer.toLowerCase()] || this.getWrongAnswer(correctAnswer, classes);
    }

    return correctAnswer;
  }

  /**
   * Evaluate worker performance on honeypot
   */
  async evaluateHoneypotPerformance(taskId: string, workerId: string): Promise<{
    passed: boolean;
    accuracy: number;
    action: 'none' | 'warning' | 'degrade' | 'suspend';
  }> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          labels: {
            where: { workerId },
          },
        },
      });

      if (!task || !task.gold) {
        return { passed: true, accuracy: 1, action: 'none' };
      }

      const label = task.labels[0];
      if (!label) {
        return { passed: false, accuracy: 0, action: 'warning' };
      }

      const isCorrect = JSON.stringify(label.answer) === JSON.stringify(task.goldAnswer);
      const accuracy = isCorrect ? 1 : 0;

      // Update gold evaluation
      await prisma.label.update({
        where: { id: label.id },
        data: {
          isGoldEval: true,
          isCorrect,
        },
      });

      // Get worker's recent honeypot performance
      const recentHoneypots = await prisma.label.findMany({
        where: {
          workerId,
          isGoldEval: true,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        include: {
          task: {
            select: { goldAnswer: true },
          },
        },
      });

      const correctCount = recentHoneypots.filter(l =>
        JSON.stringify(l.answer) === JSON.stringify(l.task.goldAnswer)
      ).length;

      const recentAccuracy = recentHoneypots.length > 0
        ? correctCount / recentHoneypots.length
        : 1;

      // Determine action based on performance
      let action: 'none' | 'warning' | 'degrade' | 'suspend' = 'none';

      if (recentAccuracy < 0.6 && recentHoneypots.length >= 5) {
        action = 'suspend';
      } else if (recentAccuracy < 0.75 && recentHoneypots.length >= 3) {
        action = 'degrade';
      } else if (recentAccuracy < 0.9 && recentHoneypots.length >= 2) {
        action = 'warning';
      }

      // Apply action
      if (action !== 'none') {
        await this.applyQualityAction(workerId, action);
      }

      return {
        passed: isCorrect,
        accuracy,
        action,
      };
    } catch (error) {
      logger.error('Error evaluating honeypot performance:', error);
      return { passed: false, accuracy: 0, action: 'none' };
    }
  }

  /**
   * Apply quality control actions
   */
  private async applyQualityAction(workerId: string, action: 'warning' | 'degrade' | 'suspend'): Promise<void> {
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) return;

    switch (action) {
      case 'warning':
        await this.sendWarning(workerId);
        break;

      case 'degrade':
        await this.degradeWorker(workerId);
        break;

      case 'suspend':
        await this.suspendWorker(workerId);
        break;
    }
  }

  /**
   * Send warning to worker
   */
  private async sendWarning(workerId: string): Promise<void> {
    logger.warn(`Sending quality warning to worker ${workerId}`);
    // In production, this would send a notification via Telegram bot
  }

  /**
   * Degrade worker trust level
   */
  private async degradeWorker(workerId: string): Promise<void> {
    const newTrustScore = Math.max(0.5, (await this.getWorkerTrustScore(workerId)) - 0.1);

    await prisma.worker.update({
      where: { id: workerId },
      data: { trustScore: newTrustScore },
    });

    logger.warn(`Degraded worker ${workerId} to trust score ${newTrustScore}`);
  }

  /**
   * Suspend worker
   */
  private async suspendWorker(workerId: string): Promise<void> {
    await prisma.worker.update({
      where: { id: workerId },
      data: {
        trustScore: 0,
        suspendedAt: new Date(),
        status: 'SUSPENDED',
      },
    });

    logger.error(`Suspended worker ${workerId} due to poor quality performance`);
  }

  /**
   * Get worker trust score
   */
  private async getWorkerTrustScore(workerId: string): Promise<number> {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { trustScore: true },
    });
    return worker?.trustScore || 0.8;
  }

  /**
   * Get quality metrics
   */
  async getQualityMetrics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    overallAccuracy: number;
    consensusRate: number;
    honeypotPassRate: number;
    workerDistribution: Record<string, number>;
  }> {
    const dateOffset = {
      day: 1,
      week: 7,
      month: 30,
    }[timeframe];

    const since = new Date(Date.now() - dateOffset * 24 * 60 * 60 * 1000);

    // Get all completed labels in timeframe
    const labels = await prisma.label.findMany({
      where: {
        createdAt: { gte: since },
        task: { status: 'COMPLETE' },
      },
      include: {
        task: {
          select: { goldAnswer: true, consensusWorkers: true },
        },
        worker: {
          select: { trustScore: true },
        },
      },
    });

    // Calculate metrics
    const goldLabels = labels.filter(l => l.task.goldAnswer);
    const correctGold = goldLabels.filter(l =>
      JSON.stringify(l.answer) === JSON.stringify(l.task.goldAnswer)
    );

    const consensusLabels = labels.filter(l => l.task.consensusWorkers?.length > 0);

    const trustLevels = {
      'Platinum (>0.96)': 0,
      'Gold (0.90-0.96)': 0,
      'Silver (0.75-0.90)': 0,
      'Bronze (<0.75)': 0,
    };

    labels.forEach(label => {
      const score = label.worker.trustScore;
      if (score > 0.96) trustLevels['Platinum (>0.96)']++;
      else if (score >= 0.90) trustLevels['Gold (0.90-0.96)']++;
      else if (score >= 0.75) trustLevels['Silver (0.75-0.90)']++;
      else trustLevels['Bronze (<0.75)']++;
    });

    return {
      overallAccuracy: labels.length > 0 ? correctGold.length / goldLabels.length : 1,
      consensusRate: labels.length > 0 ? consensusLabels.length / labels.length : 1,
      honeypotPassRate: goldLabels.length > 0 ? correctGold.length / goldLabels.length : 1,
      workerDistribution: trustLevels,
    };
  }
}

export const qualityControlService = QualityControlService.getInstance();