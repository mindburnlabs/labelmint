import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { initDatabase, initRedis, getDb, query } from './database/connection';
import taskRoutes from './routes/tasks';
import enhancedTaskRoutes from './routes/enhancedTasks';
import aiTaskRoutes from './routes/aiTasks';
import apiRoutes from './routes/api.js';
import growthRoutes from './routes/growthRoutes';
import viralRoutes from './routes/viralRoutes';
import testProjectRoutes from './api/projects/testProjectRoutes';
import adminDashboard from './pages/admin-dashboard';
import createFilesRoutes from './routes/files';
import { FileManagementConfig } from './controllers/filesController';
import { WebSocketService } from './services/websocket/WebSocketService';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// File Management Configuration
const fileManagementConfig: FileManagementConfig = {
  s3: {
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET || 'labelmint-files',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    endpoint: process.env.AWS_S3_ENDPOINT, // For MinIO or custom S3
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
  },
  virusScanner: {
    enabled: process.env.VIRUS_SCANNER_ENABLED === 'true',
    config: {
      socketPath: process.env.CLAMAV_SOCKET_PATH,
      host: process.env.CLAMAV_HOST || 'localhost',
      port: parseInt(process.env.CLAMAV_PORT || '3310'),
      timeout: parseInt(process.env.CLAMAV_TIMEOUT || '30000'),
      maxFileSize: parseInt(process.env.CLAMAV_MAX_FILE_SIZE || '104857600'), // 100MB
      skipScan: process.env.CLAMAV_SKIP_EXTENSIONS?.split(',') || [],
    },
  },
  validator: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50MB
    allowedMimeTypes: process.env.ALLOWED_MIME_TYPES?.split(',') || [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav'
    ],
    allowedExtensions: process.env.ALLOWED_EXTENSIONS?.split(',') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.mp4', '.webm', '.mp3', '.wav'],
    blockedExtensions: process.env.BLOCKED_EXTENSIONS?.split(',') || ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.php', '.asp', '.sh'],
    requireChecksum: process.env.REQUIRE_FILE_CHECKSUM === 'true',
  },
  imageProcessing: {
    enabled: process.env.IMAGE_PROCESSING_ENABLED !== 'false', // Default true
    autoOptimize: process.env.AUTO_OPTIMIZE_IMAGES === 'true',
    generateThumbnails: process.env.GENERATE_THUMBNAILS !== 'false', // Default true
    thumbnailSizes: {
      small: { width: parseInt(process.env.THUMBNAIL_SMALL_WIDTH || '150'), height: parseInt(process.env.THUMBNAIL_SMALL_HEIGHT || '150') },
      medium: { width: parseInt(process.env.THUMBNAIL_MEDIUM_WIDTH || '300'), height: parseInt(process.env.THUMBNAIL_MEDIUM_HEIGHT || '300') },
      large: { width: parseInt(process.env.THUMBNAIL_LARGE_WIDTH || '600'), height: parseInt(process.env.THUMBNAIL_LARGE_HEIGHT || '600') },
    },
  },
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://t.me'],
  credentials: true
}));
app.use(express.json());

// Serve static files (uploads)
app.use('/uploads', express.static('uploads'));

// Database connection for app-wide access
app.use(async (req, res, next) => {
  try {
    const db = await getDb();
    req.app.locals.db = db;
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await req.app.locals.db?.query('SELECT 1');
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    });
  }
});

// API routes
app.use('/api/tasks', taskRoutes);
app.use('/api/tasks', aiTaskRoutes); // AI-assisted task routes
app.use('/api', enhancedTaskRoutes); // Enhanced routes with quality control
app.use('/api/v1', apiRoutes); // Enterprise API routes
app.use('/api/growth', growthRoutes); // Growth automation routes
app.use('/api/viral', viralRoutes); // Viral features routes
app.use('/api/test-project', testProjectRoutes); // Test project routes
app.use('/api/files', createFilesRoutes(fileManagementConfig)); // File management routes

