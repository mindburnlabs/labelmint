import { Request, Response } from 'express';
import { postgresDb } from '../../database';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { Logger } from '../../utils/logger';
import { ConsensusService } from '../../services/consensusService';
import { global as globalWs } from '../..';

const logger = new Logger('TaskSubmission');

// Validation schemas
const submitTaskSchema = z.object({
  label: z.any(),
  confidence: z.number().min(0).max(1).optional(),
  timeSpent: z.number().min(0),
  metadata: z.record(z.any()).optional(),
  notes: z.string().optional()
});

/**
 * Submit task with consensus integration
 */
export const submitTask = [
  validateRequest(submitTaskSchema),
  async (req: Request, res: Response) => {
    const taskId = req.params.id;
    const userId = req.user!.id;
    const { label, confidence, timeSpent, metadata, notes } = req.body;

    try {
      await postgresDb.query('BEGIN');

      // Check if task exists and is assigned to user
      const taskQuery = `
        SELECT
          t.*,
          p.consensus_type,
          p.consensus_threshold,
          p.quality_control_enabled
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = $1 AND t.assigned_to = $2
        FOR UPDATE
      `;

      const taskResult = await postgresDb.query(taskQuery, [taskId, userId]);

      if (!taskResult.rows.length) {
        await postgresDb.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Task not found or not assigned to you'
        });
      }

      const task = taskResult.rows[0];

      // Validate task status
      if (task.status !== 'assigned') {
        await postgresDb.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Task cannot be submitted. Current status: ${task.status}`
        });
      }

      // Insert or update submission
      let submissionId;
      const existingSubmission = await postgresDb.query(
        'SELECT id FROM task_submissions WHERE task_id = $1 AND user_id = $2',
        [taskId, userId]
      );

      if (existingSubmission.rows.length > 0) {
        // Update existing submission
        await postgresDb.query(
          `UPDATE task_submissions
           SET label_data = $1, confidence_score = $2, time_spent_ms = $3,
               metadata = $4, notes = $5, submitted_at = NOW()
           WHERE task_id = $6 AND user_id = $7
           RETURNING id`,
          [
            JSON.stringify(label),
            confidence || null,
            timeSpent * 1000, // Convert to milliseconds
            JSON.stringify(metadata || {}),
            notes,
            taskId,
            userId
          ]
        );
        submissionId = existingSubmission.rows[0].id;
      } else {
        // Create new submission
        const submissionResult = await postgresDb.query(
          `INSERT INTO task_submissions
           (task_id, user_id, label_data, confidence_score, time_spent_ms, metadata, notes, submitted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING id`,
          [
            taskId,
            userId,
            JSON.stringify(label),
            confidence || null,
            timeSpent * 1000,
            JSON.stringify(metadata || {}),
            notes,
            taskId
          ]
        );
        submissionId = submissionResult.rows[0].id;
      }

      // Initialize consensus service
      const consensusService = new ConsensusService();

      // Check if consensus is reached
      const consensusResult = await consensusService.evaluateConsensus(taskId);

      let taskStatus;
      let paymentAmount = 0;

      if (consensusResult.reached) {
        // Consensus reached - mark task as completed
        taskStatus = 'completed';
        paymentAmount = consensusResult.paymentAmount || task.payment_amount;

        // Update task with consensus result
        await postgresDb.query(
          `UPDATE tasks
           SET status = 'completed', completed_at = NOW(),
               consensus_result = $1, final_label = $2,
               payment_amount = $3
           WHERE id = $4`,
          [
            JSON.stringify(consensusResult.agreement),
            JSON.stringify(consensusResult.finalLabel),
            paymentAmount,
            taskId
          ]
        );

        // Mark all related submissions as part of consensus
        await postgresDb.query(
          `UPDATE task_submissions
           SET is_consensus_participant = true
           WHERE task_id = $1`,
          [taskId]
        );

        // Process payment
        await processTaskPayment(userId, taskId, paymentAmount);

        // Notify task owner
        await notifyTaskOwner(task.owner_id, taskId, consensusResult);

        // Send real-time update via WebSocket
        await sendTaskCompletionNotification(taskId, userId, consensusResult);

      } else {
        // Consensus not reached - update task status
        taskStatus = 'in_review';
        await postgresDb.query(
          `UPDATE tasks
           SET status = 'in_review', reviewed_at = NOW()
           WHERE id = $1`,
          [taskId]
        );
      }

      // Log quality metrics
      await logQualityMetrics(userId, taskId, submissionId, consensusResult);

      await postgresDb.query('COMMIT');

      // Update user statistics
      await updateUserStats(userId, timeSpent, consensusResult.qualityScore);

      res.json({
        success: true,
        message: taskStatus === 'completed'
          ? 'Task completed successfully'
          : 'Task submitted for consensus review',
        data: {
          taskId,
          submissionId,
          status: taskStatus,
          consensus: {
            reached: consensusResult.reached,
            agreement: consensusResult.agreement,
            qualityScore: consensusResult.qualityScore,
            progress: consensusResult.progress
          },
          payment: {
            amount: paymentAmount,
            currency: 'USDT'
          }
        }
      });

    } catch (error) {
      await postgresDb.query('ROLLBACK');
      logger.error('Submit task error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit task'
      });
    }
  }
];

/**
 * Process task payment
 */
async function processTaskPayment(userId: string, taskId: string, amount: number) {
  try {
    // Add to user earnings
    await postgresDb.query(
      `UPDATE user_earnings
       SET total_earned = total_earned + $1,
           tasks_completed = tasks_completed + 1,
           last_earned_at = NOW()
       WHERE user_id = $2`,
      [amount, userId]
    );

    // Create payment record
    await postgresDb.query(
      `INSERT INTO worker_payouts
       (worker_id, task_id, amount, status, created_at)
       VALUES ($1, $2, $3, 'pending', NOW())`,
      [userId, taskId, amount]
    );

    logger.info(`Payment processed: User ${userId}, Task ${taskId}, Amount ${amount}`);

  } catch (error) {
    logger.error('Process payment error:', error);
    throw error;
  }
}

/**
 * Notify task owner
 */
async function notifyTaskOwner(ownerId: string, taskId: string, consensusResult: any) {
  try {
    const notificationData = {
      type: 'task_completed',
      title: 'Task Completed',
      message: `Task ${taskId} has been completed with consensus`,
      data: {
        taskId,
        consensus: consensusResult
      }
    };

    // Store notification
    await postgresDb.query(
      `INSERT INTO notifications
       (user_id, type, title, message, data, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        ownerId,
        notificationData.type,
        notificationData.title,
        notificationData.message,
        JSON.stringify(notificationData.data)
      ]
    );

    // Send real-time notification via WebSocket
    const wsService = (global as any).wsService;
    if (wsService) {
      await wsService.sendNotificationToUser(ownerId, {
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data,
        priority: 'high'
      });
    }

  } catch (error) {
    logger.error('Notify task owner error:', error);
  }
}

