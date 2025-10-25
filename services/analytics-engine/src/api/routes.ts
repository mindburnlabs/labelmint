/**
 * Analytics API Routes
 * RESTful API endpoints for analytics services
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AnalyticsService } from '../services/AnalyticsService';
import { ExecutiveAnalyticsService } from '../services/ExecutiveAnalyticsService';
import { ProductAnalyticsService } from '../services/ProductAnalyticsService';
import { OperationalAnalyticsService } from '../services/OperationalAnalyticsService';
import { FinancialAnalyticsService } from '../services/FinancialAnalyticsService';
import { MLAnalyticsService } from '../services/MLAnalyticsService';
import { DataWarehouseService } from '../services/DataWarehouseService';
import { RealTimePipeline } from '../pipeline/RealTimePipeline';
import { getGlobalMetrics } from '@shared/observability/metrics';

const router = Router();

// Initialize services
const dataWarehouse = new DataWarehouseService({
  dataRetention: {
    events: 90,
    aggregates: 365,
    predictions: 30
  },
  processing: {
    batchSize: 100,
    concurrency: 10,
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 30000,
      jitter: true
    }
  },
  caching: {
    ttl: 300000, // 5 minutes
    maxSize: 10000,
    strategy: 'lru'
  },
  monitoring: {
    metricsEnabled: true,
    tracingEnabled: true,
    alertingEnabled: true
  }
});

const analyticsService = new AnalyticsService(dataWarehouse);
const executiveAnalyticsService = new ExecutiveAnalyticsService(dataWarehouse);
const productAnalyticsService = new ProductAnalyticsService(dataWarehouse);
const operationalAnalyticsService = new OperationalAnalyticsService(dataWarehouse);
const financialAnalyticsService = new FinancialAnalyticsService(dataWarehouse);
const mlAnalyticsService = new MLAnalyticsService(dataWarehouse);

// Initialize real-time pipeline
const realTimePipeline = createRealTimePipeline();

// Middleware for request validation and authentication
const authenticateRequest = (req: Request, res: Response, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required'
      }
    });
  }

  // Validate token and extract organization ID
  try {
    const payload = verifyJWT(token); // Implement JWT verification
    req.organizationId = payload.organizationId;
    req.userId = payload.userId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      }
    });
  }
};

// Rate limiting middleware
const rateLimit = (req: Request, res: Response, next: any) => {
  // Implement rate limiting logic
  next();
};

// Request validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['1h', '24h', '7d', '30d', '90d']).optional()
});

const organizationQuerySchema = z.object({
  organizationId: z.string().optional(),
  period: z.enum(['1h', '24h', '7d', '30d', '90d']).optional()
});

/**
 * Executive Analytics Routes
 */
router.get('/executive', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const { startDate, endDate, period } = dateRangeSchema.parse(req.query);
    const organizationId = req.organizationId;

    const dateRange = parseDateRange(startDate, endDate, period);

    const result = await executiveAnalyticsService.getExecutiveDashboard(organizationId, dateRange);

    metrics.increment('api_executive_analytics_requests');
    metrics.observe('api_executive_analytics_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_executive_analytics_errors');
    console.error('Executive analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch executive analytics'
      }
    });
  }
});

router.get('/executive/summary', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const { startDate, endDate, period } = dateRangeSchema.parse(req.query);
    const organizationId = req.organizationId;

    const dateRange = parseDateRange(startDate, endDate, period);

    const result = await executiveAnalyticsService.generateExecutiveSummary(organizationId, dateRange);

    metrics.increment('api_executive_summary_requests');
    metrics.observe('api_executive_summary_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_executive_summary_errors');
    console.error('Executive summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate executive summary'
      }
    });
  }
});

router.get('/executive/board', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const { fiscalYear } = req.query;
    const organizationId = req.organizationId;

    const year = fiscalYear ? parseInt(fiscalYear as string) : new Date().getFullYear();

    const result = await executiveAnalyticsService.getBoardMetrics(organizationId, year);

    metrics.increment('api_board_metrics_requests');
    metrics.observe('api_board_metrics_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_board_metrics_errors');
    console.error('Board metrics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch board metrics'
      }
    });
  }
});

/**
 * Product Analytics Routes
 */
router.get('/product', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const { startDate, endDate, period } = dateRangeSchema.parse(req.query);
    const organizationId = req.organizationId;

    const dateRange = parseDateRange(startDate, endDate, period);

    const result = await productAnalyticsService.getProductAnalytics(organizationId, dateRange);

    metrics.increment('api_product_analytics_requests');
    metrics.observe('api_product_analytics_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_product_analytics_errors');
    console.error('Product analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch product analytics'
      }
    });
  }
});

