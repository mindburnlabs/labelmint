import { query } from '../database/connection';

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
  consensus_level: string;
  total_responses: number;
  unique_labels: number;
  created_at: Date;
}

export interface TaskLabel {
  task_id: number;
  worker_id: number;
  answer: string;
  time_spent?: number;
}

export interface WorkerStats {
  worker_id: number;
  total_labels: number;
  correct_labels: number;
  accuracy_rate: number;
  trust_score: number;
  tasks_completed: number;
  total_earned: number;
  bonus_earned: number;
  current_balance: number;
  warning_count: number;
  is_blocked: boolean;
  last_warning_at?: Date;
  rank?: number;
  level: string;
}

export interface LabelResult {
  success: boolean;
  isHoneypot: boolean;
  isCorrect?: boolean;
  basePoints: number;
  bonusMultiplier: number;
  finalPoints: number;
  accuracyAtTime: number;
  newBalance: number;
  message: string;
  consensusStatus?: {
    totalResponses: number;
    consensusLevel: string;
    needsMoreLabels: boolean;
  };
  workerStatus: string;
}

export async function getNextEnhancedTask(workerId: number): Promise<Task | null> {
  try {
    // Check if worker is blocked
    const workerStatus = await query(
      'SELECT is_blocked, block_reason FROM users WHERE id = $1',
      [workerId]
    );

    if (workerStatus.rows[0]?.is_blocked) {
      throw new Error(`Worker blocked: ${workerStatus.rows[0].block_reason}`);
    }

    // Release expired reservations
    await releaseExpiredReservations();

    // Start transaction
    await query('BEGIN');

    try {
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
        // Look for a regular task, prioritizing those needing consensus
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
              WHEN t.consensus_level = 'partial' THEN 0
              WHEN t.consensus_level = 'pending' THEN 1
              ELSE 2
            END,
            t.total_responses ASC,
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

export async function submitEnhancedTaskLabel(label: TaskLabel): Promise<LabelResult> {
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
        return {
          success: false,
          isHoneypot: false,
          basePoints: 0,
          bonusMultiplier: 1.0,
          finalPoints: 0,
          accuracyAtTime: 0,
          newBalance: 0,
          message: 'Task not found',
          workerStatus: 'ERROR'
        };
      }

      const task = taskResult.rows[0];
      const isHoneypot = task.is_honeypot;
      let isCorrect = false;

      // Get worker's current accuracy
      const workerResult = await query(
        `SELECT
          u.*,
          COALESCE(w.balance, 0) as balance,
          calculate_worker_accuracy(u.id) as accuracy
        FROM users u
        LEFT JOIN wallets w ON w.user_id = u.id
        WHERE u.id = $1`,
        [label.worker_id]
      );

      const worker = workerResult.rows[0];
      const accuracyAtTime = parseFloat(worker.accuracy) || 0;
      let basePoints = task.points;
      let bonusMultiplier = 1.0;

      // Calculate bonus based on accuracy
      if (accuracyAtTime >= 90) {
        bonusMultiplier = 1.2; // 20% bonus for >90% accuracy
      }

      // Save the response
      await query(`
        INSERT INTO responses (task_id, user_id, answer, is_correct, points, time_spent,
                              base_points, final_points, bonus_multiplier, accuracy_at_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        label.task_id,
        label.worker_id,
        label.answer,
        isHoneypot ? label.answer === task.correct_answer : null,
        isHoneypot ? (label.answer === task.correct_answer ? basePoints : 0) : basePoints,
        label.time_spent,
        basePoints,
        Math.floor(basePoints * bonusMultiplier),
        bonusMultiplier,
        accuracyAtTime
      ]);

      // Update worker stats
      if (isHoneypot) {
        isCorrect = label.answer === task.correct_answer;

        if (isCorrect) {
          // Correct honeypot
          await query(`
            UPDATE users
            SET tasks_completed = tasks_completed + 1,
                total_labels = total_labels + 1,
                correct_labels = correct_labels + 1,
                total_earned = total_earned + $1,
                bonus_earned = bonus_earned + $2
            WHERE id = $3
          `, [basePoints, basePoints * (bonusMultiplier - 1), label.worker_id]);
        } else {
          // Wrong honeypot
          await query(`
            UPDATE users
            SET trust_score = GREATEST(0, trust_score - 0.1),
                honeypot_failed = honeypot_failed + 1,
                total_labels = total_labels + 1
            WHERE id = $1
          `, [label.worker_id]);
        }
      } else {
        // Regular task - always award points
        const finalPoints = Math.floor(basePoints * bonusMultiplier);
        await query(`
          UPDATE users
          SET tasks_completed = tasks_completed + 1,
              total_labels = total_labels + 1,
              total_earned = total_earned + $1,
              bonus_earned = bonus_earned + $2
          WHERE id = $3
        `, [finalPoints, finalPoints * (bonusMultiplier - 1), label.worker_id]);
      }

      // Update wallet
      const pointsToAward = isHoneypot && !isCorrect ? 0 : Math.floor(basePoints * bonusMultiplier);
      await query(`
        UPDATE wallets
        SET balance = balance + $1,
            total_earned = total_earned + $1
        WHERE user_id = $1
      `, [label.worker_id, pointsToAward]);

      // Update task consensus
      await query('SELECT update_task_consensus($1)', [label.task_id]);

      // Get updated consensus status
      const consensusResult = await query(
        'SELECT total_responses, consensus_level FROM tasks WHERE id = $1',
        [label.task_id]
      );

      const consensusStatus = consensusResult.rows[0];

      // Determine if task needs more labels
      let needsMoreLabels = false;
      if (consensusStatus.consensus_level === 'pending' ||
          (consensusStatus.consensus_level === 'partial' && consensusStatus.total_responses < 3) ||
          (consensusStatus.consensus_level === 'conflict' && consensusStatus.total_responses < 5)) {
        needsMoreLabels = true;
      }

      // Release or update task based on consensus
      if (consensusStatus.consensus_level === 'complete') {
        // Task complete - keep as completed
        await query(`
          UPDATE tasks
          SET reserved_by = NULL,
              reserved_at = NULL,
              reviewed_at = NOW()
          WHERE id = $1
        `, [label.task_id]);
      } else if (needsMoreLabels) {
        // Still needs more labels - release back to pool
        await query(`
          UPDATE tasks
          SET reserved_by = NULL,
              reserved_at = NULL,
              completion_status = 'pending'
          WHERE id = $1
        `, [label.task_id]);
      } else if (consensusStatus.consensus_level === 'conflict') {
        // Conflict - mark for review
        await query(`
          UPDATE tasks
          SET reserved_by = NULL,
              reserved_at = NULL,
              completion_status = 'review'
          WHERE id = $1
        `, [label.task_id]);
      }

      // Update worker status and check for warnings/blocks
      const workerStatus = await query('SELECT update_worker_status($1) as status', [label.worker_id]);
      const status = workerStatus.rows[0].status;

      // Get new balance
      const walletResult = await query(
        'SELECT balance FROM wallets WHERE user_id = $1',
        [label.worker_id]
      );
      const newBalance = parseFloat(walletResult.rows[0]?.balance || '0');

      await query('COMMIT');

      // Prepare response message
      let message = '';
      if (isHoneypot) {
        if (isCorrect) {
          message = `Correct honeypot! You earned ${pointsToAward} points${bonusMultiplier > 1 ? ` (includes ${Math.round((bonusMultiplier - 1) * 100)}% accuracy bonus)` : ''}.`;
        } else {
          message = `Honeypot failed! Your trust score has decreased.`;
        }
      } else {
        message = `Label submitted! You earned ${pointsToAward} points${bonusMultiplier > 1 ? ` (includes ${Math.round((bonusMultiplier - 1) * 100)}% accuracy bonus)` : ''}.`;
      }

      // Add warning/block messages
      if (status === 'WARNING') {
        message += ` ⚠️ Warning: Your accuracy is below 70%. Please improve to avoid being blocked.`;
      } else if (status === 'BLOCKED') {
        message = `❌ Account blocked due to low accuracy.`;
      }

      return {
        success: true,
        isHoneypot,
        isCorrect,
        basePoints,
        bonusMultiplier,
        finalPoints: pointsToAward,
        accuracyAtTime,
        newBalance,
        message,
        consensusStatus: {
          totalResponses: consensusStatus.total_responses,
          consensusLevel: consensusStatus.consensus_level,
          needsMoreLabels
        },
        workerStatus: status
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
      basePoints: 0,
      bonusMultiplier: 1.0,
      finalPoints: 0,
      accuracyAtTime: 0,
      newBalance: 0,
      message: 'Failed to submit label',
      workerStatus: 'ERROR'
    };
  }
}

export async function getWorkerStats(workerId: number): Promise<WorkerStats | null> {
  try {
    const result = await query(`
      SELECT
        u.id as worker_id,
        u.total_labels,
        u.correct_labels,
        u.accuracy_rate,
        u.trust_score,
        u.tasks_completed,
        u.total_earned,
        u.bonus_earned,
        COALESCE(w.balance, 0) as current_balance,
        u.warning_count,
        u.last_warning_at,
        u.is_blocked,
        u.created_at
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.id = $1
    `, [workerId]);

    if (result.rows.length === 0) {
      return null;
    }

    const data = result.rows[0];

    // Calculate rank based on total earnings
    const rankResult = await query(`
      SELECT COUNT(*) + 1 as rank
      FROM users
      WHERE total_earned > $1 AND role = 'worker'
    `, [data.total_earned]);

    // Determine level based on performance
    let level = 'Beginner';
    if (data.accuracy_rate >= 95 && data.tasks_completed >= 100) {
      level = 'Expert';
    } else if (data.accuracy_rate >= 90 && data.tasks_completed >= 50) {
      level = 'Advanced';
    } else if (data.accuracy_rate >= 80 && data.tasks_completed >= 20) {
      level = 'Intermediate';
    } else if (data.tasks_completed >= 10) {
      level = 'Novice';
    }

    return {
      worker_id: data.worker_id,
      total_labels: data.total_labels,
      correct_labels: data.correct_labels,
      accuracy_rate: parseFloat(data.accuracy_rate) || 0,
      trust_score: parseFloat(data.trust_score) || 1.0,
      tasks_completed: data.tasks_completed,
      total_earned: parseFloat(data.total_earned) || 0,
      bonus_earned: parseFloat(data.bonus_earned) || 0,
      current_balance: parseFloat(data.current_balance) || 0,
      warning_count: data.warning_count,
      last_warning_at: data.last_warning_at,
      is_blocked: data.is_blocked,
      rank: parseInt(rankResult.rows[0].rank),
      level
    };

  } catch (error) {
    console.error('Error getting worker stats:', error);
    return null;
  }
}

export async function getWorkerHistory(workerId: number, limit = 10, offset = 0): Promise<any[]> {
  try {
    const result = await query(`
      SELECT
        r.id,
        r.answer,
        r.is_correct,
        r.points,
        r.final_points,
        r.bonus_multiplier,
        r.accuracy_at_time,
        r.time_spent,
        r.created_at,
        t.title as task_title,
        t.type as task_type,
        t.is_honeypot,
        CASE
          WHEN t.consensus_level = 'complete' AND r.answer = t.final_label THEN true
          WHEN t.is_honeypot = true THEN r.is_correct
          ELSE null
        END as is_consensus
      FROM responses r
      JOIN tasks t ON t.id = r.task_id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [workerId, limit, offset]);

    return result.rows.map(row => ({
      ...row,
      is_correct: row.is_correct || null,
      is_consensus: row.is_consensus || null
    }));

  } catch (error) {
    console.error('Error getting worker history:', error);
    return [];
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