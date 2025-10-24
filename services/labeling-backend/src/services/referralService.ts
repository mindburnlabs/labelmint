import { PrismaClient, User, Referral } from '@prisma/client';
import { RedisClient } from '@/lib/redis';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from './notificationService';
import { TonPaymentService } from './tonPaymentService';

interface ReferralReward {
  type: 'FIXED' | 'PERCENTAGE';
  amount: number;
  currency: 'TON' | 'USDT';
  condition: 'ON_SIGNUP' | 'ON_FIRST_TASK' | 'ON_TASK_THRESHOLD';
  value?: number; // For task threshold
}

export class ReferralService {
  private readonly referralRewards: ReferralReward[] = [
    {
      type: 'FIXED',
      amount: 0.5,
      currency: 'USDT',
      condition: 'ON_SIGNUP',
    },
    {
      type: 'FIXED',
      amount: 1,
      currency: 'USDT',
      condition: 'ON_FIRST_TASK',
    },
    {
      type: 'PERCENTAGE',
      amount: 5,
      currency: 'USDT',
      condition: 'ON_TASK_THRESHOLD',
      value: 10, // After referred worker completes 10 tasks
    },
  ];

  constructor(
    private prisma: PrismaClient,
    private redis: RedisClient,
    private notificationService: NotificationService,
    private tonPaymentService: TonPaymentService
  ) {}

  /**
   * Create a referral code for a user
   */
  async createReferralCode(userId: string): Promise<string> {
    try {
      // Check if user already has a referral code
      const existingReferral = await this.prisma.referral.findFirst({
        where: { referrerId: userId },
      });

      if (existingReferral) {
        return existingReferral.code;
      }

      // Generate unique referral code
      const code = await this.generateUniqueCode();

      // Create referral record
      await this.prisma.referral.create({
        data: {
          referrerId: userId,
          code,
          status: 'ACTIVE',
        },
      });

      logger.info(`Referral code created for user ${userId}: ${code}`);
      return code;
    } catch (error) {
      logger.error('Failed to create referral code', error);
      throw error;
    }
  }

  /**
   * Generate a unique referral code
   */
  private async generateUniqueCode(): Promise<string> {
    let code: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      // Generate 6-character alphanumeric code
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      attempts++;

      if (attempts > maxAttempts) {
        throw new Error('Failed to generate unique referral code');
      }
    } while (await this.isCodeTaken(code));

