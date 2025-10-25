/**
 * Analytics API Server
 * Express.js server for analytics services
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import analyticsRoutes from './routes';
import { getGlobalMetrics } from '@shared/observability/metrics';
import { RealTimePipeline } from '../pipeline/RealTimePipeline';

class AnalyticsServer {
  private app: express.Application;
  private server?: any;
  private realTimePipeline: RealTimePipeline;
  private metrics = getGlobalMetrics();
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.realTimePipeline = new RealTimePipeline({
      bufferSize: 10000,
      batchSize: 100,
      flushInterval: 1000,
      maxConcurrency: 10,
      retryAttempts: 3,
      backoffMs: 1000
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  /**
   * Start the analytics server
   */
  async start(): Promise<void> {
    try {
      // Start real-time pipeline
      await this.realTimePipeline.start();

      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        console.log(`🚀 Analytics API server started on port ${this.port}`);
        console.log(`📊 Real-time pipeline running`);
        console.log(`🔗 Health check available at http://localhost:${this.port}/health`);
        console.log(`📖 API documentation at http://localhost:${this.port}/docs`);
      });

      this.metrics.increment('server_started');
    } catch (error) {
      console.error('Failed to start analytics server:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the analytics server
   */
  async stop(): Promise<void> {
    console.log('🛑 Shutting down analytics server...');

    // Stop accepting new connections
    if (this.server) {
      this.server.close(async () => {
        console.log('✅ HTTP server stopped');

        // Stop real-time pipeline
        await this.realTimePipeline.stop();
        console.log('✅ Real-time pipeline stopped');

        this.metrics.increment('server_stopped');
        process.exit(0);
      });
    }
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production'
        ? ['https://labelmint.it', 'https://staging.labelmint.it']
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-ID']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // Limit each IP to X requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;

        console.log(`${req.method} ${req.path} ${status} - ${duration}ms`);

        this.metrics.increment('http_requests_total', {
          method: req.method,
          route: req.path,
          status: status.toString()
        });

        this.metrics.observe('http_request_duration_ms', duration, {
          method: req.method,
          route: req.path
        });
      });

      next();
    });

    // Organization context middleware
    this.app.use((req, res, next) => {
      const orgId = req.headers['x-organization-id'] as string;
      if (orgId) {
        req.organizationId = orgId;
      }
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.getHealthStatus();
        res.json(health);
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Metrics endpoint (for monitoring)
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = this.getPrometheusMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error) {
        res.status(500).send(error.message);
      }
    });

    // API documentation
    this.app.get('/docs', (req, res) => {
      res.json({
        title: 'LabelMint Analytics API',
        version: '1.0.0',
        description: 'Comprehensive analytics API for LabelMint platform',
        baseUrl: `${req.protocol}://${req.get('host')}/api`,
        endpoints: {
          executive: {
            description: 'Executive-level business intelligence',
            endpoints: ['/executive', '/executive/summary', '/executive/board']
          },
          product: {
            description: 'Product analytics and user behavior insights',
            endpoints: ['/product', '/product/feature-adoption']
          },
          operational: {
            description: 'System performance and operational metrics',
            endpoints: ['/operational', '/operational/health-score']
          },
          financial: {
            description: 'Financial metrics and revenue analytics',
            endpoints: ['/financial', '/financial/health-score']
          },
          ml: {
            description: 'Machine learning model performance monitoring',
            endpoints: ['/ml', '/ml/health-score']
          },
          realtime: {
            description: 'Real-time event ingestion and processing',
            endpoints: ['/events', '/events/batch']
          }
        },
        authentication: {
          type: 'Bearer Token',
          description: 'JWT token required for all endpoints except /health and /metrics'
        },
        rateLimit: {
          requests: '1000 per 15 minutes per IP',
          headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
        }
      });
    });

    // Analytics API routes
    this.app.use('/api', analyticsRoutes);

    // WebSocket support for real-time updates
    this.setupWebSocket();
  }

  /**
   * Setup WebSocket for real-time updates
   */
  private setupWebSocket(): void {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({
      port: this.port + 1,
      path: '/ws'
    });

    wss.on('connection', (ws: any, req: any) => {
      console.log('WebSocket client connected');

      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connection',
        data: {
          message: 'Connected to LabelMint Analytics WebSocket',
          timestamp: new Date().toISOString()
        }
      }));

      // Handle messages from client
      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);

          switch (data.type) {
            case 'subscribe':
              await this.handleSubscription(ws, data);
              break;
            case 'unsubscribe':
              await this.handleUnsubscription(ws, data);
              break;
            default:
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Unknown message type' }
              }));
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid message format' }
          }));
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
      });
    });

    // Forward real-time pipeline events to WebSocket clients
    this.realTimePipeline.on('batch_processed', (data: any) => {
      this.broadcastToWebSocket({
        type: 'analytics_update',
        data: {
          timestamp: new Date().toISOString(),
          eventsProcessed: data.events,
          processingTime: data.processingTime
        }
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.path} not found`
        }
      });
    });

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error);

      this.metrics.increment('server_errors');

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
        }
      });
    });
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = (signal: string) => {
      console.log(`\nReceived ${signal}, starting graceful shutdown...`);

      this.stop();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.stop();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.stop();
    });
  }

  /**
   * Get health status
   */
  private async getHealthStatus() {
    const pipelineStats = this.realTimePipeline.getStats();
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime,
      services: {
        http: 'healthy',
        websocket: 'healthy',
        realTimePipeline: pipelineStats.isRunning ? 'healthy' : 'unhealthy'
      },
      resources: {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss
        },
        cpu: process.cpuUsage(),
        pipeline: {
          bufferSize: pipelineStats.bufferSize,
          processorsCount: pipelineStats.processorsCount,
          sinksCount: pipelineStats.sinksCount
        }
      }
    };
  }

  /**
   * Get Prometheus metrics
   */
  private getPrometheusMetrics(): string {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    const metrics = this.metrics.getAllMetrics();

    let output = '';

    // Process metrics
    output += `# HELP process_cpu_usage_percent CPU usage percentage\n`;
    output += `# TYPE process_cpu_usage_percent gauge\n`;
    output += `process_cpu_usage_percent ${process.cpuUsage().user}\n\n`;

    output += `# HELP process_memory_bytes Memory usage in bytes\n`;
    output += `# TYPE process_memory_bytes gauge\n`;
    output += `process_memory_bytes{type="used"} ${memUsage.heapUsed}\n`;
    output += `process_memory_bytes{type="total"} ${memUsage.heapTotal}\n`;
    output += `process_memory_bytes{type="external"} ${memUsage.external}\n`;
    output += `process_memory_bytes{type="rss"} ${memUsage.rss}\n\n`;

    output += `# HELP process_uptime_seconds Process uptime in seconds\n`;
    output += `# TYPE process_uptime_seconds counter\n`;
    output += `process_uptime_seconds ${uptime}\n\n`;

    // Custom metrics
    for (const [name, value] of Object.entries(metrics)) {
      output += `# HELP ${name} Custom metric\n`;
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${value}\n\n`;
    }

    return output;
  }

  /**
   * Handle WebSocket subscription
   */
  private async handleSubscription(ws: any, data: any): Promise<void> {
    // Implement subscription logic
    ws.send(JSON.stringify({
      type: 'subscribed',
      data: {
        channels: data.channels || ['all'],
        timestamp: new Date().toISOString()
      }
    }));
  }

  /**
   * Handle WebSocket unsubscription
   */
  private async handleUnsubscription(ws: any, data: any): Promise<void> {
    // Implement unsubscription logic
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      data: {
        channels: data.channels || ['all'],
        timestamp: new Date().toISOString()
      }
    }));
  }

  /**
   * Broadcast message to all WebSocket clients
   */
  private broadcastToWebSocket(message: any): void {
    // Implementation would broadcast to all connected WebSocket clients
    console.log('Broadcasting to WebSocket clients:', message);
  }
}

export default AnalyticsServer;