import Redis from 'ioredis';
import { Logger } from '../utils/logger';

const logger = new Logger('RedisManager');

interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  keepAlive: number;
  connectTimeout: number;
  commandTimeout: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  avgLatency: number;
}

export class ProductionRedisManager {
  private redis: Redis;
  private redisSubscriber: Redis;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    avgLatency: number
  };

  constructor() {
    const config: CacheConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'labelmint:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000
    };

    // Primary Redis client
    this.redis = new Redis({
      ...config,
      retryDelayOnFailover: config.retryDelayOnFailover,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      lazyConnect: config.lazyConnect,
      keepAlive: config.keepAlive,
      connectTimeout: config.connectTimeout,
      commandTimeout: config.commandTimeout,
      reconnectOnError: true,
      maxRetriesPerRequest: 10,
      family: 4, // IPv4
      enableOfflineQueue: false,
      enableReadyCheck: true
    });

    // Separate Redis client for pub/sub
    this.redisSubscriber = new Redis({
      ...config,
      retryDelayOnFailover: config.retryDelayOnFailover,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      lazyConnect: config.lazyConnect,
      keepAlive: config.keepAlive,
      connectTimeout: config.connectTimeout,
      commandTimeout: config.commandTimeout
    });

    this.setupEventHandlers();
    logger.info('Redis manager initialized', config);
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    // Connection events
    this.redis.on('connect', () => {
      logger.info('Redis connected');
    });

    this.redis.on('ready', () => {
      logger.info('Redis ready');
    });

    this.redis.on('error', (err) => {
      this.metrics.errors++;
      logger.error('Redis error', err);
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    // Subscriber events
    this.redisSubscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
    });

    this.redisSubscriber.on('message', (channel, message) => {
      this.handleSubscriberMessage(channel, message);
    });
  }

  /**
   * Handle subscriber messages
   */
  private handleSubscriberMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);

      switch (channel) {
        case 'cache:invalidate':
          this.handleCacheInvalidation(data);
          break;
        case 'websocket:broadcast':
          this.handleWebSocketBroadcast(data);
          break;
        default:
          logger.warn('Unknown Redis subscriber channel', { channel });
      }
    } catch (error) {
      logger.error('Error handling Redis message', error);
    }
  }

  /**
   * Handle cache invalidation
   */
  private handleCacheInvalidation(data: any): void {
    const patterns = Array.isArray(data.patterns) ? data.patterns : [data.pattern];

    for (const pattern of patterns) {
      this.invalidatePattern(pattern).catch(error => {
        logger.error('Failed to invalidate cache pattern', { pattern, error });
      });
    }
  }

  /**
   * Handle WebSocket broadcast via Redis
   */
  private handleWebSocketBroadcast(data: any): void {
    // This would be integrated with WebSocket service
    const wsService = (global as any).wsService;
    if (wsService) {
      wsService.broadcastUpdate(data.type, data.payload, data.room);
    }
  }

  /**
   * Get value from cache with automatic latency tracking
   */
  async get(key: string): Promise<any | null> {
    const start = Date.now();

    try {
      const value = await this.redis.get(key);
      const latency = Date.now() - start;

      if (value !== null) {
        this.metrics.hits++;
        this.updateAvgLatency(latency);
        logger.debug('Cache hit', { key, latency: `${latency}ms` });
        return JSON.parse(value);
      } else {
        this.metrics.misses++;
        logger.debug('Cache miss', { key, latency: `${latency}ms` });
        return null;
      }
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const start = Date.now();
    const serializedValue = JSON.stringify(value);

    try {
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }

      const latency = Date.now() - start;
      this.metrics.sets++;
      this.updateAvgLatency(latency);
      logger.debug('Cache set', { key, ttl: ttlSeconds, latency: `${latency}ms` });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache set error', { key, error });
      throw error;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<number> {
    const start = Date.now();

    try {
      const result = await this.redis.del(key);
      const latency = Date.now() - start;
      this.metrics.deletes++;
      this.updateAvgLatency(latency);
      logger.debug('Cache delete', { key, deleted: result, latency: `${latency}ms` });
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache delete error', { key, error });
      throw error;
    }
  }

  /**
   * Invalidate cache pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(`${pattern}*`);
      if (keys.length === 0) return 0;

      const result = await this.redis.del(...keys);
      logger.info('Invalidated cache pattern', { pattern, keys: keys.length });
      return result;
    } catch (error) {
      logger.error('Cache invalidate pattern error', { pattern, error });
      return 0;
    }
  }

  /**
   * Get multiple values (mget)
   */
  async mget(keys: string[]): Promise<Array<any | null>> {
    const start = Date.now();

    try {
      const values = await this.redis.mget(...keys);
      const latency = Date.now() - start;
      this.updateAvgLatency(latency);

      const result = values.map(value => {
        if (value !== null) {
          this.metrics.hits++;
          return JSON.parse(value);
        } else {
          this.metrics.misses++;
          return null;
        }
      });

      logger.debug('Cache mget', {
        keys: keys.length,
        hits: result.filter(v => v !== null).length,
        latency: `${latency}ms`
      });

      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache mget error', { keys, error });
      throw error;
    }
  }

  /**
   * Set multiple values (mset)
   */
  async mset(keyValues: Record<string, any>, ttlSeconds?: number = 3600): Promise<void> {
    const start = Date.now();

    try {
      // Prepare key-value pairs for mset
      const msetPairs: string[] = [];
      for (const [key, value] of Object.entries(keyValues)) {
        msetPairs.push(key, JSON.stringify(value));
      }

      // Set all values
      await this.redis.mset(...msetPairs);

      // Set TTL for all keys if specified
      if (ttlSeconds && ttlSeconds > 0) {
        const multi = this.redis.multi();
        for (const key of Object.keys(keyValues)) {
          multi.expire(key, ttlSeconds);
        }
        await multi.exec();
      }

      const latency = Date.now() - start;
      this.metrics.sets += Object.keys(keyValues).length;
      this.updateAvgLatency(latency);

      logger.debug('Cache mset', {
        keys: Object.keys(keyValues).length,
        ttl: ttlSeconds,
        latency: `${latency}ms`
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache mset error', { keys: Object.keys(keyValues), error });
      throw error;
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string, amount: number = 1): Promise<number> {
    try {
      const result = await this.redis.incrby(key, amount);
      logger.debug('Cache increment', { key, amount, result });
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache increment error', { key, error });
      throw error;
    }
  }

  /**
   * Set cache with JSON operations
   */
  async hset(key: string, field: string, value: any): Promise<number> {
    try {
      const result = await this.redis.hset(key, field, JSON.stringify(value));
      logger.debug('Cache hset', { key, field });
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache hset error', { key, field, error });
      throw error;
    }
  }

  /**
   * Get field from hash
   */
  async hget(key: string, field: string): Promise<any | null> {
    try {
      const value = await this.redis.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache hget error', { key, field, error });
      return null;
    }
  }

  /**
   * Rate limiting check
   */
  async rateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - windowSeconds;
      const pipeline = this.redis.pipeline();

      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count current requests
      pipeline.zcard(key);

      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiration on the key
      pipeline.expire(key, windowSeconds);

      const results = await pipeline.exec();
      const currentCount = (results?.[1]?.[1] as number) || 0;

      const allowed = currentCount < limit;
      const remaining = Math.max(0, limit - currentCount);
      const resetTime = now + windowSeconds;

      if (!allowed) {
        logger.warn('Rate limit exceeded', { key, currentCount, limit, windowSeconds });
      }

      return { allowed, remaining, resetTime };
    } catch (error) {
      this.metrics.errors++;
      logger.error('Rate limit error', { key, error });
      return { allowed: true, remaining: limit, resetTime: 0 };
    }
  }

  /**
   * Update average latency
   */
  private updateAvgLatency(latency: number): void {
    this.metrics.avgLatency = (
      (this.metrics.avgLatency || 0) + latency
    ) / 2;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? (this.metrics.hits / total) * 100 : 0,
      totalRequests: total
    };
  }

  /**
   * Publish message to Redis channel
   */
  async publish(channel: string, message: any): Promise<void> {
    try {
      await this.redis.publish(channel, JSON.stringify(message));
      logger.debug('Published to Redis', { channel });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Redis publish error', { channel, error });
      throw error;
    }
  }

  /**
   * Subscribe to Redis channel
   */
  async subscribe(channel: string): Promise<void> {
    try {
      await this.redisSubscriber.subscribe(channel);
      logger.info('Subscribed to Redis channel', { channel });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Redis subscribe error', { channel, error });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed', error);
      return false;
    }
  }

  /**
   * Close Redis connections
   */
  async close(): Promise<void> {
    logger.info('Closing Redis connections...');
    await Promise.all([
      this.redis.quit(),
      this.redisSubscriber.quit()
    ]);
    logger.info('Redis connections closed');
  }

  /**
   * Periodic metrics logging
   */
  startMetricsLogging(): void {
    setInterval(() => {
      const metrics = this.getMetrics();
      logger.info('Redis metrics', metrics);
    }, 60000); // Every minute
  }
}

// Create singleton instance
export const redisManager = new ProductionRedisManager();