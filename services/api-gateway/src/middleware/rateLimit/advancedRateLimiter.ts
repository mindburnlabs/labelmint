import Redis from 'ioredis';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

export interface AdvancedRateLimitConfig {
  // Base rate limiting
  windowMs: number;
  maxRequests: number;

  // Sliding window options
  slidingWindow?: boolean;
  windowGranularityMs?: number;

  // Distributed coordination
  distributed?: boolean;
  redisKeyPrefix?: string;

  // User tier-based limits
  userTiers?: {
    anonymous: { max: number; windowMs: number };
    authenticated: { max: number; windowMs: number };
    premium: { max: number; windowMs: number };
    enterprise: { max: number; windowMs: number };
    admin: { max: number; windowMs: number };
  };

  // Endpoint-specific limits
  endpointLimits?: Map<string, { max: number; windowMs: number }>;

  // Security features
  enableBurstProtection?: boolean;
  burstLimit?: number;
  enableProgressiveDelays?: boolean;
  enableBlocklisting?: boolean;
  blocklistDuration?: number;

  // Advanced features
  enableAdaptiveLimiting?: boolean;
  adaptiveThreshold?: number;
  enableGeolocationLimiting?: boolean;
  geoLimits?: Map<string, { max: number; windowMs: number }>;

  // Monitoring
  enableMetrics?: boolean;
  enableAuditLogging?: boolean;
}

export interface RateLimitState {
  requests: number;
  windowStart: number;
  lastRequest: number;
  blockedUntil?: number;
  violations: number;
  userTier?: string;
  geoLocation?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  blocked?: boolean;
  blockDuration?: number;
  userTier?: string;
  rateLimitKey: string;
}

export class AdvancedRateLimiter {
  private redis: Redis | null = null;
  private localCache: Map<string, RateLimitState> = new Map();
  private config: AdvancedRateLimitConfig;

