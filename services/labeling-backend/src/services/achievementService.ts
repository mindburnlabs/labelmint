import { PrismaClient, User, Achievement, UserAchievement, Worker } from '@prisma/client';
import { RedisClient } from '@/lib/redis';
import { logger } from '@/utils/logger';
import { NotificationService } from './notificationService';

interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'TASKS' | 'ACCURACY' | 'STREAK' | 'SPECIAL' | 'SOCIAL';
  requirement: {
    type: 'COUNT' | 'ACCURACY' | 'STREAK' | 'SPECIAL';
    value: number;
    condition?: string;
  };
  reward: {
    type: 'BADGE' | 'POINTS' | 'BONUS';
    value: number | string;
  };
  xp: number;
}

export class AchievementService {
  private achievements: Map<string, AchievementDefinition> = new Map();

  constructor(
    private prisma: PrismaClient,
    private redis: RedisClient,
    private notificationService: NotificationService
  ) {
    this.initializeAchievements();
  }

  /**
   * Initialize achievement definitions
   */
  private initializeAchievements(): void {
    const definitions: AchievementDefinition[] = [
      // Task-based achievements
      {
        id: 'first_task',
        name: 'First Steps',
        description: 'Complete your first task',
        icon: '🎯',
        category: 'TASKS',
        requirement: { type: 'COUNT', value: 1 },
        reward: { type: 'POINTS', value: 10 },
        xp: 10,
      },
      {
        id: 'tasks_10',
        name: 'Getting Started',
        description: 'Complete 10 tasks',
        icon: '📊',
        category: 'TASKS',
        requirement: { type: 'COUNT', value: 10 },
        reward: { type: 'POINTS', value: 50 },
        xp: 50,
      },
      {
        id: 'tasks_100',
        name: 'Task Master',
        description: 'Complete 100 tasks',
        icon: '⭐',
        category: 'TASKS',
        requirement: { type: 'COUNT', value: 100 },
        reward: { type: 'POINTS', value: 500 },
        xp: 500,
      },
      {
        id: 'tasks_1000',
        name: 'Elite Annotator',
        description: 'Complete 1000 tasks',
        icon: '👑',
        category: 'TASKS',
        requirement: { type: 'COUNT', value: 1000 },
        reward: { type: 'BONUS', value: '5%_bonus' },
        xp: 5000,
      },

      // Accuracy-based achievements
      {
        id: 'accuracy_90',
        name: 'Precision Expert',
        description: 'Maintain 90% accuracy over 50 tasks',
        icon: '🎯',
        category: 'ACCURACY',
        requirement: { type: 'ACCURACY', value: 90, condition: 'over_50' },
        reward: { type: 'POINTS', value: 200 },
        xp: 200,
      },
      {
        id: 'accuracy_95',
        name: 'Annotation Master',
        description: 'Maintain 95% accuracy over 100 tasks',
        icon: '🏆',
        category: 'ACCURACY',
        requirement: { type: 'ACCURACY', value: 95, condition: 'over_100' },
        reward: { type: 'POINTS', value: 500 },
        xp: 500,
      },
      {
        id: 'perfect_50',
        name: 'Flawless Performance',
        description: 'Complete 50 tasks with 100% accuracy',
        icon: '💎',
        category: 'ACCURACY',
        requirement: { type: 'SPECIAL', value: 50, condition: 'perfect_accuracy' },
        reward: { type: 'BONUS', value: '2%_bonus' },
        xp: 1000,
      },

      // Streak achievements
      {
        id: 'streak_7',
        name: 'Week Warrior',
        description: 'Maintain a 7-day streak',
        icon: '🔥',
        category: 'STREAK',
        requirement: { type: 'STREAK', value: 7 },
        reward: { type: 'POINTS', value: 100 },
        xp: 100,
      },
      {
        id: 'streak_30',
        name: 'Monthly Champion',
        description: 'Maintain a 30-day streak',
        icon: '🌟',
        category: 'STREAK',
        requirement: { type: 'STREAK', value: 30 },
        reward: { type: 'POINTS', value: 500 },
        xp: 500,
      },
      {
        id: 'streak_100',
        name: 'Legendary Streak',
        description: 'Maintain a 100-day streak',
        icon: '⚡',
        category: 'STREAK',
        requirement: { type: 'STREAK', value: 100 },
        reward: { type: 'BONUS', value: '10%_bonus' },
        xp: 2000,
      },

      // Special achievements
      {
        id: 'speed_demon',
        name: 'Speed Demon',
        description: 'Complete 10 tasks in under 30 seconds each',
        icon: '⚡',
        category: 'SPECIAL',
        requirement: { type: 'SPECIAL', value: 10, condition: 'under_30s' },
        reward: { type: 'POINTS', value: 150 },
        xp: 150,
      },
      {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Complete 25 tasks before 9 AM',
        icon: '🌅',
        category: 'SPECIAL',
        requirement: { type: 'SPECIAL', value: 25, condition: 'before_9am' },
        reward: { type: 'POINTS', value: 100 },
        xp: 100,
      },
      {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Complete 25 tasks after 10 PM',
        icon: '🦉',
        category: 'SPECIAL',
        requirement: { type: 'SPECIAL', value: 25, condition: 'after_10pm' },
        reward: { type: 'POINTS', value: 100 },
        xp: 100,
      },

      // Social achievements
      {
        id: 'helpful',
        name: 'Helpful Hero',
        description: 'Help 5 newcomers in the community',
        icon: '🤝',
        category: 'SOCIAL',
        requirement: { type: 'SPECIAL', value: 5, condition: 'help_newcomers' },
        reward: { type: 'POINTS', value: 200 },
        xp: 200,
      },
      {
        id: 'referral_5',
        name: 'Network Builder',
        description: 'Refer 5 active workers',
        icon: '👥',
        category: 'SOCIAL',
        requirement: { type: 'SPECIAL', value: 5, condition: 'referrals' },
        reward: { type: 'POINTS', value: 300 },
        xp: 300,
      },
      {
        id: 'top_daily',
        name: 'Daily Champion',
        description: 'Be in the top 10 workers for a day',
        icon: '🥇',
        category: 'SPECIAL',
        requirement: { type: 'SPECIAL', value: 1, condition: 'top_10_daily' },
        reward: { type: 'POINTS', value: 400 },
        xp: 400,
      },
    ];

    definitions.forEach(achievement => {
      this.achievements.set(achievement.id, achievement);
    });

    logger.info(`Initialized ${definitions.length} achievements`);
  }

