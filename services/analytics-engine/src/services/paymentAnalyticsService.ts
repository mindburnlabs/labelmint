import { PrismaClient, Prisma } from '@prisma/client';
import { RedisClient } from '../lib/redis';
import { logger } from '../utils/logger';

interface PaymentMetrics {
  date: string;
  totalTransactions: number;
  totalVolume: number;
  successRate: number;
  avgProcessingTime: number;
  uniqueUsers: number;
  newUsers: number;
  retention: number;
}

interface WithdrawalMetrics {
  date: string;
  totalWithdrawals: number;
  totalAmount: number;
  avgWithdrawalAmount: number;
  processingTime: number;
  failedWithdrawals: number;
  pendingWithdrawals: number;
}

interface UserPaymentBehavior {
  userId: string;
  totalEarnings: number;
  totalWithdrawn: number;
  withdrawalRate: number;
  avgEarningPerDay: number;
  lastActivity: Date;
  activityStreak: number;
  preferredCurrency: 'TON' | 'USDT';
  riskScore: number;
}

interface PaymentAnomaly {
  type: 'SUDDEN_SPIKE' | 'UNUSUAL_PATTERN' | 'FAILED_BATCH' | 'LATE_PAYMENT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  affectedUsers: number;
  amount: number;
  detectedAt: Date;
  metadata: any;
}

export class PaymentAnalyticsService {
  private readonly CACHE_PREFIX = 'payment_analytics:';
  private readonly CACHE_TTL = {
    METRICS: 300, // 5 minutes
    USER_BEHAVIOR: 600, // 10 minutes
    ANOMALIES: 60, // 1 minute
    REPORTS: 3600, // 1 hour
  };

  constructor(
    private prisma: PrismaClient,
    private redis: RedisClient
  ) {}

