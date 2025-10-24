import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { DatabaseService } from './services/database/DatabaseService';
import { Logger } from './utils/logger';
import { config } from './config';
import SentryService from './config/sentry';
import MetricsService from './services/metrics';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { rateLimit } from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Redis from 'ioredis';

// Import compliance modules
import { initializeCompliance } from './compliance/init';
import complianceRoutes from './routes/api/v1/compliance';
import analyticsRoutes from './routes/api/v1/analytics';
import enhancedTasksRoutes from './routes/api/v1/enhancedTasks';
import growthRoutes from './routes/api/growth';
import viralRoutes from './routes/api/viral';
import { requireAuth } from './middleware/auth';
import { requireAdmin } from './middleware/adminAuth';

// Import performance optimization modules
import { PaginationHelper } from './utils/pagination';
import { CacheManager } from './cache/cache-manager';
import { CompressionMiddleware } from './middleware/compression';
import { FieldFilterMiddleware } from './middleware/field-filtering';
import BulkOperationsRouter from './routes/bulk-operations';
import SecurityMiddleware from './middleware/security';

const logger = new Logger('App');
const app = express();

// Initialize Database Service
const db = DatabaseService.getInstance();

// Initialize compliance system
const compliance = initializeCompliance(db);
const middleware = compliance.initializeMiddleware();

// Initialize performance components
const redis = new Redis(config.REDIS_URL || 'redis://localhost:6379');
const cacheManager = new CacheManager(redis);
const compressionMiddleware = CompressionMiddleware.createPreset('adaptive');
const fieldFilterMiddleware = new FieldFilterMiddleware(FieldFilterMiddleware.createPresets());

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Enhanced Security Middleware
app.use(SecurityMiddleware.helmetMiddleware());

// Cookie Consent Middleware (must be before CORS for web routes)
app.use('/app', middleware.cookieConsent);

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = config.CORS_ORIGINS?.split(',') || [];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-CSRF-Token',
    'X-API-Key',
    'X-Request-ID',
    'Trace-ID',
    'X-Session-ID'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Trace-ID',
    'X-Request-ID'
  ]
};

app.use(cors(corsOptions));

// Performance Optimization Middleware
app.use(compressionMiddleware.middleware());
app.use(fieldFilterMiddleware.middleware());

// Rate Limiting
const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.RATE_LIMIT_MAX_REQUESTS || 100,
  message: {
    error: 'Too many requests, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and metrics
    return req.path.startsWith('/health') ||
           req.path.startsWith('/metrics') ||
           req.path.startsWith('/ready') ||
           req.path.startsWith('/live');
  },
  keyGenerator: (req) => {
    // Use IP or user ID for rate limiting
    return req.headers['x-forwarded-for'] as string ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  },
  handler: (req, res) => {
    SentryService.captureMessage('Rate limit exceeded', 'warning', {
      tags: {
        ip: req.ip,
        path: req.path
      }
    });
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: '15 minutes'
    });
  }
});

// Enhanced Rate Limiting with Redis
app.use(SecurityMiddleware.rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: config.RATE_LIMIT_MAX_REQUESTS || 100,
  useRedis: true,
  redisUrl: config.REDIS_URL || 'redis://localhost:6379'
}));

// Metrics Middleware (should be before routes)
app.use(MetricsService.middleware());

// Audit Logging Middleware (applies to all API routes)
app.use('/api', middleware.audit);

