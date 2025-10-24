import { Context, MiddlewareFn } from 'grammy';
import Redis from 'ioredis';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

const redis = new Redis(config.REDIS_URL);

export const rateLimitMiddleware: MiddlewareFn = async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    return next();
  }

  const key = `rate_limit:${telegramId}`;
  const window = 60; // 60 seconds
  const limit = config.RATE_LIMIT_REQUESTS_PER_MINUTE;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, window);
    }

    const remaining = Math.max(0, limit - current);
    const resetTime = await redis.ttl(key);

    // Add rate limit info to context
    ctx.rateLimit = {
      remaining,
      limit,
      resetTime,
    };

    if (current > limit) {
      const waitTime = resetTime;
      await ctx.reply(
        `⚠️ Rate limit exceeded!\n` +
        `Please wait ${waitTime} seconds before trying again.\n\n` +
        `Limit: ${limit} requests per minute`
      );
      return;
    }

    await next();
  } catch (error) {
    logger.error('Rate limit middleware error:', error);
    // Continue without rate limiting if Redis fails
    await next();
  }
};

declare global {
  namespace grammy {
    interface Context {
      rateLimit?: {
        remaining: number;
        limit: number;
        resetTime: number;
      };
    }
  }
}