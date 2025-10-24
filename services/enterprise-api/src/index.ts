import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { setupSwagger } from './config/swagger';
import { setupSecurity } from './config/security';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { setupSocketIO } from './socket';
import { logger } from './utils/logger';
import { routes } from './routes';
import ssoRoutes from './routes/sso';

// Load environment variables
dotenv.config();

class EnterpriseAPI {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private prisma: PrismaClient;
  private redis: Redis;

  constructor() {
    this.app = express();
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security
    setupSecurity(this.app);

    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Tenant-ID',
        'X-Organization-ID'
      ]
    }));

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // File uploads
    this.app.use('/api/upload', require('multer')({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
      }
    }).array('files', 50));

    // Custom middleware
    this.app.use(tenantMiddleware);

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'enterprise-api',
        version: '1.0.0'
      });
    });

    // API documentation
    setupSwagger(this.app);
  }

  private setupRoutes(): void {
    // Attach database and redis to request
    this.app.use((req, res, next) => {
      (req as any).db = this.prisma;
      (req as any).redis = this.redis;
      next();
    });

    // API routes
    // SSO routes need to be accessible without auth for login flows
    this.app.use('/api/enterprise/v1', routes);

    // Separate SSO routes without auth middleware
    this.app.use('/api/sso', ssoRoutes);
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    const port = process.env.PORT || 3003;

    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true
      }
    });

    // Setup Socket.IO for real-time features
    setupSocketIO(this.io, this.prisma, this.redis);

    this.server.listen(port, () => {
      logger.info(`Enterprise API server running on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');

    this.server?.close();
    this.io?.close();

    await this.prisma.$disconnect();
    this.redis?.disconnect();

    logger.info('Shutdown complete');
  }
}

// Start the server
const api = new EnterpriseAPI();
api.start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});