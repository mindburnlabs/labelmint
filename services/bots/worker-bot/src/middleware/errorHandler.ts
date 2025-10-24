import { Context, MiddlewareFn } from 'grammy';
import { logger } from '../utils/logger.js';

export const errorHandler: MiddlewareFn = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    logger.error(`Error for user ${ctx.from?.id}:`, error);

    // Don't send error message for 403 errors (banned users)
    if (error && typeof error === 'object' && 'code' in error && error.code === 403) {
      return;
    }

    // Send user-friendly error message
    try {
      await ctx.reply(
        '❌ Oops! Something went wrong.\n' +
        'Please try again or contact support if the problem persists.'
      );
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
};