router.get('/product/feature-adoption', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const { featureId } = req.query;
    const organizationId = req.organizationId;

    if (!featureId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'featureId parameter is required'
        }
      });
    }

    const dateRange = parseDateRange(undefined, undefined, '30d');

    const result = await productAnalyticsService.getFeatureAdoptionDetails(featureId as string, organizationId, dateRange);

    metrics.increment('api_feature_adoption_requests');
    metrics.observe('api_feature_adoption_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_feature_adoption_errors');
    console.error('Feature adoption error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch feature adoption data'
      }
    });
  }
});

/**
 * Operational Analytics Routes
 */
router.get('/operational', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const { startDate, endDate, period } = dateRangeSchema.parse(req.query);
    const organizationId = req.organizationId;

    const dateRange = parseDateRange(startDate, endDate, period);

    const result = await operationalAnalyticsService.getOperationalAnalytics(organizationId, dateRange);

    metrics.increment('api_operational_analytics_requests');
    metrics.observe('api_operational_analytics_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_operational_analytics_errors');
    console.error('Operational analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch operational analytics'
      }
    });
  }
});

router.get('/operational/health-score', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const organizationId = req.organizationId;

    const result = await operationalAnalyticsService.getOperationalHealthScore(organizationId);

    metrics.increment('api_operational_health_requests');
    metrics.observe('api_operational_health_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_operational_health_errors');
    console.error('Operational health score error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch operational health score'
      }
    });
  }
});

/**
 * Financial Analytics Routes
 */
router.get('/financial', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const { startDate, endDate, period } = dateRangeSchema.parse(req.query);
    const organizationId = req.organizationId;

    const dateRange = parseDateRange(startDate, endDate, period);

    const result = await financialAnalyticsService.getFinancialAnalytics(organizationId, dateRange);

    metrics.increment('api_financial_analytics_requests');
    metrics.observe('api_financial_analytics_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_financial_analytics_errors');
    console.error('Financial analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch financial analytics'
      }
    });
  }
});

router.get('/financial/health-score', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const organizationId = req.organizationId;

    const result = await financialAnalyticsService.getFinancialHealthScore(organizationId);

    metrics.increment('api_financial_health_requests');
    metrics.observe('api_financial_health_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_financial_health_errors');
    console.error('Financial health score error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch financial health score'
      }
    });
  }
});

/**
 * ML Analytics Routes
 */
router.get('/ml', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const { startDate, endDate, period, model } = req.query;
    const organizationId = req.organizationId;

    const dateRange = parseDateRange(startDate, endDate, period);

    const result = await mlAnalyticsService.getMLAnalytics(organizationId, dateRange);

    metrics.increment('api_ml_analytics_requests');
    metrics.observe('api_ml_analytics_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_ml_analytics_errors');
    console.error('ML analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch ML analytics'
      }
    });
  }
});

router.get('/ml/health-score', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const organizationId = req.organizationId;

    const result = await mlAnalyticsService.getMLHealthScore(organizationId);

    metrics.increment('api_ml_health_requests');
    metrics.observe('api_ml_health_response_time_ms', Date.now() - startTime);

    res.json(result);
  } catch (error) {
    metrics.increment('api_ml_health_errors');
    console.error('ML health score error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch ML health score'
      }
    });
  }
});

/**
 * Real-time Events Routes
 */
router.post('/events', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const eventSchema = z.object({
      id: z.string(),
      timestamp: z.string().datetime(),
      eventType: z.string(),
      sessionId: z.string().optional(),
      userId: z.string().optional(),
      organizationId: z.string().optional(),
      properties: z.record(z.any()),
      metadata: z.object({
        source: z.string(),
        version: z.string(),
        platform: z.string(),
        userAgent: z.string().optional(),
        ip: z.string().optional(),
        country: z.string().optional(),
        device: z.string().optional()
      })
    });

    const eventData = eventSchema.parse(req.body);

    // Validate organization access
    if (eventData.organizationId && eventData.organizationId !== req.organizationId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot access events for other organizations'
        }
      });
    }

    // Add to real-time pipeline
    realTimePipeline.addEvent({
      ...eventData,
      timestamp: new Date(eventData.timestamp)
    });

    metrics.increment('api_events_ingested');
    metrics.observe('api_events_ingestion_response_time_ms', Date.now() - startTime);

    res.json({
      success: true,
      data: {
        eventId: eventData.id,
        status: 'ingested'
      }
    });
  } catch (error) {
    metrics.increment('api_events_ingestion_errors');
    console.error('Event ingestion error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_EVENT',
        message: 'Invalid event data format'
      }
    });
  }
});