// Admin Dashboard
app.use('/admin', adminDashboard);

// API usage tracking middleware
app.use('/api/v1', async (req, res, next) => {
  const startTime = Date.now();

  // Store original res.json to track response
  const originalJson = res.json;
  res.json = function(data) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Track API usage asynchronously
    if (req.apiKey) {
      setImmediate(async () => {
        try {
          await query(
            `INSERT INTO api_usage
             (api_key_id, endpoint, method, status_code, response_time, request_size, response_size, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              req.apiKey.id,
              req.path,
              req.method,
              res.statusCode,
              responseTime,
              JSON.stringify(req.body).length,
              JSON.stringify(data).length,
              req.ip,
              req.get('User-Agent') || ''
            ]
          );
        } catch (error) {
          console.error('Failed to track API usage:', error);
        }
      });
    }

    return originalJson.call(this, data);
  };

  next();
});

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Telegram Labeling Platform API',
}));

// API info endpoint
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'API v1 - Labeling Platform Backend with AI Assistance',
    version: '3.0.0',
    features: [
      'Enhanced consensus system (2/3 or 3/3 agreement)',
      'Accuracy-based bonuses (20% for >90% accuracy)',
      'Worker warnings and blocking system',
      'Comprehensive statistics and tracking',
      'Honeypot quality control',
      'AI-assisted labeling (reduces consensus from 3 to 2 workers)',
      'Automated suspicious pattern detection',
      'AI validation and quality assurance'
    ],
    endpoints: {
      tasks: {
        'GET /api/tasks/next': 'Get next available task for worker',
        'POST /api/tasks/:id/label': 'Submit task label',
        'POST /api/tasks/:id/skip': 'Skip a task'
      },
      worker: {
        'GET /api/worker/stats': 'Get detailed worker statistics',
        'GET /api/worker/history': 'Get worker task history',
        'GET /api/worker/leaderboard': 'Get top workers leaderboard',
        'GET /api/tasks/next': 'Get next task (enhanced with QC)',
        'POST /api/tasks/:id/label': 'Submit label (enhanced with QC)',
        'POST /api/tasks/:id/skip': 'Skip task (with rate limiting)'
      }
    },
    qualityControl: {
      consensus: {
        description: 'Tasks require 3 labels for consensus',
        partial: '2/3 agreement marks task as partially complete',
        conflict: 'All different labels go to 2 more workers',
        complete: '3+ matching labels complete the task'
      },
      accuracy: {
        bonus: '>90% accuracy earns 20% bonus',
        warning: '<70% accuracy triggers warning',
        blocking: '<50% accuracy results in blocking'
      },
      honeypot: 'Every 10th task is pre-labeled for QC'
    }
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    await initDatabase();

    // Run enhanced quality control migration
    try {
      const migrationPath = join(__dirname, '../../migrations/add_enhanced_quality_control.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      await query(migrationSQL);
      console.log('✅ Enhanced quality control migration applied');
    } catch (err) {
      console.log('ℹ️ Enhanced QC migration already applied or not needed');
    }

    // Run AI assistance migration
    try {
      const aiMigrationPath = join(__dirname, '../../migrations/add_ai_assistance.sql');
      const aiMigrationSQL = readFileSync(aiMigrationPath, 'utf8');
      await query(aiMigrationSQL);
      console.log('✅ AI assistance migration applied');
    } catch (err) {
      console.log('ℹ️ AI assistance migration already applied or not needed');
    }

    // Run growth automation migration
    try {
      const growthMigrationPath = join(__dirname, '../../migrations/add_growth_automation.sql');
      const growthMigrationSQL = readFileSync(growthMigrationPath, 'utf8');
      await query(growthMigrationSQL);
      console.log('✅ Growth automation migration applied');
    } catch (err) {
      console.log('ℹ️ Growth automation migration already applied or not needed');
    }

    // Run viral features migration
    try {
      const viralMigrationPath = join(__dirname, '../../migrations/add_viral_features.sql');
      const viralMigrationSQL = readFileSync(viralMigrationPath, 'utf8');
      await query(viralMigrationSQL);
      console.log('✅ Viral features migration applied');
    } catch (err) {
      console.log('ℹ️ Viral features migration already applied or not needed');
    }

    // Initialize Redis
    await initRedis();

    // Run API usage migration
    try {
      const apiUsagePath = join(__dirname, '../../migrations/003_add_api_usage.sql');
      const apiUsageSQL = readFileSync(apiUsagePath, 'utf8');
      await query(apiUsageSQL);
      console.log('✅ API usage tracking migration applied');
    } catch (err) {
      console.log('ℹ️ API usage migration already applied or not needed');
    }

    // Initialize WebSocket service
    const wsService = new WebSocketService(server);
    console.log('✅ WebSocket service initialized');

    // Make WebSocket service available globally
    (global as any).wsService = wsService;

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Backend server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔧 API endpoints:`);
      console.log(`   Basic:`);
      console.log(`   GET  /api/tasks/next - Get next task`);
      console.log(`   POST /api/tasks/:id/label - Submit label`);
      console.log(`   POST /api/tasks/:id/skip - Skip task`);
      console.log(`   Enhanced:`);
      console.log(`   GET  /api/tasks/next - Get next task (enhanced)`);
      console.log(`   GET  /api/worker/stats - Get worker statistics`);
      console.log(`   GET  /api/worker/history - Get task history`);
      console.log(`   GET  /api/worker/leaderboard - Get leaderboard`);
      console.log(`   AI-Assisted:`);
      console.log(`   POST /api/tasks/validate - Validate label with AI`);
      console.log(`   POST /api/tasks/:id/prelabel - Prelabel task with AI`);
      console.log(`   GET  /api/tasks/next-ai - Get AI-assisted task`);
      console.log(`   GET  /api/ai/stats - AI assistance statistics`);
      console.log(`   Growth Automation:`);
      console.log(`   POST /api/growth/free-tier/init - Initialize 100 free labels`);
      console.log(`   POST /api/growth/automations/twitter/run - Run Twitter bot`);
      console.log(`   POST /api/growth/automations/reddit/run - Run Reddit bot`);
      console.log(`   POST /api/growth/automations/email/run - Send cold emails`);
      console.log(`   GET  /api/growth/analytics/overview - Growth analytics`);
      console.log(`   Viral Features:`);
      console.log(`   GET  /api/viral/leaderboard - Public leaderboard`);
      console.log(`   GET  /api/viral/achievements - User achievements`);
      console.log(`   POST /api/viral/referral/process - Process referral`);
      console.log(`   POST /api/viral/milestone/create - Create shareable milestone`);
      console.log(`   GET  /api/viral/dashboard - Viral dashboard`);
      console.log(`   Enterprise API:`);
      console.log(`   POST /api/v1/projects - Create project`);
      console.log(`   POST /api/v1/projects/:id/upload - Upload data`);
      console.log(`   GET  /api/v1/projects/:id/status - Get status`);
      console.log(`   GET  /api/v1/projects/:id/results - Get results`);
      console.log(`   POST /api/v1/keys - Create API key`);
      console.log(`   GET  /api/v1/keys - List API keys`);
      console.log(`   PUT  /api/v1/keys/:id - Update API key`);
      console.log(`   DEL  /api/v1/keys/:id - Delete API key`);
      console.log(`   GET  /api/v1/keys/:id/usage - Get API key usage`);
      console.log(`   Test Project:`);
      console.log(`   POST /api/test-project/create - Create test project`);
      console.log(`   GET  /api/test-project/:id/progress - Get project progress`);
      console.log(`   GET  /api/test-project/:id/updates - Real-time updates (SSE)`);
      console.log(`   POST /api/test-project/:id/simulate - Simulate workers`);
      console.log(`   Admin Dashboard:`);
      console.log(`   GET  /admin - View admin dashboard`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();