import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { createHash } from 'crypto';
import { logger } from '../../utils/logger';
import securityConfig from '../../config/security';

export interface PerformanceMetrics {
  requestId: string;
  method: string;
  url: string;
  path: string;
  query: any;
  statusCode: number;
  responseTime: number;
  contentLength: number;
  userAgent: string;
  ip: string;
  timestamp: number;
  cacheHit: boolean;
  compressionEnabled: boolean;
  httpVersion: string;
  endpoint?: string;
  service?: string;
  userId?: string;
  apiKeyId?: string;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache size in MB
  keyPrefix: string;
  compressionEnabled: boolean;
  varyHeaders: string[];
  skipCache: (req: Request) => boolean;
  cacheKeyGenerator: (req: Request) => string;
}

export interface CompressionConfig {
  enabled: boolean;
  threshold: number; // Minimum size to compress in bytes
  level: number; // Compression level (1-9)
  chunkSize: number;
  windowBits: number;
  memLevel: number;
}

export interface PerformanceConfig {
  cache: CacheConfig;
  compression: CompressionConfig;
  enableMetrics: boolean;
  enableTracing: boolean;
  enableOptimization: boolean;
  responseTimeThresholds: {
    warning: number; // ms
    critical: number; // ms
  };
}

class PerformanceMiddleware {
  private config: PerformanceConfig;
  private cache: Map<string, { data: any; timestamp: number; etag?: string }> = new Map();
  private metrics: PerformanceMetrics[] = [];
  private metricsSize = 0;

  constructor() {
    this.config = {
      cache: {
        enabled: process.env.CACHE_ENABLED === 'true',
        ttl: parseInt(process.env.CACHE_TTL || '300'), // 5 minutes
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '100'), // 100MB
        keyPrefix: process.env.CACHE_KEY_PREFIX || 'api_cache:',
        compressionEnabled: process.env.CACHE_COMPRESSION === 'true',
        varyHeaders: ['Accept-Encoding', 'Accept-Language', 'Authorization'],
        skipCache: (req: Request) => {
          // Skip cache for non-GET requests
          if (req.method !== 'GET') return true;

          // Skip cache for authenticated requests unless explicitly allowed
          if ((req as any).user && !req.url.includes('/public/')) return true;

          // Skip cache for requests with cache-control: no-cache
          if (req.get('Cache-Control')?.includes('no-cache')) return true;

          return false;
        },
        cacheKeyGenerator: (req: Request) => {
          const elements = [
            req.method,
            req.url,
            JSON.stringify(req.query),
            // Include relevant headers that affect response
            ...this.config.cache.varyHeaders.map(header => req.get(header) || '')
          ];
          const keyString = elements.join('|');
          return this.config.cache.keyPrefix + createHash('md5').update(keyString).digest('hex');
        }
      },
      compression: {
        enabled: process.env.COMPRESSION_ENABLED !== 'false',
        threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024'), // 1KB
        level: parseInt(process.env.COMPRESSION_LEVEL || '6'),
        chunkSize: parseInt(process.env.COMPRESSION_CHUNK_SIZE || '16384'),
        windowBits: parseInt(process.env.COMPRESSION_WINDOW_BITS || '15'),
        memLevel: parseInt(process.env.COMPRESSION_MEM_LEVEL || '8')
      },
      enableMetrics: process.env.PERFORMANCE_METRICS_ENABLED !== 'false',
      enableTracing: process.env.PERFORMANCE_TRACING_ENABLED === 'true',
      enableOptimization: process.env.PERFORMANCE_OPTIMIZATION_ENABLED !== 'false',
      responseTimeThresholds: {
        warning: parseInt(process.env.PERFORMANCE_WARNING_THRESHOLD || '500'), // 500ms
        critical: parseInt(process.env.PERFORMANCE_CRITICAL_THRESHOLD || '2000') // 2s
      }
    };

    // Start cache cleanup interval
    if (this.config.cache.enabled) {
      setInterval(() => this.cleanupCache(), 60000); // Clean every minute
    }