  /**
   * Check and award achievements for a worker
   */
  async checkAndAwardAchievements(workerId: string, event: {
    type: 'TASK_COMPLETED' | 'ACCURACY_UPDATE' | 'STREAK_UPDATE' | 'SPECIAL';
    data?: any;
  }): Promise<UserAchievement[]> {
    const awardedAchievements: UserAchievement[] = [];

    try {
      // Get worker data
      const worker = await this.prisma.worker.findUnique({
        where: { userId: workerId },
        include: {
          user: true,
          achievements: {
            include: { achievement: true },
          },
        },
      });

      if (!worker) return awardedAchievements;

      // Get already earned achievement IDs
      const earnedIds = new Set(worker.achievements.map(ua => ua.achievementId));

      // Check each achievement
      for (const [achievementId, definition] of this.achievements.entries()) {
        if (earnedIds.has(achievementId)) continue;

        const hasEarned = await this.checkAchievement(worker, definition, event);
        if (hasEarned) {
          const userAchievement = await this.awardAchievement(worker, definition);
          if (userAchievement) {
            awardedAchievements.push(userAchievement);
          }
        }
      }

      return awardedAchievements;
    } catch (error) {
      logger.error('Failed to check achievements', error);
      return awardedAchievements;
    }
  }

  /**
   * Check if a worker has earned an achievement
   */
  private async checkAchievement(
    worker: Worker & { achievements: any[] },
    achievement: AchievementDefinition,
    event: any
  ): Promise<boolean> {
    const { requirement } = achievement;

    switch (requirement.type) {
      case 'COUNT':
        return worker.completedTasks >= requirement.value;

      case 'ACCURACY':
        if (requirement.condition === 'over_50') {
          return worker.completedTasks >= 50 && worker.accuracy >= requirement.value / 100;
        }
        if (requirement.condition === 'over_100') {
          return worker.completedTasks >= 100 && worker.accuracy >= requirement.value / 100;
        }
        return false;

      case 'STREAK':
        return worker.currentStreak >= requirement.value;

      case 'SPECIAL':
        return await this.checkSpecialAchievement(worker, achievement, event);

      default:
        return false;
    }
  }

