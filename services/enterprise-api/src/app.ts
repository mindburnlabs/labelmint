import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { logger } from './utils/logger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { tenantMiddleware } from './middleware/tenant.js'
import { authMiddleware } from './middleware/auth.js'
import { auditMiddleware } from './middleware/audit.js'
import { setupRoutes } from './routes/index.js'
import { setupWebSocket } from './services/websocket.js'

// Load environment variables
dotenv.config()

// Initialize Express app
const app = express()
const server = createServer(app)

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true
  }
})

// Initialize database and Redis
export const prisma = new PrismaClient({
  log: ['query', 'error', 'warn']
})

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
})

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
  crossOriginEmbedderPolicy: false
}))

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000']
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
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
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 10000,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-organization-id'] as string || req.ip
  }
})

app.use('/api', limiter)

// Body parsing middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Request logging
app.use((req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      organizationId: req.headers['x-organization-id'],
      userId: req.headers['x-user-id']
    })
  })

  next()
})

// Custom middleware
app.use('/api/enterprise/v1', tenantMiddleware)
app.use('/api/enterprise/v1', authMiddleware)
app.use('/api/enterprise/v1', auditMiddleware)

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`

    // Check Redis connection
    await redis.ping()

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        websocket: 'active'
      },
      version: process.env.npm_package_version || '1.0.0'
    })
  } catch (error) {
    logger.error('Health check failed', error)
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// API routes
setupRoutes(app, '/api/enterprise/v1')

// Setup WebSocket handlers
setupWebSocket(io)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  })
})

// Error handling middleware
app.use(errorHandler)

// Start server
const PORT = process.env.PORT || 3003
const HOST = process.env.HOST || '0.0.0.0'

server.listen(PORT, HOST, () => {
  logger.info('Enterprise API server started', {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version
  })
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')

  server.close(async () => {
    logger.info('HTTP server closed')

    await prisma.$disconnect()
    logger.info('Database disconnected')

    redis.disconnect()
    logger.info('Redis disconnected')

    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully')

  server.close(async () => {
    logger.info('HTTP server closed')

    await prisma.$disconnect()
    logger.info('Database disconnected')

    redis.disconnect()
    logger.info('Redis disconnected')

    process.exit(0)
  })
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise })
  process.exit(1)
})

export { app, io }