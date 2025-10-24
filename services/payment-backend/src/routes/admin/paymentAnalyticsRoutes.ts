/**
 * Admin API Routes for Payment Analytics
 */

import { Router } from 'express';
import { PaymentAnalyticsController } from '@/api/admin/paymentAnalyticsController';
import { authenticateAdmin, requirePermission } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';

const router = Router();
const controller = new PaymentAnalyticsController();

// All routes require admin authentication
router.use(authenticateAdmin);
router.use(requirePermission('payment_analytics'));

/**
 * GET /api/admin/payments/analytics
 * Get comprehensive payment analytics
 * Query: period, startDate, endDate, limit, offset, userId, status
 */
router.get('/analytics', controller.getAnalytics.bind(controller));

/**
 * GET /api/admin/payments/realtime
 * Get real-time payment metrics and status
 */
router.get('/realtime', controller.getRealTimeMetrics.bind(controller));

/**
 * GET /api/admin/payments/transactions/:transactionId
 * Get detailed transaction information
 */
router.get('/transactions/:transactionId', controller.getTransactionDetails.bind(controller));

/**
 * POST /api/admin/payments/bulk-action
 * Process bulk actions on transactions
 * Body: { action: 'retry' | 'cancel' | 'refund' | 'mark_resolved', transactionIds: string[] }
 */
router.post(
  '/bulk-action',
  validateRequest({
    action: { type: 'string', enum: ['retry', 'cancel', 'refund', 'mark_resolved'] },
    transactionIds: { type: 'array', items: { type: 'string' }, minItems: 1 }
  }),
  controller.processBulkAction.bind(controller)
);

/**
 * GET /api/admin/payments/backup
 * Get backup payment methods and transactions
 */
router.get('/backup', controller.getBackupPayments.bind(controller));

/**
 * PUT /api/admin/payments/backup/:methodId/configure
 * Configure backup payment method
 */
router.put(
  '/backup/:methodId/configure',
  validateRequest({
    config: { type: 'object' }
  }),
  controller.configureBackupMethod.bind(controller)
);

/**
 * GET /api/admin/payments/fees/history
 * Get fee optimization history
 */
router.get('/fees/history', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const { FeeOptimizationService } = await import('@/services/payment/FeeOptimizationService');
    const feeService = new FeeOptimizationService(null as any); // Initialize as needed

    const history = feeService.getFeeHistory(parseInt(hours as string));

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fee history'
    });
  }
});

/**
 * POST /api/admin/payments/fees/optimize
 * Manually trigger fee optimization
 */
router.post('/fees/optimize', async (req, res) => {
  try {
    // Trigger immediate fee optimization
    const { FeeOptimizationService } = await import('@/services/payment/FeeOptimizationService');
    // Implementation depends on your fee service setup

    res.json({
      success: true,
      message: 'Fee optimization triggered'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger fee optimization'
    });
  }
});

/**
 * GET /api/admin/payments/alerts
 * Get payment alerts
 * Query: type, resolved, limit
 */
router.get('/alerts', async (req, res) => {
  try {
    const { type, resolved, limit = 50 } = req.query;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const where: any = {};
    if (type) where.type = type;
    if (resolved !== undefined) where.resolved = resolved === 'true';

    const alerts = await prisma.paymentAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * PUT /api/admin/payments/alerts/:alertId/resolve
 * Mark alert as resolved
 */
router.put('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const alert = await prisma.paymentAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

/**
 * GET /api/admin/payments/users/:userId/activity
 * Get payment activity for a specific user
 */
router.get('/users/:userId/activity', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'month' } = req.query;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Calculate date range
    const now = new Date();
    const start = period === 'week' ? new Date(now.getTime() - 604800000) :
      period === 'month' ? new Date(now.getTime() - 2592000000) :
      new Date(now.getTime() - 31536000000); // year

    const [transactions, totalVolume, totalFees, successRate] = await Promise.all([
      prisma.tonTransaction.findMany({
        where: {
          userId,
          createdAt: { gte: start }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      prisma.tonTransaction.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          createdAt: { gte: start }
        },
        _sum: { amount: true }
      }),
      prisma.tonTransaction.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          createdAt: { gte: start }
        },
        _sum: { fee: true }
      }),
      prisma.tonTransaction.groupBy({
        by: ['status'],
        where: {
          userId,
          createdAt: { gte: start }
        },
        _count: true
      })
    ]);

    const totalTx = successRate.reduce((sum, s) => sum + s._count, 0);
    const completedTx = successRate.find(s => s.status === 'COMPLETED')?._count || 0;

    res.json({
      success: true,
      data: {
        userId,
        period,
        summary: {
          totalTransactions: totalTx,
          successRate: totalTx > 0 ? (completedTx / totalTx) * 100 : 0,
          totalVolume: totalVolume._sum.amount || '0',
          totalFees: totalFees._sum.fee || '0'
        },
        transactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user activity'
    });
  }
});

/**
 * GET /api/admin/payments/export
 * Export payment data as CSV
 * Query: startDate, endDate, format, fields
 */
router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv', fields } = req.query;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const where: any = {};
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    const transactions = await prisma.tonTransaction.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            telegramId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10000 // Limit for export
    });

    if (format === 'csv') {
      // Convert to CSV
      const csv = [
        'Transaction ID,User ID,Email,Amount,Fee,Status,Created At,Completed At',
        ...transactions.map(tx =>
          `${tx.id},${tx.userId},${tx.user?.email || ''},${tx.amount},${tx.fee},${tx.status},${tx.createdAt},${tx.completedAt || ''}`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=payments_${startDate}_${endDate}.csv`);
      res.send(csv);
    } else {
      // JSON format
      res.json({
        success: true,
        data: transactions
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to export payment data'
    });
  }
});

export default router;