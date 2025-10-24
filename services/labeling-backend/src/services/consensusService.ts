import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { queueService } from './queueService.js';

const prisma = new PrismaClient();

export interface ConsensusResult {
  finalAnswer: any;
  confidence: number;
  participatingWorkers: string[];
  isConsensus: boolean;
  requiredVotes: number;
  actualVotes: number;
}

export class ConsensusService {
  private static instance: ConsensusService;

  static getInstance(): ConsensusService {
    if (!ConsensusService.instance) {
      ConsensusService.instance = new ConsensusService();
    }
    return ConsensusService.instance;
  }

  /**
   * Process consensus for a task
   */
  async processConsensus(taskId: string): Promise<ConsensusResult | null> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          project: true,
          labels: {
            include: {
              worker: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
            take: 5, // Maximum 5 votes for consensus
          },
        },
      });

      if (!task) {
        logger.error(`Task ${taskId} not found`);
        return null;
      }

      const labels = task.labels.filter(l => !l.isGoldEval); // Exclude gold evaluations
      const requiredVotes = this.getRequiredVotes(task.type);

      if (labels.length < requiredVotes) {
        logger.debug(`Task ${taskId}: Not enough votes yet (${labels.length}/${requiredVotes})`);
        return null;
      }

      // Check for early consensus (2/2 agreement)
      if (labels.length >= 2 && this.checkEarlyConsensus(labels.slice(0, 2))) {
        const result = this.calculateConsensus(labels.slice(0, 2));
        await this.finalizeTask(taskId, result);
        return result;
      }

      // Full consensus calculation
      if (labels.length >= requiredVotes) {
        const result = this.calculateConsensus(labels);
        await this.finalizeTask(taskId, result);
        return result;
      }

      // Need more votes
      return null;
    } catch (error) {
      logger.error(`Consensus processing error for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Get required number of votes based on task type
   */
  private getRequiredVotes(taskType: string): number {
    const defaults = {
      IMG_CLS: 3,
      TXT_CLS: 3,
      RLHF_PAIR: 2, // Pairwise comparison needs fewer votes
      BBOX: 3,
    };
    return defaults[taskType as keyof typeof defaults] || 3;
  }

  /**
   * Check for early consensus (2/2 agreement)
   */
  private checkEarlyConsensus(labels: any[]): boolean {
    if (labels.length !== 2) return false;

    const answer1 = labels[0].answer;
    const answer2 = labels[1].answer;

    // For simple classification
    if (typeof answer1 === 'string' && typeof answer2 === 'string') {
      return answer1 === answer2;
    }

    // For complex answers (e.g., bounding boxes), implement similarity check
    return this.compareAnswers(answer1, answer2) > 0.95;
  }

  /**
   * Calculate consensus from votes
   */
  private calculateConsensus(labels: any[]): ConsensusResult {
    const answers = labels.map(l => l.answer);
    const votes = {};

    // Count votes for each unique answer
    for (const answer of answers) {
      const key = JSON.stringify(answer);
      votes[key] = (votes[key] || 0) + 1;
    }

    // Find the answer with most votes
    let maxVotes = 0;
    let winningAnswer = null;
    let totalVotes = answers.length;

    for (const [answerKey, voteCount] of Object.entries(votes)) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winningAnswer = JSON.parse(answerKey);
      }
    }

    // Calculate confidence
    const confidence = maxVotes / totalVotes;
    const isConsensus = confidence >= 0.67; // 2/3 agreement

    return {
      finalAnswer: winningAnswer,
      confidence,
      participatingWorkers: labels.map(l => l.workerId),
      isConsensus,
      requiredVotes: this.getRequiredVotes('IMG_CLS'), // Would get from actual task
      actualVotes: totalVotes,
    };
  }

  /**
   * Compare two answers for similarity
   */
  private compareAnswers(answer1: any, answer2: any): number {
    // For string answers
    if (typeof answer1 === 'string' && typeof answer2 === 'string') {
      return answer1 === answer2 ? 1 : 0;
    }

    // For bounding boxes
    if (answer1.type === 'bbox' && answer2.type === 'bbox') {
      return this.calculateIoU(answer1.data, answer2.data);
    }

    // For arrays (e.g., multiple labels)
    if (Array.isArray(answer1) && Array.isArray(answer2)) {
      const intersection = answer1.filter(x => answer2.includes(x)).length;
      const union = new Set([...answer1, ...answer2]).size;
      return intersection / union;
    }

    // Default: exact match
    return answer1 === answer2 ? 1 : 0;
  }

  /**
   * Calculate Intersection over Union (IoU) for bounding boxes
   */
  private calculateIoU(box1: any, box2: any): number {
    // box format: {x, y, width, height}
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 <= x1 || y2 <= y1) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;

    return intersection / union;
  }

  /**
   * Finalize task with consensus result
   */
  private async finalizeTask(taskId: string, result: ConsensusResult): Promise<void> {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETE',
        finalAnswer: result.finalAnswer,
        confidence: result.confidence,
        consensusWorkers: result.participatingWorkers,
      },
    });

    // Update worker accuracy scores
    await this.updateWorkerAccuracy(taskId, result);

    // Notify if task needs escalation
    if (!result.isConsensus && result.actualVotes >= 5) {
      await this.escalateTask(taskId);
    }

    logger.info(`Task ${taskId} finalized with consensus: ${result.confidence.toFixed(2)}`);
  }

  /**
   * Update worker accuracy based on their contribution
   */
  private async updateWorkerAccuracy(taskId: string, result: ConsensusResult): Promise<void> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { labels: true },
    });

    if (!task || task.gold) return; // Skip gold tasks

    const labels = await prisma.label.findMany({
      where: { taskId },
      include: { worker: true },
    });

    for (const label of labels) {
      const isCorrect = this.compareAnswers(label.answer, result.finalAnswer) > 0.9;

      await prisma.worker.update({
        where: { id: label.workerId },
        data: {
          accuracy: {
            increment: isCorrect ? 0.01 : -0.005,
          },
          tasksCompleted: {
            increment: 1,
          },
        },
      });

      // Update trust score based on performance
      await this.updateTrustScore(label.workerId, isCorrect);
    }
  }

  /**
   * Update worker trust score
   */
  private async updateTrustScore(workerId: string, isCorrect: boolean): Promise<void> {
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) return;

    const change = isCorrect ? 0.001 : -0.002;
    const newScore = Math.max(0, Math.min(1, worker.trustScore + change));

    await prisma.worker.update({
      where: { id: workerId },
      data: { trustScore: newScore },
    });
  }

  /**
   * Escalate task for expert review
   */
  private async escalateTask(taskId: string): Promise<void> {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'ESCALATED',
        escalatedAt: new Date(),
      },
    });

    // Notify admins
    logger.warn(`Task ${taskId} escalated due to lack of consensus`);

    // Add to expert review queue
    await queueService.addToQueue('expert-review', {
      taskId,
      reason: 'NO_CONSENSUS',
    });
  }
}

export const consensusService = ConsensusService.getInstance();