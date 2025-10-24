import { query, runMigrations } from '../database/connection';
import axios from 'axios';
import { paymentChannelManager } from './paymentChannel.js';

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  type: string;
  data: any;
  options?: string[];
  correct_answer?: string;
  points: number;
  is_honeypot: boolean;
  reserved_by?: number;
  reserved_at?: Date;
  completion_status: string;
  created_at: Date;
}

export interface TaskLabel {
  task_id: number;
  worker_id: number;
  answer: string;
  time_spent?: number;
}

export async function getNextTask(workerId: number): Promise<Task | null> {
  try {
    // First release any expired reservations
    await runMigrations();

    // Start transaction
    const client = await query('BEGIN');

    try {
      // Find a task that:
      // 1. Is not completed
      // 2. Is not currently reserved
      // 3. Has not been seen by this worker
      // 4. Is marked as a honeypot (every 10th task) OR is a regular task with enough label diversity

      // Count tasks already labeled by this worker
      const workerTaskCount = await query(
        'SELECT COUNT(*) as count FROM responses WHERE user_id = $1',
        [workerId]
      );
      const count = parseInt(workerTaskCount.rows[0].count);

      // Every 10th task should be a honeypot
      const shouldBeHoneypot = (count + 1) % 10 === 0;

      let taskQuery = '';
      let queryParams: any[] = [];

      if (shouldBeHoneypot) {
        // Look for a honeypot task not seen by this worker
        taskQuery = `
          SELECT t.* FROM tasks t
          WHERE t.completion_status = 'pending'
          AND t.is_honeypot = true
          AND t.reserved_by IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM task_seen ts WHERE ts.task_id = t.id AND ts.worker_id = $1
          )
          ORDER BY RANDOM()
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `;
        queryParams = [workerId];
      } else {
        // Look for a regular task not seen by this worker
        // Prioritize tasks that need more labels for consensus
        taskQuery = `
          SELECT t.* FROM tasks t
          WHERE t.completion_status = 'pending'
          AND t.is_honeypot = false
          AND t.reserved_by IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM task_seen ts WHERE ts.task_id = t.id AND ts.worker_id = $1
          )
          ORDER BY
            CASE
              WHEN t.consensus_count < 3 THEN 0
              ELSE 1
            END,
            RANDOM()
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `;
        queryParams = [workerId];
      }

      const result = await query(taskQuery, queryParams);

      if (result.rows.length === 0) {
        await query('ROLLBACK');
        return null;
      }

      const task = result.rows[0];

      // Reserve the task for 30 seconds
      await query(`
        UPDATE tasks
        SET reserved_by = $1,
            reserved_at = NOW(),
            completion_status = 'in_progress'
        WHERE id = $2
      `, [workerId, task.id]);

      // Mark task as seen by this worker
      await query(`
        INSERT INTO task_seen (task_id, worker_id)
        VALUES ($1, $2)
        ON CONFLICT (task_id, worker_id) DO NOTHING
      `, [task.id, workerId]);

      await query('COMMIT');

      // Return task without correct_answer
      const { correct_answer, ...taskWithoutAnswer } = task;
      return taskWithoutAnswer as Task;

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error getting next task:', error);
    throw error;
  }
}

export async function submitTaskLabel(label: TaskLabel): Promise<{
  success: boolean;
  isHoneypot: boolean;
  isCorrect?: boolean;
  pointsEarned: number;
  newBalance: number;
  message: string;
}> {
  try {
    const client = await query('BEGIN');

    try {
      // Get the task
      const taskResult = await query(
        'SELECT * FROM tasks WHERE id = $1',
        [label.task_id]
      );

      if (taskResult.rows.length === 0) {
        await query('ROLLBACK');
        return { success: false, isHoneypot: false, pointsEarned: 0, newBalance: 0, message: 'Task not found' };
      }

      const task = taskResult.rows[0];
      const isHoneypot = task.is_honeypot;
      let isCorrect = false;
      let pointsEarned = 0;

      // Save the response
      await query(`
        INSERT INTO responses (task_id, user_id, answer, is_correct, points, time_spent)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        label.task_id,
        label.worker_id,
        label.answer,
        isHoneypot ? label.answer === task.correct_answer : null,
        isHoneypot ? (label.answer === task.correct_answer ? task.points : 0) : null,
        label.time_spent
      ]);

      // Update worker stats and balance
      if (isHoneypot) {
        isCorrect = label.answer === task.correct_answer;

        if (isCorrect) {
          // Correct honeypot - award points
          pointsEarned = task.points;
          await query(`
            UPDATE users
            SET tasks_completed = tasks_completed + 1,
                total_earned = total_earned + $1
            WHERE id = $2
          `, [pointsEarned, label.worker_id]);

          await query(`
            UPDATE wallets
            SET balance = balance + $1,
                total_earned = total_earned + $1
            WHERE user_id = $1
          `, [label.worker_id, pointsEarned]);
        } else {
          // Wrong honeypot - decrease trust score
          await query(`
            UPDATE users
            SET trust_score = GREATEST(0, trust_score - 0.1),
                honeypot_failed = honeypot_failed + 1
            WHERE id = $1
          `, [label.worker_id]);
        }
      } else {
        // Regular task - award points
        pointsEarned = task.points;
        await query(`
          UPDATE users
          SET tasks_completed = tasks_completed + 1,
              total_earned = total_earned + $1
          WHERE id = $2
        `, [pointsEarned, label.worker_id]);

        await query(`
          UPDATE wallets
          SET balance = balance + $1,
              total_earned = total_earned + $1
          WHERE user_id = $1
        `, [label.worker_id, pointsEarned]);

        // Track referral earnings asynchronously
        if (pointsEarned > 0) {
          setImmediate(async () => {
            try {
              await axios.post(`${process.env.BOT_API_URL || 'http://localhost:3000'}/api/referral/track`, {
                taskId: label.task_id,
                workerId: label.worker_id,
                earning: pointsEarned
              });
            } catch (error) {
              console.error('Failed to track referral earnings:', error);
            }
          });

          // Check if worker has payment channel and process via channel
          const channel = await paymentChannelManager.getWorkerChannel(label.worker_id);
          if (channel && channel.status === 'active') {
            try {
              // Convert points to USDT (100 points = $2 USDT)
              const usdtAmount = pointsEarned / 50;

              // Process instant payment via channel (zero fee)
              const channelResult = await paymentChannelManager.processOffchainPayment(
                channel.channelId,
                channel.platformAddress, // Platform to worker
                channel.workerAddress,
                usdtAmount,
                label.task_id,
                { type: 'task_completion', points: pointsEarned }
              );

              if (channelResult.success) {
                console.log(`✅ Channel payment: Worker ${label.worker_id} earned $${usdtAmount} via channel ${channel.channelId}`);
              }
            } catch (error) {
              console.error('Channel payment failed, falling back to wallet:', error);
            }
          }
        }
      }

      // Check if task should be marked as complete
      // Get all responses for this task
      const responsesResult = await query(`
        SELECT answer, COUNT(*) as count
        FROM responses
        WHERE task_id = $1
        GROUP BY answer
        ORDER BY count DESC
      `, [label.task_id]);

      if (responsesResult.rows.length >= 3) {
        // Check for consensus (3 or more workers with same answer)
        const topResponse = responsesResult.rows[0];
        if (topResponse.count >= 3) {
          // Mark task as complete with consensus
          await query(`
            UPDATE tasks
            SET consensus_label = $1,
                consensus_count = $2,
                completion_status = 'completed',
                reserved_by = NULL,
                reserved_at = NULL
            WHERE id = $3
          `, [topResponse.answer, topResponse.count, label.task_id]);
        }
      } else {
        // Release the reservation but keep task pending
        await query(`
          UPDATE tasks
          SET reserved_by = NULL,
              reserved_at = NULL,
              completion_status = 'pending'
          WHERE id = $1
        `, [label.task_id]);
      }

      // Get new balance
      const walletResult = await query(
        'SELECT balance FROM wallets WHERE user_id = $1',
        [label.worker_id]
      );

      const newBalance = parseFloat(walletResult.rows[0]?.balance || '0');

      await query('COMMIT');

      let message = '';
      if (isHoneypot) {
        if (isCorrect) {
          message = `Correct! You earned ${pointsEarned} points.`;
        } else {
          message = `Honeypot failed! Your trust score has decreased.`;
        }
      } else {
        message = `Label submitted! You earned ${pointsEarned} points.`;
      }

      return {
        success: true,
        isHoneypot,
        isCorrect,
        pointsEarned,
        newBalance,
        message
      };

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error submitting task label:', error);
    return {
      success: false,
      isHoneypot: false,
      pointsEarned: 0,
      newBalance: 0,
      message: 'Failed to submit label'
    };
  }
}

export async function releaseExpiredReservations(): Promise<void> {
  try {
    await query(`
      UPDATE tasks
      SET reserved_by = NULL,
          reserved_at = NULL,
          completion_status = 'pending'
      WHERE reserved_at < NOW() - INTERVAL '30 seconds'
        AND completion_status = 'in_progress'
    `);
  } catch (error) {
    console.error('Error releasing expired reservations:', error);
  }
}