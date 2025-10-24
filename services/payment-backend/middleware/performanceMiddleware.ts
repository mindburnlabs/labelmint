/**
 * Performance Monitoring Middleware
 * Tracks request performance and metrics
 */

import performanceMonitoring from '../services/monitoring/PerformanceMonitoringService';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface PerformanceRequest extends Request {
  id: string;
  startTime: number;
}

/**
 * Middleware to track HTTP request performance
 */
export function performanceTracker(req: PerformanceRequest, res: Response, next: NextFunction): void {
  // Generate unique request ID
  req.id = randomUUID();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);

  // Track response finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    // Record metrics
    performanceMonitoring.recordRequest({
      method: req.method,
      path: req.route?.path || req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id,
      timestamp: new Date()
    });

    // Add performance headers
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Process-Time', process.uptime().toFixed(3));
  });

  next();
}

/**
 * Middleware to add performance headers
 */
export function performanceHeaders(req: Request, res: Response, next: NextFunction): void {
  // Cache control headers
  if (req.path.startsWith('/api/')) {
    // API endpoints - no caching by default
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (req.path.startsWith('/assets/')) {
    // Static assets - long cache
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // Performance hints
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('X-DNS-Prefetch-Control', 'on');

  next();
}

/**
 * Middleware to track slow requests
 */
export function slowRequestTracker(threshold: number = 1000) {
  return (req: PerformanceRequest, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      if (duration > threshold) {
        console.warn(`[SLOW REQUEST] ${req.method} ${req.path} - ${duration}ms`, {
          id: req.id,
          method: req.method,
          path: req.path,
          duration,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      }
    });

    next();
  };
}

/**
 * Memory usage monitoring middleware
 */
export function memoryMonitor(req: Request, res: Response, next: NextFunction): void {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100;
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100;

  // Add memory usage headers in development
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('X-Memory-Used', `${heapUsedMB}MB`);
    res.setHeader('X-Memory-Total', `${heapTotalMB}MB`);
  }

  // Warn if memory usage is high
  if (heapUsedMB > 500) {
    console.warn(`[HIGH MEMORY] ${heapUsedMB}MB used on ${req.method} ${req.path}`);
  }

  next();
}

/**
 * Database query performance tracking
 */
export function dbQueryTracker(queryType: string, table: string) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor): void => {
    const method = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const start = Date.now();
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - start;

        // Record query performance
        performanceMonitoring.recordDBQuery(queryType, table, duration);

        return result;
      } catch (error) {
        const duration = Date.now() - start;

        // Record failed query
        performanceMonitoring.recordDBQuery(queryType, table, duration);

        throw error;
      }
    };
  };
}

/**
 * Custom performance metrics decorator
 */
export function trackPerformance(metricName: string, labels?: Record<string, string>) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor): void => {
    const method = descriptor.value;

    descriptor.value = function(...args: any[]) {
      const start = Date.now();

      try {
        const result = method.apply(this, args);

        if (result instanceof Promise) {
          return result.then((value) => {
            const duration = Date.now() - start;
            performanceMonitoring.recordCustomMetric(metricName, duration, labels);
            return value;
          }).catch((error) => {
            const duration = Date.now() - start;
            performanceMonitoring.recordCustomMetric(metricName, duration, { ...labels, error: 'true' });
            throw error;
          });
        } else {
          const duration = Date.now() - start;
          performanceMonitoring.recordCustomMetric(metricName, duration, labels);
          return result;
        }
      } catch (error) {
        const duration = Date.now() - start;
        performanceMonitoring.recordCustomMetric(metricName, duration, { ...labels, error: 'true' });
        throw error;
      }
    };
  };
}