/**
 * Caching Middleware
 * Integrates with Redis cache for response caching
 */

import cacheManager from '../services/cache/CacheManager';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

export interface CacheOptions {
  ttl?: number;
  key?: string;
  vary?: string[];
  tags?: string[];
  skipIf?: (req: Request) => boolean;
  condition?: (req: Request) => boolean;
}

/**
 * Response caching middleware
 */
export function cacheResponse(options: CacheOptions = {}) {
  const {
    ttl = 300, // 5 minutes default
    key,
    vary = ['Accept', 'Accept-Encoding'],
    tags = [],
    skipIf,
    condition = (req) => req.method === 'GET'
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if condition is not met
    if (!condition(req)) {
      return next();
    }

    // Skip if skipIf condition is met
    if (skipIf && skipIf(req)) {
      return next();
    }

    // Generate cache key
    const cacheKey = key || generateCacheKey(req, vary);

    try {
      // Try to get cached response
      const cached = await cacheManager.get(cacheKey);

      if (cached) {
        // Serve from cache
        res.set(cached.headers);
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        return res.send(cached.body);
      }

      // Intercept response to cache it
      const originalSend = res.send;
      const originalWrite = res.write;
      const chunks: Buffer[] = [];
      let statusCode: number;
      let headers: Record<string, string> = {};

      res.write = function(chunk: any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      };

      res.send = function(data: any) {
        // Only cache successful responses
        if (statusCode === 200 || statusCode === 201) {
          const body = Buffer.concat(chunks).length > 0
            ? Buffer.concat(chunks).toString()
            : data;

          // Prepare cache entry
          const cacheEntry = {
            headers: res.getHeaders(),
            body,
            statusCode,
            timestamp: Date.now()
          };

          // Cache the response
          cacheManager.set(cacheKey, cacheEntry, {
            ttl,
            tags,
            compress: body.length > 1024
          });

          res.set('X-Cache', 'MISS');
          res.set('X-Cache-Key', cacheKey);
        }

        return originalSend.call(this, data);
      };

      // Capture status code
      const originalStatus = res.status;
      res.status = function(code: number) {
        statusCode = code;
        return originalStatus.call(this, code);
      };

      // Capture headers
      const originalSet = res.set;
      res.set = function(...args: any[]) {
        const result = originalSet.apply(this, args);
        headers = res.getHeaders() as Record<string, string>;
        return result;
      };

    } catch (error) {
      console.error('Cache middleware error:', error);
    }

    next();
  };
}

/**
 * API response caching middleware
 */
export function cacheApiResponse(ttl: number = 300, tags: string[] = []) {
  return cacheResponse({
    ttl,
    tags: ['api', ...tags],
    condition: (req) => req.method === 'GET' && req.path.startsWith('/api/'),
    skipIf: (req) => {
      // Skip caching if user is authenticated and data is user-specific
      return !!req.headers.authorization;
    }
  });
}

/**
 * Static asset caching middleware
 */
export function cacheStaticAssets(ttl: number = 31536000) {
  return cacheResponse({
    ttl,
    tags: ['static'],
    condition: (req) => req.path.startsWith('/assets/') || req.path.startsWith('/static/'),
    vary: ['Accept-Encoding']
  });
}

/**
 * Page caching middleware
 */
export function cachePage(ttl: number = 60) {
  return cacheResponse({
    ttl,
    tags: ['page'],
    condition: (req) => {
      // Only cache GET requests that don't have query parameters
      return req.method === 'GET' &&
             !req.path.startsWith('/api/') &&
             Object.keys(req.query).length === 0;
    },
    skipIf: (req) => {
      // Skip if user is logged in
      return !!(req as any).user;
    }
  });
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(tags: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.send;

    res.send = async function(data: any) {
      // Invalidate cache on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await cacheManager.invalidateByTags(tags);
          res.set('X-Cache-Invalidated', tags.join(','));
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Cache busting middleware
 */
export function cacheBuster() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Add cache busting headers for development
    if (process.env.NODE_ENV === 'development') {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }

    // Add ETag for conditional requests
    const etag = generateETag(req);
    res.set('ETag', etag);

    // Handle If-None-Match
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    next();
  };
}

/**
 * Query result caching decorator
 */
export function cacheQuery(ttl: number = 600, tags: string[] = []) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const cacheKey = `query:${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      try {
        const cached = await cacheManager.get(cacheKey);
        if (cached !== null) {
          return cached;
        }

        const result = await method.apply(this, args);

        await cacheManager.set(cacheKey, result, {
          ttl,
          tags: ['query', ...tags]
        });

        return result;
      } catch (error) {
        console.error('Query cache error:', error);
        return method.apply(this, args);
      }
    };
  };
}

/**
 * Service method caching decorator
 */
export function cacheService(ttl: number = 300, keyPrefix?: string) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const prefix = keyPrefix || `${target.constructor.name}`;
      const cacheKey = `${prefix}:${propertyName}:${hashArgs(args)}`;

      return cacheManager.getOrSet(cacheKey, () => {
        return method.apply(this, args);
      }, { ttl });
    };
  };
}

/**
 * Helper functions
 */

function generateCacheKey(req: Request, vary: string[]): string {
  const parts = [
    req.method,
    req.path,
    ...vary.map(header => req.headers[header.toLowerCase()] || ''),
    JSON.stringify(req.query)
  ];

  return createHash('md5')
    .update(parts.join('|'))
    .digest('hex');
}

function generateETag(req: Request): string {
  const data = JSON.stringify({
    url: req.url,
    method: req.method,
    query: req.query,
    headers: req.headers
  });

  return `"${createHash('sha256').update(data).digest('hex').substring(0, 16)}"`;
}

function hashArgs(args: any[]): string {
  return createHash('md5')
    .update(JSON.stringify(args))
    .digest('hex');
}

/**
 * Cache warming service
 */
export class CacheWarmer {
  private static instance: CacheWarmer;
  private warmupJobs: Map<string, () => Promise<any>> = new Map();

  static getInstance(): CacheWarmer {
    if (!CacheWarmer.instance) {
      CacheWarmer.instance = new CacheWarmer();
    }
    return CacheWarmer.instance;
  }

  addJob(key: string, fn: () => Promise<any>): void {
    this.warmupJobs.set(key, fn);
  }

  async warmAll(): Promise<void> {
    const jobs = Array.from(this.warmupJobs.entries());

    for (const [key, fn] of jobs) {
      try {
        const start = performance.now();
        await fn();
        const duration = performance.now() - start;
        console.log(`Cache warmed: ${key} (${duration.toFixed(2)}ms)`);
      } catch (error) {
        console.error(`Cache warming failed for ${key}:`, error);
      }
    }
  }

  async warmJob(key: string): Promise<void> {
    const job = this.warmupJobs.get(key);
    if (job) {
      await job();
    }
  }

  clearJobs(): void {
    this.warmupJobs.clear();
  }
}

export const cacheWarmer = CacheWarmer.getInstance();