    // Start metrics cleanup interval
    if (this.config.enableMetrics) {
      setInterval(() => this.cleanupMetrics(), 300000); // Clean every 5 minutes
    }
  }

  /**
   * Cache middleware
   */
  cacheMiddleware() {
    if (!this.config.cache.enabled) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      // Skip cache based on configuration
      if (this.config.cache.skipCache(req)) {
        return next();
      }

      const cacheKey = this.config.cache.cacheKeyGenerator(req);
      const cached = this.cache.get(cacheKey);

      if (cached && this.isCacheValid(cached)) {
        // Set cache headers
        const age = Math.floor((Date.now() - cached.timestamp) / 1000);
        const maxAge = this.config.cache.ttl - age;

        res.set({
          'Cache-Control': `public, max-age=${maxAge}`,
          'X-Cache': 'HIT',
          'X-Cache-Age': age.toString(),
          'ETag': cached.etag || this.generateETag(cached.data)
        });

        // Check if client has fresh cache
        const clientETag = req.get('If-None-Match');
        if (clientETag && clientETag === cached.etag) {
          return res.status(304).end();
        }

        // Send cached response
        res.set('Content-Type', 'application/json');
        return res.json(cached.data);
      }

      // Mark as cache miss
      res.set('X-Cache', 'MISS');

      // Override res.json to cache response
      const originalJson = res.json;
      res.json = function(this: Response, data: any) {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cacheData = {
            data,
            timestamp: Date.now(),
            etag: this.generateETag(data)
          };

          // Store in cache (with size management)
          if (this.cache.size < this.getMaxCacheEntries()) {
            this.cache.set(cacheKey, cacheData);
          }
        }

        return originalJson.call(this, data);
      }.bind({ cache: this.cache, generateETag: this.generateETag.bind(this), getMaxCacheEntries: this.getMaxCacheEntries.bind(this) });

      next();
    };
  }

  /**
   * Performance metrics middleware
   */
  metricsMiddleware() {
    if (!this.config.enableMetrics) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      const requestId = this.generateRequestId();

      // Add request ID to response headers
      res.set('X-Request-ID', requestId);

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]) {
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);

        const metrics: PerformanceMetrics = {
          requestId,
          method: req.method,
          url: req.url,
          path: req.path,
          query: req.query,
          statusCode: res.statusCode,
          responseTime,
          contentLength: parseInt(res.get('Content-Length') || '0'),
          userAgent: req.get('User-Agent') || '',
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          timestamp: Date.now(),
          cacheHit: res.get('X-Cache') === 'HIT',
          compressionEnabled: res.get('Content-Encoding') === 'gzip',
          httpVersion: req.httpVersion,
          endpoint: (req as any).route?.path,
          service: (req as any).service,
          userId: (req as any).user?.id,
          apiKeyId: (req as any).apiKey?.id
        };

        // Store metrics
        this.addMetrics(metrics);

        // Log based on performance thresholds
        if (responseTime > this.config.responseTimeThresholds.critical) {
          logger.error('Critical response time detected', {
            ...metrics,
            threshold: this.config.responseTimeThresholds.critical
          });
        } else if (responseTime > this.config.responseTimeThresholds.warning) {
          logger.warn('Slow response time detected', {
            ...metrics,
            threshold: this.config.responseTimeThresholds.warning
          });
        }

        // Set performance headers
        res.set({
          'X-Response-Time': `${responseTime}ms`,
          'X-Server-Timing': `total;dur=${responseTime}`
        });

        originalEnd.apply(this, args);
      }.bind({ addMetrics: this.addMetrics.bind(this) });

      next();
    };
  }

  /**
   * Response optimization middleware
   */
  optimizationMiddleware() {
    if (!this.config.enableOptimization) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      // Set optimization headers
      res.set({
        // Connection optimization
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5, max=1000',

        // HTTP/2 push hints (if supported)
        'X-Content-Type-Options': 'nosniff',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none',

        // Performance hints
        'X-DNS-Prefetch-Control': 'on'
      });

      // Optimize based on request type
      if (req.accepts('json')) {
        // JSON optimization
        res.set('Content-Type', 'application/json; charset=utf-8');
      }

      // Add preconnect hints for external resources
      const preconnectHints = [];
      if (req.url.includes('/api/')) {
        preconnectHints.push('</api>; rel=preconnect');
      }

      if (preconnectHints.length > 0) {
        res.set('Link', preconnectHints.join(', '));
      }

      next();
    };
  }

  /**
   * HTTP/2 and HTTP/3 optimization middleware
   */
  protocolOptimizationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const httpVersion = req.httpVersion;

      // HTTP/2 optimizations
      if (httpVersion.startsWith('2.')) {
        // Server push for critical resources
        if (req.path.startsWith('/api/')) {
          res.set('Link', '</docs>; rel=preload; as=document');
        }

        // Prioritize API responses
        res.set('X-Priority': 'u=1');
      }

      // HTTP/3 optimizations (when available)
      if (httpVersion.startsWith('3.')) {
        res.set('X-QUIC': 'available');
      }

      next();
    };
  }

  /**
   * Resource hints middleware
   */
  resourceHintsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const hints = [];

      // Add DNS prefetch for external services
      if (req.url.includes('/api/v1/payment')) {
        hints.push('</ton.org>; rel=dns-prefetch');
        hints.push('</stripe.com>; rel=dns-prefetch');
      }

      // Add preconnect for API endpoints
      if (req.url.includes('/api/')) {
        hints.push('</api>; rel=preconnect');
      }

      // Add preload for critical resources
      if (req.path === '/' || req.path === '/health') {
        hints.push('</api/v1/status>; rel=preload; as=fetch');
      }

      if (hints.length > 0) {
        res.set('Link', hints.join(', '));
      }

      next();
    };
  }

  /**
   * Helper methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateETag(data: any): string {
    const hash = createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `"${hash}"`;
  }

  private isCacheValid(cached: any): boolean {
    const age = Date.now() - cached.timestamp;
    return age < (this.config.cache.ttl * 1000);
  }

  private getMaxCacheEntries(): number {
    // Convert MB to approximate number of entries (assuming 1KB per entry)
    return (this.config.cache.maxSize * 1024 * 1024) / 1024;
  }

  private cleanupCache(): void {
    const now = Date.now();
    const maxAge = this.config.cache.ttl * 1000;
    let cleaned = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > maxAge) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }

    // Remove oldest entries if cache is too large
    if (this.cache.size > this.getMaxCacheEntries()) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.length - this.getMaxCacheEntries();
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }

      logger.debug(`Cache cleanup: removed ${toRemove} old entries due to size limit`);
    }
  }

  private addMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    this.metricsSize += JSON.stringify(metrics).length;

    // Keep metrics size manageable
    if (this.metricsSize > 50 * 1024 * 1024) { // 50MB
      this.cleanupMetrics();
    }
  }

  private cleanupMetrics(): void {
    // Keep only the last 10000 metrics
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
      this.metricsSize = this.metrics.reduce((size, metric) =>
        size + JSON.stringify(metric).length, 0);
    }

    // Remove metrics older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const filtered = this.metrics.filter(metric => metric.timestamp > oneHourAgo);

    if (filtered.length < this.metrics.length) {
      const removed = this.metrics.length - filtered.length;
      this.metrics = filtered;
      this.metricsSize = this.metrics.reduce((size, metric) =>
        size + JSON.stringify(metric).length, 0);
      logger.debug(`Metrics cleanup: removed ${removed} old entries`);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): any {
    if (this.metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        compressionRate: 0
      };
    }

    const totalRequests = this.metrics.length;
    const responseTimes = this.metrics.map(m => m.responseTime);
    const cacheHits = this.metrics.filter(m => m.cacheHit).length;
    const errors = this.metrics.filter(m => m.statusCode >= 400).length;
    const compressed = this.metrics.filter(m => m.compressionEnabled).length;

    // Calculate percentiles
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

    // Calculate by endpoint
    const byEndpoint = this.metrics.reduce((acc, metric) => {
      const endpoint = metric.endpoint || 'unknown';
      if (!acc[endpoint]) {
        acc[endpoint] = {
          count: 0,
          totalResponseTime: 0,
          errors: 0,
          cacheHits: 0
        };
      }
      acc[endpoint].count++;
      acc[endpoint].totalResponseTime += metric.responseTime;
      if (metric.statusCode >= 400) acc[endpoint].errors++;
      if (metric.cacheHit) acc[endpoint].cacheHits++;
      return acc;
    }, {} as any);

    // Calculate averages for each endpoint
    Object.keys(byEndpoint).forEach(endpoint => {
      const stats = byEndpoint[endpoint];
      stats.averageResponseTime = stats.totalResponseTime / stats.count;
      stats.errorRate = stats.errors / stats.count;
      stats.cacheHitRate = stats.cacheHits / stats.count;
    });

    return {
      totalRequests,
      timeRange: {
        start: this.metrics[0]?.timestamp,
        end: this.metrics[this.metrics.length - 1]?.timestamp
      },
      responseTime: {
        average: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        p50,
        p95,
        p99
      },
      rates: {
        cacheHitRate: cacheHits / totalRequests,
        errorRate: errors / totalRequests,
        compressionRate: compressed / totalRequests
      },
      cache: {
        enabled: this.config.cache.enabled,
        size: this.cache.size,
        maxSize: this.getMaxCacheEntries(),
        ttl: this.config.cache.ttl
      },
      byEndpoint,
      recentErrors: this.metrics
        .filter(m => m.statusCode >= 400)
        .slice(-10)
        .map(m => ({
          url: m.url,
          statusCode: m.statusCode,
          responseTime: m.responseTime,
          timestamp: m.timestamp,
          requestId: m.requestId
        }))
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    if (!this.config.cache.enabled) {
      return { enabled: false };
    }

    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    const validEntries = entries.filter(([_, cached]) => this.isCacheValid(cached));
    const expiredEntries = entries.length - validEntries.length;

    return {
      enabled: true,
      totalEntries: entries.length,
      validEntries: validEntries.length,
      expiredEntries,
      hitRate: this.getPerformanceStats().rates.cacheHitRate,
      ttl: this.config.cache.ttl,
      maxSize: this.getMaxCacheEntries(),
      memoryUsage: this.metricsSize,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(([_, cached]) => cached.timestamp)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(([_, cached]) => cached.timestamp)) : null
    };
  }
}

export default PerformanceMiddleware;