  /**
   * Check special achievement conditions
   */
  private async checkSpecialAchievement(
    worker: Worker,
    achievement: AchievementDefinition,
    event: any
  ): Promise<boolean> {
    const { condition, value } = achievement.requirement;

    switch (condition) {
      case 'perfect_accuracy':
        // Check last N tasks for 100% accuracy
        const recentTasks = await this.prisma.taskAnswer.findMany({
          where: {
            workerId: worker.userId,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
          take: value,
          orderBy: { createdAt: 'desc' },
        });

        if (recentTasks.length < value) return false;
        return recentTasks.every(t => t.isCorrect);

      case 'under_30s':
        // Check if completed 10 tasks under 30 seconds
        const fastTasks = await this.prisma.taskAnswer.findMany({
          where: {
            workerId: worker.userId,
            timeSpentMs: { lt: 30000 },
          },
          take: value,
          orderBy: { createdAt: 'desc' },
        });
        return fastTasks.length >= value;

      case 'before_9am':
        // Check tasks completed before 9 AM
        const morningTasks = await this.prisma.taskAnswer.findMany({
          where: {
            workerId: worker.userId,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        });
        const count = morningTasks.filter(t => {
          const hour = new Date(t.createdAt).getHours();
          return hour < 9;
        }).length;
        return count >= value;

      case 'after_10pm':
        // Check tasks completed after 10 PM
        const nightTasks = await this.prisma.taskAnswer.findMany({
          where: {
            workerId: worker.userId,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        });
        const nightCount = nightTasks.filter(t => {
          const hour = new Date(t.createdAt).getHours();
          return hour >= 22;
        }).length;
        return nightCount >= value;

      case 'help_newcomers':
        // This would need to be tracked separately
        return false;

      case 'referrals':
        // Check number of successful referrals
        const referralCount = await this.prisma.user.count({
          where: {
            referredBy: worker.userId,
            workers: {
              some: {
                completedTasks: { gte: 10 },
              },
            },
          },
        });
        return referralCount >= value;

      case 'top_10_daily':
        // Check if in top 10 for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const topWorkers = await this.prisma.taskAnswer.groupBy({
          by: ['workerId'],
          where: {
            createdAt: { gte: today },
            isCorrect: true,
          },
          _count: true,
          orderBy: { _count: 'desc' },
          take: 10,
        });

        return topWorkers.some(w => w.workerId === worker.userId);

      default:
        return false;
    }
  }

  /**
   * Award an achievement to a worker
   */
  private async awardAchievement(
    worker: Worker & { user: User },
    achievement: AchievementDefinition
  ): Promise<UserAchievement | null> {
    try {
      // Create achievement record in database
      const userAchievement = await this.prisma.userAchievement.create({
        data: {
          userId: worker.userId,
          achievementId: achievement.id,
          awardedAt: new Date(),
        },
      });

      // Update worker XP and level
      const newTotalXp = worker.totalXp + achievement.xp;
      const newLevel = this.calculateLevel(newTotalXp);

      await this.prisma.worker.update({
        where: { userId: worker.userId },
        data: {
          totalXp: newTotalXp,
          level: newLevel,
        },
      });

      // Process rewards
      await this.processReward(worker, achievement);

      // Send notification
      await this.notificationService.sendNotification(
        worker.userId,
        'achievement_unlocked',
        {
          achievement,
          xpGained: achievement.xp,
          newLevel,
        }
      );

      logger.info(`Achievement awarded`, {
        userId: worker.userId,
        achievementId: achievement.id,
        xp: achievement.xp,
      });

      return userAchievement;
    } catch (error) {
      logger.error('Failed to award achievement', error);
      return null;
    }
  }

  /**
   * Process achievement rewards
   */
  private async processReward(
    worker: Worker & { user: User },
    achievement: AchievementDefinition
  ): Promise<void> {
    const { reward } = achievement;

    switch (reward.type) {
      case 'POINTS':
        // Add bonus to worker's earnings
        await this.prisma.user.update({
          where: { id: worker.userId },
          data: {
            usdtBalance: { increment: parseFloat(reward.value.toString()) * 0.01 }, // Convert points to USDT
          },
        });
        break;

      case 'BONUS':
        // Store bonus percentage in worker metadata
        const currentBonus = worker.metadata?.bonusPercentage || 0;
        const bonusValue = parseFloat(reward.value.toString());
        await this.prisma.worker.update({
          where: { userId: worker.userId },
          data: {
            metadata: {
              ...worker.metadata,
              bonusPercentage: Math.max(currentBonus, bonusValue),
            },
          },
        });
        break;
    }
  }

  /**
   * Calculate worker level based on XP
   */
  private calculateLevel(totalXp: number): number {
    // Level formula: level = floor(sqrt(xp / 100))
    return Math.floor(Math.sqrt(totalXp / 100));
  }

  /**
   * Get worker achievements
   */
  async getWorkerAchievements(workerId: string): Promise<{
    earned: any[];
    locked: any[];
    totalXp: number;
    level: number;
  }> {
    const worker = await this.prisma.worker.findUnique({
      where: { userId: workerId },
      include: {
        achievements: {
          include: { achievement: true },
        },
      },
    });

    if (!worker) {
      return { earned: [], locked: [], totalXp: 0, level: 0 };
    }

    const earnedIds = new Set(worker.achievements.map(ua => ua.achievementId));
    const earned = worker.achievements.map(ua => ({
      ...ua.achievement,
      awardedAt: ua.awardedAt,
    }));

    const locked = Array.from(this.achievements.values())
      .filter(a => !earnedIds.has(a.id))
      .map(a => ({
        ...a,
        progress: this.calculateProgress(worker, a),
      }));

    return {
      earned,
      locked,
      totalXp: worker.totalXp,
      level: worker.level,
    };
  }

  /**
   * Calculate progress towards an achievement
   */
  private calculateProgress(worker: Worker, achievement: AchievementDefinition): number {
    const { requirement } = achievement;

    switch (requirement.type) {
      case 'COUNT':
        return Math.min(100, (worker.completedTasks / requirement.value) * 100);

      case 'ACCURACY':
        if (requirement.condition === 'over_50' && worker.completedTasks < 50) {
          return (worker.completedTasks / 50) * 100;
        }
        if (requirement.condition === 'over_100' && worker.completedTasks < 100) {
          return (worker.completedTasks / 100) * 100;
        }
        return (worker.accuracy * 100 >= requirement.value) ? 100 : (worker.accuracy * 100 / requirement.value) * 100;

      case 'STREAK':
        return Math.min(100, (worker.currentStreak / requirement.value) * 100);

      default:
        return 0;
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(type: 'xp' | 'tasks' | 'accuracy' = 'xp', limit: number = 50): Promise<any[]> {
    let orderBy: any = {};
    let select: any = {
      user: {
        select: {
          telegramUsername: true,
          firstName: true,
        },
      },
    };

    switch (type) {
      case 'xp':
        orderBy = { totalXp: 'desc' };
        select.totalXp = true;
        select.level = true;
        break;
      case 'tasks':
        orderBy = { completedTasks: 'desc' };
        select.completedTasks = true;
        select.accuracy = true;
        break;
      case 'accuracy':
        orderBy = { accuracy: 'desc' };
        select.accuracy = true;
        select.completedTasks = true;
        break;
    }

    const workers = await this.prisma.worker.findMany({
      where: {
        completedTasks: { gte: 10 }, // Minimum tasks to appear
      },
      select,
      orderBy,
      take: limit,
    });

    return workers.map((worker, index) => ({
      rank: index + 1,
      ...worker,
    }));
  }

  /**
   * Get achievement statistics
   */
  async getAchievementStats(): Promise<{
    totalAchievements: number;
    totalUnlocked: number;
    byCategory: Record<string, number>;
    mostCommon: any[];
  }> {
    const totalAchievements = this.achievements.size;
    const totalUnlocked = await this.prisma.userAchievement.count();

    // By category
    const byCategory: Record<string, number> = {};
    for (const achievement of this.achievements.values()) {
      byCategory[achievement.category] = (byCategory[achievement.category] || 0) + 1;
    }

    // Most common achievements
    const commonAchievements = await this.prisma.userAchievement.groupBy({
      by: ['achievementId'],
      _count: true,
      orderBy: { _count: 'desc' },
      take: 10,
    });

    const mostCommon = commonAchievements.map(ca => {
      const achievement = this.achievements.get(ca.achievementId);
      return {
        id: ca.achievementId,
        name: achievement?.name || 'Unknown',
        count: ca._count,
      };
    });

    return {
      totalAchievements,
      totalUnlocked,
      byCategory,
      mostCommon,
    };
  }
}