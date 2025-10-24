import { Router } from 'express';
import { authenticateWorker, AuthenticatedRequest } from '../middleware/auth';
import {
  prelabelTaskWithAI,
  validateLabelWithAI,
  getAIAssistedConsensus,
  generateTaskExamples,
  batchPrelabelTasks,
  getAIAssistedNextTask,
  getWorkerSuspicionScore
} from '../services/aiAssistedTaskService';
import { query } from '../database/connection';

const router = Router();

// POST /api/tasks/validate - Validate worker label with AI
router.post('/validate', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { response_id, task_id, worker_label } = req.body;

    if (!response_id || !task_id || !worker_label) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['response_id', 'task_id', 'worker_label']
      });
    }

    // Check if user is admin or task owner (for validation permissions)
    const hasPermission = req.user.role === 'admin' || req.user.role === 'client';
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Validate the label with AI
    const validation = await validateLabelWithAI(response_id, task_id, worker_label);

    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error validating label:', error);
    res.status(500).json({ error: 'Failed to validate label' });
  }
});

// POST /api/tasks/:id/prelabel - Prelabel a task with AI
router.post('/:id/prelabel', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Only admins can trigger prelabeling
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const taskId = parseInt(req.params.id);
    const result = await prelabelTaskWithAI(taskId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error prelabeling task:', error);
    res.status(500).json({ error: 'Failed to prelabel task' });
  }
});

// GET /api/tasks/:id/consensus - Get AI-assisted consensus info
router.get('/:id/consensus', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const taskId = parseInt(req.params.id);
    const consensus = await getAIAssistedConsensus(taskId);

    res.json({
      success: true,
      consensus,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting consensus:', error);
    res.status(500).json({ error: 'Failed to get consensus info' });
  }
});

// POST /api/tasks/generate-examples - Generate examples for task type
router.post('/generate-examples', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'client') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { task_type, categories, instructions, count = 3 } = req.body;

    if (!task_type || !categories || !Array.isArray(categories)) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['task_type', 'categories', 'instructions']
      });
    }

    const result = await generateTaskExamples(task_type, categories, instructions, count);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      examples: result.examples,
      generated_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error generating examples:', error);
    res.status(500).json({ error: 'Failed to generate examples' });
  }
});

// POST /api/tasks/batch-prelabel - Prelabel multiple tasks
router.post('/batch-prelabel', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { task_ids } = req.body;

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({
        error: 'task_ids must be a non-empty array'
      });
    }

    if (task_ids.length > 50) {
      return res.status(400).json({
        error: 'Cannot process more than 50 tasks at once'
      });
    }

    const result = await batchPrelabelTasks(task_ids);

    res.json({
      success: true,
      ...result,
      processed_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error batch prelabeling:', error);
    res.status(500).json({ error: 'Failed to batch prelabel tasks' });
  }
});

// GET /api/tasks/next-ai - Get next AI-assisted task
router.get('/next-ai', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if worker is blocked
    if (req.user.is_blocked) {
      return res.status(403).json({
        error: 'Account blocked',
        message: req.user.block_reason || 'Your account has been blocked'
      });
    }

    const task = await getAIAssistedNextTask(req.user.id);

    if (!task) {
      return res.status(404).json({
        error: 'No AI-assisted tasks available',
        message: 'There are no AI-assisted tasks available at the moment'
      });
    }

    // Reserve the task
    await query(`
      UPDATE tasks
      SET reserved_by = $1,
          reserved_at = NOW(),
          completion_status = 'in_progress'
      WHERE id = $2
    `, [req.user.id, task.id]);

    // Mark as seen
    await query(`
      INSERT INTO task_seen (task_id, worker_id)
      VALUES ($1, $2)
      ON CONFLICT (task_id, worker_id) DO NOTHING
    `, [task.id, req.user.id]);

    res.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        type: task.type,
        data: task.data,
        options: task.options,
        points: 1, // Default points
        consensus_info: {
          targetResponses: task.consensusTarget,
          aiPrelabel: task.aiPrelabel,
          aiConfidence: task.aiConfidence,
          mode: task.usesAIAssistance ? 'AI Assisted' : 'Standard'
        },
        reserved_until: new Date(Date.now() + 30000).toISOString()
      },
      ai_info: {
        hasPrelabel: !!task.aiPrelabel,
        aiConfidence: task.aiConfidence,
        reducedConsensus: task.consensusTarget < 3
      }
    });

  } catch (error: any) {
    console.error('Error getting AI-assisted task:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// GET /api/worker/suspicion-score - Get worker's suspicion score
router.get('/worker/suspicion-score', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Workers can only check their own score, admins can check anyone
    const workerId = req.user.role === 'admin'
      ? parseInt(req.query.worker_id as string) || req.user.id
      : req.user.id;

    const score = await getWorkerSuspicionScore(workerId);

    res.json({
      success: true,
      worker_id: workerId,
      suspicion_score: score,
      checked_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting suspicion score:', error);
    res.status(500).json({ error: 'Failed to get suspicion score' });
  }
});

// GET /api/ai/stats - Get AI assistance statistics
router.get('/ai/stats', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await query(`
      SELECT
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN ai_prelabel IS NOT NULL THEN 1 END) as ai_prelabeled,
        COUNT(CASE WHEN uses_ai_assistance = true THEN 1 END) as ai_assisted,
        AVG(ai_confidence) as avg_ai_confidence,
        COUNT(CASE WHEN consensus_target = 2 THEN 1 END) as reduced_consensus,
        COUNT(CASE WHEN completion_status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN ai_validated = true THEN 1 END) as ai_validated_labels
      FROM tasks
    `);

    const validationStats = await query(`
      SELECT
        COUNT(*) as total_validated,
        AVG(ai_validation_score) as avg_validation_score,
        COUNT(CASE WHEN ai_flagged_as_suspicious = true THEN 1 END) as suspicious_count
      FROM responses
      WHERE ai_validated = true
    `);

    const costSavings = await query(`
      SELECT
        COUNT(CASE WHEN t.consensus_target = 2 THEN 1 END) * 1 as labels_saved,
        COUNT(CASE WHEN t.ai_prelabel IS NOT NULL THEN 1 END) * 0.001 as ai_cost_estimate
      FROM tasks t
      WHERE t.completion_status = 'completed'
    `);

    res.json({
      success: true,
      statistics: {
        tasks: stats.rows[0],
        validation: validationStats.rows[0],
        impact: costSavings.rows[0]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting AI stats:', error);
    res.status(500).json({ error: 'Failed to get AI statistics' });
  }
});

// POST /api/ai/analyze-patterns - Analyze worker patterns (admin only)
router.post('/ai/analyze-patterns', authenticateWorker, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { worker_ids } = req.body;

    // Get workers with high suspicion scores
    const suspiciousWorkers = await query(`
      SELECT DISTINCT
        wba.worker_id,
        u.username,
        MAX(wba.suspicious_score) as max_suspicion_score,
        COUNT(*) as analysis_days,
        wba.pattern_detected
      FROM worker_behavior_analysis wba
      JOIN users u ON u.id = wba.worker_id
      WHERE wba.auto_flagged = true
        OR wba.suspicious_score > 0.5
      GROUP BY wba.worker_id, u.username, wba.pattern_detected
      ORDER BY max_suspicion_score DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      suspicious_workers: suspiciousWorkers.rows,
      analyzed_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error analyzing patterns:', error);
    res.status(500).json({ error: 'Failed to analyze patterns' });
  }
});

export default router;