/**
 * Send task completion notification
 */
async function sendTaskCompletionNotification(
  taskId: string,
  completedBy: string,
  consensusResult: any
) {
  try {
    const wsService = (global as any).wsService;
    if (wsService) {
      // Get project members to notify
      const membersQuery = `
        SELECT user_id FROM project_members
        WHERE project_id = (SELECT project_id FROM tasks WHERE id = $1)
      `;
      const membersResult = await postgresDb.query(membersQuery, [taskId]);

      for (const member of membersResult.rows) {
        await wsService.sendTaskCompletion(taskId, completedBy, {
          consensus: consensusResult,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    logger.error('Send task completion notification error:', error);
  }
}

/**
 * Log quality metrics
 */
async function logQualityMetrics(
  userId: string,
  taskId: string,
  submissionId: string,
  consensusResult: any
) {
  try {
    await postgresDb.query(
      `INSERT INTO quality_metrics
       (user_id, task_id, submission_id, consensus_score, accuracy_score, speed_score, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        userId,
        taskId,
        submissionId,
        consensusResult.consensusScore || null,
        consensusResult.qualityScore || null,
        consensusResult.speedScore || null
      ]
    );
  } catch (error) {
    logger.error('Log quality metrics error:', error);
  }
}

/**
 * Update user statistics
 */
async function updateUserStats(userId: string, timeSpent: number, qualityScore: number) {
  try {
    // Update worker stats
    await postgresDb.query(
      `INSERT INTO worker_stats
       (user_id, tasks_completed, avg_completion_time_ms, quality_score, updated_at)
       VALUES ($1, 1, $2, $3, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         tasks_completed = worker_stats.tasks_completed + 1,
         avg_completion_time_ms = (worker_stats.avg_completion_time_ms + $2) / 2,
         quality_score = (worker_stats.quality_score + $3) / 2,
         updated_at = NOW()`,
      [userId, timeSpent * 1000, qualityScore]
    );
  } catch (error) {
    logger.error('Update user stats error:', error);
  }
}