  constructor(config: AdvancedRateLimitConfig) {
    this.config = {
      windowMs: 60000,
      maxRequests: 100,
      slidingWindow: true,
      windowGranularityMs: 1000,
      distributed: true,
      redisKeyPrefix: 'rate_limit:',
      enableBurstProtection: true,
      burstLimit: 10,
      enableProgressiveDelays: true,
      enableBlocklisting: true,
      blocklistDuration: 300000, // 5 minutes
      enableAdaptiveLimiting: true,
      adaptiveThreshold: 0.8,
      enableMetrics: true,
      enableAuditLogging: true,
      userTiers: {
        anonymous: { max: 100, windowMs: 60000 },
        authenticated: { max: 1000, windowMs: 60000 },
        premium: { max: 5000, windowMs: 60000 },
        enterprise: { max: 10000, windowMs: 60000 },
        admin: { max: 20000, windowMs: 60000 }
      },
      ...config
    };

    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    if (!this.config.distributed) return;

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true
      });

      this.redis.on('error', (error) => {
        logger.error('Redis connection error in rate limiter:', error);
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected for rate limiting');
      });

      await this.redis.connect();
    } catch (error) {
      logger.warn('Failed to initialize Redis for rate limiting, falling back to local cache:', error);
      this.redis = null;
    }
  }

  /**
   * Generate rate limit key for request
   */
  private generateRateLimitKey(req: Request, identifier: string): string {
    const elements = [];

    // User identification
    if (req.user?.id) {
      elements.push(`user:${req.user.id}`);
    } else if (req.apiKey?.id) {
      elements.push(`apikey:${req.apiKey.id}`);
    } else {
      elements.push(`ip:${req.ip}`);
    }

    // User tier
    const userTier = this.getUserTier(req);
    elements.push(`tier:${userTier}`);

    // Endpoint
    if (identifier !== 'global') {
      elements.push(`endpoint:${identifier}`);
    }

    // Geolocation (if enabled)
    if (this.config.enableGeolocationLimiting) {
      const geo = this.getGeoLocation(req);
      if (geo) {
        elements.push(`geo:${geo}`);
      }
    }

    // Create hash for consistent key
    const keyString = elements.join(':');
    return this.config.redisKeyPrefix + createHash('sha256').update(keyString).digest('hex').substring(0, 16);
  }

  /**
   * Determine user tier from request
   */
  private getUserTier(req: Request): string {
    if (req.user?.role === 'admin') return 'admin';
    if (req.user?.role === 'enterprise' || req.apiKey?.permissions?.includes('enterprise')) return 'enterprise';
    if (req.user?.role === 'premium' || req.apiKey?.permissions?.includes('premium')) return 'premium';
    if (req.user?.id || req.apiKey?.id) return 'authenticated';
    return 'anonymous';
  }

  /**
   * Get geolocation from request (simplified)
   */
  private getGeoLocation(req: Request): string | null {
    // In production, use proper geolocation service
    const country = req.headers['cf-ipcountry'] as string || req.headers['x-country'] as string;
    return country || null;
  }

  /**
   * Check rate limit for request
   */
  async checkRateLimit(req: Request, identifier: string = 'global'): Promise<RateLimitResult> {
    const key = this.generateRateLimitKey(req, identifier);
    const userTier = this.getUserTier(req);
    const geoLocation = this.getGeoLocation(req);

    try {
      // Check if user is blocklisted
      if (this.config.enableBlocklisting) {
        const blockResult = await this.checkBlocklist(req, key);
        if (blockResult.blocked) {
          return blockResult;
        }
      }

      // Get rate limit state
      const state = await this.getRateLimitState(key);

      // Apply tier-based limits
      const tierLimits = this.config.userTiers![userTier];
      let maxRequests = tierLimits.max;
      let windowMs = tierLimits.windowMs;

      // Apply endpoint-specific limits if more restrictive
      const endpointLimit = this.config.endpointLimits?.get(identifier);
      if (endpointLimit) {
        if (endpointLimit.max < maxRequests) {
          maxRequests = endpointLimit.max;
        }
        if (endpointLimit.windowMs < windowMs) {
          windowMs = endpointLimit.windowMs;
        }
      }

      // Apply adaptive limiting
      if (this.config.enableAdaptiveLimiting) {
        const adaptiveLimit = await this.calculateAdaptiveLimit(key, maxRequests);
        maxRequests = adaptiveLimit;
      }

      // Check sliding window
      const now = Date.now();
      const windowStart = this.config.slidingWindow ?
        now - this.config.windowGranularityMs! * Math.ceil(windowMs / this.config.windowGranularityMs!) :
        now - windowMs;

      // Clean old requests from sliding window
      this.cleanSlidingWindow(state, windowStart);

      // Check burst protection
      if (this.config.enableBurstProtection && this.checkBurstViolation(state, now)) {
        return this.handleBurstViolation(req, key, userTier);
      }

      // Check rate limit
      const allowed = state.requests < maxRequests;
      const remaining = Math.max(0, maxRequests - state.requests);
      const resetTime = state.windowStart + windowMs;

      if (allowed) {
        // Update state
        state.requests++;
        state.lastRequest = now;
        state.userTier = userTier;
        state.geoLocation = geoLocation;

        await this.setRateLimitState(key, state);
      } else {
        // Handle violation
        await this.handleViolation(req, key, state);
      }

      const result: RateLimitResult = {
        allowed,
        remaining,
        resetTime,
        userTier,
        rateLimitKey: key
      };

      if (!allowed) {
        result.retryAfter = Math.ceil((resetTime - now) / 1000);
      }

      // Log metrics
      if (this.config.enableMetrics) {
        this.logMetrics(req, result, identifier);
      }

      return result;

    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: 1,
        resetTime: Date.now() + this.config.windowMs,
        userTier,
        rateLimitKey: key
      };
    }
  }

  /**
   * Get rate limit state from Redis or local cache
   */
  private async getRateLimitState(key: string): Promise<RateLimitState> {
    if (this.redis) {
      try {
        const data = await this.redis.get(key);
        if (data) {
          return JSON.parse(data) as RateLimitState;
        }
      } catch (error) {
        logger.warn('Failed to get rate limit state from Redis:', error);
      }
    }

    return this.localCache.get(key) || {
      requests: 0,
      windowStart: Date.now(),
      lastRequest: 0,
      violations: 0
    };
  }

  /**
   * Set rate limit state in Redis and local cache
   */
  private async setRateLimitState(key: string, state: RateLimitState): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.setex(key, Math.ceil(this.config.windowMs / 1000), JSON.stringify(state));
      } catch (error) {
        logger.warn('Failed to set rate limit state in Redis:', error);
      }
    }

    this.localCache.set(key, state);

    // Clean local cache periodically
    if (this.localCache.size > 10000) {
      this.cleanLocalCache();
    }
  }

  /**
   * Clean sliding window by removing old requests
   */
  private cleanSlidingWindow(state: RateLimitState, windowStart: number): void {
    if (!this.config.slidingWindow) {
      // Reset for fixed window
      if (Date.now() - state.windowStart >= this.config.windowMs) {
        state.requests = 0;
        state.windowStart = Date.now();
      }
      return;
    }

    // For sliding window, we'd need to track individual request timestamps
    // Simplified implementation here
    if (Date.now() - state.windowStart >= this.config.windowMs) {
      state.requests = 0;
      state.windowStart = Date.now();
    }
  }

  /**
   * Check burst protection
   */
  private checkBurstViolation(state: RateLimitState, now: number): boolean {
    const timeSinceLastRequest = now - state.lastRequest;
    return timeSinceLastRequest < 100 && state.requests >= (this.config.burstLimit || 10);
  }

  /**
   * Handle burst violation
   */
  private handleBurstViolation(req: Request, key: string, userTier: string): RateLimitResult {
    const delay = Math.min(5000, 100 * Math.pow(2, Math.floor(Math.random() * 3))); // 100ms-5s

    if (this.config.enableAuditLogging) {
      logger.warn('Burst protection triggered', {
        ip: req.ip,
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id,
        userTier,
        key,
        delay
      });
    }

    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + delay,
      retryAfter: Math.ceil(delay / 1000),
      blocked: true,
      blockDuration: delay,
      userTier,
      rateLimitKey: key
    };
  }

  /**
   * Handle rate limit violation
   */
  private async handleViolation(req: Request, key: string, state: RateLimitState): Promise<void> {
    state.violations++;

    // Progressive blocking for repeated violations
    if (state.violations >= 3 && this.config.enableBlocklisting) {
      const blockDuration = Math.min(
        this.config.blocklistDuration! * Math.pow(2, state.violations - 3),
        3600000 // Max 1 hour
      );

      await this.addToBlocklist(req, key, blockDuration);
    }

    await this.setRateLimitState(key, state);
  }

  /**
   * Check if user is blocklisted
   */
  private async checkBlocklist(req: Request, key: string): Promise<RateLimitResult> {
    const blocklistKey = `${this.config.redisKeyPrefix}blocklist:${key}`;

    if (this.redis) {
      try {
        const blockedUntil = await this.redis.get(blocklistKey);
        if (blockedUntil) {
          const unblockTime = parseInt(blockedUntil);
          if (Date.now() < unblockTime) {
            return {
              allowed: false,
              remaining: 0,
              resetTime: unblockTime,
              retryAfter: Math.ceil((unblockTime - Date.now()) / 1000),
              blocked: true,
              blockDuration: unblockTime - Date.now(),
              userTier: this.getUserTier(req),
              rateLimitKey: key
            };
          } else {
            // Remove expired blocklist entry
            await this.redis.del(blocklistKey);
          }
        }
      } catch (error) {
        logger.warn('Failed to check blocklist:', error);
      }
    }

    return { allowed: true, remaining: 1, resetTime: Date.now(), userTier: this.getUserTier(req), rateLimitKey: key };
  }

  /**
   * Add user to blocklist
   */
  private async addToBlocklist(req: Request, key: string, duration: number): Promise<void> {
    const blocklistKey = `${this.config.redisKeyPrefix}blocklist:${key}`;
    const blockedUntil = Date.now() + duration;

    if (this.redis) {
      try {
        await this.redis.setex(blocklistKey, Math.ceil(duration / 1000), blockedUntil.toString());
      } catch (error) {
        logger.warn('Failed to add to blocklist:', error);
      }
    }

    if (this.config.enableAuditLogging) {
      logger.warn('User added to blocklist', {
        ip: req.ip,
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id,
        key,
        duration,
        blockedUntil
      });
    }
  }

  /**
   * Calculate adaptive limit based on system load
   */
  private async calculateAdaptiveLimit(key: string, baseLimit: number): Promise<number> {
    // Simplified adaptive limiting based on recent violations
    const state = await this.getRateLimitState(key);
    const violationRatio = state.violations / Math.max(1, state.requests);

    if (violationRatio > this.config.adaptiveThreshold!) {
      return Math.max(baseLimit * 0.5, 1); // Reduce limit by 50%
    }

    return baseLimit;
  }

  /**
   * Clean local cache
   */
  private cleanLocalCache(): void {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, state] of this.localCache.entries()) {
      if (now - state.lastRequest > this.config.windowMs * 2) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.localCache.delete(key));
  }

  /**
   * Log metrics
   */
  private logMetrics(req: Request, result: RateLimitResult, identifier: string): void {
    const metrics = {
      timestamp: Date.now(),
      ip: req.ip,
      userId: req.user?.id,
      apiKeyId: req.apiKey?.id,
      userTier: result.userTier,
      endpoint: identifier,
      allowed: result.allowed,
      remaining: result.remaining,
      blocked: result.blocked,
      rateLimitKey: result.rateLimitKey
    };

    // In production, send to metrics system (Prometheus, etc.)
    logger.debug('Rate limit metrics', metrics);
  }

  /**
   * Express middleware
   */
  middleware(identifier: string = 'global') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const result = await this.checkRateLimit(req, identifier);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': this.config.userTiers?.[result.userTier!]?.max.toString() || this.config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
        'X-RateLimit-Policy': `burst;w=${Math.ceil(this.config.windowMs / 1000)}`
      });

      if (!result.allowed) {
        const status = result.blocked ? 429 : 429;
        const message = result.blocked ?
          'Too many requests. Temporarily blocked due to suspicious activity.' :
          'Rate limit exceeded. Please try again later.';

        res.status(status).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter: result.retryAfter,
            userTier: result.userTier
          }
        });
        return;
      }

      next();
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
    }
    this.localCache.clear();
  }
}

export default AdvancedRateLimiter;