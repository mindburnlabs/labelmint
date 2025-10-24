import { Request, Response } from 'express'
import { Pool } from 'pg'
import Redis from 'redis'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/telegram_labeling'
})

const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
})

export class TestProjectController {
  async createTestProject(req: Request, res: Response) {
    try {
      const createTestProject = require('../scripts/createTestProject').default
      const projectId = await createTestProject()

      res.json({
        success: true,
        data: {
          projectId,
          message: 'Test project created successfully'
        }
      })
    } catch (error) {
      console.error('Error creating test project:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create test project'
      })
    }
  }

  async getProjectProgress(req: Request, res: Response) {
    const { projectId } = req.params

    try {
      // Get real-time metrics from Redis
      const metrics = await redis.hGetAll(`project:${projectId}:metrics`)

      // Get active workers from Redis
      const activeWorkers = await redis.sMembers(`project:${projectId}:active_workers`)
      const workerDetails = await Promise.all(
        activeWorkers.map(async workerId => {
          const workerData = await redis.hGetAll(`worker:${workerId}`)
          return {
            id: workerId,
            username: workerData.username || 'Unknown',
            tasksCompleted: workerData.tasksCompleted || '0',
            accuracy: workerData.accuracy || '0.00',
            lastSeen: workerData.lastSeen || new Date().toISOString()
          }
        })
      )

      // Get tasks per minute (last 5 minutes)
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000
      const taskKeys = await redis.zRangeByScore(
        `project:${projectId}:completed_timestamps`,
        fiveMinutesAgo,
        now
      )
      const tasksPerMinute = taskKeys.length / 5

      // Get quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(projectId)

      // Get earnings overview
      const earningsOverview = await this.getEarningsOverview(projectId)

      res.json({
        success: true,
        data: {
          projectId,
          metrics: {
            totalTasks: parseInt(metrics.totalTasks || '0'),
            completedTasks: parseInt(metrics.completedTasks || '0'),
            pendingTasks: parseInt(metrics.pendingTasks || '0'),
            inProgressTasks: parseInt(metrics.inProgressTasks || '0'),
            consensusReached: parseInt(metrics.consensusReached || '0'),
            qualityScore: parseFloat(metrics.qualityScore || '0')
          },
          activeWorkers: workerDetails,
          tasksPerMinute: Math.round(tasksPerMinute * 100) / 100,
          qualityMetrics,
          earningsOverview,
          lastUpdated: new Date().toISOString()
        }
      })
    } catch (error) {
      console.error('Error fetching project progress:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch project progress'
      })
    }
  }

  private async calculateQualityMetrics(projectId: string) {
    const query = `
      WITH task_quality AS (
        SELECT
          t.id,
          t.ground_truth,
          COUNT(r.id) as response_count,
          SUM(CASE WHEN r.data::json->>'label' = t.ground_truth THEN 1 ELSE 0 END) as correct_count
        FROM tasks t
        LEFT JOIN responses r ON t.id = r.task_id
        WHERE t.project_id = $1 AND t.status = 'completed'
        GROUP BY t.id, t.ground_truth
      )
      SELECT
        COUNT(*) as total_completed_tasks,
        SUM(CASE WHEN correct_count >= 2 THEN 1 ELSE 0 END) as consensus_tasks,
        SUM(CASE WHEN correct_count >= 2 AND correct_count = response_count THEN 1 ELSE 0 END) as perfect_consensus,
        AVG(CASE WHEN response_count > 0 THEN (correct_count::float / response_count::float) * 100 ELSE 0 END) as average_accuracy,
        SUM(response_count) as total_labels,
        SUM(CASE WHEN r.data::json->>'label' != t.ground_truth THEN 1 ELSE 0 END) as incorrect_labels
      FROM task_quality tq
      LEFT JOIN tasks t ON tq.id = t.id
      LEFT JOIN responses r ON t.id = r.task_id
    `

    const result = await pool.query(query, [projectId])
    const row = result.rows[0]

    return {
      totalCompletedTasks: parseInt(row.total_completed_tasks || '0'),
      consensusTasks: parseInt(row.consensus_tasks || '0'),
      perfectConsensus: parseInt(row.perfect_consensus || '0'),
      averageAccuracy: parseFloat(row.average_accuracy || '0'),
      totalLabels: parseInt(row.total_labels || '0'),
      incorrectLabels: parseInt(row.incorrect_labels || '0'),
      consensusRate: row.total_completed_tasks > 0
        ? Math.round((row.consensus_tasks / row.total_completed_tasks) * 100 * 100) / 100
        : 0
    }
  }

  private async getEarningsOverview(projectId: string) {
    const query = `
      SELECT
        p.price_per_label,
        COUNT(t.id) as total_tasks,
        COUNT(r.id) as total_labels,
        COUNT(r.id) * p.price_per_label as total_spent,
        COUNT(r.id) * 0.02 as total_worker_earnings,
        COUNT(r.id) * (p.price_per_label - 0.02) as platform_revenue
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      LEFT JOIN responses r ON t.id = r.task_id
      WHERE p.id = $1
      GROUP BY p.id, p.price_per_label
    `

    const result = await pool.query(query, [projectId])
    const row = result.rows[0]

    return {
      pricePerLabel: parseFloat(row.price_per_label || '0'),
      totalTasks: parseInt(row.total_tasks || '0'),
      totalLabels: parseInt(row.total_labels || '0'),
      totalSpent: parseFloat(row.total_spent || '0'),
      totalWorkerEarnings: parseFloat(row.total_worker_earnings || '0'),
      platformRevenue: parseFloat(row.platform_revenue || '0'),
      remainingBudget: (row.total_tasks * row.price_per_label) - parseFloat(row.total_spent || '0')
    }
  }

  async getRealTimeUpdates(req: Request, res: Response) {
    const { projectId } = req.params

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    // Send initial data
    const sendUpdate = async () => {
      try {
        const metrics = await redis.hGetAll(`project:${projectId}:metrics`)
        const activeWorkersCount = await redis.sCard(`project:${projectId}:active_workers`)

        const data = {
          timestamp: Date.now(),
          metrics: {
            completedTasks: parseInt(metrics.completedTasks || '0'),
            pendingTasks: parseInt(metrics.pendingTasks || '0'),
            inProgressTasks: parseInt(metrics.inProgressTasks || '0')
          },
          activeWorkersCount
        }

        res.write(`data: ${JSON.stringify(data)}\n\n`)
      } catch (error) {
        console.error('Error sending real-time update:', error)
      }
    }

    // Send initial update
    sendUpdate()

    // Set up interval for updates
    const interval = setInterval(sendUpdate, 5000) // Update every 5 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval)
    })
  }

  async simulateWorkerActivity(req: Request, res: Response) {
    const { projectId } = req.params
    const { workerCount = 10, taskRate = 2 } = req.body // taskRate = tasks per minute per worker

    try {
      // Get pending tasks
      const tasksResult = await pool.query(
        'SELECT id FROM tasks WHERE project_id = $1 AND status = $2 LIMIT $3',
        [projectId, 'pending', workerCount * taskRate * 5] // 5 minutes worth of tasks
      )

      const tasks = tasksResult.rows
      const workers = []

      // Create mock workers
      for (let i = 0; i < workerCount; i++) {
        workers.push({
          id: `worker_${Date.now()}_${i}`,
          username: `MockWorker${i + 1}`,
          accuracy: 0.85 + Math.random() * 0.15 // 85-100% accuracy
        })
      }

      // Simulate task completions
      const completions = []
      for (const worker of workers) {
        const tasksForWorker = tasks.slice(
          Math.floor(Math.random() * tasks.length),
          Math.floor(Math.random() * tasks.length) + taskRate
        )

        for (const task of tasksForWorker) {
          // Simulate labeling with some errors based on worker accuracy
          const isCorrect = Math.random() < worker.accuracy

          // Get ground truth
          const taskDetails = await pool.query(
            'SELECT ground_truth FROM tasks WHERE id = $1',
            [task.id]
          )

          const groundTruth = taskDetails.rows[0].ground_truth
          const categories = ['cat', 'dog', 'other']

          // Choose label (correct or incorrect based on accuracy)
          let label = groundTruth
          if (!isCorrect) {
            // Pick a different category
            label = categories.find(c => c !== groundTruth) || categories[0]
          }

          // Insert response
          await pool.query(
            `INSERT INTO responses (task_id, user_id, data, time_spent, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [
              task.id,
              worker.id,
              JSON.stringify({ label }),
              Math.floor(2 + Math.random() * 8) // 2-10 seconds
            ]
          )

          // Update Redis metrics
          await redis.hIncrBy(`project:${projectId}:metrics`, 'inProgressTasks', 1)
          await redis.hIncrBy(`project:${projectId}:metrics`, 'pendingTasks', -1)

          // Record completion timestamp
          await redis.zAdd(
            `project:${projectId}:completed_timestamps`,
            { score: Date.now(), value: `${task.id}:${worker.id}` }
          )

          // Mark worker as active
          await redis.sAdd(`project:${projectId}:active_workers`, worker.id)
          await redis.hSet(`worker:${worker.id}`, {
            username: worker.username,
            tasksCompleted: '1',
            accuracy: worker.accuracy.toString(),
            lastSeen: new Date().toISOString()
          })

          completions.push({
            taskId: task.id,
            workerId: worker.id,
            label,
            correct: isCorrect,
            timestamp: new Date().toISOString()
          })
        }
      }

      // Check for consensus on completed tasks
      await this.checkConsensus(projectId)

      res.json({
        success: true,
        data: {
          simulatedWorkers: workerCount,
          tasksSimulated: completions.length,
          completions
        }
      })
    } catch (error) {
      console.error('Error simulating worker activity:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to simulate worker activity'
      })
    }
  }

  private async checkConsensus(projectId: string) {
    const query = `
      SELECT t.id, t.ground_truth
      FROM tasks t
      WHERE t.project_id = $1
        AND t.status != 'completed'
        AND (SELECT COUNT(*) FROM responses r WHERE r.task_id = t.id) >= 3
    `

    const tasks = await pool.query(query, [projectId])

    for (const task of tasks.rows) {
      const responsesQuery = `
        SELECT data::json->>'label' as label, COUNT(*) as count
        FROM responses
        WHERE task_id = $1
        GROUP BY data::json->>'label'
        ORDER BY count DESC
      `

      const responses = await pool.query(responsesQuery, [task.id])

      if (responses.rows.length > 0 && responses.rows[0].count >= 2) {
        // Consensus reached
        await pool.query(
          'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2',
          ['completed', task.id]
        )

        // Update Redis metrics
        await redis.hIncrBy(`project:${projectId}:metrics`, 'completedTasks', 1)
        await redis.hIncrBy(`project:${projectId}:metrics`, 'inProgressTasks', -1)
        await redis.hIncrBy(`project:${projectId}:metrics`, 'consensusReached', 1)
      }
    }
  }
}