/**
 * Anomaly Detection API Routes
 * RESTful endpoints for anomaly detection and behavioral analysis
 */

import { Router, Request, Response } from 'express';
import { anomalyDetectionService } from '@/services/AnomalyDetectionService';
import { logger, mlLogger } from '@/utils/logger';
import {
  UserBehaviorFeatures,
  TransactionFeatures
} from '@/types/ml.types';

const router = Router();

/**
 * POST /api/v1/anomaly-detection/analyze-user
 * Analyze user behavior for anomalies
 */
router.post('/analyze-user', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { userId, features } = req.body;

    if (!userId || !features) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'userId and features are required',
        },
      });
    }

    mlLogger.anomalyDetection('Processing user anomaly analysis', {
      userId,
      featuresCount: Object.keys(features).length,
    });

    const anomalies = await anomalyDetectionService.detectUserBehaviorAnomalies(userId, features);

    const processingTime = Date.now() - startTime;

    const summary = {
      total_anomalies: anomalies.length,
      anomaly_types: {
        statistical: anomalies.filter(a => a.anomaly_type === 'statistical').length,
        behavioral: anomalies.filter(a => a.anomaly_type === 'behavioral').length,
        temporal: anomalies.filter(a => a.anomaly_type === 'temporal').length,
        network: anomalies.filter(a => a.anomaly_type === 'network').length,
        geographic: anomalies.filter(a => a.anomaly_type === 'geographic').length,
      },
      severity_distribution: {
        low: anomalies.filter(a => a.anomaly_score < 30).length,
        medium: anomalies.filter(a => a.anomaly_score >= 30 && a.anomaly_score < 70).length,
        high: anomalies.filter(a => a.anomaly_score >= 70 && a.anomaly_score < 90).length,
        critical: anomalies.filter(a => a.anomaly_score >= 90).length,
      },
      requires_investigation: anomalies.filter(a => a.requires_investigation).length,
    };

    mlLogger.anomalyDetection('User anomaly analysis completed', {
      userId,
      anomalyCount: anomalies.length,
      maxScore: anomalies.length > 0 ? Math.max(...anomalies.map(a => a.anomaly_score)) : 0,
      processingTime,
    });

    res.json({
      success: true,
      data: {
        user_id: userId,
        anomalies,
        summary,
        risk_level: summary.requires_investigation > 0 ? 'high' : summary.total_anomalies > 0 ? 'medium' : 'low',
      },
      meta: {
        analyzed_at: new Date(),
        api_processing_time_ms: processingTime,
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    mlLogger.error('User anomaly analysis failed', error as Error, {
      userId: req.body.userId,
      processingTime,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ANOMALY_ANALYSIS_FAILED',
        message: 'Failed to analyze user behavior for anomalies',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      meta: {
        processed_at: new Date(),
        api_processing_time_ms: processingTime,
      },
    });
  }
});

/**
 * POST /api/v1/anomaly-detection/analyze-transaction
 * Analyze transaction for anomalous patterns
 */
router.post('/analyze-transaction', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { transactionId, userId, features } = req.body;

    if (!transactionId || !userId || !features) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'transactionId, userId, and features are required',
        },
      });
    }

    mlLogger.anomalyDetection('Processing transaction anomaly analysis', {
      transactionId,
      userId,
      featuresCount: Object.keys(features).length,
    });

    const anomalies = await anomalyDetectionService.detectTransactionAnomalies(
      transactionId,
      userId,
      features
    );

    const processingTime = Date.now() - startTime;

    const summary = {
      total_anomalies: anomalies.length,
      max_anomaly_score: anomalies.length > 0 ? Math.max(...anomalies.map(a => a.anomaly_score)) : 0,
      affected_metrics: anomalies.flatMap(a => a.affected_metrics),
      requires_investigation: anomalies.filter(a => a.requires_investigation).length,
    };

    mlLogger.anomalyDetection('Transaction anomaly analysis completed', {
      transactionId,
      userId,
      anomalyCount: anomalies.length,
      processingTime,
    });

    res.json({
      success: true,
      data: {
        transaction_id: transactionId,
        user_id: userId,
        anomalies,
        summary,
        risk_level: summary.requires_investigation > 0 ? 'high' : summary.total_anomalies > 0 ? 'medium' : 'low',
      },
      meta: {
        analyzed_at: new Date(),
        api_processing_time_ms: processingTime,
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    mlLogger.error('Transaction anomaly analysis failed', error as Error, {
      transactionId: req.body.transactionId,
      userId: req.body.userId,
      processingTime,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'TRANSACTION_ANOMALY_ANALYSIS_FAILED',
        message: 'Failed to analyze transaction for anomalies',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      meta: {
        processed_at: new Date(),
        api_processing_time_ms: processingTime,
      },
    });
  }
});