router.post('/events/batch', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const metrics = getGlobalMetrics();

  try {
    const batchSchema = z.object({
      events: z.array(z.object({
        id: z.string(),
        timestamp: z.string().datetime(),
        eventType: z.string(),
        sessionId: z.string().optional(),
        userId: z.string().optional(),
        organizationId: z.string().optional(),
        properties: z.record(z.any()),
        metadata: z.object({
          source: z.string(),
          version: z.string(),
          platform: z.string(),
          userAgent: z.string().optional(),
          ip: z.string().optional(),
          country: z.string().optional(),
          device: z.string().optional()
        })
      }))
    });

    const batchData = batchSchema.parse(req.body);

    // Validate organization access for all events
    const unauthorizedEvents = batchData.events.filter(
      event => event.organizationId && event.organizationId !== req.organizationId
    );

    if (unauthorizedEvents.length > 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot access events for other organizations'
        }
      });
    }

    // Add events to real-time pipeline
    const processedEvents = batchData.events.map(event => ({
      ...event,
      timestamp: new Date(event.timestamp)
    }));

    realTimePipeline.addEvents(processedEvents);

    metrics.increment('api_events_batch_ingested', processedEvents.length);
    metrics.observe('api_events_batch_ingestion_response_time_ms', Date.now() - startTime);

    res.json({
      success: true,
      data: {
        ingestedCount: processedEvents.length,
        eventId: processedEvents[0]?.id
      }
    });
  } catch (error) {
    metrics.increment('api_events_batch_errors');
    console.error('Batch event ingestion error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BATCH',
        message: 'Invalid batch event data format'
      }
    });
  }
});

/**
 * Metrics and Monitoring Routes
 */
router.get('/metrics', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;

    const result = await analyticsService.getMetrics(organizationId as string);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch metrics'
      }
    });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        dataWarehouse: 'healthy',
        realTimePipeline: realTimePipeline.getStats().isRunning ? 'healthy' : 'unhealthy',
        executiveAnalytics: 'healthy',
        productAnalytics: 'healthy',
        operationalAnalytics: 'healthy',
        financialAnalytics: 'healthy',
        mlAnalytics: 'healthy'
      },
      metrics: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * Export Routes
 */
router.get('/export/:type', authenticateRequest, rateLimit, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { startDate, endDate, period } = dateRangeSchema.parse(req.query);
    const { format } = req.query;
    const organizationId = req.organizationId;

    const dateRange = parseDateRange(startDate, endDate, period);
    const exportFormat = (format as string) || 'json';

    let result;
    switch (type) {
      case 'executive':
        result = await executiveAnalyticsService.exportToExcel(organizationId, dateRange, exportFormat);
        break;
      case 'product':
        result = await productAnalyticsService.exportToCSV(organizationId, dateRange, exportFormat);
        break;
      case 'financial':
        result = await financialAnalyticsService.exportToPDF(organizationId, dateRange, exportFormat);
        break;
      case 'ml':
        result = await mlAnalyticsService.exportToJSON(organizationId, dateRange, exportFormat);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_EXPORT_TYPE',
            message: 'Invalid export type. Must be one of: executive, product, financial, ml'
          }
        });
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export data'
      }
    });
  }
});

// Helper functions
function parseDateRange(startDate?: string, endDate?: string, period?: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else if (period) {
    const periodMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000
    };

    const ms = periodMs[period as keyof typeof periodMs];
    end = now;
    start = new Date(now.getTime() - ms);
  } else {
    // Default to last 30 days
    end = now;
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date range');
  }

  if (start > end) {
    throw new Error('Start date must be before end date');
  }

  return { start, end };
}

function verifyJWT(token: string): { organizationId: string; userId: string } {
  // Implement JWT verification logic
  // This is a mock implementation
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return {
      organizationId: payload.organizationId || 'default-org',
      userId: payload.userId || 'default-user'
    };
  } catch (error) {
    throw new Error('Invalid JWT token');
  }
}

function createRealTimePipeline() {
  // Mock implementation - would create actual pipeline
  return {
    addEvent: (event: any) => console.log('Event added:', event),
    addEvents: (events: any[]) => console.log('Events added:', events),
    getStats: () => ({
      isRunning: true,
      bufferSize: 1000,
      processorsCount: 3,
      sinksCount: 2
    })
  } as RealTimePipeline;
}

export default router;