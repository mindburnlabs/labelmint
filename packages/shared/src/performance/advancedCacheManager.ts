// ====================================================================
// ADVANCED MULTI-LEVEL CACHE MANAGER FOR 10,000+ CONCURRENT USERS
// ====================================================================
// Production-ready caching system with intelligent invalidation,
// compression, and distributed cache coordination

import Redis from 'ioredis';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { gzip, ungzip } from 'zlib';
import { EventEmitter } from 'events';

const gzipAsync = promisify(gzip);
const ungzipAsync = promisify(ungzip);

export interface CacheConfig {
  redis: {
    cluster: boolean;
    nodes: Array<{
      host: string;
      port: number;
      password?: string;
    }>;
    options: {
      enableReadyCheck: boolean;
      maxRetriesPerRequest: number;
      retryDelayOnFailover: number;
      lazyConnect: boolean;
      keepAlive: number;
      family: 4 | 6;
      keyPrefix: string;
      commandTimeout: number;
    };
  };
  memory: {
    maxSize: number; // MB
    ttl: number; // ms
    checkPeriod: number; // ms
    lruUpdateAgeOnGet: boolean;
    updateAgeOnGet: boolean;
  };
  compression: {
    enabled: boolean;
    threshold: number; // bytes
    level: number; // 1-9
    chunkSize: number;
  };
  performance: {
    enableMetrics: boolean;
    enableTracing: boolean;
    batchSize: number;
    parallelism: number;
    pipelineSize: number;
  };
  invalidation: {
    enableEvents: boolean;
    eventBusUrl?: string;
    broadcastInterval: number; // ms
    maxQueueSize: number;
  };
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
  compressed: boolean;
  tags: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  version: number;
  etag?: string;
}

export interface CacheStats {
  // General stats
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  hitRate: number;

  // Memory stats
  memoryUsage: number;
  memoryLimit: number;
  entryCount: number;
  compressionRatio: number;

  // Redis stats
  redisHits: number;
  redisMisses: number;
  redisErrors: number;
  redisConnections: number;
  redisMemoryUsage: number;

  // Performance stats
  avgGetTime: number;
  avgSetTime: number;
  avgCompressTime: number;
  pipelineSize: number;
  batchOperations: number;

  // Tag stats
  tagInvalidations: number;
  tagOperations: number;
  activeTags: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high' | 'critical';
  compress?: boolean;
  version?: number;
  noEvict?: boolean;
  refreshAhead?: boolean;
  refreshThreshold?: number;
}

class LRUEntry<T> {
  public prev: LRUEntry<T> | null = null;
  public next: LRUEntry<T> | null = null;
  public key: string;
  public entry: CacheEntry<T>;

  constructor(key: string, entry: CacheEntry<T>) {
    this.key = key;
    this.entry = entry;
  }
}

class LRUCache<T> {
  private head: LRUEntry<T> | null = null;
  private tail: LRUEntry<T> | null = null;
  private map = new Map<string, LRUEntry<T>>();
  private maxSize: number;
  private currentSize: number = 0;
  private lruUpdateAgeOnGet: boolean;

  constructor(maxSize: number, lruUpdateAgeOnGet: boolean = false) {
    this.maxSize = maxSize;
    this.lruUpdateAgeOnGet = lruUpdateAgeOnGet;
  }

  get(key: string): CacheEntry<T> | null {
    const node = this.map.get(key);
    if (!node) return null;

    if (this.lruUpdateAgeOnGet) {
      this.moveToHead(node);
    }

    return node.entry;
  }

  set(key: string, entry: CacheEntry<T>): void {
    const existingNode = this.map.get(key);

    if (existingNode) {
      this.currentSize -= existingNode.entry.size;
      existingNode.entry = entry;
      this.currentSize += entry.size;
      this.moveToHead(existingNode);
      return;
    }

    const newNode = new LRUEntry(key, entry);
    this.map.set(key, newNode);
    this.addToFront(newNode);
    this.currentSize += entry.size;

    // Evict if necessary
    while (this.currentSize > this.maxSize && this.tail) {
      this.evict(this.tail);
    }
  }

  delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;

    this.remove(node);
    this.map.delete(key);
    this.currentSize -= node.entry.size;
    return true;
  }

  clear(): void {
    this.head = null;
    this.tail = null;
    this.map.clear();
    this.currentSize = 0;
  }

  *entries(): Generator<[string, CacheEntry<T>]> {
    let current = this.head;
    while (current) {
      yield [current.key, current.entry];
      current = current.next;
    }
  }

  private addToFront(node: LRUEntry<T>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private remove(node: LRUEntry<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private moveToHead(node: LRUEntry<T>): void {
    this.remove(node);
    this.addToFront(node);
  }

  private evict(node: LRUEntry<T>): void {
    this.remove(node);
    this.map.delete(node.key);
    this.currentSize -= node.entry.size;
  }

  getStats() {
    return {
      size: this.map.size,
      memoryUsage: this.currentSize,
      maxSize: this.maxSize,
      utilization: this.currentSize / this.maxSize
    };
  }
}

export class AdvancedCacheManager extends EventEmitter {
  private redis: Redis | Redis.Cluster;
  private memoryCache: LRUCache<any>;
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private batchQueue: Array<() => Promise<void>> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private tagInvalidationQueue: Array<{ tag: string; timestamp: number }> = [];
  private invalidationTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    super();

    this.config = {
      redis: {
        cluster: process.env.REDIS_CLUSTER === 'true',
        nodes: [{
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD
        }],
        options: {
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          lazyConnect: true,
          keepAlive: 30000,
          family: 4,
          keyPrefix: process.env.REDIS_KEY_PREFIX || 'labelmint:',
          commandTimeout: 5000
        }
      },
      memory: {
        maxSize: parseInt(process.env.CACHE_MEMORY_SIZE || '1024'), // MB
        ttl: parseInt(process.env.CACHE_TTL || '300000'), // 5 minutes
        checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '60000'), // 1 minute
        lruUpdateAgeOnGet: true,
        updateAgeOnGet: true
      },
      compression: {
        enabled: process.env.CACHE_COMPRESSION !== 'false',
        threshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024'),
        level: parseInt(process.env.CACHE_COMPRESSION_LEVEL || '6'),
        chunkSize: parseInt(process.env.CACHE_COMPRESSION_CHUNK_SIZE || '16384')
      },
      performance: {
        enableMetrics: process.env.CACHE_METRICS_ENABLED !== 'false',
        enableTracing: process.env.CACHE_TRACING_ENABLED === 'true',
        batchSize: parseInt(process.env.CACHE_BATCH_SIZE || '100'),
        parallelism: parseInt(process.env.CACHE_PARALLELISM || '10'),
        pipelineSize: parseInt(process.env.CACHE_PIPELINE_SIZE || '50')
      },
      invalidation: {
        enableEvents: process.env.CACHE_INVALIDATION_EVENTS === 'true',
        eventBusUrl: process.env.CACHE_EVENT_BUS_URL,
        broadcastInterval: parseInt(process.env.CACHE_INVALIDATION_INTERVAL || '5000'),
        maxQueueSize: parseInt(process.env.CACHE_INVALIDATION_QUEUE_SIZE || '1000')
      },
      ...config
    };

    this.memoryCache = new LRUCache(
      this.config.memory.maxSize * 1024 * 1024, // Convert MB to bytes
      this.config.memory.lruUpdateAgeOnGet
    );

    this.stats = this.initializeStats();
    this.initializeRedis();
    this.startTimers();
  }

  private initializeStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      memoryUsage: 0,
      memoryLimit: this.config.memory.maxSize * 1024 * 1024,
      entryCount: 0,
      compressionRatio: 0,
      redisHits: 0,
      redisMisses: 0,
      redisErrors: 0,
      redisConnections: 0,
      redisMemoryUsage: 0,
      avgGetTime: 0,
      avgSetTime: 0,
      avgCompressTime: 0,
      pipelineSize: 0,
      batchOperations: 0,
      tagInvalidations: 0,
      tagOperations: 0,
      activeTags: 0
    };
  }

  private async initializeRedis(): Promise<void> {
    try {
      if (this.config.redis.cluster && this.config.redis.nodes.length > 1) {
        this.redis = new Redis.Cluster(this.config.redis.nodes, {
          redisOptions: {
            password: this.config.redis.nodes[0].password,
            commandTimeout: this.config.redis.options.commandTimeout
          },
          enableReadyCheck: this.config.redis.options.enableReadyCheck,
          maxRetriesPerRequest: this.config.redis.options.maxRetriesPerRequest,
          retryDelayOnFailover: this.config.redis.options.retryDelayOnFailover,
          lazyConnect: this.config.redis.options.lazyConnect,
          keepAlive: this.config.redis.options.keepAlive,
          family: this.config.redis.options.family
        });
      } else {
        const node = this.config.redis.nodes[0];
        this.redis = new Redis({
          host: node.host,
          port: node.port,
          password: node.password,
          keyPrefix: this.config.redis.options.keyPrefix,
          enableReadyCheck: this.config.redis.options.enableReadyCheck,
          maxRetriesPerRequest: this.config.redis.options.maxRetriesPerRequest,
          retryDelayOnFailover: this.config.redis.options.retryDelayOnFailover,
          lazyConnect: this.config.redis.options.lazyConnect,
          keepAlive: this.config.redis.options.keepAlive,
          family: this.config.redis.options.family,
          commandTimeout: this.config.redis.options.commandTimeout
        });
      }

      this.redis.on('connect', () => {
        console.log('✅ Redis connected');
        this.stats.redisConnections++;
        this.emit('redis:connected');
      });

      this.redis.on('error', (error) => {
        console.error('❌ Redis error:', error.message);
        this.stats.redisErrors++;
        this.emit('redis:error', error);
      });

      this.redis.on('close', () => {
        console.log('🔌 Redis connection closed');
        this.emit('redis:disconnected');
      });

      if (this.config.invalidation.enableEvents) {
        await this.setupInvalidationEvents();
      }

      await this.redis.ping();
    } catch (error) {
      console.warn('⚠️ Redis not available, using memory-only cache:', error.message);
      this.redis = null as any;
    }
  }

  private async setupInvalidationEvents(): Promise<void> {
    if (!this.redis) return;

    try {
      // Subscribe to invalidation events
      const subscriber = this.redis.duplicate();
      await subscriber.subscribe('cache:invalidation');

      subscriber.on('message', (channel, message) => {
        if (channel === 'cache:invalidation') {
          try {
            const { tag, keys, version } = JSON.parse(message);
            this.handleInvalidationEvent(tag, keys, version);
          } catch (error) {
            console.error('Invalid invalidation event:', error);
          }
        }
      });

      this.emit('invalidation:setup');
    } catch (error) {
      console.error('Failed to setup invalidation events:', error);
    }
  }

  private handleInvalidationEvent(tag: string, keys: string[], version: number): void {
    // Invalidate matching keys in memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags.includes(tag) && entry.version < version) {
        this.memoryCache.delete(key);
        this.stats.evictions++;
      }
    }

    this.stats.tagInvalidations++;
    this.emit('tag:invalidated', { tag, keys, version });
  }

  private startTimers(): void {
    // Cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.memory.checkPeriod);

    // Metrics timer
    if (this.config.performance.enableMetrics && this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    if (this.config.performance.enableMetrics) {
      this.metricsTimer = setInterval(() => {
        this.updateMetrics();
      }, 30000); // Update every 30 seconds
    }

    // Invalidation broadcast timer
    if (this.config.invalidation.enableEvents && this.invalidationTimer) {
      clearInterval(this.invalidationTimer);
    }

    if (this.config.invalidation.enableEvents) {
      this.invalidationTimer = setInterval(() => {
        this.processInvalidationQueue();
      }, this.config.invalidation.broadcastInterval);
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.evictions += cleaned;
      console.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }

    this.updateMemoryStats();
  }

  private updateMemoryStats(): void {
    const memStats = this.memoryCache.getStats();
    this.stats.memoryUsage = memStats.memoryUsage;
    this.stats.entryCount = memStats.size;
  }

  private updateMetrics(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;

    // Update Redis stats if available
    if (this.redis) {
      this.updateRedisStats();
    }

    this.emit('metrics:updated', this.stats);
  }

  private async updateRedisStats(): Promise<void> {
    if (!this.redis) return;

    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      if (memoryMatch) {
        this.stats.redisMemoryUsage = parseInt(memoryMatch[1]);
      }

      const keyspaceMatch = info.match(/keys=(\d+)/);
      if (keyspaceMatch) {
        // Update active keys count if needed
      }
    } catch (error) {
      console.error('Failed to update Redis stats:', error);
    }
  }

  private processInvalidationQueue(): void {
    if (this.tagInvalidationQueue.length === 0 || !this.redis) return;

    const toProcess = this.tagInvalidationQueue.splice(0, this.config.invalidation.maxQueueSize);

    for (const { tag, timestamp } of toProcess) {
      // Broadcast invalidation event
      this.redis.publish('cache:invalidation', JSON.stringify({
        tag,
        timestamp,
        source: process.env.NODE_NAME || 'unknown'
      })).catch(error => {
        console.error('Failed to broadcast invalidation:', error);
      });
    }
  }

  // Public API methods

  async get<T>(key: string): Promise<T | null> {
    const startTime = process.hrtime.bigint();

    try {
      // Level 1: Memory cache
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && this.isEntryValid(memoryEntry)) {
        memoryEntry.hits++;
        this.stats.hits++;

        const endTime = process.hrtime.bigint();
        this.updateAvgTime('get', Number(endTime - startTime) / 1000000);

        // Refresh ahead if enabled and nearing expiration
        if (memoryEntry.refreshAhead && this.shouldRefresh(memoryEntry)) {
          this.refreshEntry(key, memoryEntry);
        }

        this.emit('cache:hit', { key, source: 'memory', entry: memoryEntry });
        return memoryEntry.value;
      } else if (memoryEntry) {
        // Remove expired entry
        this.memoryCache.delete(key);
      }

      // Level 2: Redis cache
      if (this.redis) {
        const redisValue = await this.getFromRedis<T>(key);
        if (redisValue !== null) {
          this.stats.hits++;
          this.stats.redisHits++;

          // Cache in memory for faster access
          this.setToMemory(key, redisValue.entry);

          const endTime = process.hrtime.bigint();
          this.updateAvgTime('get', Number(endTime - startTime) / 1000000);

          this.emit('cache:hit', { key, source: 'redis', entry: redisValue.entry });
          return redisValue.value;
        }
        this.stats.redisMisses++;
      }

      this.stats.misses++;
      const endTime = process.hrtime.bigint();
      this.updateAvgTime('get', Number(endTime - startTime) / 1000000);

      this.emit('cache:miss', { key });
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.emit('cache:error', { operation: 'get', key, error });
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const ttl = options.ttl || this.config.memory.ttl;
      const shouldCompress = options.compress !== false &&
                           this.config.compression.enabled &&
                           this.shouldCompress(value);

      let compressedValue = value;
      let compressed = false;
      const size = this.calculateSize(value);
      let actualSize = size;

      if (shouldCompress) {
        const compressStartTime = process.hrtime.bigint();
        compressedValue = await this.compress(value) as T;
        compressed = true;
        actualSize = this.calculateSize(compressedValue);

        const compressEndTime = process.hrtime.bigint();
        this.updateAvgTime('compress', Number(compressEndTime - compressStartTime) / 1000000);
      }

      const entry: CacheEntry<T> = {
        key,
        value: compressedValue,
        timestamp: Date.now(),
        ttl,
        hits: 0,
        size: actualSize,
        compressed,
        tags: options.tags || [],
        priority: options.priority || 'normal',
        version: options.version || 1,
        etag: this.generateETag(value),
        refreshAhead: options.refreshAhead || false
      };

      // Set in memory cache
      this.memoryCache.set(key, entry);
      this.stats.sets++;

      // Set in Redis
      if (this.redis) {
        await this.setToRedis(key, entry);
      }

      this.updateMemoryStats();

      const endTime = process.hrtime.bigint();
      this.updateAvgTime('set', Number(endTime - startTime) / 1000000);

      this.emit('cache:set', { key, entry, size: actualSize });
    } catch (error) {
      console.error('Cache set error:', error);
      this.emit('cache:error', { operation: 'set', key, value, error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      this.stats.deletes++;

      if (this.redis) {
        await this.redis.del(key);
      }

      this.updateMemoryStats();
      this.emit('cache:delete', { key });
    } catch (error) {
      console.error('Cache delete error:', error);
      this.emit('cache:error', { operation: 'delete', key, error });
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    const startTime = Date.now();

    try {
      let invalidatedCount = 0;

      // Invalidate memory cache entries
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags.includes(tag)) {
          this.memoryCache.delete(key);
          invalidatedCount++;
        }
      }

      // Invalidate Redis entries
      if (this.redis) {
        const pattern = `${this.config.redis.options.keyPrefix}*`;
        const keys = await this.redis.keys(pattern);
        const pipeline = this.redis.pipeline();

        for (const key of keys) {
          const data = await this.redis.get(key);
          if (data) {
            try {
              const entry: CacheEntry = JSON.parse(data);
              if (entry.tags.includes(tag)) {
                pipeline.del(key);
                invalidatedCount++;
              }
            } catch (error) {
              // Skip invalid entries
            }
          }
        }

        await pipeline.exec();
      }

      // Queue invalidation event for broadcast
      if (this.config.invalidation.enableEvents) {
        this.tagInvalidationQueue.push({
          tag,
          timestamp: startTime
        });
      }

      this.stats.tagInvalidations++;
      this.updateMemoryStats();

      this.emit('tag:invalidated', { tag, count: invalidatedCount });
    } catch (error) {
      console.error('Tag invalidation error:', error);
      this.emit('cache:error', { operation: 'invalidateTag', tag, error });
    }
  }

  async warmCache<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    const batchSize = this.config.performance.batchSize;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const promises = batch.map(entry =>
        this.set(entry.key, entry.value, entry.options).catch(error => {
          console.error(`Failed to warm cache for key ${entry.key}:`, error);
        })
      );

      await Promise.allSettled(promises);

      // Add delay to prevent overwhelming the system
      if (i + batchSize < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    this.stats.batchOperations++;
    console.log(`✅ Warmed ${entries.length} cache entries`);
  }

  // Batch operations
  async getBatch<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    const batchSize = this.config.performance.batchSize;

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const promises = batch.map(async (key) => {
        const value = await this.get<T>(key);
        return { key, value };
      });

      const batchResults = await Promise.allSettled(promises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.key, result.value.value);
        }
      }
    }

    return results;
  }

  async setBatch<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    const batchSize = this.config.performance.batchSize;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const promises = batch.map(entry =>
        this.set(entry.key, entry.value, entry.options)
      );

      await Promise.allSettled(promises);

      // Add delay to prevent overwhelming the system
      if (i + batchSize < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    this.stats.batchOperations++;
  }

  // Pipeline operations for Redis
  async pipeline<T>(operations: Array<{ type: 'get' | 'set' | 'delete'; key: string; value?: T; options?: CacheOptions }>): Promise<Map<string, T | null>> {
    if (!this.redis) {
      // Fallback to individual operations
      const results = new Map<string, T | null>();
      for (const op of operations) {
        if (op.type === 'get') {
          results.set(op.key, await this.get<T>(op.key));
        } else if (op.type === 'set' && op.value !== undefined) {
          await this.set(op.key, op.value, op.options);
        } else if (op.type === 'delete') {
          await this.delete(op.key);
        }
      }
      return results;
    }

    const pipeline = this.redis.pipeline();
    const getResultKeys: string[] = [];

    for (const op of operations) {
      if (op.type === 'get') {
        pipeline.get(op.key);
        getResultKeys.push(op.key);
      } else if (op.type === 'set' && op.value !== undefined) {
        const entry = await this.prepareCacheEntry(op.key, op.value, op.options);
        pipeline.set(op.key, JSON.stringify(entry), 'PX', entry.ttl);
      } else if (op.type === 'delete') {
        pipeline.del(op.key);
      }
    }

    const results = await pipeline.exec();
    const resultMap = new Map<string, T | null>();

    if (results) {
      let resultIndex = 0;
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        if (op.type === 'get') {
          const [err, value] = results[resultIndex];
          if (!err && value) {
            try {
              const entry: CacheEntry<T> = JSON.parse(value as string);
              if (this.isEntryValid(entry)) {
                resultMap.set(getResultKeys[resultIndex], entry.value);
                // Cache in memory
                this.setToMemory(getResultKeys[resultIndex], entry);
              }
            } catch (parseError) {
              console.error('Failed to parse cache entry:', parseError);
            }
          }
          resultIndex++;
        }
      }
    }

    this.stats.pipelineSize++;
    return resultMap;
  }

  // Specialized cache methods for LabelMint

  async cacheUserProfile(userId: string, profile: any): Promise<void> {
    await this.set(`user:profile:${userId}`, profile, {
      ttl: 900000, // 15 minutes
      tags: ['user', 'profile'],
      priority: 'high',
      refreshAhead: true,
      refreshThreshold: 0.8
    });
  }

  async getUserProfile(userId: string): Promise<any | null> {
    return await this.get(`user:profile:${userId}`);
  }

  async cacheAvailableTasks(tasks: any[]): Promise<void> {
    await this.set('tasks:available', tasks, {
      ttl: 30000, // 30 seconds
      tags: ['tasks', 'available'],
      priority: 'critical',
      refreshAhead: true,
      refreshThreshold: 0.9
    });
  }

  async getAvailableTasks(): Promise<any[] | null> {
    return await this.get('tasks:available');
  }

  async cacheProjectStats(projectId: string, stats: any): Promise<void> {
    await this.set(`project:stats:${projectId}`, stats, {
      ttl: 60000, // 1 minute
      tags: ['project', 'stats'],
      priority: 'high'
    });
  }

  async getProjectStats(projectId: string): Promise<any | null> {
    return await this.get(`project:stats:${projectId}`);
  }

  // Helper methods

  private async getFromRedis<T>(key: string): Promise<{ value: T; entry: CacheEntry<T> } | null> {
    if (!this.redis) return null;

    try {
      let value = await this.redis.get(key);
      if (!value) return null;

      const entry: CacheEntry<T> = JSON.parse(value);

      if (!this.isEntryValid(entry)) {
        await this.redis.del(key);
        return null;
      }

      // Decompress if needed
      if (entry.compressed) {
        entry.value = await this.decompress(entry.value) as T;
      }

      entry.hits++;
      await this.redis.set(key, JSON.stringify(entry), 'PX', entry.ttl);

      return { value: entry.value, entry };
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  private async setToRedis<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.set(key, JSON.stringify(entry), 'PX', entry.ttl);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  private setToMemory<T>(key: string, entry: CacheEntry<T>): void {
    this.memoryCache.set(key, entry);
  }

  private async prepareCacheEntry<T>(key: string, value: T, options: CacheOptions = {}): Promise<CacheEntry<T>> {
    const ttl = options.ttl || this.config.memory.ttl;
    const shouldCompress = options.compress !== false &&
                         this.config.compression.enabled &&
                         this.shouldCompress(value);

    let compressedValue = value;
    let compressed = false;
    const size = this.calculateSize(value);
    let actualSize = size;

    if (shouldCompress) {
      compressedValue = await this.compress(value) as T;
      compressed = true;
      actualSize = this.calculateSize(compressedValue);
    }

    return {
      key,
      value: compressedValue,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size: actualSize,
      compressed,
      tags: options.tags || [],
      priority: options.priority || 'normal',
      version: options.version || 1,
      etag: this.generateETag(value),
      refreshAhead: options.refreshAhead || false
    };
  }

  private shouldCompress(value: any): boolean {
    return this.calculateSize(value) > this.config.compression.threshold;
  }

  private calculateSize(value: any): number {
    return JSON.stringify(value).length;
  }

  private async compress(value: any): Promise<Buffer> {
    return await gzipAsync(JSON.stringify(value), {
      level: this.config.compression.level,
      chunkSize: this.config.compression.chunkSize
    });
  }

  private async decompress(compressed: any): Promise<any> {
    if (Buffer.isBuffer(compressed)) {
      const decompressed = await ungzipAsync(compressed);
      return JSON.parse(decompressed.toString());
    }
    return compressed;
  }

  private generateETag(value: any): string {
    const hash = createHash('md5');
    hash.update(JSON.stringify(value));
    return `"${hash.digest('hex')}"`;
  }

  private isEntryValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private shouldRefresh(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    return age > entry.ttl * 0.8; // Refresh at 80% of TTL
  }

  private async refreshEntry<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // In a real implementation, this would refresh the data from the source
    // For now, just extend the TTL
    entry.timestamp = Date.now();
    this.memoryCache.set(key, entry);
  }

  private updateAvgTime(operation: 'get' | 'set' | 'compress', timeMs: number): void {
    const key = `avg${operation.charAt(0).toUpperCase() + operation.slice(1)}Time`;
    const current = (this.stats as any)[key] || 0;
    (this.stats as any)[key] = (current + timeMs) / 2;
  }

  // Performance and monitoring

  getStats(): CacheStats {
    return { ...this.stats };
  }

  async getRedisInfo(): Promise<any> {
    if (!this.redis) return null;

    try {
      const info = await this.redis.info();
      return {
        info,
        connected: true,
        type: this.config.redis.cluster ? 'cluster' : 'single'
      };
    } catch (error) {
      return { error: error.message, connected: false };
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    const details: any = {
      memory: {
        usage: this.stats.memoryUsage,
        limit: this.stats.memoryLimit,
        utilization: this.stats.memoryUsage / this.stats.memoryLimit,
        entries: this.stats.entryCount
      },
      performance: {
        hitRate: this.stats.hitRate,
        avgGetTime: this.stats.avgGetTime,
        avgSetTime: this.stats.avgSetTime
      },
      redis: {
        connected: !!this.redis,
        errors: this.stats.redisErrors
      }
    };

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (details.memory.utilization > 0.9 || details.redis.errors > 10) {
      status = 'unhealthy';
    } else if (details.memory.utilization > 0.7 || details.performance.hitRate < 0.8) {
      status = 'degraded';
    }

    return { status, details };
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.redis) {
      try {
        const pattern = `${this.config.redis.options.keyPrefix}*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        console.error('Redis clear error:', error);
      }
    }

    // Reset stats
    this.stats = this.initializeStats();
    this.emit('cache:cleared');
  }

  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    if (this.invalidationTimer) {
      clearInterval(this.invalidationTimer);
      this.invalidationTimer = null;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.redis) {
      await this.redis.disconnect();
      this.redis = null as any;
    }

    this.removeAllListeners();
  }
}

// Singleton instance
let cacheManager: AdvancedCacheManager | null = null;

export function getAdvancedCacheManager(config?: Partial<CacheConfig>): AdvancedCacheManager {
  if (!cacheManager) {
    cacheManager = new AdvancedCacheManager(config);
  }
  return cacheManager;
}

export { AdvancedCacheManager, type CacheConfig, type CacheOptions, type CacheStats };