/**
 * POST /api/v1/anomaly-detection/analyze-system
 * Analyze system performance metrics for anomalies
 */
router.post('/analyze-system', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { metrics } = req.body;

    if (!metrics) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'metrics are required',
        },
      });
    }

    const requiredMetrics = ['cpu_usage', 'memory_usage', 'disk_io', 'network_io', 'response_time', 'error_rate', 'throughput'];
    const missingMetrics = requiredMetrics.filter(metric => !(metric in metrics));

    if (missingMetrics.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_METRICS',
          message: `Missing required metrics: ${missingMetrics.join(', ')}`,
        },
      });
    }

    mlLogger.anomalyDetection('Processing system anomaly analysis', {
      metricsCount: Object.keys(metrics).length,
    });

    const anomalies = await anomalyDetectionService.detectSystemAnomalies(metrics);

    const processingTime = Date.now() - startTime;

    const summary = {
      total_anomalies: anomalies.length,
      system_health_score: anomalies.length === 0 ? 100 : Math.max(0, 100 - Math.max(...anomalies.map(a => a.anomaly_score))),
      performance_impact: anomalies.map(a => ({
        metric: a.affected_metrics.join(', '),
        impact_score: a.anomaly_score,
        recommendation: this.getSystemRecommendation(a),
      })),
    };

    mlLogger.anomalyDetection('System anomaly analysis completed', {
      anomalyCount: anomalies.length,
      healthScore: summary.system_health_score,
      processingTime,
    });

    res.json({
      success: true,
      data: {
        anomalies,
        summary,
        system_status: summary.system_health_score >= 80 ? 'healthy' : summary.system_health_score >= 60 ? 'warning' : 'critical',
      },
      meta: {
        analyzed_at: new Date(),
        api_processing_time_ms: processingTime,
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    mlLogger.error('System anomaly analysis failed', error as Error, {
      processingTime,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_ANOMALY_ANALYSIS_FAILED',
        message: 'Failed to analyze system metrics for anomalies',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      meta: {
        processed_at: new Date(),
        api_processing_time_ms: processingTime,
      },
    });
  }
});

/**
 * GET /api/v1/anomaly-detection/trends
 * Get anomaly trends and analytics
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const { timeWindow = 24, entityType } = req.query;

    const trends = await anomalyDetectionService.analyzeAnomalyTrends(
      parseInt(timeWindow as string),
      entityType as string
    );

    res.json({
      success: true,
      data: trends,
      meta: {
        retrieved_at: new Date(),
        timeWindow: parseInt(timeWindow as string),
        entityType,
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get anomaly trends', error as Error, {
      timeWindow: req.query.timeWindow,
      entityType: req.query.entityType,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'TRENDS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve anomaly trends',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/anomaly-detection/entities/:entityId/anomalies
 * Get recent anomalies for a specific entity
 */
