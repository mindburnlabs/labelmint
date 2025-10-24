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
          role: 'CLIENT', // Default role for client bot
        });
        logger.info(`Auto-registered new user: ${telegramId}`);
      } catch (error) {
        logger.error('Failed to create user:', error);
        await ctx.reply('❌ An error occurred. Please try again later.');
        return;
      }
    }

    // Store user in context
    ctx.user = {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      role: user.role,
      isVerified: user.isVerified || false,
    };

    // Check if user is allowed (only clients and admins)
    if (user.role === 'WORKER') {
      await ctx.reply(
        '⚠️ This bot is for clients only.\n' +
        'Workers should use @LabelMintWorkerBot\n' +
        '📱 Tap /earn to start labeling!'
      );
      return;
    }

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