import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { CacheConfig } from '@types/index';
import config from '@config/index';
import { logger } from '@utils/logger';

interface CacheEntry {
  data: any;
  headers: Record<string, string>;
  statusCode: number;
  createdAt: number;
  ttl: number;
}

interface CacheMiddleware {
  (cacheConfig: Partial<CacheConfig>): (req: Request, res: Response, next: NextFunction) => void;
}

class CacheMiddleware {
  private redis: any;
  private enabled: boolean;
  private defaultTTL: number;
  private prefix: string;

  constructor() {
    this.enabled = config.cache.enabled;
    this.defaultTTL = config.cache.ttl;
    this.prefix = config.cache.prefix;

    if (this.enabled) {
      this.initializeRedis();
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      const Redis = require('ioredis');
      this.redis = new Redis({
        host: config.cache.redis.host,
        port: config.cache.redis.port,
        password: config.cache.redis.password,
        db: config.cache.redis.db,
        keyPrefix: config.cache.redis.keyPrefix + 'cache:',
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      });

      this.redis.on('connect', () => {
        logger.info('Redis cache connected');
      });

      this.redis.on('error', (error: Error) => {
        logger.error('Redis cache error:', error);
      });

      // Test connection
      await this.redis.ping();
      logger.info('Cache initialized with Redis');
    } catch (error) {
      logger.error('Failed to initialize Redis cache:', error);
      this.enabled = false;
    }
  }

  middleware: CacheMiddleware = (cacheConfig: Partial<CacheConfig> = {}) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Skip caching if disabled or not a GET request
      if (!this.enabled || req.method !== 'GET') {
        return next();
      }

      // Skip caching if auth headers are present (user-specific content)
      if (req.get('Authorization') || req.get('X-API-Key')) {
        return next();
      }

      // Skip caching if no-cache header is present
      if (req.get('Cache-Control') === 'no-cache') {
        return next();
      }

      const correlationId = (req as any).correlationId;
      const ttl = cacheConfig.ttl || this.defaultTTL;
      const cacheKey = this.generateCacheKey(req, cacheConfig);

      try {
        // Try to get from cache
        const cached = await this.get(cacheKey);

        if (cached) {
          logger.debug('Cache hit', { cacheKey, correlationId });

          // Set cache headers
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Key', cacheKey);
          res.set('Age', Math.floor((Date.now() - cached.createdAt) / 1000).toString());

          // Restore cached response
          res.status(cached.statusCode);

          // Restore headers
          Object.entries(cached.headers).forEach(([key, value]) => {
            res.set(key, value);
          });

          return res.json(cached.data);
        }

        logger.debug('Cache miss', { cacheKey, correlationId });

        // Override res.json to cache response
        const originalJson = res.json;
        res.json = (data: any) => {
          // Only cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const cacheEntry: CacheEntry = {
              data,
              headers: res.getHeaders() as Record<string, string>,
              statusCode: res.statusCode,
              createdAt: Date.now(),
              ttl
            };

            // Cache asynchronously (don't wait)
            this.set(cacheKey, cacheEntry, ttl).catch(error => {
              logger.error('Failed to cache response:', error);
            });
          }

          return originalJson.call(res, data);
        };

        // Set cache headers for response
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
        res.set('Cache-Control', `public, max-age=${ttl}`);

        next();

      } catch (error) {
        logger.error('Cache middleware error:', error);
        next(); // Continue without caching
      }
    };
  };

  private generateCacheKey(req: Request, cacheConfig: Partial<CacheConfig>): string {
    const parts = [
      req.method.toLowerCase(),
      req.path,
      // Include query string for GET requests
      req.url.includes('?') ? req.url.split('?')[1] : '',
      // Include user ID if authenticated
      (req as any).user?.id || 'anonymous',
      // Include API key ID if present
      (req as any).apiKey?.id || 'no-key'
    ];

    const keyString = parts.filter(Boolean).join(':');
    const hash = createHash('sha256').update(keyString).digest('hex');

    return `${this.prefix}:${hash}`;
  }

  private async get(key: string): Promise<CacheEntry | null> {
    if (!this.redis) return null;

    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      const parsed = JSON.parse(data);

      // Check if expired
      if (Date.now() - parsed.createdAt > parsed.ttl * 1000) {
        await this.delete(key);
        return null;
      }

      return parsed;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  private async set(key: string, entry: CacheEntry, ttl: number): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.setex(key, ttl, JSON.stringify(entry));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  private async delete(key: string): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  // Public methods for cache management
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.redis) return;

    try {
      const keys = await this.redis.keys(`${this.prefix}:*${pattern}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error('Cache invalidation error:', error);
    }
  }

  async invalidateUrl(url: string): Promise<void> {
    const mockReq = {
      method: 'GET',
      path: url,
      url: url,
      get: () => null
    } as Request;

    const cacheKey = this.generateCacheKey(mockReq, {});
    await this.delete(cacheKey);
    logger.debug('Invalidated cache for URL:', url);
  }

  async clear(): Promise<void> {
    if (!this.redis) return;

    try {
      const keys = await this.redis.keys(`${this.prefix}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  async getStats(): Promise<{
    enabled: boolean;
    redis: boolean;
    totalKeys: number;
    memoryUsage?: string;
  }> {
    const stats = {
      enabled: this.enabled,
      redis: !!this.redis,
      totalKeys: 0
    };

    if (this.redis) {
      try {
        const keys = await this.redis.keys(`${this.prefix}:*`);
        stats.totalKeys = keys.length;

        const info = await this.redis.info('memory');
        const match = info.match(/used_memory_human:(.+)/);
        if (match) {
          (stats as any).memoryUsage = match[1].trim();
        }
      } catch (error) {
        logger.error('Failed to get cache stats:', error);
      }
    }

    return stats;
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      logger.info('Cache connection closed');
    }
  }
}

// Export singleton instance
const cacheMiddlewareInstance = new CacheMiddleware();
export const cacheMiddleware = cacheMiddlewareInstance.middleware;
export const invalidatePattern = cacheMiddlewareInstance.invalidatePattern.bind(cacheMiddlewareInstance);
export const invalidateUrl = cacheMiddlewareInstance.invalidateUrl.bind(cacheMiddlewareInstance);
export const clearCache = cacheMiddlewareInstance.clear.bind(cacheMiddlewareInstance);
export const getCacheStats = cacheMiddlewareInstance.getStats.bind(cacheMiddlewareInstance);
export const cleanupCache = cacheMiddlewareInstance.cleanup.bind(cacheMiddlewareInstance);