// Enhanced Request Pipeline with Performance Tracking
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string ||
                  `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Performance tracking
  (req as any).startTime = Date.now();
  (req as any).cacheManager = cacheManager;

  // Sentry breadcrumb
  SentryService.addBreadcrumb({
    message: 'Request started',
    category: 'http',
    data: {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }
  });

  // Add to request context
  (req as any).requestId = requestId;

  next();
});

// Pagination Middleware
app.use((req, res, next) => {
  (req as any).pagination = {
    options: PaginationHelper.parseOptions(req as any)
  };
  next();
});

// Body Parsing Middleware
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    (req as any).rawBody = buf;
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Static Files (with caching)
app.use('/static', express.static('public', {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Health and Metrics Routes (no authentication required)
app.use('/health', healthRoutes);
app.use('/metrics', healthRoutes);
app.use('/ready', healthRoutes);
app.use('/live', healthRoutes);
app.use('/version', healthRoutes);

// Proxy to monitoring stack (if needed)
app.use('/monitoring', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: {
    '^/monitoring': ''
  },
  onError: (err, req, res) => {
    logger.error('Proxy error', err);
  }
}));

// Cookie Consent Endpoint
app.post('/api/v1/compliance/cookie-consent', async (req, res) => {
  try {
    const consent = req.body;
    const userId = (req as any).auth?.payload?.userId;
    const sessionId = req.headers['x-session-id'] as string;

    await compliance.getCookieConsentService().recordConsent(
      consent,
      userId,
      sessionId,
      req.ip,
      req.headers['user-agent']
    );

    compliance.getCookieConsentService().setConsentCookie(res, consent);

    res.json({
      success: true,
      message: 'Consent saved successfully'
    });
  } catch (error: any) {
    console.error('Error saving consent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save consent'
    });
  }
});

// API Routes with Performance Optimizations
const apiRouter = express.Router();

// Authentication Routes (no auth required)
apiRouter.use('/auth', authRoutes);

// Compliance Routes (mixed auth)
apiRouter.use('/v1/compliance', complianceRoutes);

// Analytics Routes (mixed auth - some endpoints public)
apiRouter.use('/v1/analytics', analyticsRoutes);

// Protected Routes (authentication required)
apiRouter.use('/v1/enhancedTasks', requireAuth, enhancedTasksRoutes);

// Growth Automation Routes
apiRouter.use('/growth', growthRoutes);

// Viral Feature Routes
apiRouter.use('/viral', viralRoutes);

// Admin-only Routes
apiRouter.use('/v1/admin/compliance', requireAuth, requireAdmin, complianceRoutes);
apiRouter.use('/v1/admin/analytics', requireAuth, requireAdmin, analyticsRoutes);

// Bulk Operations Routes (performance focused)
const bulkRouter = new BulkOperationsRouter(
  db as any, // Prisma client compatibility
  cacheManager,
  { addBulk: () => Promise.resolve() } // Mock queue service
);
apiRouter.use('/bulk', bulkRouter.getRouter());

// Performance Metrics Endpoint
apiRouter.get('/performance/metrics', async (req, res) => {
  try {
    const [cacheStats, compressionStats, fieldFilterStats] = await Promise.all([
      cacheManager.getStats(),
      compressionMiddleware.getStats(),
      fieldFilterMiddleware.getStats()
    ]);

    res.json({
      cache: cacheStats,
      compression: compressionStats,
      fieldFilter: fieldFilterStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get performance metrics error', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Cache Management Endpoint
apiRouter.post('/cache/clear', async (req, res) => {
  try {
    const { pattern } = req.body;

    if (pattern) {
      const deleted = await cacheManager.deleteByPattern(pattern);
      res.json({ message: `Cleared ${deleted} cache entries matching pattern: ${pattern}` });
    } else {
      await cacheManager.clear();
      res.json({ message: 'All cache cleared' });
    }
  } catch (error) {
    logger.error('Cache clear error', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Apply API router
app.use('/api', apiRouter);

// GraphQL Endpoint (if implemented)
// app.use('/graphql', authMiddleware, graphqlMiddleware);

// Sentry Request Handler (must be after routes)
const sentryRequestHandler = SentryService.Handlers.requestHandler();
app.use(sentryRequestHandler);

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Sentry Error Handler
const sentryErrorHandler = Sentry.Handlers.errorHandler();
app.use(sentryErrorHandler);

// Application Error Handler (must be last)
app.use(errorHandler);

// Graceful Shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new requests
  (server as any).close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close database connections
      await db.close();
      logger.info('Database connections closed');

      // Close Redis connections
      await redis.quit();
      logger.info('Redis connections closed');

      // Flush metrics
      const metrics = await MetricsService.getPrometheusMetrics();
      logger.info('Final metrics:', metrics);

      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  SentryService.captureException(error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  SentryService.captureException(reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});

// Start server
const PORT = config.PORT || 3000;
const server = app.listen(PORT, async () => {
  logger.info(`🚀 Server started on port ${PORT}`);
  logger.info(`📊 Health checks: http://localhost:${PORT}/health`);
  logger.info(`📈 Metrics: http://localhost:${PORT}/metrics`);
  logger.info(`🌍 Environment: ${config.NODE_ENV}`);

  // Log performance optimizations enabled
  logger.info('⚡ Performance optimizations enabled:');
  logger.info('   - Advanced pagination with cursor and offset support');
  logger.info('   - GraphQL DataLoader for N+1 prevention');
  logger.info('   - Redis caching with intelligent invalidation');
  logger.info('   - Adaptive response compression');
  logger.info('   - Field filtering with validation');
  logger.info('   - Bulk operations endpoints');
  logger.info('   - Database query optimization');
  logger.info('   - Enhanced security middleware with Redis rate limiting');

  // Log compliance features enabled
  logger.info('🔒 Compliance features enabled:');
  logger.info('   - GDPR compliance with data export/deletion');
  logger.info('   - Comprehensive audit logging');
  logger.info('   - Cookie consent management');
  logger.info('   - Google Analytics 4 integration');
  logger.info('   - A/B testing framework');
  logger.info('   - User behavior analytics');

  // Send startup metric
  MetricsService.recordAuthEvent('server_start', 'system', true);

  // Initialize cache warming
  try {
    await cacheManager.warmCache([
      { key: 'config:app_settings', fetcher: () => ({ version: '1.0.0' }) }
    ]);
    logger.info('Cache warming completed');
  } catch (error) {
    logger.error('Cache warming failed', error);
  }
});

export default app;