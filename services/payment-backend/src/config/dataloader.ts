import { Logger } from '../utils/logger';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const logger = new Logger('DataLoader');

interface DataLoaderOptions {
  maxBatchSize?: number;
  batchScheduleFn?: (ms: number) => number;
  cache?: boolean;
  cacheExpiration?: number;
  ttl?: boolean; // Time to live in cache
}

interface CacheKey {
  key: string;
  ttl?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

class RedisCacheMap<K, V> {
  private redis: Redis;
  private keyPrefix: string;
  private defaultTTL: number;

  constructor(redis: Redis, keyPrefix: string = 'dataloader:', defaultTTL: number = 300000) { // 5 minutes
    this.redis = redis;
    this.keyPrefix = keyPrefix;
    this.defaultTTL = defaultTTL;
  }

  private parseCacheKey(key: K): string {
    return `${this.keyPrefix}${JSON.stringify(key)}`;
  }

  private setCacheEntry(key: K, value: V, ttl?: number): Promise<void> {
    const cacheKey = this.parseCacheKey(key);
    const entry: CacheEntry<V> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };

    await this.redis.setex(
      cacheKey,
      Math.ceil((ttl || this.defaultTTL) / 1000),
      JSON.stringify(entry)
    );
  }

  private async getCacheEntry(key: K): Promise<V | undefined> {
    const cacheKey = this.parseCacheKey(key);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      try {
        const entry: CacheEntry<V> = JSON.parse(cached);

        // Check if entry is expired
        if (Date.now() - entry.timestamp >= (entry.ttl || this.defaultTTL) * 1000) {
          await this.redis.del(cacheKey);
          return undefined;
        }

        return entry.data;
      } catch (error) {
        logger.error('Failed to parse cache entry', { key, error });
        await this.redis.del(cacheKey);
        return undefined;
      }
    }

    return undefined;
  }

  private async deleteCacheEntry(key: K): Promise<void> {
    const cacheKey = this.parseCacheKey(key);
    await this.redis.del(cacheKey);
  }

  private async deleteCacheEntries(keys: K[]): Promise<void> {
    if (keys.length === 0) return;

    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      pipeline.del(this.parseCacheKey(key));
    }
    await pipeline.exec();
  }
}

export class DataLoaderConfig {
  // Default configuration for all DataLoaders
  static readonly DEFAULTS: DataLoaderOptions = {
    maxBatchSize: 100,
    batchScheduleFn: () => setTimeout(() => process.nextTick(), 0),
    cache: true,
    cacheExpiration: 300000, // 5 minutes
    ttl: false
  };

  // Optimized configuration for read-heavy data
  static readonly READ_HEAVY: DataLoaderOptions = {
    ...this.DEFAULTS,
    cache: true,
    cacheExpiration: 600000, // 10 minutes
    maxBatchSize: 50
  };

  // Configuration for frequently accessed data
  static readonly FREQUENT: DataLoaderOptions = {
    ...this.DEFAULTS,
    cache: true,
    cacheExpiration: 120000, // 2 minutes
    maxBatchSize: 25
  };

  // Configuration for write operations
  static readonly WRITE: DataLoaderOptions = {
    ...this.DEFAULTS,
    cache: false, // Don't cache write operations by default
    maxBatchSize: 50
  };
}

export class DataLoaderManager {
  private redis: Redis;
  private prisma: PrismaClient;
  private loaders: Map<string, any> = new Map();

  constructor(redis: Redis, prisma: PrismaClient) {
    this.redis = redis;
    this.prisma = prisma;
  }

