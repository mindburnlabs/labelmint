import { Context, MiddlewareFn } from 'grammy';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { apiService } from '../services/apiService.js';

export interface AuthContext extends Context {
  user?: {
    id: string;
    telegramId: number;
    username?: string;
    role: 'CLIENT' | 'WORKER' | 'ADMIN';
    isVerified: boolean;
    trustScore: number;
    earnings: number;
    completedTasks: number;
    accuracy: number;
    streak: number;
  };
}

export const authMiddleware: MiddlewareFn<AuthContext> = async (ctx, next) => {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      logger.warn('No telegram ID in context');
      return;
    }

    // Check if user exists in database
    let user;
    try {
      user = await apiService.getUserByTelegramId(telegramId);
    } catch (error) {
      logger.error('Failed to fetch user:', error);
    }

    // Auto-register user if not exists
    if (!user) {
      try {
        user = await apiService.createUser({
          telegramId,
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name,
          role: 'WORKER', // Default role for worker bot
        });
        logger.info(`Auto-registered new worker: ${telegramId}`);
      } catch (error) {
        logger.error('Failed to create user:', error);
        await ctx.reply('❌ An error occurred. Please try again later.');
        return;
      }
    }

    // Check if user is allowed (only workers and admins)
    if (user.role === 'CLIENT') {
      await ctx.reply(
        '⚠️ This bot is for workers only.\n' +
        'Clients should use @LabelMintBot\n' +
        '📱 Tap /start to manage your projects!'
      );
      return;
    }

    // Get worker stats
    let stats;
    try {
      stats = await apiService.getWorkerStats(user.id);
    } catch (error) {
      logger.error('Failed to fetch worker stats:', error);
      stats = {
        earnings: 0,
        completedTasks: 0,
        accuracy: 0,
        streak: 0,
        trustScore: 0.8,
      };
    }

    // Store user in context
    ctx.user = {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      role: user.role,
      isVerified: user.isVerified || false,
      trustScore: stats.trustScore,
      earnings: stats.earnings,
      completedTasks: stats.completedTasks,
      accuracy: stats.accuracy,
      streak: stats.streak,
    };

    // Check if admin
    if (config.ADMIN_TELEGRAM_IDS.includes(telegramId) && user.role !== 'ADMIN') {
      try {
        await apiService.updateUserRole(user.id, 'ADMIN');
        ctx.user.role = 'ADMIN';
        logger.info(`Updated ${telegramId} to ADMIN role`);
      } catch (error) {
        logger.error('Failed to update admin role:', error);
      }
    }

    await next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    await ctx.reply('❌ Authentication error. Please try again.');
  }
};