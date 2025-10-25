// Advanced Multi-Level Cache Manager for LabelMint
import Redis from 'ioredis';

interface CacheConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    retryDelayOnFailover?: number;
    maxRetriesPerRequest?: number;
  };
  memory: {
    maxSize: number;
    ttl: number;
    checkPeriod?: number;
  };
  compression: {
    enabled: boolean;
    threshold: number;
  };
}

interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
}

interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  hits: number;
  size: number;
  compressed?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  memoryUsage: number;
  redisUsage: number;
}

class AdvancedCacheManager {
  private redis: Redis | null = null;
  private memoryCache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'labelmint:',
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        ...config.redis
      },
      memory: {
        maxSize: 1000,
        ttl: 300000, // 5 minutes
        checkPeriod: 60000, // 1 minute
        ...config.memory
      },
      compression: {
        enabled: true,
        threshold: 1024, // 1KB
        ...config.compression
      }
    };

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      memoryUsage: 0,
      redisUsage: 0
    };

    this.initializeRedis();
    this.startCleanupTimer();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(this.config.redis);

      this.redis.on('connect', () => {
        console.log('✅ Redis connected');
      });

      this.redis.on('error', (error) => {
        console.error('❌ Redis error:', error.message);
      });

      this.redis.on('close', () => {
        console.log('🔌 Redis connection closed');
      });

      // Test connection
      await this.redis.ping();
    } catch (error) {
      console.warn('⚠️ Redis not available, using memory-only cache:', error.message);
      this.redis = null;
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.memory.checkPeriod);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }

    // Enforce memory limit
    if (this.memoryCache.size > this.config.memory.maxSize) {
      const entries = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].hits - b[1].hits); // Least used first

      const toDelete = entries.slice(0, this.memoryCache.size - this.config.memory.maxSize);
      for (const [key] of toDelete) {
        this.memoryCache.delete(key);
      }
    }

    this.updateMemoryUsage();
  }

  private updateMemoryUsage(): void {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }
    this.stats.memoryUsage = totalSize;
  }

  private async getFromRedis<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      let value = await this.redis.get(key);
      if (!value) return null;

      const entry: CacheEntry<T> = JSON.parse(value);

      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        await this.redis.del(key);
        return null;
      }

      // Update hit count
      entry.hits++;
      await this.redis.set(key, JSON.stringify(entry), 'PX', entry.ttl);

      return entry.value;
    } catch (error) {
      console.error('Redis get error:', error.message);
      return null;
    }
  }

  private async setToRedis<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    if (!this.redis) return;

    try {
      const ttl = options.ttl || this.config.memory.ttl;
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl,
        tags: options.tags || [],
        hits: 0,
        size: this.calculateSize(value),
        compressed: options.compress && this.shouldCompress(value)
      };

      // Compress if needed
      if (entry.compressed) {
        entry.value = this.compress(value) as T;
      }

      await this.redis.set(key, JSON.stringify(entry), 'PX', ttl);
      this.stats.sets++;
    } catch (error) {
      console.error('Redis set error:', error.message);
    }
  }

  private shouldCompress(value: any): boolean {
    if (!this.config.compression.enabled) return false;
    return this.calculateSize(value) > this.config.compression.threshold;
  }

  private calculateSize(value: any): number {
    return JSON.stringify(value).length;
  }

  private compress(value: any): string {
    // Simple compression simulation - in production use zlib
    return JSON.stringify(value);
  }

  private decompress(compressed: string): any {
    // Simple decompression simulation - in production use zlib
    return JSON.parse(compressed);
  }

  // Public API methods

  async get<T>(key: string): Promise<T | null> {
    // Level 1: Memory cache
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      // Check if expired
      if (Date.now() - memoryEntry.timestamp > memoryEntry.ttl) {
        this.memoryCache.delete(key);
      } else {
        memoryEntry.hits++;
        this.stats.hits++;
        return memoryEntry.value;
      }
    }

    // Level 2: Redis cache
    const redisValue = await this.getFromRedis<T>(key);
    if (redisValue !== null) {
      // Cache in memory for faster access
      this.setToMemory(key, redisValue);
      this.stats.hits++;
      return redisValue;
    }

    this.stats.misses++;
    return null;
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.config.memory.ttl;
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl,
      tags: options.tags || [],
      hits: 0,
      size: this.calculateSize(value),
      compressed: options.compress && this.shouldCompress(value)
    };

    // Set in memory cache
    this.memoryCache.set(key, entry);
    this.stats.sets++;

    // Set in Redis
    await this.setToRedis(key, value, options);
  }

  private setToMemory<T>(key: string, value: T, ttl: number = this.config.memory.ttl): void {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl,
      tags: [],
      hits: 0,
      size: this.calculateSize(value)
    };

    this.memoryCache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    this.stats.deletes++;

    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error('Redis delete error:', error.message);
      }
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    // Invalidate memory cache entries with this tag
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }

    // Invalidate Redis entries with this tag
    if (this.redis) {
      try {
        const pattern = `${this.config.redis.keyPrefix}*:${tag}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        console.error('Redis tag invalidation error:', error.message);
      }
    }
  }

  async warmCache<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    const promises = entries.map(entry =>
      this.set(entry.key, entry.value, entry.options)
    );

    await Promise.allSettled(promises);
    console.log(`✅ Warmed ${entries.length} cache entries`);
  }

  // Specialized cache methods for LabelMint

  async cacheUserProfile(userId: string, profile: any): Promise<void> {
    await this.set(`user:profile:${userId}`, profile, {
      ttl: 900000, // 15 minutes
      tags: ['user', 'profile'],
      priority: 'high'
    });
  }

  async getUserProfile(userId: string): Promise<any | null> {
    return await this.get(`user:profile:${userId}`);
  }

  async cacheAvailableTasks(tasks: any[]): Promise<void> {
    await this.set('tasks:available', tasks, {
      ttl: 30000, // 30 seconds
      tags: ['tasks', 'available'],
      priority: 'high'
    });
  }

  async getAvailableTasks(): Promise<any[] | null> {
    return await this.get('tasks:available');
  }

  async cacheProjectStats(projectId: string, stats: any): Promise<void> {
    await this.set(`project:stats:${projectId}`, stats, {
      ttl: 60000, // 1 minute
      tags: ['project', 'stats']
    });
  }

  async getProjectStats(projectId: string): Promise<any | null> {
    return await this.get(`project:stats:${projectId}`);
  }

  async cacheWorkerStats(workerId: string, stats: any): Promise<void> {
    await this.set(`worker:stats:${workerId}`, stats, {
      ttl: 120000, // 2 minutes
      tags: ['worker', 'stats']
    });
  }

  async getWorkerStats(workerId: string): Promise<any | null> {
    return await this.get(`worker:stats:${workerId}`);
  }

  // Performance and monitoring

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;

    return { ...this.stats };
  }

  async getRedisStats(): Promise<any> {
    if (!this.redis) return null;

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');

      return {
        info,
        keyspace,
        connected: this.redis.status === 'ready'
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.redis) {
      try {
        const pattern = `${this.config.redis.keyPrefix}*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        console.error('Redis clear error:', error.message);
      }
    }

    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      memoryUsage: 0,
      redisUsage: 0
    };
  }

  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.redis) {
      await this.redis.disconnect();
      this.redis = null;
    }
  }
}

// Singleton instance
let cacheManager: AdvancedCacheManager | null = null;

export function getCacheManager(): AdvancedCacheManager {
  if (!cacheManager) {
    cacheManager = new AdvancedCacheManager();
  }
  return cacheManager;
}

export { AdvancedCacheManager, type CacheConfig, type CacheOptions, type CacheStats };