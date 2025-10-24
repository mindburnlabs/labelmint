/**
 * Redis Cache Service
 * Handles multi-layer caching strategy with Redis
 */

import Redis from 'ioredis';
import { createClient } from 'redis';
import crypto from 'crypto';
import { config } from '../config';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  tags?: string[];
  compress?: boolean;
  version?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
  keyCount: number;
  avgResponseTime: number;
}

export interface CacheItem<T = any> {
  key: string;
  value: T;
  expiresAt?: Date;
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number;
  tags: string[];
}

export class RedisCacheService {
  private redis: Redis;
  private redisClient: any;
  private localCache: Map<string, { value: any; expiresAt: number }> = new Map();
  private metrics: Map<string, CacheStats> = new Map();
  private isRedisConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.initializeRedis();
    this.startCleanupInterval();
  }

  private async initializeRedis() {
    try {
      // Primary Redis instance
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        commandTimeout: 5000,
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        },
      });

      // Redis client for pub/sub
      this.redisClient = createClient({
        url: `redis://${config.redis.host}:${config.redis.port}`,
        password: config.redis.password,
        database: config.redis.db,
      });

      await this.redis.connect();
      await this.redisClient.connect();

      this.isRedisConnected = true;
      this.reconnectAttempts = 0;

      console.log('Redis connected successfully');

      // Setup event listeners
      this.redis.on('error', (error) => {
        console.error('Redis error:', error);
        this.handleRedisError(error);
      });

      this.redis.on('connect', () => {
        console.log('Redis reconnected');
        this.isRedisConnected = true;
        this.reconnectAttempts = 0;
      });

      this.redis.on('close', () => {
        console.log('Redis connection closed');
        this.isRedisConnected = false;
      });

    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isRedisConnected = false;
      this.handleRedisError(error);
    }
  }

  private async handleRedisError(error: any) {
    if (!this.isRedisConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      setTimeout(() => {
        console.log(`Attempting to reconnect to Redis (attempt ${this.reconnectAttempts})`);
        this.initializeRedis();
      }, delay);
    }
  }

  /**
   * Get value from cache (L1: Local, L2: Redis)
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Check local cache first (L1)
      const localItem = this.localCache.get(key);
      if (localItem && localItem.expiresAt > Date.now()) {
        this.updateMetrics('local', 'hit', Date.now() - startTime);
        return localItem.value;
      }

      // Check Redis cache (L2)
      if (this.isRedisConnected) {
        const redisKey = this.getRedisKey(key);
        const cached = await this.redis.get(redisKey);

        if (cached) {
          const item: CacheItem<T> = JSON.parse(cached);

          // Update local cache with fresh data
          this.localCache.set(key, {
            value: item.value,
            expiresAt: item.expiresAt ? item.expiresAt.getTime() : Date.now() + 300000 // 5 min default
          });

          // Update access stats
          await this.updateAccessStats(redisKey);

          this.updateMetrics('redis', 'hit', Date.now() - startTime);
          return item.value;
        }
      }

      this.updateMetrics('combined', 'miss', Date.now() - startTime);
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.updateMetrics('error', 'miss', Date.now() - startTime);
      return null;
    }
  }

  /**
   * Set value in cache with options
   */
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const startTime = Date.now();
    const {
      ttl = 3600, // 1 hour default
      prefix = 'default',
      tags = [],
      compress = false,
      version = 'v1'
    } = options;

    try {
      const cacheItem: CacheItem<T> = {
        key,
        value,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + ttl * 1000),
        accessCount: 0,
        lastAccessed: new Date(),
        size: this.calculateSize(value),
        tags
      };

      // Store in local cache (L1)
      const localTtl = Math.min(ttl, 300); // Max 5 min in local cache
      this.localCache.set(key, {
        value,
        expiresAt: Date.now() + localTtl * 1000
      });

      // Store in Redis (L2)
      if (this.isRedisConnected) {
        const redisKey = this.getRedisKey(key, prefix, version);
        const serialized = JSON.stringify(cacheItem);

        // Set main cache
        await this.redis.setex(redisKey, ttl, serialized);

        // Set tag indexes for invalidation
        if (tags.length > 0) {
          await this.setTagIndexes(redisKey, tags, ttl);
        }

        // Publish update event
        await this.publishCacheUpdate(redisKey, 'set');
      }

      this.updateMetrics('set', 'hit', Date.now() - startTime);

    } catch (error) {
      console.error('Cache set error:', error);
      this.updateMetrics('error', 'miss', Date.now() - startTime);
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      // Remove from local cache
      this.localCache.delete(key);

      // Remove from Redis
      if (this.isRedisConnected) {
        const redisKey = this.getRedisKey(key);
        const item = await this.redis.get(redisKey);

        if (item) {
          const cacheItem: CacheItem = JSON.parse(item);

          // Remove tag indexes
          if (cacheItem.tags.length > 0) {
            await this.removeTagIndexes(redisKey, cacheItem.tags);
          }

          await this.redis.del(redisKey);
          await this.publishCacheUpdate(redisKey, 'delete');
        }
      }

    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTag(tag: string): Promise<void> {
    try {
      if (!this.isRedisConnected) return;

      const tagKey = `tag:${tag}`;
      const keys = await this.redis.smembers(tagKey);

      if (keys.length > 0) {
        // Delete all keys with this tag
        await this.redis.del(...keys);

        // Delete tag index
        await this.redis.del(tagKey);

        // Publish invalidation event
        await this.publishCacheUpdate(tag, 'invalidate_tag');
      }

    } catch (error) {
      console.error('Tag invalidation error:', error);
    }
  }

  /**
   * Get multiple keys (mget)
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];

    for (const key of keys) {
      const value = await this.get<T>(key);
      results.push(value);
    }

    return results;
  }

  /**
   * Set multiple keys (mset)
   */
  async mset<T = any>(items: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    const promises = items.map(item =>
      this.set(item.key, item.value, item.options)
    );

    await Promise.all(promises);
  }

  /**
   * Cache query results with automatic invalidation
   */
  async cacheQuery<T = any>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(queryKey);
    if (cached !== null) {
      return cached;
    }

    // Execute query and cache result
    const result = await queryFn();
    await this.set(queryKey, result, options);

    return result;
  }

  /**
   * Cache API responses
   */
  async cacheResponse<T = any>(
    key: string,
    responseFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    return this.cacheQuery(key, responseFn, {
      ttl: 300, // 5 minutes for API responses
      prefix: 'api',
      ...options
    });
  }

  /**
   * Cache full pages
   */
  async cachePage(
    key: string,
    pageFn: () => Promise<string>,
    options: CacheOptions = {}
  ): Promise<string> {
    return this.cacheQuery(key, pageFn, {
      ttl: 60, // 1 minute for pages
      prefix: 'page',
      tags: ['page', 'html'],
      ...options
    });
  }

  /**
   * Session storage
   */
  async setSession(sessionId: string, data: any, ttl: number = 86400): Promise<void> {
    await this.set(sessionId, data, {
      ttl,
      prefix: 'session',
      tags: ['session']
    });
  }

  async getSession(sessionId: string): Promise<any | null> {
    return this.get(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.delete(sessionId);
  }

  /**
   * Distributed cache warming
   */
  async warmCache(warmupFunctions: Array<{ key: string; fn: () => Promise<any> }>): Promise<void> {
    const promises = warmupFunctions.map(async ({ key, fn }) => {
      try {
        const exists = await this.redis?.exists(this.getRedisKey(key));
        if (!exists) {
          const result = await fn();
          await this.set(key, result, { ttl: 3600 });
        }
      } catch (error) {
        console.error(`Failed to warm cache for key ${key}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats & { redis: any; local: any }> {
    const combined = this.getCombinedStats();

    let redisStats = {};
    if (this.isRedisConnected) {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');

      redisStats = {
        memory: this.parseRedisMemory(info),
        keys: this.parseRedisKeyspace(keyspace),
        connected: true
      };
    }

    return {
      ...combined,
      redis: redisStats,
      local: {
        size: this.localCache.size,
        memoryUsage: this.calculateLocalMemoryUsage()
      }
    };
  }

  /**
   * Clear all cache
   */
  async clear(pattern?: string): Promise<void> {
    try {
      if (this.isRedisConnected) {
        if (pattern) {
          const keys = await this.redis.keys(`${this.getRedisKey(pattern)}*`);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } else {
          // Clear only app keys, not system keys
          const keys = await this.redis.keys('labelmint:*');
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        }
      }

      this.localCache.clear();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Private helper methods
   */

  private getRedisKey(key: string, prefix: string = 'default', version: string = 'v1'): string {
    return `labelmint:${version}:${prefix}:${key}`;
  }

  private async setTagIndexes(redisKey: string, tags: string[], ttl: number): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      pipeline.sadd(tagKey, redisKey);
      pipeline.expire(tagKey, ttl);
    }

    await pipeline.exec();
  }

  private async removeTagIndexes(redisKey: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      pipeline.srem(tagKey, redisKey);
    }

    await pipeline.exec();
  }

  private async updateAccessStats(redisKey: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.hincrby(`${redisKey}:stats`, 'accessCount', 1);
    pipeline.hset(`${redisKey}:stats`, 'lastAccessed', new Date().toISOString());
    pipeline.expire(`${redisKey}:stats`, 86400); // Stats expire in 24h

    await pipeline.exec();
  }

  private async publishCacheUpdate(key: string, action: string): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.publish('cache_updates', JSON.stringify({
        key,
        action,
        timestamp: new Date().toISOString()
      }));
    }
  }

  private calculateSize(value: any): number {
    return JSON.stringify(value).length;
  }

  private calculateLocalMemoryUsage(): number {
    let totalSize = 0;
    for (const [key, value] of this.localCache.entries()) {
      totalSize += key.length + JSON.stringify(value).length;
    }
    return totalSize;
  }

  private updateMetrics(type: string, result: 'hit' | 'miss' | 'error', responseTime: number): void {
    if (!this.metrics.has(type)) {
      this.metrics.set(type, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        memoryUsage: 0,
        keyCount: 0,
        avgResponseTime: 0
      });
    }

    const stats = this.metrics.get(type)!;

    if (result === 'hit') {
      stats.hits++;
    } else {
      stats.misses++;
    }

    const total = stats.hits + stats.misses;
    stats.hitRate = total > 0 ? (stats.hits / total) * 100 : 0;

    // Update average response time
    stats.avgResponseTime = (stats.avgResponseTime + responseTime) / 2;
  }

  private getCombinedStats(): CacheStats {
    let totalHits = 0;
    let totalMisses = 0;
    let totalResponseTime = 0;
    let count = 0;

    for (const stats of this.metrics.values()) {
      totalHits += stats.hits;
      totalMisses += stats.misses;
      totalResponseTime += stats.avgResponseTime;
      count++;
    }

    return {
      hits: totalHits,
      misses: totalMisses,
      hitRate: totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0,
      memoryUsage: 0, // To be calculated
      keyCount: this.localCache.size,
      avgResponseTime: count > 0 ? totalResponseTime / count : 0
    };
  }

  private parseRedisMemory(info: string): any {
    const lines = info.split('\r\n');
    const memory: any = {};

    for (const line of lines) {
      if (line.includes('used_memory_human:')) {
        memory.used = line.split(':')[1];
      } else if (line.includes('used_memory_peak_human:')) {
        memory.peak = line.split(':')[1];
      }
    }

    return memory;
  }

  private parseRedisKeyspace(info: string): any {
    const lines = info.split('\r\n');
    const keyspace: any = {};

    for (const line of lines) {
      if (line.startsWith('db')) {
        const [db, stats] = line.split(':');
        const matches = stats.match(/keys=(\d+),expires=(\d+)/);
        if (matches) {
          keyspace[db] = {
            keys: parseInt(matches[1]),
            expires: parseInt(matches[2])
          };
        }
      }
    }

    return keyspace;
  }

  private startCleanupInterval(): void {
    // Clean expired local cache entries every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.localCache.entries()) {
        if (value.expiresAt < now) {
          this.localCache.delete(key);
        }
      }
    }, 60000);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    this.localCache.clear();
  }
}

// Singleton instance
const cacheService = new RedisCacheService();
export default cacheService;