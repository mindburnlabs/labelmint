// ============================================================================
// CACHE UTILITIES
// ============================================================================

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string
  tags?: string[]
  compression?: boolean
}

export interface CacheEntry<T = any> {
  key: string
  value: T
  expiresAt: number
  createdAt: number
  accessCount: number
  lastAccessedAt: number
  tags: string[]
}

export interface ICacheProvider {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>
  delete(key: string): Promise<void>
  clear(pattern?: string): Promise<void>
  has(key: string): Promise<boolean>
  ttl(key: string): Promise<number>
  keys(pattern?: string): Promise<string[]>
}

// ============================================================================
// REDIS CACHE PROVIDER
// ============================================================================

export class RedisCacheProvider implements ICacheProvider {
  private redis: any // Redis client
  private defaultPrefix: string
  private defaultTtl: number

  constructor(redis: any, options: { prefix?: string; defaultTtl?: number } = {}) {
    this.redis = redis
    this.defaultPrefix = options.prefix || 'cache:'
    this.defaultTtl = options.defaultTtl || 3600 // 1 hour
  }

  private getKey(key: string): string {
    return `${this.defaultPrefix}${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getKey(key)
      const value = await this.redis.get(fullKey)

      if (!value) return null

      const entry: CacheEntry<T> = JSON.parse(value)

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        await this.delete(key)
        return null
      }

      // Update access statistics
      entry.accessCount++
      entry.lastAccessedAt = Date.now()
      await this.redis.setex(fullKey, Math.ceil((entry.expiresAt - Date.now()) / 1000), JSON.stringify(entry))

      return entry.value
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.getKey(key)
      const ttl = options.ttl || this.defaultTtl
      const expiresAt = Date.now() + (ttl * 1000)

      const entry: CacheEntry<T> = {
        key,
        value,
        expiresAt,
        createdAt: Date.now(),
        accessCount: 0,
        lastAccessedAt: Date.now(),
        tags: options.tags || []
      }

      await this.redis.setex(fullKey, ttl, JSON.stringify(entry))

      // Store tag mappings if tags are provided
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          const tagKey = `${this.defaultPrefix}tag:${tag}`
          await this.redis.sadd(tagKey, fullKey)
          await this.redis.expire(tagKey, ttl)
        }
      }
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getKey(key)
      await this.redis.del(fullKey)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        const keys = await this.keys(pattern)
        if (keys.length > 0) {
          await this.redis.del(...keys.map(k => this.getKey(k)))
        }
      } else {
        // Clear all with default prefix
        const keys = await this.redis.keys(`${this.defaultPrefix}*`)
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      }
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const value = await this.get(key)
      return value !== null
    } catch (error) {
      console.error('Cache has error:', error)
      return false
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getKey(key)
      return await this.redis.ttl(fullKey)
    } catch (error) {
      console.error('Cache TTL error:', error)
      return -1
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    try {
      const searchPattern = pattern ? `${this.defaultPrefix}${pattern}` : `${this.defaultPrefix}*`
      const keys = await this.redis.keys(searchPattern)
      return keys.map(k => k.replace(this.defaultPrefix, ''))
    } catch (error) {
      console.error('Cache keys error:', error)
      return []
    }
  }

  async invalidateTag(tag: string): Promise<void> {
    try {
      const tagKey = `${this.defaultPrefix}tag:${tag}`
      const keys = await this.redis.smembers(tagKey)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
      await this.redis.del(tagKey)
    } catch (error) {
      console.error('Cache tag invalidation error:', error)
    }
  }
}

// ============================================================================
// MEMORY CACHE PROVIDER (for development/testing)
// ============================================================================

export class MemoryCacheProvider implements ICacheProvider {
  private cache = new Map<string, CacheEntry>()
  private tagMap = new Map<string, Set<string>>()
  private defaultTtl: number
  private cleanupInterval: NodeJS.Timeout

  constructor(defaultTtl: number = 3600) {
    this.defaultTtl = defaultTtl
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000) // Cleanup every minute
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  private getFullKey(key: string): string {
    return key
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(this.getFullKey(key))
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    entry.accessCount++
    entry.lastAccessedAt = Date.now()
    return entry.value
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.defaultTtl
    const fullKey = this.getFullKey(key)

    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt: Date.now() + (ttl * 1000),
      createdAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now(),
      tags: options.tags || []
    }

    this.cache.set(fullKey, entry)

    // Store tag mappings
    if (options.tags) {
      for (const tag of options.tags) {
        if (!this.tagMap.has(tag)) {
          this.tagMap.set(tag, new Set())
        }
        this.tagMap.get(tag)!.add(fullKey)
      }
    }
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key)
    const entry = this.cache.get(fullKey)
    if (entry) {
      // Remove from tag mappings
      for (const tag of entry.tags) {
        const tagSet = this.tagMap.get(tag)
        if (tagSet) {
          tagSet.delete(fullKey)
          if (tagSet.size === 0) {
            this.tagMap.delete(tag)
          }
        }
      }
    }
    this.cache.delete(fullKey)
  }

  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      for (const [key] of this.cache) {
        if (regex.test(key)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
      this.tagMap.clear()
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(this.getFullKey(key))
    if (!entry) return -1
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000))
  }

  async keys(pattern?: string): Promise<string[]> {
    if (pattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return Array.from(this.cache.keys()).filter(key => regex.test(key))
    }
    return Array.from(this.cache.keys())
  }

  async invalidateTag(tag: string): Promise<void> {
    const keys = this.tagMap.get(tag)
    if (keys) {
      for (const key of keys) {
        this.cache.delete(key)
      }
      this.tagMap.delete(tag)
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

// ============================================================================
// CACHE MANAGER
// ============================================================================

export class CacheManager {
  private provider: ICacheProvider

  constructor(provider: ICacheProvider) {
    this.provider = provider
  }

  // Wrapper methods with type safety
  async get<T>(key: string): Promise<T | null> {
    return this.provider.get<T>(key)
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    return this.provider.set<T>(key, value, options)
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    let value = await this.get<T>(key)

    if (value === null) {
      value = await factory()
      await this.set(key, value, options)
    }

    return value
  }

  async delete(key: string): Promise<void> {
    return this.provider.delete(key)
  }

  async clear(pattern?: string): Promise<void> {
    return this.provider.clear(pattern)
  }

  async has(key: string): Promise<boolean> {
    return this.provider.has(key)
  }

  async ttl(key: string): Promise<number> {
    return this.provider.ttl(key)
  }

  async keys(pattern?: string): Promise<string[]> {
    return this.provider.keys(pattern)
  }

  async invalidateTag(tag: string): Promise<void> {
    if ('invalidateTag' in this.provider) {
      return (this.provider as any).invalidateTag(tag)
    }
  }

  // Cache helpers
  async invalidateUserCache(userId: string): Promise<void> {
    await this.clear(`user:${userId}:*`)
    await this.invalidateTag(`user:${userId}`)
  }

  async invalidateProjectCache(projectId: string): Promise<void> {
    await this.clear(`project:${projectId}:*`)
    await this.invalidateTag(`project:${projectId}`)
  }

  async cacheApiResponse<T>(
    key: string,
    data: T,
    ttl: number = 300 // 5 minutes default
  ): Promise<void> {
    await this.set(key, data, { ttl, tags: ['api'] })
  }

  async getCachedApiResponse<T>(key: string): Promise<T | null> {
    return this.get<T>(key)
  }
}

// ============================================================================
// CACHE DECORATORS
// ============================================================================

export function cached(options: CacheOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`

      // Try to get from cache first
      if (this.cache) {
        const cached = await this.cache.get(cacheKey)
        if (cached !== null) {
          return cached
        }
      }

      // Execute method and cache result
      const result = await method.apply(this, args)

      if (this.cache) {
        await this.cache.set(cacheKey, result, options)
      }

      return result
    }
  }
}

export function invalidateCache(pattern: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args)

      if (this.cache) {
        await this.cache.clear(pattern)
      }

      return result
    }
  }
}