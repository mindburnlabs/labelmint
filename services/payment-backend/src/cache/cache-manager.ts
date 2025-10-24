import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Compress large values
  version?: string; // Cache version for cache busting
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
  version: string;
  compressed?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  memoryUsage: number;
  keyCount: number;
}

interface CachePattern {
  pattern: string;
  description: string;
  example: string;
}

export class CacheManager {
  private redis: Redis;
  private logger: Logger;
  private metrics: MetricsCollector;
  private defaultTTL: number = 300; // 5 minutes
  private keyPrefix: string = 'deligeit:cache:';
  private compressionThreshold: number = 1024; // Compress values > 1KB
  private currentVersion: string = 'v1';

  constructor(redis: Redis) {
    this.redis = redis;
    this.logger = new Logger('CacheManager');
    this.metrics = new MetricsCollector('cache');
  }

  /**
   * Get value from cache with automatic deserialization
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key);

    try {
      const cached = await this.redis.get(fullKey);

      if (cached) {
        const entry: CacheEntry<T> = JSON.parse(cached);

        // Check if entry is expired
        if (this.isExpired(entry)) {
          await this.delete(key);
          this.recordMiss(key, Date.now() - startTime);
          return null;
        }

        // Check version compatibility
        if (entry.version !== this.currentVersion) {
          await this.delete(key);
          this.recordMiss(key, Date.now() - startTime);
          return null;
        }

        // Decompress if needed
        const data = entry.compressed ?
          await this.decompress(entry.data as any) :
          entry.data;

        this.recordHit(key, Date.now() - startTime);
        this.logger.debug(`Cache hit for key: ${key}`);
        return data;
      }

      this.recordMiss(key, Date.now() - startTime);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}`, error);
      this.recordMiss(key, Date.now() - startTime);
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL and tags
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key, options.prefix);
    const ttl = options.ttl || this.defaultTTL;

    try {
      let dataToStore = value;
      let compressed = false;

      // Compress large values if enabled
      if (options.compress && this.shouldCompress(value)) {
        dataToStore = await this.compress(value as any);
        compressed = true;
      }

      const entry: CacheEntry<T> = {
        data: dataToStore,
        timestamp: Date.now(),
        ttl,
        tags: options.tags,
        version: options.version || this.currentVersion,
        compressed
      };

      const serialized = JSON.stringify(entry);

      // Set with expiration
      if (ttl > 0) {
        await this.redis.setex(fullKey, ttl, serialized);
      } else {
        await this.redis.set(fullKey, serialized);
      }

      // Add to tag indexes if tags are provided
      if (options.tags && options.tags.length > 0) {
        await this.addToTagIndexes(fullKey, options.tags);
      }

      this.recordSet(key, Date.now() - startTime);
      this.logger.debug(`Cache set for key: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<void> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key);

    try {
      // Get tags before deletion to clean up indexes
      const cached = await this.redis.get(fullKey);
      if (cached) {
        const entry: CacheEntry<any> = JSON.parse(cached);
        if (entry.tags) {
          await this.removeFromTagIndexes(fullKey, entry.tags);
        }
      }

      await this.redis.del(fullKey);
      this.recordDelete(key, Date.now() - startTime);
      this.logger.debug(`Cache delete for key: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}`, error);
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    const startTime = Date.now();
    const fullPattern = this.buildKey(pattern);

    try {
      const keys = await this.redis.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      // Clean up tag indexes for all keys
      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const entry: CacheEntry<any> = JSON.parse(cached);
          if (entry.tags) {
            await this.removeFromTagIndexes(key, entry.tags);
          }
        }
      }

      const deleted = await this.redis.del(...keys);
      this.logger.info(`Cache pattern delete: ${pattern}, deleted ${deleted} keys`);

      return deleted;
    } catch (error) {
      this.logger.error(`Cache pattern delete error for pattern ${pattern}`, error);
      return 0;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const startTime = Date.now();
    let totalDeleted = 0;

    try {
      for (const tag of tags) {
        const tagKey = this.buildTagKey(tag);
        const keys = await this.redis.smembers(tagKey);

        if (keys.length > 0) {
          await this.redis.del(...keys);
          await this.redis.del(tagKey);
          totalDeleted += keys.length;
        }
      }

      this.logger.info(`Cache invalidation by tags: ${tags.join(', ')}, deleted ${totalDeleted} keys`);
      return totalDeleted;
    } catch (error) {
      this.logger.error(`Cache tag invalidation error`, error);
      return 0;
    }
  }

  /**
   * Get multiple values in a batch
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    const fullKeys = keys.map(key => this.buildKey(key));

    try {
      const values = await this.redis.mget(...fullKeys);

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = values[i];

        if (value) {
          try {
            const entry: CacheEntry<T> = JSON.parse(value);

            if (this.isExpired(entry) || entry.version !== this.currentVersion) {
              await this.delete(key);
              results.set(key, null);
            } else {
              const data = entry.compressed ?
                await this.decompress(entry.data as any) :
                entry.data;
              results.set(key, data);
            }
          } catch (parseError) {
            this.logger.error(`Cache mget parse error for key ${key}`, parseError);
            results.set(key, null);
          }
        } else {
          results.set(key, null);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Cache mget error', error);
      // Return empty map on error
      return new Map();
    }
  }

  /**
   * Set multiple values in a batch
   */
  async mset<T>(
    entries: Array<{ key: string; value: T; options?: CacheOptions }>
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    try {
      for (const { key, value, options = {} } of entries) {
        const fullKey = this.buildKey(key, options.prefix);
        const ttl = options.ttl || this.defaultTTL;

        let dataToStore = value;
        let compressed = false;

        if (options.compress && this.shouldCompress(value)) {
          dataToStore = await this.compress(value as any);
          compressed = true;
        }

        const entry: CacheEntry<T> = {
          data: dataToStore,
          timestamp: Date.now(),
          ttl,
          tags: options.tags,
          version: options.version || this.currentVersion,
          compressed
        };

        const serialized = JSON.stringify(entry);

        if (ttl > 0) {
          pipeline.setex(fullKey, ttl, serialized);
        } else {
          pipeline.set(fullKey, serialized);
        }

        if (options.tags && options.tags.length > 0) {
          for (const tag of options.tags) {
            pipeline.sadd(this.buildTagKey(tag), fullKey);
          }
        }
      }

      await pipeline.exec();
      this.logger.debug(`Cache mset: ${entries.length} entries`);
    } catch (error) {
      this.logger.error('Cache mset error', error);
      throw error;
    }
  }

