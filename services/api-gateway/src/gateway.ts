import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import { createProxyMiddleware } from 'http-proxy-middleware';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import config from '@config/index';
import { logger } from '@utils/logger';
import { errorHandler } from '@middleware/errorHandler';
import { requestLogger } from '@middleware/logging/requestLogger';
import { correlationId } from '@middleware/logging/correlationId';
import { rateLimiter } from '@middleware/rateLimit/rateLimiter';
import { authMiddleware } from '@middleware/auth/authMiddleware';
import { cacheMiddleware } from '@middleware/cache/cacheMiddleware';
import { serviceRegistry } from '@services/registry';
import { healthChecker } from '@services/health';
import { metricsCollector } from '@services/metrics';

class APIGateway {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeProxy();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet(config.helmet));
    this.app.use(cors(config.cors));
    this.app.use(compression(config.compression));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request tracking
    this.app.use(correlationId);
    this.app.use(requestLogger);

    // Metrics collection
    this.app.use(metricsCollector.middleware());

    // Trust proxy for IP detection
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        services: healthChecker.getAllServiceHealth()
      });
    });

    // Gateway info endpoint
    this.app.get('/gateway/info', (req, res) => {
      res.json({
        name: 'LabelMint API Gateway',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: config.services.map(s => ({
          name: s.name,
          path: s.path,
          auth: s.auth
        }))
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await metricsCollector.getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error) {
        res.status(500).json({ error: 'Failed to collect metrics' });
      }
    });

    // Service health endpoint
    this.app.get('/gateway/services/health', (req, res) => {
      const health = healthChecker.getAllServiceHealth();
      res.json(health);
    });

    // Service registry endpoint
    this.app.get('/gateway/services', (req, res) => {
      const services = serviceRegistry.getAllServices();
      res.json(services);
    });

    // API Documentation
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'LabelMint API Gateway',
          version: '1.0.0',
          description: 'Enterprise-grade API Gateway for LabelMint services',
        },
        servers: [
          {
            url: `http://localhost:${config.port}`,
            description: 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
            apiKey: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key',
            },
          },
        },
      },
      apis: ['./src/routes/**/*.ts', './src/gateway.ts'],
    };

    const specs = swaggerJsdoc(swaggerOptions);
    this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'LabelMint API Gateway Documentation'
    }));

    // OpenAPI JSON
    this.app.get('/docs.json', (req, res) => {
      res.json(specs);
    });
  }

  private initializeProxy(): void {
    config.services.forEach(service => {
      const proxyOptions = {
        target: service.target,
        changeOrigin: true,
        timeout: service.timeout,
        proxyTimeout: service.timeout,
        pathRewrite: (path: string, req: express.Request) => {
          return path.replace(service.path, '');
        },
        onError: (err: Error, req: express.Request, res: express.Response) => {
          logger.error(`Proxy error for service ${service.name}:`, err);
          healthChecker.markServiceUnhealthy(service.name);

          if (!res.headersSent) {
            res.status(503).json({
              error: 'Service Unavailable',
              service: service.name,
              message: 'The requested service is currently unavailable',
              timestamp: new Date().toISOString()
            });
          }
        },
        onProxyReq: (proxyReq: any, req: express.Request, res: express.Response) => {
          // Add correlation ID to upstream request
          const correlationId = (req as any).correlationId;
          if (correlationId) {
            proxyReq.setHeader('X-Correlation-ID', correlationId);
          }

          // Add user information from authentication
          if ((req as any).user) {
            proxyReq.setHeader('X-User-ID', (req as any).user.id);
            proxyReq.setHeader('X-User-Role', (req as any).user.role);
          }

          if ((req as any).apiKey) {
            proxyReq.setHeader('X-API-Key-ID', (req as any).apiKey.id);
          }
        },
        onProxyRes: (proxyRes: any, req: express.Request, res: express.Response) => {
          // Mark service as healthy on successful response
          if (proxyRes.statusCode < 500) {
            healthChecker.markServiceHealthy(service.name);
          }

          // Add cache headers for cacheable responses
          if (service.cache?.enabled && req.method === 'GET' && proxyRes.statusCode === 200) {
            proxyRes.headers['Cache-Control'] = `public, max-age=${service.cache.ttl}`;
          }
        }
      };

      // Build middleware chain for this service
      const middlewares: express.RequestHandler[] = [];

      // Apply service-specific rate limiting
      if (service.rateLimit) {
        const serviceRateLimiter = rateLimiter(service.rateLimit);
        middlewares.push(serviceRateLimiter);
      }

      // Apply authentication if required
      if (service.auth) {
        middlewares.push(authMiddleware);
      }

      // Apply caching if enabled
      if (service.cache?.enabled) {
        middlewares.push(cacheMiddleware(service.cache));
      }

      // Add the proxy middleware
      const proxy = createProxyMiddleware(proxyOptions);
      middlewares.push(proxy);

      // Apply all middlewares to the service path
      this.app.use(service.path, ...middlewares);

      logger.info(`Registered proxy for service ${service.name} at ${service.path} -> ${service.target}`);
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  public async start(): Promise<void> {
    try {
      // Initialize services
      await serviceRegistry.initialize();
      await healthChecker.initialize();
      await metricsCollector.initialize();

      // Start health checking
      healthChecker.start();

      // Start the server
      this.server = this.app.listen(config.port, () => {
        logger.info(`🚀 API Gateway started on port ${config.port}`);
        logger.info(`📚 Documentation available at http://localhost:${config.port}/docs`);
        logger.info(`📊 Metrics available at http://localhost:${config.port}/metrics`);
        logger.info(`🏥 Health check at http://localhost:${config.port}/health`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start API Gateway:', error);
      process.exit(1);
    }
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down API Gateway...');

    // Stop accepting new connections
    if (this.server) {
      this.server.close(() => {
        logger.info('Server closed');
      });
    }

    // Stop health checking
    healthChecker.stop();

    // Cleanup resources
    await serviceRegistry.cleanup();
    await metricsCollector.cleanup();

    logger.info('API Gateway shutdown complete');
    process.exit(0);
  }
}

// Start the gateway
const gateway = new APIGateway();
gateway.start().catch((error) => {
  logger.error('Failed to start gateway:', error);
  process.exit(1);
});

export default gateway;