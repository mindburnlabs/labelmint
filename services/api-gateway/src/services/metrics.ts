import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { APIUsage } from '@types/index';
import { logger } from '@utils/logger';

class MetricsCollector {
  private initialized = false;
  private register: client.Registry;
  private httpRequestDuration: client.Histogram<string>;
  private httpRequestTotal: client.Counter<string>;
  private httpErrorsTotal: client.Counter<string>;
  private activeConnections: client.Gauge<string>;
  private requestSizes: client.Histogram<string>;
  private responseSizes: client.Histogram<string>;

  constructor() {
    this.register = new client.Registry();

    // Add default metrics
    client.collectDefaultMetrics({ register: this.register });

    // Create custom metrics
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
    });

    this.httpRequestTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service']
    });

    this.httpErrorsTotal = new client.Counter({
      name: 'http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'route', 'status_code', 'service', 'error_type']
    });

    this.activeConnections = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active connections'
    });

    this.requestSizes = new client.Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000]
    });

    this.responseSizes = new client.Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [100, 1000, 10000, 100000, 1000000]
    });

    // Register metrics
    this.register.registerMetric(this.httpRequestDuration);
    this.register.registerMetric(this.httpRequestTotal);
    this.register.registerMetric(this.httpErrorsTotal);
    this.register.registerMetric(this.activeConnections);
    this.register.registerMetric(this.requestSizes);
    this.register.registerMetric(this.responseSizes);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing metrics collector...');
    this.initialized = true;
  }

  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Increment active connections
      this.activeConnections.inc();

      // Track request size
      const contentLength = parseInt(req.get('Content-Length') || '0', 10);
      if (contentLength > 0) {
        this.requestSizes.observe(
          { method: req.method, route: req.route?.path || req.path },
          contentLength
        );
      }

      // Override res.end to collect metrics
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        // Calculate duration
        const duration = (Date.now() - startTime) / 1000;
        const route = req.route?.path || req.path;
        const service = (req as any).service || 'gateway';
        const statusCode = res.statusCode.toString();

        // Record metrics
        this.httpRequestDuration.observe(
          { method: req.method, route, status_code: statusCode, service },
          duration
        );

        this.httpRequestTotal.inc(
          { method: req.method, route, status_code: statusCode, service }
        );

        // Track errors
        if (res.statusCode >= 400) {
          const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
          this.httpErrorsTotal.inc(
            { method: req.method, route, status_code: statusCode, service, error_type: errorType }
          );
        }

        // Track response size
        if (chunk) {
          const responseSize = Buffer.byteLength(chunk, encoding);
          this.responseSizes.observe(
            { method: req.method, route, status_code: statusCode },
            responseSize
          );
        }

        // Decrement active connections
        this.activeConnections.dec();

        // Call original end
        originalEnd.call(this, chunk, encoding);
      }.bind(this);

      next();
    };
  }

  recordUsage(usage: APIUsage): void {
    // Custom metrics for API usage can be added here
    logger.debug('API usage recorded', { usage });
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  async cleanup(): Promise<void> {
    this.register.clear();
    this.initialized = false;
    logger.info('Metrics collector cleaned up');
  }
}

export const metricsCollector = new MetricsCollector();