  /**
   * Get or create a DataLoader with custom options
   */
  getDataLoader<K, V>(
    name: string,
    batchLoadFn: (keys: K[]) => Promise<V[]>,
    options: DataLoaderOptions = DataLoaderConfig.DEFAULTS
  ): any {
    const cache = options.cache ? new RedisCacheMap<K, V[]>(this.redis, `${name}:`) : null;

    const DataLoader = require('dataloader').defaultDataLoader<K, V>;

    const loader = new DataLoader<K, V>({
      batchLoadFn: async (keys: K[]) => {
        if (cache) {
          // Try to get from cache first
          const cachePromises = keys.map(key => cache.getCacheEntry(key));
          const cachedResults = await Promise.all(cachePromises);

          const uncachedKeys: K[] = [];
          const cachedValues: Map<K, V> = new Map();

          cachedResults.forEach((result, index) => {
            if (result !== undefined) {
              cachedValues.set(keys[index], result);
            } else {
              uncachedKeys.push(keys[index]);
            }
          });

          if (uncachedKeys.length > 0) {
            // Load uncached data
            const batchResults = await batchLoadFn(uncachedKeys);

            // Cache the results
            const cachePromises = uncachedKeys.map(key =>
              cache.setCacheEntry(key, batchResults.find((r, i) => uncachedKeys[i] === key))
            );
            await Promise.all(cachePromises);

            // Combine cached and fresh results
            return keys.map(key => {
              const cachedIndex = uncachedKeys.indexOf(key);
              return cachedIndex !== -1 ? batchResults[cachedIndex] : cachedValues.get(key);
            });
          }

          // All cached
          return cachedValues.get(key)!;
        }

        return keys.map(key => cache.getCacheEntry(key)).map((value, index) => {
          if (value === undefined) {
            // Shouldn't happen if no cache
            throw new Error(`Cache miss for ${name} DataLoader`);
          }
          return value;
        });
      },
      ...options
    });

    // Clean up cache after each batch
    loader.clear = () => {
      if (cache) {
        const cacheKeys = Array.from((cache as any)._cache.keys());
        if (cacheKeys.length > 0) {
          logger.debug(`Clearing ${cacheKeys.length} expired cache entries for ${name}`);
          await cache.deleteCacheEntries(cacheKeys);
        }
      }
    };

    this.loaders.set(name, loader);
    return loader;
  }

  /**
   * Get all existing DataLoaders for cleanup
   */
  getAllLoaders(): any[] {
    return Array.from(this.loaders.values());
  }

  /**
   * Clear all DataLoader caches
   */
  async clearAllCaches(): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(this.redis.keys(`${this.redis.options.keyPrefix}*`));
    await pipeline.exec();

    // Clear in-memory caches
    this.loaders.forEach(loader => {
      if (loader && typeof loader.clearAll === 'function') {
        loader.clearAll();
      }
    });

    logger.info('All DataLoader caches cleared');
  }

  /**
   * Warm cache with preloaded data
   */
  async warmCache(
    loaderName: string,
    keys: any[],
    warmData: any[]
  ): Promise<void> {
    const loader = this.loaders.get(loaderName);
    if (!loader) {
      logger.warn(`DataLoader ${loaderName} not found`);
      return;
    }

    const cache = new RedisCacheMap(this.redis, `${loaderName}:warmup:`);

    // Preload data into cache
    const cachePromises = keys.map((key, index) =>
      cache.setCacheEntry(key, warmData[index])
    );

    await Promise.all(cachePromises);
    logger.info(`Warmed cache for ${loaderName} with ${keys.length} entries`);
  }

  /**
   * Generate cache statistics
   */
  async getCacheStats(): Promise<any> {
    const info = await this.redis.info();
    const memoryUsage = info.memory;

    return {
      totalKeys: parseInt(info.keyspace),
      cacheSize: memoryUsage.used,
      cacheSizeMB: Math.round(memoryUsage.used / 1024 / 1024),
      memoryUsedPercent: Math.round((memoryUsage.used / memoryUsage.total) * 100),
      evictionCount: parseInt(info.stats.evicted_keys),
      hitRate: this.calculateHitRate(info.stats)
    };
  }

  private calculateHitRate(stats: any): number {
    if (!stats.keyspace_hits || !stats.keyspace_misses) return 0;

    const total = parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses);
    return total > 0 ? (parseInt(stats.keyspace_hits) / total) * 100 : 0;
  }

  /**
   * Cache invalidation utilities
   */
  async invalidateCacheByPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      logger.info(`Invalidating ${keys.length} cache entries matching: ${pattern}`);
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();
    }
  }

  /**
   * Tag-based cache invalidation
   */
  async invalidateCacheByTag(tag: string): Promise<void> {
    // This would need a tag-based cache implementation
    // For now, use pattern matching
    await this.invalidateCacheByPattern(`*:${tag}:*`);
  }
}

export default DataLoaderManager;
export { DataLoaderConfig, RedisCacheMap, DataLoaderOptions };