  /**
   * Get comprehensive payment metrics for a date range
   */
  async getPaymentMetrics(
    startDate: Date,
    endDate: Date,
    currency?: string
  ): Promise<PaymentMetrics[]> {
    const cacheKey = `${this.CACHE_PREFIX}metrics:${startDate.toISOString()}:${endDate.toISOString()}:${currency || 'all'}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const query = `
      SELECT
        DATE(t.created_at) as date,
        COUNT(*) as total_transactions,
        COALESCE(SUM(t.amount), 0) as total_volume,
        CASE
          WHEN COUNT(*) > 0 THEN
            (COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END) * 100.0 / COUNT(*))
          ELSE 0
        END as success_rate,
        COALESCE(AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))), 0) as avg_processing_time,
        COUNT(DISTINCT t.user_id) as unique_users,
        COUNT(DISTINCT CASE WHEN u.created_at::date = DATE(t.created_at) THEN t.user_id END) as new_users,
        COALESCE(
          (
            COUNT(DISTINCT t.user_id) * 1.0 /
            NULLIF(
              (
                SELECT COUNT(DISTINCT t2.user_id)
                FROM transactions t2
                WHERE DATE(t2.created_at) BETWEEN DATE(t.created_at) - INTERVAL '7 days' AND DATE(t.created_at) - INTERVAL '1 day'
              ), 0
            )
          ) * 100, 0
        ) as retention
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.created_at BETWEEN $1 AND $2
        ${currency ? 'AND t.currency = $3' : ''}
      GROUP BY DATE(t.created_at)
      ORDER BY date DESC
    `;

    const results = await this.prisma.$queryRawUnsafe(
      query,
      startDate,
      endDate,
      currency || null
    );

    const metrics = results.map((row: any) => ({
      date: row.date,
      totalTransactions: parseInt(row.total_transactions),
      totalVolume: parseFloat(row.total_volume),
      successRate: parseFloat(row.success_rate),
      avgProcessingTime: parseFloat(row.avg_processing_time),
      uniqueUsers: parseInt(row.unique_users),
      newUsers: parseInt(row.new_users),
      retention: parseFloat(row.retention),
    }));

    await this.redis.setex(cacheKey, this.CACHE_TTL.METRICS, JSON.stringify(metrics));
    return metrics;
  }

  /**
   * Get withdrawal metrics for analysis
   */
  async getWithdrawalMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<WithdrawalMetrics[]> {
    const cacheKey = `${this.CACHE_PREFIX}withdrawals:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total_withdrawals,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(amount), 0) as avg_withdrawal_amount,
        COALESCE(AVG(EXTRACT(EPOCH FROM (processed_at - created_at))), 0) as processing_time,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_withdrawals,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_withdrawals
      FROM withdrawals
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const results = await this.prisma.$queryRawUnsafe(query, startDate, endDate);

    const metrics = results.map((row: any) => ({
      date: row.date,
      totalWithdrawals: parseInt(row.total_withdrawals),
      totalAmount: parseFloat(row.total_amount),
      avgWithdrawalAmount: parseFloat(row.avg_withdrawal_amount),
      processingTime: parseFloat(row.processing_time),
      failedWithdrawals: parseInt(row.failed_withdrawals),
      pendingWithdrawals: parseInt(row.pending_withdrawals),
    }));

    await this.redis.setex(cacheKey, this.CACHE_TTL.METRICS, JSON.stringify(metrics));
    return metrics;
  }

  /**
   * Analyze user payment behavior for risk assessment
   */
  async analyzeUserPaymentBehavior(
    userId: string,
    days: number = 30
  ): Promise<UserPaymentBehavior> {
    const cacheKey = `${this.CACHE_PREFIX}user_behavior:${userId}:${days}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [transactions, withdrawals, user] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          createdAt: { gte: startDate },
          status: 'COMPLETED',
        },
        select: {
          amount: true,
          currency: true,
          type: true,
          createdAt: true,
        },
      }),
      this.prisma.withdrawal.findMany({
        where: {
          userId,
          createdAt: { gte: startDate },
          status: 'COMPLETED',
        },
        select: {
          amount: true,
          createdAt: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalEarnings: true,
          trustScore: true,
          createdAt: true,
        },
      }),
    ]);

    const totalEarnings = transactions
      .filter(t => t.type === 'EARNING')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0);

    const dailyEarnings = this.calculateDailyEarnings(transactions);
    const avgEarningPerDay = dailyEarnings.reduce((sum, day) => sum + day.earnings, 0) / days;

    const activityPattern = this.calculateActivityPattern(transactions, withdrawals, days);
    const riskScore = this.calculateRiskScore(user, transactions, withdrawals, totalEarnings, totalWithdrawn);

    const preferredCurrency = this.getPreferredCurrency(transactions);

    const behavior: UserPaymentBehavior = {
      userId,
      totalEarnings: user?.totalEarnings ? parseFloat(user.totalEarnings.toString()) : totalEarnings,
      totalWithdrawn,
      withdrawalRate: totalEarnings > 0 ? (totalWithdrawn / totalEarnings) * 100 : 0,
      avgEarningPerDay,
      lastActivity: this.getLastActivity(transactions, withdrawals),
      activityStreak: activityPattern.currentStreak,
      preferredCurrency,
      riskScore,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL.USER_BEHAVIOR, JSON.stringify(behavior));
    return behavior;
  }

  /**
   * Detect payment anomalies and potential fraud
   */
  async detectPaymentAnomalies(): Promise<PaymentAnomaly[]> {
    const cacheKey = `${this.CACHE_PREFIX}anomalies:${new Date().toISOString().slice(0, 13)}`; // Hourly cache
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const anomalies: PaymentAnomaly[] = [];

    // Detect sudden transaction spikes
    const spikeAnomaly = await this.detectTransactionSpike();
    if (spikeAnomaly) anomalies.push(spikeAnomaly);

    // Detect unusual withdrawal patterns
    const withdrawalAnomaly = await this.detectUnusualWithdrawalPattern();
    if (withdrawalAnomaly) anomalies.push(withdrawalAnomaly);

    // Detect batch failures
    const batchFailureAnomaly = await this.detectBatchFailures();
    if (batchFailureAnomaly) anomalies.push(batchFailureAnomaly);

    // Detect late payments
    const latePaymentAnomaly = await this.detectLatePayments();
    if (latePaymentAnomaly) anomalies.push(latePaymentAnomaly);

    await this.redis.setex(cacheKey, this.CACHE_TTL.ANOMALIES, JSON.stringify(anomalies));
    return anomalies;
  }

  /**
   * Generate payment performance report
   */
  async generatePaymentReport(
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    date?: Date
  ): Promise<any> {
    const reportDate = date || new Date();
    const cacheKey = `${this.CACHE_PREFIX}report:${type}:${reportDate.toISOString().slice(0, 10)}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    let startDate: Date;
    let endDate: Date;

    switch (type) {
      case 'DAILY':
        startDate = new Date(reportDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(reportDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'WEEKLY':
        startDate = new Date(reportDate);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'MONTHLY':
        startDate = new Date(reportDate.getFullYear(), reportDate.getMonth(), 1);
        endDate = new Date(reportDate.getFullYear(), reportDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    const [transactions, withdrawals, topEarners, currencies] = await Promise.all([
      this.getTransactionStats(startDate, endDate),
      this.getWithdrawalStats(startDate, endDate),
      this.getTopEarners(startDate, endDate, 10),
      this.getCurrencyBreakdown(startDate, endDate),
    ]);

    const report = {
      type,
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalTransactions: transactions.total,
        totalVolume: transactions.volume,
        totalWithdrawals: withdrawals.total,
        totalWithdrawnAmount: withdrawals.amount,
        successRate: transactions.successRate,
      },
      transactions,
      withdrawals,
      topEarners,
      currencies,
      anomalies: await this.detectPaymentAnomalies(),
      generatedAt: new Date(),
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL.REPORTS, JSON.stringify(report));
    return report;
  }

  /**
   * Get real-time payment dashboard data
   */
  async getDashboardData(): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}dashboard:realtime`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      lastHourTransactions,
      lastHourWithdrawals,
      pendingTransactions,
      pendingWithdrawals,
      todayMetrics,
      activeUsers,
    ] = await Promise.all([
      this.prisma.transaction.count({
        where: {
          createdAt: { gte: hourAgo },
          status: 'COMPLETED',
        },
      }),
      this.prisma.withdrawal.count({
        where: {
          createdAt: { gte: hourAgo },
          status: 'COMPLETED',
        },
      }),
      this.prisma.transaction.count({
        where: {
          status: 'PENDING',
          createdAt: { gte: dayAgo },
        },
      }),
      this.prisma.withdrawal.count({
        where: {
          status: 'PENDING',
          createdAt: { gte: dayAgo },
        },
      }),
      this.getTodayMetrics(),
      this.getActiveUsersCount(),
    ]);

    const dashboard = {
      realTime: {
        lastHourTransactions,
        lastHourWithdrawals,
        pendingTransactions,
        pendingWithdrawals,
        activeUsers,
      },
      today: todayMetrics,
      alerts: await this.detectPaymentAnomalies(),
      timestamp: now,
    };

    await this.redis.setex(cacheKey, 30, JSON.stringify(dashboard)); // 30 second cache
    return dashboard;
  }

  // Private helper methods

  private calculateDailyEarnings(transactions: any[]): Array<{ date: string; earnings: number }> {
    const dailyEarnings: Record<string, number> = {};

    transactions
      .filter(t => t.type === 'EARNING')
      .forEach(t => {
        const date = t.createdAt.toISOString().split('T')[0];
        dailyEarnings[date] = (dailyEarnings[date] || 0) + parseFloat(t.amount.toString());
      });

    return Object.entries(dailyEarnings).map(([date, earnings]) => ({ date, earnings }));
  }

  private calculateActivityPattern(
    transactions: any[],
    withdrawals: any[],
    days: number
  ): { currentStreak: number; totalActiveDays: number } {
    const activityDays = new Set<string>();
    const today = new Date().toISOString().split('T')[0];

    [...transactions, ...withdrawals].forEach(t => {
      activityDays.add(t.createdAt.toISOString().split('T')[0]);
    });

    let currentStreak = 0;
    let checkDate = new Date();

    while (activityDays.has(checkDate.toISOString().split('T')[0])) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
      currentStreak,
      totalActiveDays: activityDays.size,
    };
  }

  private calculateRiskScore(
    user: any,
    transactions: any[],
    withdrawals: any[],
    totalEarnings: number,
    totalWithdrawn: number
  ): number {
    let riskScore = 0;

    // Base trust score
    if (user?.trustScore) {
      riskScore += (1 - parseFloat(user.trustScore.toString())) * 30;
    }

    // Withdrawal rate (high withdrawal rate is risky)
    const withdrawalRate = totalEarnings > 0 ? totalWithdrawn / totalEarnings : 0;
    if (withdrawalRate > 0.9) riskScore += 20;
    else if (withdrawalRate > 0.7) riskScore += 10;

    // Account age (new accounts are riskier)
    const accountAge = user?.createdAt
      ? (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    if (accountAge < 7) riskScore += 20;
    else if (accountAge < 30) riskScore += 10;

    // Transaction frequency (very high frequency can be suspicious)
    const avgDailyTransactions = transactions.length / 30;
    if (avgDailyTransactions > 100) riskScore += 15;
    else if (avgDailyTransactions > 50) riskScore += 5;

    // Failed transactions
    const failedTransactions = transactions.filter(t => t.status === 'FAILED').length;
    const failureRate = transactions.length > 0 ? failedTransactions / transactions.length : 0;
    if (failureRate > 0.1) riskScore += 15;
    else if (failureRate > 0.05) riskScore += 5;

    return Math.min(100, Math.max(0, riskScore));
  }

  private getPreferredCurrency(transactions: any[]): 'TON' | 'USDT' {
    const currencyCount: Record<string, number> = {};

    transactions.forEach(t => {
      currencyCount[t.currency] = (currencyCount[t.currency] || 0) + 1;
    });

    return Object.keys(currencyCount).length > 0 && currencyCount['TON'] > currencyCount['USDT'] ? 'TON' : 'USDT';
  }

  private getLastActivity(transactions: any[], withdrawals: any[]): Date {
    const allActivities = [...transactions, ...withdrawals];
    if (allActivities.length === 0) return new Date(0);

    return new Date(Math.max(...allActivities.map(a => a.createdAt.getTime())));
  }

  private async detectTransactionSpike(): Promise<PaymentAnomaly | null> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const [currentHour, previousHour] = await Promise.all([
      this.prisma.transaction.count({
        where: { createdAt: { gte: hourAgo } },
      }),
      this.prisma.transaction.count({
        where: {
          createdAt: { gte: twoHoursAgo, lt: hourAgo },
        },
      }),
    ]);

    const spikeThreshold = 3; // 3x increase
    if (currentHour > previousHour * spikeThreshold && currentHour > 100) {
      return {
        type: 'SUDDEN_SPIKE',
        severity: currentHour > previousHour * 5 ? 'HIGH' : 'MEDIUM',
        description: `Transaction volume spiked by ${((currentHour / previousHour - 1) * 100).toFixed(1)}%`,
        affectedUsers: await this.prisma.transaction.count({
          where: { createdAt: { gte: hourAgo } },
          distinct: ['userId'],
        }),
        amount: await this.prisma.transaction.aggregate({
          where: { createdAt: { gte: hourAgo } },
          _sum: { amount: true },
        }).then(r => parseFloat(r._sum.amount?.toString() || '0')),
        detectedAt: now,
        metadata: { currentHour, previousHour },
      };
    }

    return null;
  }

  private async detectUnusualWithdrawalPattern(): Promise<PaymentAnomaly | null> {
    // Detect multiple withdrawals to different addresses from same user
    const recentWithdrawals = await this.prisma.withdrawal.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        status: 'COMPLETED',
      },
      select: { userId: true, address: true, amount: true },
    });

    const userWithdrawals: Record<string, Set<string>> = {};
    recentWithdrawals.forEach(w => {
      if (!userWithdrawals[w.userId]) userWithdrawals[w.userId] = new Set();
      userWithdrawals[w.userId].add(w.address);
    });

    for (const [userId, addresses] of Object.entries(userWithdrawals)) {
      if (addresses.size > 3) {
        return {
          type: 'UNUSUAL_PATTERN',
          severity: 'HIGH',
          description: `User ${userId} made withdrawals to ${addresses.size} different addresses`,
          affectedUsers: 1,
          amount: recentWithdrawals
            .filter(w => w.userId === userId)
            .reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0),
          detectedAt: new Date(),
          metadata: { userId, addressCount: addresses.size },
        };
      }
    }

    return null;
  }

  private async detectBatchFailures(): Promise<PaymentAnomaly | null> {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const failedCount = await this.prisma.withdrawal.count({
      where: {
        createdAt: { gte: hourAgo },
        status: 'FAILED',
      },
    });

    if (failedCount > 10) {
      return {
        type: 'FAILED_BATCH',
        severity: 'CRITICAL',
        description: `${failedCount} withdrawals failed in the last hour`,
        affectedUsers: await this.prisma.withdrawal.count({
          where: {
            createdAt: { gte: hourAgo },
            status: 'FAILED',
          },
          distinct: ['userId'],
        }),
        amount: await this.prisma.withdrawal.aggregate({
          where: {
            createdAt: { gte: hourAgo },
            status: 'FAILED',
          },
          _sum: { amount: true },
        }).then(r => parseFloat(r._sum.amount?.toString() || '0')),
        detectedAt: new Date(),
        metadata: { failedCount },
      };
    }

    return null;
  }

  private async detectLatePayments(): Promise<PaymentAnomaly | null> {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const pendingCount = await this.prisma.transaction.count({
      where: {
        status: 'PENDING',
        createdAt: { lt: hourAgo },
      },
    });

    if (pendingCount > 50) {
      return {
        type: 'LATE_PAYMENT',
        severity: 'MEDIUM',
        description: `${pendingCount} payments pending for over 1 hour`,
        affectedUsers: await this.prisma.transaction.count({
          where: {
            status: 'PENDING',
            createdAt: { lt: hourAgo },
          },
          distinct: ['userId'],
        }),
        amount: await this.prisma.transaction.aggregate({
          where: {
            status: 'PENDING',
            createdAt: { lt: hourAgo },
          },
          _sum: { amount: true },
        }).then(r => parseFloat(r._sum.amount?.toString() || '0')),
        detectedAt: new Date(),
        metadata: { pendingCount },
      };
    }

    return null;
  }

  private async getTransactionStats(startDate: Date, endDate: Date) {
    const stats = await this.prisma.transaction.aggregate({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    const completedCount = await this.prisma.transaction.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
      },
    });

    return {
      total: stats._count.id,
      volume: parseFloat(stats._sum.amount?.toString() || '0'),
      successRate: stats._count.id > 0 ? (completedCount / stats._count.id) * 100 : 0,
    };
  }

  private async getWithdrawalStats(startDate: Date, endDate: Date) {
    const stats = await this.prisma.withdrawal.aggregate({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    return {
      total: stats._count.id,
      amount: parseFloat(stats._sum.amount?.toString() || '0'),
    };
  }

  private async getTopEarners(startDate: Date, endDate: Date, limit: number) {
    return this.prisma.transaction.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
        type: 'EARNING',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });
  }

  private async getCurrencyBreakdown(startDate: Date, endDate: Date) {
    return this.prisma.transaction.groupBy({
      by: ['currency'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
      },
      _count: { id: true },
      _sum: { amount: true },
    });
  }

  private async getTodayMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [transactions, withdrawals] = await Promise.all([
      this.getTransactionStats(today, new Date()),
      this.getWithdrawalStats(today, new Date()),
    ]);

    return { transactions, withdrawals };
  }

  private async getActiveUsersCount(): Promise<number> {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [transactionUsers, withdrawalUsers] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { createdAt: { gte: hourAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.withdrawal.findMany({
        where: { createdAt: { gte: hourAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const uniqueUsers = new Set([
      ...transactionUsers.map(u => u.userId),
      ...withdrawalUsers.map(u => u.userId),
    ]);

    return uniqueUsers.size;
  }
}