  /**
   * Atomic increment operation
   */
  async increment(
    key: string,
    amount: number = 1,
    options: CacheOptions = {}
  ): Promise<number> {
    const fullKey = this.buildKey(key, options.prefix);

    try {
      const result = await this.redis.incrby(fullKey, amount);

      if (options.ttl && options.ttl > 0) {
        await this.redis.expire(fullKey, options.ttl);
      }

      this.logger.debug(`Cache increment: ${key} by ${amount}, result: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Cache increment error for key ${key}`, error);
      throw error;
    }
  }

  /**
   * Get or set pattern - returns cached value or sets and returns new value
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, options);

    return value;
  }

  /**
   * Cache warming - pre-populate cache with data
   */
  async warmCache<T>(
    entries: Array<{ key: string; fetcher: () => Promise<T>; options?: CacheOptions }>
  ): Promise<void> {
    const promises = entries.map(async ({ key, fetcher, options }) => {
      try {
        const value = await fetcher();
        await this.set(key, value, options);
      } catch (error) {
        this.logger.error(`Cache warming error for key ${key}`, error);
      }
    });

    await Promise.allSettled(promises);
    this.logger.info(`Cache warming completed: ${entries.length} entries`);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      const memoryUsage = this.parseMemoryInfo(info);

      const stats = this.metrics.getStats();

      return {
        hits: stats.hits || 0,
        misses: stats.misses || 0,
        sets: stats.sets || 0,
        deletes: stats.deletes || 0,
        hitRate: this.calculateHitRate(stats.hits, stats.misses),
        memoryUsage,
        keyCount
      };
    } catch (error) {
      this.logger.error('Cache stats error', error);
      return {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        hitRate: 0,
        memoryUsage: 0,
        keyCount: 0
      };
    }
  }

  /**
   * Clear entire cache (use with caution)
   */
  async clear(): Promise<void> {
    try {
      const pattern = this.buildKey('*');
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.warn(`Cache cleared: ${keys.length} keys deleted`);
      }
    } catch (error) {
      this.logger.error('Cache clear error', error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);

    try {
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const fullKey = this.buildKey(key);

    try {
      const result = await this.redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache expire error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    const fullKey = this.buildKey(key);

    try {
      return await this.redis.ttl(fullKey);
    } catch (error) {
      this.logger.error(`Cache TTL error for key ${key}`, error);
      return -1;
    }
  }

  // Private helper methods

  private buildKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || this.keyPrefix;
    return `${keyPrefix}${key}`;
  }

  private buildTagKey(tag: string): string {
    return `${this.keyPrefix}tags:${tag}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp >= (entry.ttl * 1000);
  }

  private shouldCompress(value: any): boolean {
    if (typeof value !== 'string') {
      const serialized = JSON.stringify(value);
      return serialized.length > this.compressionThreshold;
    }
    return value.length > this.compressionThreshold;
  }

  private async compress(data: string): Promise<string> {
    // Simple placeholder - in production, use gzip/zlib
    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  private async decompress(data: any): Promise<any> {
    // Simple placeholder - in production, use gzip/zlib
    return data;
  }

  private async addToTagIndexes(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      pipeline.sadd(this.buildTagKey(tag), key);
      pipeline.expire(this.buildTagKey(tag), 86400); // 24 hours
    }

    await pipeline.exec();
  }

  private async removeFromTagIndexes(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      pipeline.srem(this.buildTagKey(tag), key);
    }

    await pipeline.exec();
  }

  private parseMemoryInfo(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private calculateHitRate(hits: number, misses: number): number {
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  }

  private recordHit(key: string, duration: number): void {
    this.metrics.increment('hits');
    this.metrics.histogram('hit_duration', duration, { key });
  }

  private recordMiss(key: string, duration: number): void {
    this.metrics.increment('misses');
    this.metrics.histogram('miss_duration', duration, { key });
  }

  private recordSet(key: string, duration: number): void {
    this.metrics.increment('sets');
    this.metrics.histogram('set_duration', duration, { key });
  }

  private recordDelete(key: string, duration: number): void {
    this.metrics.increment('deletes');
    this.metrics.histogram('delete_duration', duration, { key });
  }

  /**
   * Common cache patterns
   */
  static readonly PATTERNS: CachePattern[] = [
    {
      pattern: 'user:*',
      description: 'User-specific data cache',
      example: 'user:12345'
    },
    {
      pattern: 'task:list:*',
      description: 'Task list pagination cache',
      example: 'task_list:page_2_limit_20'
    },
    {
      pattern: 'task:*:details',
      description: 'Task details cache',
      example: 'task:12345:details'
    },
    {
      pattern: 'delegation:*:active',
      description: 'Active delegations for user',
      example: 'delegation:12345:active'
    },
    {
      pattern: 'analytics:*:daily',
      description: 'Daily analytics data',
      example: 'analytics:2024-01-15:daily'
    },
    {
      pattern: 'config:*',
      description: 'Configuration cache',
      example: 'config:app_settings'
    },
    {
      pattern: 'session:*',
      description: 'User session cache',
      example: 'session:abc123def456'
    },
    {
      pattern: 'rate_limit:*:*',
      description: 'Rate limiting cache',
      example: 'rate_limit:user:12345'
    }
  ];
}

export default CacheManager;
export { CacheOptions, CacheEntry, CacheStats, CachePattern };