router.get('/entities/:entityId/anomalies', async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const { limit = 50 } = req.query;

    const anomalies = anomalyDetectionService.getEntityAnomalies(
      entityId,
      parseInt(limit as string)
    );

    const summary = {
      total_anomalies: anomalies.length,
      recent_anomalies: anomalies.filter(a =>
        (Date.now() - a.detected_at.getTime()) < 24 * 60 * 60 * 1000 // Last 24 hours
      ).length,
      severity_distribution: {
        low: anomalies.filter(a => a.anomaly_score < 30).length,
        medium: anomalies.filter(a => a.anomaly_score >= 30 && a.anomaly_score < 70).length,
        high: anomalies.filter(a => a.anomaly_score >= 70 && a.anomaly_score < 90).length,
        critical: anomalies.filter(a => a.anomaly_score >= 90).length,
      },
    };

    res.json({
      success: true,
      data: {
        entity_id: entityId,
        anomalies,
        summary,
      },
      meta: {
        retrieved_at: new Date(),
        limit: parseInt(limit as string),
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get entity anomalies', error as Error, {
      entityId: req.params.entityId,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ENTITY_ANOMALIES_RETRIEVAL_FAILED',
        message: 'Failed to retrieve entity anomalies',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/anomaly-detection/models
 * Get anomaly detection model statistics
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = anomalyDetectionService.getModelStats();

    res.json({
      success: true,
      data: {
        models,
        total: models.length,
      },
      meta: {
        retrieved_at: new Date(),
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get anomaly model statistics', error as Error);

    res.status(500).json({
      success: false,
      error: {
        code: 'MODEL_STATS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve anomaly detection model statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * POST /api/v1/anomaly-detection/models/:modelName/update
 * Update anomaly detection model with new data
 */
router.post('/models/:modelName/update', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.params;
    const { force = false } = req.body;

    // Check if model exists
    const models = anomalyDetectionService.getModelStats();
    const model = models.find(m => m.name === modelName);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MODEL_NOT_FOUND',
          message: `Anomaly detection model not found: ${modelName}`,
        },
      });
    }

    mlLogger.anomalyDetection('Model update triggered', {
      modelName,
      force,
      triggeredBy: req.user?.id || 'unknown',
    });

    // Trigger model update
    await anomalyDetectionService.updateModels();

    res.json({
      success: true,
      data: {
        model_name: modelName,
        status: 'updated',
        message: 'Model has been updated with latest data',
      },
      meta: {
        updated_at: new Date(),
        force_update: force,
      },
    });

  } catch (error) {
    mlLogger.error('Failed to update anomaly model', error as Error, {
      modelName: req.params.modelName,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'MODEL_UPDATE_FAILED',
        message: 'Failed to update anomaly detection model',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/anomaly-detection/alerts
 * Get recent anomaly alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { limit = 50, severity } = req.query;

    // In a real implementation, this would query actual alert storage
    const alerts = [
      {
        id: 'alert_1',
        type: 'behavioral_anomaly',
        severity: 'high',
        message: 'Unusual login pattern detected for user_123',
        entity_id: 'user_123',
        detected_at: new Date(Date.now() - 3600000),
        requires_investigation: true,
      },
      {
        id: 'alert_2',
        type: 'performance_anomaly',
        severity: 'warning',
        message: 'System response time elevated above normal thresholds',
        entity_id: 'system_main',
        detected_at: new Date(Date.now() - 1800000),
        requires_investigation: false,
      },
    ];

    let filteredAlerts = alerts;
    if (severity) {
      filteredAlerts = alerts.filter(alert => alert.severity === severity);
    }

    const limitedAlerts = filteredAlerts.slice(0, parseInt(limit as string) || 50);

    res.json({
      success: true,
      data: {
        alerts: limitedAlerts,
        total: filteredAlerts.length,
        active_count: alerts.filter(a => a.requires_investigation).length,
      },
      meta: {
        retrieved_at: new Date(),
        limit: parseInt(limit as string) || 50,
        severity,
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get anomaly alerts', error as Error, {
      severity: req.query.severity,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERTS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve anomaly alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/anomaly-detection/health
 * Health check endpoint for anomaly detection service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isActive = anomalyDetectionService.isActive();
    const stats = anomalyDetectionService.getServiceStats();

    const health = {
      status: isActive ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      service: 'anomaly-detection',
      models: {
        total: stats.modelsCount,
        active: stats.modelsCount,
      },
      monitoring: {
        tracked_entities: stats.trackedEntities,
        total_anomalies: stats.totalAnomalies,
        last_update: stats.lastUpdate,
      },
    };

    const statusCode = isActive ? 200 : 503;

    res.status(statusCode).json({
      success: isActive,
      data: health,
    });

  } catch (error) {
    mlLogger.error('Health check failed', error as Error);

    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Anomaly detection service health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Helper function to get system recommendations based on anomaly type
 */
function getSystemRecommendation(anomaly: any): string {
  const affectedMetrics = anomaly.affected_metrics;

  if (affectedMetrics.includes('cpu_usage')) {
    return 'Consider scaling up resources or optimizing CPU-intensive processes';
  }
  if (affectedMetrics.includes('memory_usage')) {
    return 'Monitor memory leaks and consider increasing memory allocation';
  }
  if (affectedMetrics.includes('response_time')) {
    return 'Investigate slow queries and optimize database performance';
  }
  if (affectedMetrics.includes('error_rate')) {
    return 'Review application logs and fix underlying errors';
  }
  if (affectedMetrics.includes('throughput')) {
    return 'Analyze capacity constraints and consider load balancing';
  }

  return 'Monitor system metrics and investigate unusual patterns';
}

export { router as anomalyDetectionRoutes };
export default router;