import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import * as Sentry from '@sentry/node';
import { MetricsService } from '../services/metrics';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('HealthCheck');
const prisma = new PrismaClient();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    external: ServiceStatus;
  };
  metrics?: any;
  checks: CheckResult[];
}

interface ServiceStatus {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
  details?: any;
}

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  error?: string;
}

class HealthChecker extends EventEmitter {
  private startTime: number;
  private cache: Map<string, { status: HealthStatus; timestamp: number }> = new Map();
  private cacheTTL = 30000; // 30 seconds

  constructor() {
    super();
    this.startTime = Date.now();
  }

  async checkHealth(detailed = false): Promise<HealthStatus> {
    const cached = this.cache.get('health');
    if (cached && !detailed && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.status;
    }

    const checks: CheckResult[] = [];
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    // Database Check
    const dbCheck = await this.checkDatabase();
    checks.push(dbCheck);

    // Redis Check
    const redisCheck = await this.checkRedis();
    checks.push(redisCheck);

    // External Service Checks
    const externalCheck = await this.checkExternalServices();
    checks.push(externalCheck);

    // Memory Check
    const memoryCheck = this.checkMemoryUsage();
    checks.push(memoryCheck);

    // Disk Space Check
    const diskCheck = await this.checkDiskSpace();
    checks.push(diskCheck);

    // Determine overall status
    const allPassed = checks.every(c => c.status === 'pass');
    const hasWarning = checks.some(c => c.status === 'warn');
    const hasFailure = checks.some(c => c.status === 'fail');

    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (hasFailure) status = 'unhealthy';
    else if (hasWarning || !allPassed) status = 'degraded';

    const healthStatus: HealthStatus = {
      status,
      timestamp,
      uptime,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: {
          status: dbCheck.status === 'pass' ? 'healthy' : 'unhealthy',
          latency: dbCheck.duration,
          error: dbCheck.error
        },
        redis: {
          status: redisCheck.status === 'pass' ? 'healthy' : 'unhealthy',
          latency: redisCheck.duration,
          error: redisCheck.error
        },
        external: {
          status: externalCheck.status === 'pass' ? 'healthy' : 'unhealthy',
          error: externalCheck.error
        }
      },
      checks: detailed ? checks : []
    };

    if (detailed) {
      healthStatus.metrics = await this.getDetailedMetrics();
    }

    this.cache.set('health', { status: healthStatus, timestamp: Date.now() });
    return healthStatus;
  }

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;

      return {
        name: 'database',
        status: duration < 1000 ? 'pass' : 'warn',
        duration
      };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database health check failed', error);

      return {
        name: 'database',
        status: 'fail',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true
      });

      await redis.ping();
      await redis.quit();

      const duration = Date.now() - start;

      return {
        name: 'redis',
        status: duration < 500 ? 'pass' : 'warn',
        duration
      };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Redis health check failed', error);

      return {
        name: 'redis',
        status: 'fail',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkExternalServices(): Promise<CheckResult> {
    const start = Date.now();
    const services = [
      { name: 'stripe', url: 'https://api.stripe.com/v1' },
      { name: 'openai', url: 'https://api.openai.com/v1' }
    ];

    try {
      const results = await Promise.allSettled(
        services.map(async (service) => {
          const response = await fetch(service.url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });
          return {
            name: service.name,
            ok: response.ok
          };
        })
      );

      const allOk = results.every(r =>
        r.status === 'fulfilled' && r.value.ok
      );

      const duration = Date.now() - start;

      return {
        name: 'external_services',
        status: allOk ? 'pass' : 'warn',
        duration
      };
    } catch (error) {
      const duration = Date.now() - start;

      return {
        name: 'external_services',
        status: 'warn',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private checkMemoryUsage(): CheckResult {
    const start = Date.now();
    const usage = process.memoryUsage();
    const totalMemory = usage.heapTotal;
    const usedMemory = usage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    return {
      name: 'memory_usage',
      status: memoryUsagePercent > 90 ? 'fail' : memoryUsagePercent > 75 ? 'warn' : 'pass',
      duration: Date.now() - start,
      error: memoryUsagePercent > 90 ? `Memory usage: ${memoryUsagePercent.toFixed(2)}%` : undefined
    };
  }

  private async checkDiskSpace(): Promise<CheckResult> {
    const start = Date.now();
    try {
      // In a real implementation, you would check actual disk space
      // For now, we'll simulate the check
      const diskUsagePercent = Math.random() * 100;

      return {
        name: 'disk_space',
        status: diskUsagePercent > 95 ? 'fail' : diskUsagePercent > 80 ? 'warn' : 'pass',
        duration: Date.now() - start,
        error: diskUsagePercent > 95 ? `Disk usage: ${diskUsagePercent.toFixed(2)}%` : undefined
      };
    } catch (error) {
      return {
        name: 'disk_space',
        status: 'fail',
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getDetailedMetrics(): Promise<any> {
    return {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      activeHandles: process._getActiveHandles?.() || 0,
      activeRequests: process._getActiveRequests?.() || 0,
      version: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }
}

const healthChecker = new HealthChecker();

// Basic health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await healthChecker.checkHealth(false);

    const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      status: health.status,
      timestamp: health.timestamp,
      uptime: health.uptime
    });
  } catch (error) {
    logger.error('Health check error', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Detailed health check endpoint
router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const health = await healthChecker.checkHealth(true);

    const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { endpoint: 'health' }
    });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Readiness check endpoint (for Kubernetes)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if the application is ready to serve traffic
    const dbCheck = await healthChecker.checkDatabase();
    const redisCheck = await healthChecker.checkRedis();

    const isReady = dbCheck.status === 'pass' && redisCheck.status === 'pass';

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: { database: dbCheck, redis: redisCheck }
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed'
    });
  }
});

// Liveness check endpoint (for Kubernetes)
router.get('/live', async (req: Request, res: Response) => {
  // Simple liveness check - if the server responds, it's alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint for Prometheus
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await MetricsService.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Metrics endpoint error', error);
    res.status(500).send('Metrics collection failed');
  }
});

// Version endpoint
router.get('/version', (req: Request, res: Response) => {
  res.json({
    version: process.env.npm_package_version || '1.0.0',
    build: process.env.BUILD_NUMBER || 'unknown',
    commit: process.env.GIT_COMMIT || 'unknown',
    environment: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString()
  });
});

export default router;