import rateLimit from 'express-rate-limit';
import { RateLimitConfig, RateLimitOverride } from '@types/index';
import config from '@config/index';
import { logger } from '@utils/logger';

// Redis client for distributed rate limiting (if Redis is available)
let RedisStore: any;
let redis: any;

if (config.cache.enabled) {
  try {
    const Redis = require('rate-limit-redis');
    const IoRedis = require('ioredis');

    redis = new IoRedis({
      host: config.cache.redis.host,
      port: config.cache.redis.port,
      password: config.cache.redis.password,
      db: config.cache.redis.db,
      keyPrefix: config.cache.redis.keyPrefix + 'rate-limit:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    RedisStore = Redis;
  } catch (error) {
    logger.warn('Redis rate limiting not available, using memory store:', error);
  }
}

class RateLimitMiddleware {
  private globalLimiter: any;

  constructor() {
    // Global rate limiter
    this.globalLimiter = this.createLimiter(config.rateLimit, 'global');
  }

  createLimiter(rateLimitConfig: Partial<RateLimitConfig>, identifier: string = 'default') {
    const options: any = {
      windowMs: rateLimitConfig.windowMs || config.rateLimit.windowMs,
      max: rateLimitConfig.max || config.rateLimit.max,
      message: rateLimitConfig.message || config.rateLimit.message,
      standardHeaders: rateLimitConfig.standardHeaders ?? config.rateLimit.standardHeaders,
      legacyHeaders: rateLimitConfig.legacyHeaders ?? config.rateLimit.legacyHeaders,
      keyGenerator: (req: any) => {
        // Use IP, user ID, or API key for rate limiting
        if (req.user?.id) {
          return `user:${req.user.id}:${identifier}`;
        }
        if (req.apiKey?.id) {
          return `apikey:${req.apiKey.id}:${identifier}`;
        }
        return `ip:${req.ip}:${identifier}`;
      },
      handler: (req: any, res: any) => {
        const correlationId = req.correlationId;

        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userId: req.user?.id,
          apiKeyId: req.apiKey?.id,
          path: req.path,
          method: req.method,
          correlationId,
          identifier
        });

        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter: Math.ceil(options.windowMs / 1000),
            correlationId
          }
        });
      },
      onLimitReached: (req: any, res: any, options: any) => {
        logger.info('Rate limit reached', {
          ip: req.ip,
          userId: req.user?.id,
          apiKeyId: req.apiKey?.id,
          path: req.path,
          method: req.method,
          identifier
        });
      }
    };

    // Use Redis store if available
    if (RedisStore && redis) {
      try {
        options.store = new RedisStore({
          redis: redis,
          prefix: `rl:${identifier}:`,
          resetExpiryOnChange: true,
          expiry: options.windowMs
        });
        logger.debug(`Redis rate limiter created for ${identifier}`);
      } catch (error) {
        logger.warn(`Failed to create Redis rate limiter for ${identifier}, using memory store:`, error);
      }
    } else {
      logger.debug(`Memory rate limiter created for ${identifier}`);
    }

    return rateLimit(options);
  }

  // Global rate limiter
  global = this.globalLimiter;

  // Service-specific rate limiter
  service = (config?: RateLimitOverride) => {
    if (!config) return this.global;
    return this.createLimiter(config, 'service');
  };

  // Endpoint-specific rate limiter
  endpoint = (path: string, config?: RateLimitOverride) => {
    const identifier = `endpoint:${path}`;
    return this.createLimiter(config || {}, identifier);
  };

  // User-specific rate limiter
  user = (config?: RateLimitOverride) => {
    const limiter = this.createLimiter(config || {}, 'user');

    // Skip if no user is authenticated
    return (req: any, res: any, next: any) => {
      if (!req.user && !req.apiKey) {
        return next();
      }
      limiter(req, res, next);
    };
  };

  // API key specific rate limiter
  apiKey = () => {
    const limiter = this.createLimiter({}, 'apikey');

    return (req: any, res: any, next: any) => {
      if (!req.apiKey) {
        return next();
      }

      // Use API key's custom rate limit if available
      if (req.apiKey.rateLimit) {
        const customLimiter = this.createLimiter(req.apiKey.rateLimit, `apikey:${req.apiKey.id}`);
        return customLimiter(req, res, next);
      }

      limiter(req, res, next);
    };
  };

  // Adaptive rate limiter based on request method
  adaptive = (config: {
    GET?: RateLimitOverride;
    POST?: RateLimitOverride;
    PUT?: RateLimitOverride;
    DELETE?: RateLimitOverride;
    PATCH?: RateLimitOverride;
  }) => {
    return (req: any, res: any, next: any) => {
      const methodConfig = config[req.method as keyof typeof config];
      const limiter = methodConfig ?
        this.createLimiter(methodConfig, `method:${req.method}`) :
        this.global;

      limiter(req, res, next);
    };
  };

  // Create multiple rate limiters that all must pass
  strict = (configs: Array<Partial<RateLimitConfig> & { id: string }>) => {
    const limiters = configs.map(cfg => this.createLimiter(cfg, cfg.id));

    return (req: any, res: any, next: any) => {
      let index = 0;

      const runNext = () => {
        if (index >= limiters.length) {
          return next();
        }

        const limiter = limiters[index];
        limiter(req, res, () => {
          index++;
          runNext();
        });
      };

      runNext();
    };
  };
}

// Export singleton instance
const rateLimitMiddleware = new RateLimitMiddleware();
export const rateLimiter = rateLimitMiddleware.service.bind(rateLimitMiddleware);
export const globalRateLimiter = rateLimitMiddleware.global;
export const endpointRateLimiter = rateLimitMiddleware.endpoint.bind(rateLimitMiddleware);
export const userRateLimiter = rateLimitMiddleware.user.bind(rateLimitMiddleware);
export const apiKeyRateLimiter = rateLimitMiddleware.apiKey.bind(rateLimitMiddleware);
export const adaptiveRateLimiter = rateLimitMiddleware.adaptive.bind(rateLimitMiddleware);
export const strictRateLimiter = rateLimitMiddleware.strict.bind(rateLimitMiddleware);