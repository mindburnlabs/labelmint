import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
  timestamp: number;
}

class PerformanceMiddleware {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 10000; // Keep last 10,000 requests

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = performance.now();
      const requestId = this.generateRequestId();

      // Add request ID to response headers
      res.setHeader('X-Request-ID', requestId);

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]): void {
        const endTime = performance.now();
        const duration = endTime - startTime;

        const metrics: PerformanceMetrics = {
          requestId,
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip || req.connection.remoteAddress,
          userId: (req as any).user?.id,
          timestamp: Date.now()
        };

        // Store metrics
        this.storeMetrics(metrics);

        // Add performance headers
        res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
        res.setHeader('X-Server-Timestamp', Date.now().toString());

        // Log slow requests
        if (duration > 200) {
          console.warn('Slow request detected:', {
            requestId,
            method: req.method,
            url: req.originalUrl,
            duration: `${duration.toFixed(2)}ms`,
            statusCode: res.statusCode
          });
        }

        // Call original end
        originalEnd.apply(this, args);
      }.bind(res);

      next();
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private storeMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getMetricsSummary(timeWindowMs: number = 300000): PerformanceSummary {
    const now = Date.now();
    const windowStart = now - timeWindowMs;

    const recentMetrics = this.metrics.filter(m => m.timestamp >= windowStart);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        requestsPerSecond: 0,
        timeWindowMs
      };
    }

    const durations = recentMetrics.map(m => m.duration).sort((a, b) => a - b);
    const errors = recentMetrics.filter(m => m.statusCode >= 400);

    return {
      totalRequests: recentMetrics.length,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95ResponseTime: this.percentile(durations, 0.95),
      p99ResponseTime: this.percentile(durations, 0.99),
      errorRate: (errors.length / recentMetrics.length) * 100,
      requestsPerSecond: recentMetrics.length / (timeWindowMs / 1000),
      timeWindowMs
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }
}

interface PerformanceSummary {
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  requestsPerSecond: number;
  timeWindowMs: number;
}

export const performanceMiddleware = new PerformanceMiddleware();
export type { PerformanceMetrics, PerformanceSummary };