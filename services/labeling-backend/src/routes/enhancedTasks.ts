import { Router } from 'express';
import { authenticateWorker, AuthenticatedRequest } from '../middleware/auth';
import {
  getNextEnhancedTask,
  submitEnhancedTaskLabel,
  getWorkerStats,
  getWorkerHistory
} from '../services/enhancedTaskService';
import { query } from '../database/connection';

const router = Router();

// GET /api/tasks/next - Get next available task with enhanced QC
router.get('/next', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user is blocked
    if (req.user.is_blocked) {
      return res.status(403).json({
        error: 'Account blocked',
        message: req.user.block_reason || 'Your account has been blocked due to poor performance',
        isBlocked: true,
        blockReason: req.user.block_reason
      });
    }

    // Check if user has warnings
    if (req.user.warning_count > 0) {
      const warningMessage = req.user.warning_count === 1
        ? '⚠️ You have a warning. Your accuracy is below 70%. Please improve to avoid being blocked.'
        : `⚠️ You have ${req.user.warning_count} warnings. Your account is at risk of being blocked.`;

      // Include warning in response but don't block yet
      console.log(`Warning for user ${req.user.id}: ${warningMessage}`);
    }

    const task = await getNextEnhancedTask(req.user.id);

    if (!task) {
      return res.status(404).json({
        error: 'No tasks available',
        message: 'There are no tasks available at the moment. Please try again later.',
        stats: {
          accuracy: req.user.accuracy_rate || 0,
          tasksCompleted: req.user.tasks_completed,
          currentBalance: 0 // Would need to fetch from wallet
        }
      });
    }

    res.json({
      success: true,
      task: {
        id: task.id,
        project_id: task.project_id,
        title: task.title,
        description: task.description,
        type: task.type,
        data: task.data,
        options: task.options,
        points: task.points,
        consensus_info: {
          level: task.consensus_level,
          totalResponses: task.total_responses,
          uniqueLabels: task.unique_labels
        },
        reserved_until: new Date(Date.now() + 30000).toISOString() // 30 seconds from now
      },
      worker_info: {
        accuracy: req.user.accuracy_rate || 0,
        trustScore: req.user.trust_score,
        warnings: req.user.warning_count,
        bonusEligible: (req.user.accuracy_rate || 0) >= 90
      }
    });

  } catch (error: any) {
    console.error('Error getting next task:', error);
    if (error.message.includes('blocked')) {
      return res.status(403).json({
        error: 'Account blocked',
        message: error.message
      });
    }
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// POST /api/tasks/:id/label - Submit task label with enhanced QC
router.post('/:id/label', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if blocked
    if (req.user.is_blocked) {
      return res.status(403).json({
        error: 'Account blocked',
        message: 'Your account is blocked and you cannot submit labels'
      });
    }

    const taskId = parseInt(req.params.id);
    const { answer, time_spent } = req.body;

    if (!answer) {
      return res.status(400).json({ error: 'Answer is required' });
    }

    // Validate that the task is reserved by this worker
    const taskCheck = await query(
      'SELECT reserved_by FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskCheck?.rows[0]?.reserved_by !== req.user.id) {
      return res.status(403).json({
        error: 'Task not reserved by you',
        message: 'This task is not reserved by you or reservation has expired'
      });
    }

    const result = await submitEnhancedTaskLabel({
      task_id: taskId,
      worker_id: req.user.id,
      answer: answer.toString(),
      time_spent: time_spent ? parseInt(time_spent) : undefined
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Get updated worker stats
    const updatedStats = await getWorkerStats(req.user.id);

    res.json({
      success: true,
      isHoneypot: result.isHoneypot,
      isCorrect: result.isCorrect,
      basePoints: result.basePoints,
      bonusMultiplier: result.bonusMultiplier,
      finalPoints: result.finalPoints,
      accuracyAtTime: result.accuracyAtTime,
      newBalance: result.newBalance,
      message: result.message,
      consensusStatus: result.consensusStatus,
      workerStatus: result.workerStatus,
      stats: updatedStats
    });

  } catch (error) {
    console.error('Error submitting label:', error);
    res.status(500).json({ error: 'Failed to submit label' });
  }
});

// GET /api/worker/stats - Get worker statistics
router.get('/worker/stats', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const stats = await getWorkerStats(req.user.id);

    if (!stats) {
      return res.status(404).json({ error: 'Worker stats not found' });
    }

    // Get recent activity
    const recentActivity = await getWorkerHistory(req.user.id, 5);

    // Get accuracy history for last 7 days
    const accuracyHistory = await query(`
      SELECT
        date,
        labels_submitted,
        accuracy_rate,
        points_earned,
        bonus_earned
      FROM worker_accuracy_history
      WHERE worker_id = $1
        AND date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY date DESC
    `, [req.user.id]);

    // Get warnings
    const warnings = await query(`
      SELECT
        warning_type,
        message,
        accuracy_at_time,
        created_at
      FROM worker_warnings
      WHERE worker_id = $1
        AND is_resolved = false
      ORDER BY created_at DESC
      LIMIT 5
    `, [req.user.id]);

    res.json({
      success: true,
      stats: {
        ...stats,
        recentActivity,
        accuracyHistory: accuracyHistory.rows,
        warnings: warnings.rows,
        performance: {
          level: stats.level,
          rank: stats.rank,
          bonusEligible: stats.accuracy_rate >= 90,
          needsImprovement: stats.accuracy_rate < 70 && stats.total_labels >= 5,
          atRisk: stats.accuracy_rate < 50 && stats.total_labels >= 10
        }
      }
    });

  } catch (error) {
    console.error('Error getting worker stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/worker/history - Get worker task history
router.get('/worker/history', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await getWorkerHistory(req.user.id, limit, offset);

    // Get total count for pagination
    const countResult = await query(
      'SELECT COUNT(*) as total FROM responses WHERE user_id = $1',
      [req.user.id]
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      history,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    console.error('Error getting worker history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// POST /api/tasks/:id/skip - Skip a task
router.post('/:id/skip', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.is_blocked) {
      return res.status(403).json({
        error: 'Account blocked',
        message: 'Cannot skip tasks while account is blocked'
      });
    }

    const taskId = parseInt(req.params.id);

    // Check skip limit (max 5 skips per hour)
    const recentSkips = await query(`
      SELECT COUNT(*) as count
      FROM task_seen ts
      JOIN tasks t ON t.id = ts.task_id
      WHERE ts.worker_id = $1
        AND ts.seen_at > NOW() - INTERVAL '1 hour'
        AND t.reserved_by = $1
        AND t.completion_status = 'pending'
    `, [req.user.id]);

    if (parseInt(recentSkips.rows[0].count) >= 5) {
      return res.status(429).json({
        error: 'Skip limit reached',
        message: 'You can only skip 5 tasks per hour. Please wait before skipping more.'
      });
    }

    // Release the reservation
    await query(`
      UPDATE tasks
      SET reserved_by = NULL,
          reserved_at = NULL,
          completion_status = 'pending'
      WHERE id = $1 AND reserved_by = $2
    `, [taskId, req.user.id]);

    res.json({
      success: true,
      message: 'Task skipped successfully',
      skipsRemaining: Math.max(0, 5 - parseInt(recentSkips.rows[0].count))
    });

  } catch (error) {
    console.error('Error skipping task:', error);
    res.status(500).json({ error: 'Failed to skip task' });
  }
});

// GET /api/worker/leaderboard - Get top workers leaderboard
router.get('/worker/leaderboard', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const period = req.query.period as string || 'all'; // all, week, month

    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND r.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND r.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const leaderboard = await query(`
      SELECT
        u.id,
        u.username,
        u.first_name,
        u.accuracy_rate,
        u.tasks_completed,
        ${period === 'all' ? 'u.total_earned' : 'COALESCE(SUM(r.points), 0)'} as period_earned,
        ${period === 'all' ? 'u.total_labels' : 'COALESCE(COUNT(r.id), 0)'} as period_labels,
        calculate_worker_accuracy(u.id) as current_accuracy
      FROM users u
      LEFT JOIN responses r ON r.user_id = u.id ${dateFilter}
      WHERE u.role = 'worker' AND u.is_active = true
      GROUP BY u.id, u.username, u.first_name, u.accuracy_rate, u.tasks_completed, u.total_earned, u.total_labels
      ORDER BY ${period === 'all' ? 'u.total_earned' : 'period_earned'} DESC
      LIMIT $1
    `, [limit]);

    // Get current user's rank
    const userRank = await query(`
      SELECT COUNT(*) + 1 as rank
      FROM users
      WHERE role = 'worker'
        AND is_active = true
        AND ${period === 'all' ? 'total_earned' : '(SELECT COALESCE(SUM(points), 0) FROM responses WHERE user_id = users.id ' + dateFilter + ')'} > COALESCE(
          ${period === 'all' ? req.user?.total_earned || 0 : '(SELECT COALESCE(SUM(points), 0) FROM responses WHERE user_id = ' + req.user?.id + ' ' + dateFilter + ')'}
        , 0)
    `);

    res.json({
      success: true,
      leaderboard: leaderboard.rows,
      userRank: parseInt(userRank.rows[0]?.rank || 0),
      period
    });

  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

export default router;