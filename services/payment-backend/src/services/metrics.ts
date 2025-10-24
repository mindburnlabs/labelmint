import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import { Logger } from '../utils/logger';

const logger = new Logger('Metrics');

class MetricsService {
  private register: client.Registry;
  private httpRequestsTotal: client.Counter<string>;
  private httpRequestDuration: client.Histogram<string>;
  private activeConnections: client.Gauge<string>;
  private databaseConnections: client.Gauge<string>;
  private cacheHits: client.Counter<string>;
  private cacheMisses: client.Counter<string>;
  private errorCount: client.Counter<string>;
  private jwtTokensIssued: client.Counter<string>;
  private activeUsers: client.Gauge<string>;
  private responseSize: client.Histogram<string>;
  private requestSize: client.Histogram<string>;

  constructor() {
    this.register = new client.Registry();
    this.initializeMetrics();
    this.collectDefaultMetrics();
  }

  private initializeMetrics() {
    // HTTP Request Counter
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'status_class', 'version', 'environment'],
      registers: [this.register]
    });

    // HTTP Request Duration Histogram
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'status_class', 'version', 'environment'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register]
    });

    // Active Connections Gauge
    this.activeConnections = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
      registers: [this.register]
    });

    // Database Connections Gauge
    this.databaseConnections = new client.Gauge({
      name: 'database_connections',
      help: 'Number of database connections',
      labelNames: ['state'], // active, idle, total
      registers: [this.register]
    });

    // Cache Hits Counter
    this.cacheHits = new client.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type', 'key_pattern'],
      registers: [this.register]
    });

    // Cache Misses Counter
    this.cacheMisses = new client.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type', 'key_pattern'],
      registers: [this.register]
    });

    // Error Counter
    this.errorCount = new client.Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity', 'component', 'error_code'],
      registers: [this.register]
    });

    // JWT Tokens Issued Counter
    this.jwtTokensIssued = new client.Counter({
      name: 'jwt_tokens_issued_total',
      help: 'Total number of JWT tokens issued',
      labelNames: ['user_type', 'token_type'],
      registers: [this.register]
    });

    // Active Users Gauge
    this.activeUsers = new client.Gauge({
      name: 'active_users',
      help: 'Number of currently active users',
      labelNames: ['time_window'], // 1m, 5m, 15m, 1h
      registers: [this.register]
    });

    // Response Size Histogram
    this.responseSize = new client.Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route', 'status_class'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
      registers: [this.register]
    });

    // Request Size Histogram
    this.requestSize = new client.Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
      registers: [this.register]
    });

    // Database Query Duration
    new client.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table', 'query_type'],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register]
    });

    // Redis Operations Duration
    new client.Histogram({
      name: 'redis_operation_duration_seconds',
      help: 'Duration of Redis operations in seconds',
      labelNames: ['operation', 'command'],
      buckets: [0.0001, 0.001, 0.01, 0.1, 0.5, 1],
      registers: [this.register]
    });

    // Email Sent Counter
    new client.Counter({
      name: 'emails_sent_total',
      help: 'Total number of emails sent',
      labelNames: ['type', 'template', 'provider'],
      registers: [this.register]
    });

    // Authentication Events
    new client.Counter({
      name: 'authentication_events_total',
      help: 'Total number of authentication events',
      labelNames: ['event_type', 'provider', 'success'],
      registers: [this.register]
    });

    // Business Metrics
    new client.Counter({
      name: 'user_registrations_total',
      help: 'Total number of user registrations',
      labelNames: ['source', 'user_type'],
      registers: [this.register]
    });

    new client.Counter({
      name: 'tasks_completed_total',
      help: 'Total number of tasks completed',
      labelNames: ['type', 'priority', 'status'],
      registers: [this.register]
    });

    new client.Counter({
      name: 'delegations_created_total',
      help: 'Total number of delegations created',
      labelNames: ['type', 'priority'],
      registers: [this.register]
    });

    // External API Calls
    new client.Histogram({
      name: 'external_api_request_duration_seconds',
      help: 'Duration of external API requests',
      labelNames: ['service', 'endpoint', 'method', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register]
    });

    // WebSocket Connections
    new client.Gauge({
      name: 'websocket_connections',
      help: 'Number of active WebSocket connections',
      labelNames: ['room', 'user_type'],
      registers: [this.register]
    });
  }

  private collectDefaultMetrics() {
    // Collect default Node.js metrics
    client.collectDefaultMetrics({
      register: this.register,
      labels: {
        app: 'labelmintit-backend',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  }

  // Middleware for Express
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const contentLength = parseInt(req.headers['content-length'] || '0');

      // Increment active connections
      this.activeConnections.inc({ type: 'http' });

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const responseSize = parseInt(res.getHeader('content-length') as string || '0');
        const route = req.route?.path || req.path || 'unknown';
        const statusCode = res.statusCode.toString();
        const statusClass = this.getStatusClass(res.statusCode);

        // Record metrics
        this.httpRequestsTotal.inc({
          method: req.method,
          route,
          status_code: statusCode,
          status_class: statusClass,
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        });

        this.httpRequestDuration.observe({
          method: req.method,
          route,
          status_code: statusCode,
          status_class: statusClass,
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }, duration);

        this.responseSize.observe({
          method: req.method,
          route,
          status_class: statusClass
        }, responseSize);

        if (contentLength > 0) {
          this.requestSize.observe({
            method: req.method,
            route
          }, contentLength);
        }

        // Decrement active connections
        this.activeConnections.dec({ type: 'http' });

        // Log slow requests
        if (duration > 1) {
          logger.warn('Slow request detected', {
            method: req.method,
            route,
            duration,
            statusCode
          });
        }
      });

      next();
    };
  }

  private getStatusClass(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return '2xx';
    if (statusCode >= 300 && statusCode < 400) return '3xx';
    if (statusCode >= 400 && statusCode < 500) return '4xx';
    if (statusCode >= 500) return '5xx';
    return 'unknown';
  }

  // Metric recording methods
  recordCacheHit(cacheType: string, keyPattern: string) {
    this.cacheHits.inc({ cache_type: cacheType, key_pattern: keyPattern });
  }

  recordCacheMiss(cacheType: string, keyPattern: string) {
    this.cacheMisses.inc({ cache_type: cacheType, key_pattern: keyPattern });
  }

  recordError(type: string, severity: string, component: string, errorCode?: string) {
    this.errorCount.inc({
      type,
      severity,
      component,
      error_code: errorCode || 'unknown'
    });
  }

  recordJWTTokenIssued(userType: string, tokenType: string) {
    this.jwtTokensIssued.inc({ user_type: userType, token_type: tokenType });
  }

  updateActiveUsers(count: number, timeWindow: string) {
    this.activeUsers.set({ time_window: timeWindow }, count);
  }

  updateDatabaseConnections(active: number, idle: number, total: number) {
    this.databaseConnections.set({ state: 'active' }, active);
    this.databaseConnections.set({ state: 'idle' }, idle);
    this.databaseConnections.set({ state: 'total' }, total);
  }

  recordEmailSent(type: string, template: string, provider: string) {
    const counter = this.register.getSingleMetric('emails_sent_total') as client.Counter<string>;
    counter?.inc({ type, template, provider });
  }

  recordAuthEvent(eventType: string, provider: string, success: boolean) {
    const counter = this.register.getSingleMetric('authentication_events_total') as client.Counter<string>;
    counter?.inc({ event_type: eventType, provider, success: success.toString() });
  }

  recordUserRegistration(source: string, userType: string) {
    const counter = this.register.getSingleMetric('user_registrations_total') as client.Counter<string>;
    counter?.inc({ source, user_type: userType });
  }

  recordTaskCompleted(type: string, priority: string, status: string) {
    const counter = this.register.getSingleMetric('tasks_completed_total') as client.Counter<string>;
    counter?.inc({ type, priority, status });
  }

  recordDelegationCreated(type: string, priority: string) {
    const counter = this.register.getSingleMetric('delegations_created_total') as client.Counter<string>;
    counter?.inc({ type, priority });
  }

  recordExternalAPICall(service: string, endpoint: string, method: string, statusCode: string, duration: number) {
    const histogram = this.register.getSingleMetric('external_api_request_duration_seconds') as client.Histogram<string>;
    histogram?.observe({ service, endpoint, method, status_code: statusCode }, duration);
  }

  updateWebSocketConnections(room: string, userType: string, count: number) {
    const gauge = this.register.getSingleMetric('websocket_connections') as client.Gauge<string>;
    gauge?.set({ room, user_type: userType }, count);
  }

  // Get Prometheus metrics
  async getPrometheusMetrics(): Promise<string> {
    try {
      // Update application-specific metrics before returning
      await this.updateApplicationMetrics();

      return await this.register.metrics();
    } catch (error) {
      logger.error('Failed to get Prometheus metrics', error);
      return '# Error collecting metrics\n';
    }
  }

  private async updateApplicationMetrics() {
    try {
      // Update active users (you might get this from Redis or your database)
      const activeUsers1m = await this.getActiveUsersCount(1); // Last minute
      const activeUsers5m = await this.getActiveUsersCount(5); // Last 5 minutes
      const activeUsers1h = await this.getActiveUsersCount(60); // Last hour

      this.updateActiveUsers(activeUsers1m, '1m');
      this.updateActiveUsers(activeUsers5m, '5m');
      this.updateActiveUsers(activeUsers1h, '1h');

      // Update database connections (from Prisma)
      // Note: You need to implement this based on your database client
      // this.updateDatabaseConnections(prismaInstance.getActiveConnections(), ...);
    } catch (error) {
      logger.error('Failed to update application metrics', error);
    }
  }

  private async getActiveUsersCount(minutes: number): Promise<number> {
    // Implement logic to get active users from your data store
    // This is a placeholder implementation
    return Math.floor(Math.random() * 1000);
  }

  // Reset metrics (useful for testing)
  resetMetrics() {
    this.register.clear();
    this.initializeMetrics();
    this.collectDefaultMetrics();
  }
}

// Export singleton instance
export const MetricsService = new MetricsService();
export default MetricsService;