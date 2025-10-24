import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { MetricsService } from './metrics';
import { Request } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  blockDurationMs?: number;
  headers?: boolean;
  customResponse?: (req: Request, res: any, options: any) => void;
}

interface RateLimitInfo {
  totalHits: number;
  remainingHits: number;
  resetTime: Date;
  retryAfter: number;
  isBlocked: boolean;
  blockExpiresAt?: Date;
}

class RateLimiter {
  private redis: Redis;
  private logger: Logger;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
    this.logger = new Logger('RateLimiter');
  }

  // Advanced rate limiting with sliding window
  async checkSlidingWindow(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const window = config.windowMs;
    const maxRequests = config.maxRequests;

    try {
      // Use Redis sorted sets for sliding window
      const pipeline = this.redis.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, 0, now - window);

      // Count current requests in window
      pipeline.zcard(key);

      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiration
      pipeline.expire(key, Math.ceil(window / 1000));

      const results = await pipeline.exec();
      const totalHits = parseInt(results[1][1] as string) || 0;

      const isBlocked = totalHits >= maxRequests;
      const remainingHits = Math.max(0, maxRequests - totalHits);
      const resetTime = new Date(now + window);

      // Block temporarily if over limit
      let blockExpiresAt: Date | undefined;
      if (isBlocked && config.blockDurationMs) {
        const blockKey = `${key}:blocked`;
        await this.redis.setex(
          blockKey,
          Math.ceil(config.blockDurationMs / 1000),
          '1'
        );
        blockExpiresAt = new Date(now + config.blockDurationMs);
      }

      return {
        totalHits,
        remainingHits,
        resetTime,
        retryAfter: Math.ceil((window - (now % window)) / 1000),
        isBlocked,
        blockExpiresAt
      };
    } catch (error) {
      this.logger.error('Rate limiter error', error);
      // Default to allowing request on error
      return {
        totalHits: 0,
        remainingHits: maxRequests,
        resetTime: new Date(Date.now() + window),
        retryAfter: Math.ceil(window / 1000),
        isBlocked: false
      };
    }
  }

  // Token bucket rate limiting for burst handling
  async checkTokenBucket(
    key: string,
    config: {
      capacity: number;
      refillRate: number;
    }
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const bucketKey = `bucket:${key}`;
    const script = `
      local bucketKey = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local refillInterval = 1000

      -- Get current bucket state
      local bucket = redis.call('HMGET', bucketKey, 'tokens', 'lastRefill')
      local tokens = tonumber(bucket[1]) or capacity
      local lastRefill = tonumber(bucket[2]) or 0

      -- Calculate time passed and tokens to add
      local timePassed = math.max(0, now - lastRefill)
      local tokensToAdd = math.floor((timePassed / refillInterval) * refillRate)
      tokens = math.min(capacity, tokens + tokensToAdd)

      -- Check if request can be processed
      local canProcess = tokens >= 1
      if canProcess then
        tokens = tokens - 1
      end

      -- Update bucket state
      redis.call('HMSET', bucketKey, 'tokens', tokens, 'lastRefill', now)
      redis.call('EXPIRE', bucketKey, math.ceil(capacity / refillRate))

      return {canProcess, tokens}
    `;

    try {
      const result = await this.redis.eval(
        script,
        1,
        bucketKey,
        config.capacity,
        config.refillRate,
        now
      );

      const [canProcess, tokens] = result;

      return {
        totalHits: config.capacity - tokens,
        remainingHits: tokens,
        resetTime: new Date(now + 1000),
        retryAfter: Math.ceil(1000 / (config.refillRate * 1000)),
        isBlocked: !canProcess
      };
    } catch (error) {
      this.logger.error('Token bucket error', error);
      return {
        totalHits: 0,
        remainingHits: config.capacity,
        resetTime: new Date(now + 1000),
        retryAfter: 1,
        isBlocked: false
      };
    }
  }

  // Distributed rate limiting across multiple instances
  async checkDistributed(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitInfo> {
    const instanceId = process.env.INSTANCE_ID || `node-${process.pid}`;
    const distributedKey = `dist:${key}:${instanceId}`;
    const leaderKey = `dist:${key}:leader`;

    try {
      // Check if this instance is the leader for this key
      const isLeader = await this.checkLeadership(leaderKey, instanceId);

      if (isLeader) {
        // Leader aggregates counts from all instances
        return this.aggregateCounts(key, config);
      } else {
        // Non-leader uses local rate limiting
        return this.checkSlidingWindow(distributedKey, config);
      }
    } catch (error) {
      this.logger.error('Distributed rate limiting error', error);
      return this.checkSlidingWindow(distributedKey, config);
    }
  }

  // Adaptive rate limiting based on load
  async checkAdaptive(
    key: string,
    baseConfig: RateLimitConfig,
    currentLoad: number // 0-1 representing system load
  ): Promise<RateLimitInfo> {
    // Adjust rate limits based on system load
    const loadFactor = Math.max(0.1, 1 - currentLoad);
    const adjustedMaxRequests = Math.floor(baseConfig.maxRequests * loadFactor);

    const adjustedConfig = {
      ...baseConfig,
      maxRequests: adjustedMaxRequests
    };

    // Log adjustment for monitoring
    this.logger.debug('Adaptive rate limiting', {
      key,
      originalMax: baseConfig.maxRequests,
      adjustedMax: adjustedMaxRequests,
      loadFactor,
      currentLoad
    });

    return this.checkSlidingWindow(key, adjustedConfig);
  }

  // User-based rate limiting with tiers
  async checkUserTier(
    userId: string,
    config: RateLimitConfig
  ): Promise<RateLimitInfo> {
    // Get user tier from database or cache
    const userTier = await this.getUserTier(userId);

    const tierLimits = {
      free: { multiplier: 1, burst: 1.5 },
      basic: { multiplier: 5, burst: 2 },
      premium: { multiplier: 20, burst: 3 },
      enterprise: { multiplier: 100, burst: 5 }
    };

    const tierLimit = tierLimits[userTier] || tierLimits.free;

    const tieredConfig = {
      ...config,
      maxRequests: Math.floor(config.maxRequests * tierLimit.multiplier),
      blockDurationMs: config.blockDurationMs || tierLimit.burst * 10000
    };

    const tierKey = `tier:${userTier}:${userId}`;
    return this.checkSlidingWindow(tierKey, tieredConfig);
  }

  // Geographic rate limiting
  async checkGeoBased(
    key: string,
    country: string,
    config: RateLimitConfig
  ): Promise<RateLimitInfo> {
    // Different limits per country
    const geoLimits = {
      // High-risk countries
      CN: { multiplier: 0.5 },
      RU: { multiplier: 0.5 },
      // Standard countries
      US: { multiplier: 1 },
      GB: { multiplier: 1 },
      DE: { multiplier: 1 },
      FR: { multiplier: 1 },
      // Lower limits for specific regions
      EU: { multiplier: 0.8 },
      AP: { multiplier: 0.9 }
    };

    const geoLimit = geoLimits[country] || { multiplier: 1 };

    const geoConfig = {
      ...config,
      maxRequests: Math.floor(config.maxRequests * geoLimit.multiplier)
    };

    const geoKey = `geo:${country}:${key}`;

    // Log geo limiting
    this.logger.debug('Geo-based rate limiting', {
      key,
      country,
      multiplier: geoLimit.multiplier,
      adjustedMax: geoConfig.maxRequests
    });

    return this.checkSlidingWindow(geoKey, geoConfig);
  }

  // Check if user is blocked from rate limiting
  async isBlocked(key: string): Promise<boolean> {
    const blockKey = `${key}:blocked`;
    const blocked = await this.redis.get(blockKey);
    return blocked === '1';
  }

  // Clear rate limit block
  async clearBlock(key: string): Promise<void> {
    const blockKey = `${key}:blocked`;
    await this.redis.del(blockKey);
    this.logger.info('Rate limit block cleared', { key });
  }

  // Get rate limit statistics
  async getStats(key: string, hours: number = 24): Promise<any> {
    const statsKey = `stats:${key}`;
    const pipeline = this.redis.pipeline();

    // Get hourly stats for the specified period
    for (let i = 0; i < hours; i++) {
      pipeline.hget(statsKey, `hour-${i}`);
    }

    const results = await pipeline.exec();

    const stats = {
      hourly: results.map(([, value], index) => ({
        hour: index,
        requests: parseInt(value || '0')
      })),
      total: results.reduce((sum, [, value]) => sum + parseInt(value || '0'), 0)
    };

    return stats;
  }

  // Private helper methods
  private async checkLeadership(leaderKey: string, instanceId: string): Promise<boolean> {
    const script = `
      local leaderKey = KEYS[1]
      local instanceId = ARGV[1]
      local ttl = 10

      -- Try to acquire leadership
      local result = redis.call('SET', leaderKey .. ':lock', instanceId, 'NX', 'EX', ttl)

      if result then
        redis.call('SET', leaderKey, instanceId, 'EX', ttl)
        return 1
      else
        return redis.call('GET', leaderKey) == instanceId
      end
    `;

    try {
      const isLeader = await this.redis.eval(script, 1, leaderKey, instanceId);
      return isLeader === 1;
    } catch (error) {
      this.logger.error('Leadership check error', error);
      return false;
    }
  }

  private async aggregateCounts(key: string, config: RateLimitConfig): Promise<RateLimitInfo> {
    const pattern = `${key}:*`;

    // Get all instance keys
    const keys = await this.redis.keys(pattern);

    // Sum counts from all instances
    const pipeline = this.redis.pipeline();
    keys.forEach(k => pipeline.zcard(k));

    const results = await pipeline.exec();
    const totalHits = results.reduce((sum, [, count]) => sum + parseInt(count || '0'), 0);

    // Reset all counters
    const resetPipeline = this.redis.pipeline();
    keys.forEach(k => resetPipeline.del(k));
    await resetPipeline.exec();

    return {
      totalHits,
      remainingHits: Math.max(0, config.maxRequests - totalHits),
      resetTime: new Date(Date.now() + config.windowMs),
      retryAfter: Math.ceil(config.windowMs / 1000),
      isBlocked: totalHits >= config.maxRequests
    };
  }

  private async getUserTier(userId: string): Promise<string> {
    // This would typically query your database
    // For now, we'll simulate it
    const userTierCache = await this.redis.hget('user:tiers', userId);
    if (userTierCache) {
      return userTierCache;
    }

    // Simulate tier lookup
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      a = a & a;
      a = ((a >> 2) & 0x3fffffff) + a;
      a = a & a;
      a = ((a >> 4) & 0x0fffffff) + a;
      a = a & a;
      a = ((a >> 6) & 0x03fffffff) + a;
      a = a & a;
      return a;
    }, 5381);

    const tiers = ['free', 'basic', 'premium', 'enterprise'];
    const tierIndex = Math.abs(hash) % tiers.length;
    const tier = tiers[tierIndex];

    // Cache the tier
    await this.redis.hset('user:tiers', userId, tier);
    await this.redis.expire('user:tiers', 300); // 5 minutes

    return tier;
  }
}

export default RateLimiter;
export { RateLimitConfig, RateLimitInfo };