    return code;
  }

  /**
   * Check if a referral code is already taken
   */
  private async isCodeTaken(code: string): Promise<boolean> {
    const existing = await this.prisma.referral.findUnique({
      where: { code },
    });
    return !!existing;
  }

  /**
   * Apply a referral code during user registration
   */
  async applyReferralCode(
    userId: string,
    code: string,
    referrerTelegramId?: number
  ): Promise<boolean> {
    try {
      // Find the referral
      const referral = await this.prisma.referral.findUnique({
        where: { code },
        include: {
          referrer: true,
        },
      });

      if (!referral) {
        logger.warn(`Invalid referral code: ${code}`);
        return false;
      }

      if (referral.status !== 'ACTIVE') {
        logger.warn(`Referral code is not active: ${code}`);
        return false;
      }

      // Check if referring self
      if (referrerTelegramId && referrer.telegramId === referrerTelegramId) {
        logger.warn(`User attempted self-referral: ${userId}`);
        return false;
      }

      // Create referral relationship
      await this.prisma.referralRelationship.create({
        data: {
          referralId: referral.id,
          referredId: userId,
          referredAt: new Date(),
          status: 'PENDING',
        },
      });

      // Update referral stats
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: {
          totalReferred: { increment: 1 },
          pendingReferred: { increment: 1 },
        },
      });

      // Store in Redis for quick lookup
      await this.redis.setex(
        `referral:${userId}`,
        86400 * 30, // 30 days
        JSON.stringify({
          referrerId: referral.referrerId,
          referralId: referral.id,
          code,
        })
      );

      logger.info(`Referral applied: ${code} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to apply referral code', error);
      return false;
    }
  }

  /**
   * Process referral rewards based on user activity
   */
  async processReferralReward(
    userId: string,
    event: 'SIGNUP' | 'FIRST_TASK' | 'TASK_COMPLETED'
  ): Promise<void> {
    try {
      // Get referral info from cache or database
      const referralInfo = await this.getReferralInfo(userId);
      if (!referralInfo) return;

      let rewardsToProcess: ReferralReward[] = [];

      switch (event) {
        case 'SIGNUP':
          rewardsToProcess = this.referralRewards.filter(r => r.condition === 'ON_SIGNUP');
          break;

        case 'FIRST_TASK':
          rewardsToProcess = this.referralRewards.filter(r => r.condition === 'ON_FIRST_TASK');

          // Mark referral as active
          await this.prisma.referralRelationship.updateMany({
            where: {
              referredId: userId,
              status: 'PENDING',
            },
            data: {
              status: 'ACTIVE',
              activatedAt: new Date(),
            },
          });

          await this.prisma.referral.update({
            where: { id: referralInfo.referralId },
            data: {
              activeReferred: { increment: 1 },
              pendingReferred: { decrement: 1 },
            },
          });
          break;

        case 'TASK_COMPLETED':
          // Check task count for percentage rewards
          const worker = await this.prisma.worker.findUnique({
            where: { userId },
          });

          if (worker) {
            const thresholdRewards = this.referralRewards.filter(
              r => r.condition === 'ON_TASK_THRESHOLD' && worker.completedTasks === r.value
            );

            // Check if this reward hasn't been processed yet
            for (const reward of thresholdRewards) {
              const existing = await this.prisma.referralReward.findFirst({
                where: {
                  referralId: referralInfo.referralId,
                  referredId: userId,
                  type: reward.condition,
                  value: reward.value,
                },
              });

              if (!existing) {
                rewardsToProcess.push(reward);
              }
            }
          }
          break;
      }

      // Process rewards
      for (const reward of rewardsToProcess) {
        await this.grantReferralReward(referralInfo.referrerId, userId, reward);
      }

      // Send notifications
      if (rewardsToProcess.length > 0) {
        await this.notificationService.sendNotification(
          referralInfo.referrerId,
          'referral_reward',
          {
            referredUserId: userId,
            event,
            rewards: rewardsToProcess,
          }
        );
      }
    } catch (error) {
      logger.error('Failed to process referral reward', error);
    }
  }

  /**
   * Grant a referral reward to the referrer
   */
  private async grantReferralReward(
    referrerId: string,
    referredId: string,
    reward: ReferralReward
  ): Promise<void> {
    try {
      let amount = reward.amount;

      // Calculate percentage rewards
      if (reward.type === 'PERCENTAGE') {
        const referredWorker = await this.prisma.worker.findUnique({
          where: { userId: referredId },
        });

        if (referredWorker) {
          // Get referred worker's total earnings
          amount = (referredWorker.totalEarnings * reward.amount) / 100;
        }
      }

      // Grant the reward
      await this.tonPaymentService.updateWorkerEarnings(
        referrerId,
        amount,
        reward.currency
      );

      // Record the reward
      await this.prisma.referralReward.create({
        data: {
          referralId: (await this.getReferralInfo(referredId))?.referralId!,
          referredId,
          referrerId,
          type: reward.condition,
          amount,
          currency: reward.currency,
          grantedAt: new Date(),
          value: reward.value,
        },
      });

      // Update referral stats
      await this.prisma.referral.updateMany({
        where: {
          referrerId,
        },
        data: {
          totalRewards: { increment: amount },
        },
      });

      logger.info(`Referral reward granted`, {
        referrerId,
        referredId,
        amount,
        currency: reward.currency,
        type: reward.condition,
      });
    } catch (error) {
      logger.error('Failed to grant referral reward', error);
    }
  }

  /**
   * Get referral information for a user
   */
  private async getReferralInfo(userId: string): Promise<{
    referrerId: string;
    referralId: string;
    code: string;
  } | null> {
    // Try cache first
    const cached = await this.redis.get(`referral:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const relationship = await this.prisma.referralRelationship.findFirst({
      where: { referredId: userId },
      include: {
        referral: true,
      },
    });

    if (!relationship) return null;

    const info = {
      referrerId: relationship.referral.referrerId,
      referralId: relationship.referralId,
      code: relationship.referral.code,
    };

    // Cache for future use
    await this.redis.setex(
      `referral:${userId}`,
      86400 * 30,
      JSON.stringify(info)
    );

    return info;
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string): Promise<{
    code: string;
    totalReferred: number;
    activeReferred: number;
    pendingReferred: number;
    totalRewards: number;
    recentReferrals: Array<{
      id: string;
      firstName: string;
      telegramUsername: string;
      referredAt: string;
      status: string;
      tasksCompleted: number;
    }>;
  }> {
    const referral = await this.prisma.referral.findFirst({
      where: { referrerId: userId },
      include: {
        relationships: {
          include: {
            referred: {
              include: {
                worker: true,
              },
            },
          },
          orderBy: { referredAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!referral) {
      return {
        code: '',
        totalReferred: 0,
        activeReferred: 0,
        pendingReferred: 0,
        totalRewards: 0,
        recentReferrals: [],
      };
    }

    const recentReferrals = referral.relationships.map(rel => ({
      id: rel.referredId,
      firstName: rel.referred.firstName,
      telegramUsername: rel.referred.telegramUsername || '',
      referredAt: rel.referredAt,
      status: rel.status,
      tasksCompleted: rel.referred.worker?.completedTasks || 0,
    }));

    return {
      code: referral.code,
      totalReferred: referral.totalReferred,
      activeReferred: referral.activeReferred,
      pendingReferred: referral.pendingReferred,
      totalRewards: referral.totalRewards,
      recentReferrals,
    };
  }

  /**
   * Get global referral statistics (admin only)
   */
  async getGlobalReferralStats(): Promise<{
    totalReferrals: number;
    activeReferrers: number;
    totalRewardsPaid: number;
    topReferrers: Array<{
      referrerId: string;
      firstName: string;
      telegramUsername: string;
      totalReferred: number;
      totalRewards: number;
    }>;
    monthlyTrend: Array<{
      month: string;
      referrals: number;
      rewards: number;
    }>;
  }> {
    const [
      totalReferrals,
      activeReferrers,
      totalRewards,
      topReferrers,
    ] = await Promise.all([
      this.prisma.referralRelationship.count(),
      this.prisma.referral.count({
        where: { totalReferred: { gt: 0 } },
      }),
      this.prisma.referral.aggregate({
        _sum: { totalRewards: true },
      }),
      this.prisma.referral.findMany({
        where: { totalReferred: { gt: 0 } },
        include: {
          referrer: {
            select: {
              firstName: true,
              telegramUsername: true,
            },
          },
        },
        orderBy: { totalReferred: 'desc' },
        take: 10,
      }),
    ]);

    // Get monthly trend for last 6 months
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toISOString().substring(0, 7);

      const [referrals, rewards] = await Promise.all([
        this.prisma.referralRelationship.count({
          where: {
            referredAt: {
              gte: new Date(month),
              lt: new Date(date.getFullYear(), date.getMonth() + 1),
            },
          },
        }),
        this.prisma.referralReward.aggregate({
          where: {
            grantedAt: {
              gte: new Date(month),
              lt: new Date(date.getFullYear(), date.getMonth() + 1),
            },
          },
          _sum: { amount: true },
        }),
      ]);

      monthlyTrend.push({
        month: date.toLocaleDateString('en', { month: 'short', year: 'numeric' }),
        referrals,
        rewards: rewards._sum.amount || 0,
      });
    }

    return {
      totalReferrals,
      activeReferrers,
      totalRewardsPaid: totalRewards._sum.totalRewards || 0,
      topReferrers: topReferrers.map(r => ({
        referrerId: r.referrerId,
        firstName: r.referrer.firstName,
        telegramUsername: r.referrer.telegramUsername || '',
        totalReferred: r.totalReferred,
        totalRewards: r.totalRewards,
      })),
      monthlyTrend,
    };
  }

  /**
   * Validate a referral code
   */
  async validateReferralCode(code: string): Promise<boolean> {
    const referral = await this.prisma.referral.findUnique({
      where: { code },
    });

    return !!referral && referral.status === 'ACTIVE';
  }

  /**
   * Deactivate a referral code
   */
  async deactivateReferralCode(referralId: string): Promise<void> {
    await this.prisma.referral.update({
      where: { id: referralId },
      data: { status: 'INACTIVE' },
    });

    logger.info(`Referral deactivated: ${referralId}`);
  }

  /**
   * Clean up expired pending referrals
   */
  async cleanupExpiredReferrals(): Promise<number> {
    const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const result = await this.prisma.referralRelationship.updateMany({
      where: {
        status: 'PENDING',
        referredAt: { lt: expiredDate },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} expired referrals`);
    }

    return result.count;
  }
}