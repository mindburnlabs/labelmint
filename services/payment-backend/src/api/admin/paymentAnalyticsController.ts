/**
 * Admin API Controller for Payment Analytics
 * Provides comprehensive payment analytics and management endpoints
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { paymentMonitor } from '@/services/payment/PaymentMonitorService';
import { backupPaymentService } from '@/services/payment/BackupPaymentService';
import { z } from 'zod';

const prisma = new PrismaClient();

// Query schemas
const analyticsQuerySchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
  userId: z.string().optional(),
  status: z.string().optional()
});

const bulkActionSchema = z.object({
  action: z.enum(['retry', 'cancel', 'refund', 'mark_resolved']),
  transactionIds: z.array(z.string()).min(1)
});

export class PaymentAnalyticsController {
  /**
   * Get comprehensive payment analytics
   */
  async getAnalytics(req: Request, res: Response) {
    try {
      const query = analyticsQuerySchema.parse(req.query);
      const { period, startDate, endDate, limit, offset, userId, status } = query;

      // Calculate date range
      const now = new Date();
      const start = startDate ? new Date(startDate) :
        period === 'hour' ? new Date(now.getTime() - 3600000) :
        period === 'day' ? new Date(now.getTime() - 86400000) :
        period === 'week' ? new Date(now.getTime() - 604800000) :
        new Date(now.getTime() - 2592000000); // month
      const end = endDate ? new Date(endDate) : now;

      // Fetch transaction data
      const whereClause: any = {
        createdAt: { gte: start, lte: end }
      };

      if (userId) whereClause.userId = userId;
      if (status) whereClause.status = status;

      const [
        totalTransactions,
        completedTransactions,
        failedTransactions,
        pendingTransactions,
        totalVolume,
        totalFees,
        avgProcessingTime,
        transactionsByHour,
        errorsByType,
        recentTransactions
      ] = await Promise.all([
        // Total transactions
        prisma.tonTransaction.count({ where: whereClause }),

        // Completed transactions
        prisma.tonTransaction.count({
          where: { ...whereClause, status: 'COMPLETED' }
        }),

        // Failed transactions
        prisma.tonTransaction.count({
          where: { ...whereClause, status: 'FAILED' }
        }),

        // Pending transactions
        prisma.tonTransaction.count({
          where: { ...whereClause, status: 'PENDING' }
        }),

        // Total volume
        prisma.tonTransaction.aggregate({
          where: { ...whereClause, status: 'COMPLETED' },
          _sum: { amount: true }
        }),

        // Total fees collected
        prisma.tonTransaction.aggregate({
          where: { ...whereClause, status: 'COMPLETED' },
          _sum: { fee: true }
        }),

        // Average processing time
        prisma.tonTransaction.aggregate({
          where: {
            ...whereClause,
            status: 'COMPLETED',
            completedAt: { not: null }
          },
          _avg: {
            createdAt: true,
            completedAt: true
          }
        }),

        // Transactions by hour
        prisma.$queryRaw`
          SELECT
            DATE_TRUNC('hour', "createdAt") as hour,
            COUNT(*) as count,
            COALESCE(SUM(amount), '0') as volume
          FROM "ton_transactions"
          WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
          GROUP BY DATE_TRUNC('hour', "createdAt")
          ORDER BY hour DESC
          LIMIT 24
        `,

        // Errors by type
        prisma.$queryRaw`
          SELECT
            metadata->>'error' as error_type,
            COUNT(*) as count
          FROM "ton_transactions"
          WHERE status = 'FAILED'
            AND "createdAt" >= ${start}
            AND "createdAt" <= ${end}
            AND metadata->>'error' IS NOT NULL
          GROUP BY metadata->>'error'
          ORDER BY count DESC
          LIMIT 10
        `,

        // Recent transactions
        prisma.tonTransaction.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                telegramId: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        })
      ]);

      // Calculate success rate
      const successRate = totalTransactions > 0
        ? (completedTransactions / totalTransactions) * 100
        : 0;

      // Calculate average processing time in minutes
      const avgTime = avgProcessingTime._avg.createdAt && avgProcessingTime._avg.completedAt
        ? (avgProcessingTime._avg.completedAt.getTime() - avgProcessingTime._avg.createdAt.getTime()) / (1000 * 60)
        : 0;

      // Get gas price analytics
      const gasPriceData = await prisma.gasPriceData.findMany({
        where: {
          timestamp: { gte: start, lte: end }
        },
        orderBy: { timestamp: 'desc' }
      });

      const avgGasPrice = gasPriceData.length > 0
        ? gasPriceData.reduce((sum, d) => sum + parseFloat(d.baseFee), 0) / gasPriceData.length
        : 0;

      // Get backup payment statistics
      const backupTransactions = await prisma.backupTransaction.findMany({
        where: {
          createdAt: { gte: start, lte: end }
        },
        include: {
          method: {
            select: { name: true }
          }
        }
      });

      const backupStats = {
        total: backupTransactions.length,
        completed: backupTransactions.filter(t => t.status === 'completed').length,
        pending: backupTransactions.filter(t => t.status === 'pending').length,
        failed: backupTransactions.filter(t => t.status === 'failed').length,
        byMethod: backupTransactions.reduce((acc, tx) => {
          acc[tx.method.name] = (acc[tx.method.name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      // Get alerts
      const alerts = await prisma.paymentAlert.findMany({
        where: {
          createdAt: { gte: start, lte: end }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const analytics = {
        summary: {
          period,
          dateRange: { start, end },
          totalTransactions,
          successRate: Math.round(successRate * 100) / 100,
          totalVolume: totalVolume._sum.amount || '0',
          totalFees: totalFees._sum.fee || '0',
          avgProcessingTime: Math.round(avgTime * 100) / 100,
          avgGasPrice: avgGasPrice.toString()
        },
        statusBreakdown: {
          completed: completedTransactions,
          failed: failedTransactions,
          pending: pendingTransactions
        },
        transactionsByHour,
        errorsByType,
        backupPayments: backupStats,
        alerts: {
          total: alerts.length,
          critical: alerts.filter(a => a.type === 'critical').length,
          warning: alerts.filter(a => a.type === 'warning').length,
          info: alerts.filter(a => a.type === 'info').length,
          unresolved: alerts.filter(a => !a.resolved).length
        },
        recentTransactions,
        pagination: {
          limit,
          offset,
          hasMore: recentTransactions.length === limit
        }
      };

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error fetching payment analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics',
        message: error.message
      });
    }
  }

  /**
   * Get real-time payment metrics
   */
  async getRealTimeMetrics(req: Request, res: Response) {
    try {
      const metrics = paymentMonitor.getMetrics();
      const currentStats = await paymentMonitor.getPaymentStats('hour');
      const gasPrice = paymentMonitor.getCurrentGasPrice ?
        paymentMonitor.getCurrentGasPrice() : null;

      // Get current pending transactions
      const pendingCount = await prisma.tonTransaction.count({
        where: { status: 'PENDING' }
      });

      // Get wallet balances
      const hotWallets = await prisma.userTonWallet.findMany({
        where: { isHotWallet: true },
        select: {
          id: true,
          address: true,
          balance: true
        }
      });

      const totalHotWalletBalance = hotWallets.reduce(
        (sum, wallet) => sum + parseFloat(wallet.balance || '0'),
        0
      );

      const realTimeData = {
        timestamp: new Date(),
        stats: currentStats,
        pendingTransactions: pendingCount,
        hotWalletBalance: totalHotWalletBalance.toString(),
        gasPrice: gasPrice ? {
          baseFee: gasPrice.baseFee,
          networkCongestion: gasPrice.networkCongestion,
          recommendedFee: gasPrice.recommendedFee
        } : null,
        recentMetrics: metrics.slice(-100),
        alerts: await prisma.paymentAlert.findMany({
          where: { resolved: false },
          orderBy: { createdAt: 'desc' },
          take: 10
        })
      };

      res.json({
        success: true,
        data: realTimeData
      });

    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch real-time metrics'
      });
    }
  }

  /**
   * Get detailed transaction information
   */
  async getTransactionDetails(req: Request, res: Response) {
    try {
      const { transactionId } = req.params;

      const transaction = await prisma.tonTransaction.findUnique({
        where: { id: transactionId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              telegramId: true
            }
          },
          backupTransactions: {
            include: {
              method: {
                select: {
                  name: true,
                  feeRate: true
                }
              }
            }
          }
        }
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      // Get related metrics
      const relatedMetrics = paymentMonitor.getMetrics().filter(
        m => m.transactionId === transactionId
      );

      res.json({
        success: true,
        data: {
          transaction,
          metrics: relatedMetrics,
          backupPayments: transaction.backupTransactions
        }
      });

    } catch (error) {
      console.error('Error fetching transaction details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction details'
      });
    }
  }

  /**
   * Process bulk actions on transactions
   */
  async processBulkAction(req: Request, res: Response) {
    try {
      const body = bulkActionSchema.parse(req.body);
      const { action, transactionIds } = body;

      const results = [];

      for (const txId of transactionIds) {
        try {
          let result;

          switch (action) {
            case 'retry':
              // Trigger transaction retry
              result = await this.retryTransaction(txId);
              break;

            case 'cancel':
              // Cancel pending transaction
              result = await this.cancelTransaction(txId);
              break;

            case 'refund':
              // Process refund
              result = await this.refundTransaction(txId);
              break;

            case 'mark_resolved':
              // Mark as resolved
              result = await this.markTransactionResolved(txId);
              break;

            default:
              throw new Error(`Unknown action: ${action}`);
          }

          results.push({ transactionId: txId, success: true, result });

        } catch (error) {
          results.push({
            transactionId: txId,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        data: {
          action,
          processed: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results
        }
      });

    } catch (error) {
      console.error('Error processing bulk action:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process bulk action'
      });
    }
  }

  /**
   * Get backup payment methods and transactions
   */
  async getBackupPayments(req: Request, res: Response) {
    try {
      const [methods, transactions] = await Promise.all([
        backupPaymentService.getAvailableProviders(),
        backupPaymentService.getBackupTransactions()
      ]);

      res.json({
        success: true,
        data: {
          methods,
          transactions
        }
      });

    } catch (error) {
      console.error('Error fetching backup payments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch backup payments'
      });
    }
  }

  /**
   * Configure backup payment methods
   */
  async configureBackupMethod(req: Request, res: Response) {
    try {
      const { methodId, config } = req.body;

      const method = await prisma.backupPaymentMethod.update({
        where: { id: methodId },
        data: {
          config,
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        data: method
      });

    } catch (error) {
      console.error('Error configuring backup method:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to configure backup method'
      });
    }
  }

  // Helper methods
  private async retryTransaction(transactionId: string): Promise<any> {
    // Implement transaction retry logic
    // This would integrate with your TON service
    return { status: 'retry_initiated' };
  }

  private async cancelTransaction(transactionId: string): Promise<any> {
    await prisma.tonTransaction.update({
      where: { id: transactionId },
      data: { status: 'CANCELLED' }
    });
    return { status: 'cancelled' };
  }

  private async refundTransaction(transactionId: string): Promise<any> {
    // Implement refund logic
    // This would integrate with your payment services
    return { status: 'refund_initiated' };
  }

  private async markTransactionResolved(transactionId: string): Promise<any> {
    await prisma.tonTransaction.update({
      where: { id: transactionId },
      data: {
        metadata: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: 'admin'
        }
      }
    });
    return { status: 'resolved' };
  }
}