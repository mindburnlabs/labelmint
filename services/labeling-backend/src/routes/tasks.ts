import { Router } from 'express';
import { authenticateWorker, AuthenticatedRequest } from '../middleware/auth';
import { getNextTask, submitTaskLabel } from '../services/taskService';
import { query } from '../database/connection';

const router = Router();

// GET /api/tasks/next - Get next available task
router.get('/next', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user has sufficient trust score (optional: require minimum trust)
    if (req.user.trust_score < 0.3) {
      return res.status(403).json({
        error: 'Trust score too low',
        message: 'You need to improve your accuracy to continue',
        trustScore: req.user.trust_score
      });
    }

    const task = await getNextTask(req.user.id);

    if (!task) {
      return res.status(404).json({
        error: 'No tasks available',
        message: 'There are no tasks available at the moment. Please try again later.'
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
        reserved_until: new Date(Date.now() + 30000).toISOString() // 30 seconds from now
      }
    });

  } catch (error) {
    console.error('Error getting next task:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// POST /api/tasks/:id/label - Submit task label
router.post('/:id/label', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const taskId = parseInt(req.params.id);
    const { answer, time_spent } = req.body;

    if (!answer) {
      return res.status(400).json({ error: 'Answer is required' });
    }

    // Validate that the task is reserved by this worker
    const taskCheck = await req.app.locals.db?.query(
      'SELECT reserved_by FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskCheck?.rows[0]?.reserved_by !== req.user.id) {
      return res.status(403).json({
        error: 'Task not reserved by you',
        message: 'This task is not reserved by you or reservation has expired'
      });
    }

    const result = await submitTaskLabel({
      task_id: taskId,
      worker_id: req.user.id,
      answer: answer.toString(),
      time_spent: time_spent ? parseInt(time_spent) : undefined
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      isHoneypot: result.isHoneypot,
      isCorrect: result.isCorrect,
      pointsEarned: result.pointsEarned,
      newBalance: result.newBalance,
      message: result.message,
      stats: {
        tasksCompleted: req.user.tasks_completed + (result.isHoneypot && result.isCorrect ? 1 : !result.isHoneypot ? 1 : 0),
        totalEarned: req.user.total_earned + result.pointsEarned,
        trustScore: result.isHoneypot && !result.isCorrect
          ? Math.max(0, req.user.trust_score - 0.1)
          : req.user.trust_score
      }
    });

  } catch (error) {
    console.error('Error submitting label:', error);
    res.status(500).json({ error: 'Failed to submit label' });
  }
});

// POST /api/tasks/:id/skip - Skip a task (optional)
router.post('/:id/skip', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const taskId = parseInt(req.params.id);

    // Release the reservation
    await req.app.locals.db?.query(`
      UPDATE tasks
      SET reserved_by = NULL,
          reserved_at = NULL,
          completion_status = 'pending'
      WHERE id = $1 AND reserved_by = $2
    `, [taskId, req.user.id]);

    res.json({
      success: true,
      message: 'Task skipped successfully'
    });

  } catch (error) {
    console.error('Error skipping task:', error);
    res.status(500).json({ error: 'Failed to skip task' });
  }
});

export default router;