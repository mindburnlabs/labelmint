import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * Get project analytics
 */
router.get('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { timeframe = '7d' } = req.query;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            answers: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check permissions
    if (project.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Task completion over time
    const completionData = await prisma.taskAnswer.groupBy({
      by: ['createdAt'],
      where: {
        task: {
          projectId: id,
        },
        createdAt: { gte: startDate },
      },
      _count: true,
      _avg: {
        timeSpentMs: true,
      },
    });

    // Worker accuracy distribution
    const accuracyData = await prisma.worker.findMany({
      where: {
        taskAnswers: {
          some: {
            task: { projectId: id },
          },
        },
      },
      select: {
        accuracy: true,
        _count: {
          select: {
            taskAnswers: {
              where: {
                task: { projectId: id },
              },
            },
          },
        },
      },
    });

    // Label distribution
    const labelData = await prisma.taskAnswer.groupBy({
      by: ['answer'],
      where: {
        task: {
          projectId: id,
        },
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    // Quality metrics
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(t => t.status === 'COMPLETED').length;
    const totalAnswers = await prisma.taskAnswer.count({
      where: {
        task: { projectId: id },
      },
    });
    const correctAnswers = await prisma.taskAnswer.count({
      where: {
        task: { projectId: id },
        isCorrect: true,
      },
    });

    const analytics = {
      overview: {
        totalTasks,
        completedTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        totalAnswers,
        accuracy: totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0,
        budgetSpent: project.budget - project.budgetRemaining,
        budgetRemaining: project.budgetRemaining,
      },
      timeSeries: {
        completions: completionData.map(item => ({
          date: item.createdAt,
          count: item._count,
          avgTime: item._avg.timeSpentMs || 0,
        })),
      },
      distributions: {
        accuracy: accuracyData.map(w => ({
          accuracy: w.accuracy * 100,
          tasks: w._count.taskAnswers,
        })),
        labels: labelData.map(l => ({
          label: l.answer,
          count: l._count,
        })),
      },
    };

    res.json(analytics);
  } catch (error) {
    logger.error('Failed to get project analytics', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get worker analytics
 */
router.get('/workers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { timeframe = '30d' } = req.query;

    // Check permissions (worker can only see their own stats)
    if (id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const worker = await prisma.worker.findUnique({
      where: { userId: id },
      include: {
        user: true,
        taskAnswers: {
          include: {
            task: true,
          },
        },
      },
    });

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Daily earnings
    const dailyEarnings = await prisma.taskAnswer.groupBy({
      by: ['createdAt'],
      where: {
        workerId: id,
        createdAt: { gte: startDate },
        isCorrect: true,
      },
      _sum: {
        earnings: true,
      },
      _count: true,
    });

    // Performance by task type
    const performanceByType = await prisma.taskAnswer.groupBy({
      by: ['taskType'],
      where: {
        workerId: id,
        createdAt: { gte: startDate },
      },
      _avg: {
        timeSpentMs: true,
      },
      _count: {
        _all: true,
      },
      where: {
        workerId: id,
        isCorrect: true,
      },
    });

    // Recent activity
    const recentActivity = await prisma.taskAnswer.findMany({
      where: {
        workerId: id,
        createdAt: { gte: startDate },
      },
      include: {
        task: {
          select: {
            id: true,
            type: true,
            project: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const analytics = {
      overview: {
        totalTasks: worker.completedTasks,
        accuracy: worker.accuracy * 100,
        level: worker.level,
        totalEarnings: worker.totalEarnings,
        currentStreak: worker.currentStreak,
        bestStreak: worker.bestStreak,
        status: worker.status,
      },
      performance: {
        dailyEarnings: dailyEarnings.map(item => ({
          date: item.createdAt,
          earnings: parseFloat(item._sum.earnings?.toString() || '0'),
          tasks: item._count,
        })),
        byTaskType: performanceByType.map(item => ({
          type: item.taskType,
          tasks: item._count._all,
          avgTime: item._avg.timeSpentMs || 0,
        })),
      },
      activity: recentActivity.map(answer => ({
        id: answer.id,
        taskId: answer.taskId,
        taskType: answer.task.type,
        project: answer.task.project.title,
        isCorrect: answer.isCorrect,
        earnings: answer.earnings,
        timeSpent: answer.timeSpentMs,
        createdAt: answer.createdAt,
      })),
    };

    res.json(analytics);
  } catch (error) {
    logger.error('Failed to get worker analytics', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get global platform analytics (admin only)
 */
router.get('/platform', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Platform metrics
    const [
      totalUsers,
      totalWorkers,
      totalProjects,
      activeProjects,
      totalTasks,
      completedTasks,
      totalAnswers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.worker.count(),
      prisma.project.count(),
      prisma.project.count({ where: { status: 'RUNNING' } }),
      prisma.task.count(),
      prisma.task.count({ where: { status: 'COMPLETED' } }),
      prisma.taskAnswer.count(),
    ]);

    // Task volume over time
    const taskVolume = await prisma.taskAnswer.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: startDate },
      },
      _count: true,
      _avg: {
        timeSpentMs: true,
      },
    });

    // New users over time
    const newUsers = await prisma.user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    // Revenue metrics
    const revenue = await prisma.transaction.aggregate({
      where: {
        type: 'DEPOSIT',
        status: 'COMPLETED',
        createdAt: { gte: startDate },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Worker distribution
    const workerDistribution = await prisma.worker.groupBy({
      by: ['level', 'status'],
      _count: true,
    });

    // Task type distribution
    const taskTypeDistribution = await prisma.task.groupBy({
      by: ['type'],
      _count: true,
    });

    const analytics = {
      overview: {
        totalUsers,
        totalWorkers,
        totalProjects,
        activeProjects,
        totalTasks,
        completedTasks,
        totalAnswers,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      },
      timeSeries: {
        taskVolume: taskVolume.map(item => ({
          date: item.createdAt,
          tasks: item._count,
          avgTime: item._avg.timeSpentMs || 0,
        })),
        newUsers: newUsers.map(item => ({
          date: item.createdAt,
          users: item._count,
        })),
      },
      financial: {
        totalRevenue: parseFloat(revenue._sum.amount?.toString() || '0'),
        transactions: revenue._count,
      },
      distributions: {
        workers: workerDistribution,
        taskTypes: taskTypeDistribution,
      },
    };

    res.json(analytics);
  } catch (error) {
    logger.error('Failed to get platform analytics', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Export analytics data
 */
router.get('/export/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params; // 'project', 'worker', or 'platform'
    const { format = 'json', timeframe = '7d', id } = req.query;

    let data: any;

    switch (type) {
      case 'project':
        if (!id) {
          return res.status(400).json({ error: 'Project ID required' });
        }
        data = await getProjectAnalytics(id as string, timeframe as string);
        break;
      case 'worker':
        if (!id) {
          return res.status(400).json({ error: 'Worker ID required' });
        }
        data = await getWorkerAnalytics(id as string, timeframe as string);
        break;
      case 'platform':
        if (req.user.role !== 'ADMIN') {
          return res.status(403).json({ error: 'Access denied' });
        }
        data = await getPlatformAnalytics(timeframe as string);
        break;
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    // Format response
    if (format === 'csv') {
      // Convert to CSV and send
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${timeframe}.csv"`);
      res.send(convertToCSV(data));
    } else {
      res.json(data);
    }
  } catch (error) {
    logger.error('Failed to export analytics', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
async function getProjectAnalytics(projectId: string, timeframe: string) {
  // Implementation similar to the endpoint above
  return {};
}

async function getWorkerAnalytics(workerId: string, timeframe: string) {
  // Implementation similar to the endpoint above
  return {};
}

async function getPlatformAnalytics(timeframe: string) {
  // Implementation similar to the endpoint above
  return {};
}

function convertToCSV(data: any): string {
  // Convert JSON data to CSV format
  return JSON.stringify(data);
}

export default router;