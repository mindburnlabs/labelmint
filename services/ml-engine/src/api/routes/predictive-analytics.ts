/**
 * Predictive Analytics API Routes
 * RESTful endpoints for predictions and model management
 */

import { Router, Request, Response } from 'express';
import { predictiveAnalyticsService } from '@/services/PredictiveAnalyticsService';
import { logger, mlLogger } from '@/utils/logger';
import {
  PredictionRequest,
  PredictionResponse,
  BatchPredictionRequest
} from '@/types/ml.types';

const router = Router();

/**
 * POST /api/v1/predictive-analytics/predict
 * Make a single prediction
 */
router.post('/predict', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const request: PredictionRequest = {
      model_type: req.body.model_type,
      entity_id: req.body.entity_id,
      entity_type: req.body.entity_type || 'user',
      features: req.body.features || {},
      include_feature_importance: req.body.include_feature_importance || false,
    };

    if (!request.model_type || !request.entity_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'model_type and entity_id are required',
        },
      });
    }

    mlLogger.prediction('Processing prediction request', {
      modelType: request.model_type,
      entityId: request.entity_id,
      entityType: request.entity_type,
      hasFeatures: Object.keys(request.features).length > 0,
    });

    const result: PredictionResponse = await predictiveAnalyticsService.predict(request);

    const processingTime = Date.now() - startTime;

    mlLogger.prediction('Prediction completed', {
      modelType: request.model_type,
      entityId: request.entity_id,
      predictedValue: result.prediction.predicted_value,
      confidence: result.prediction.confidence,
      processingTime: result.processing_time_ms,
      apiProcessingTime: processingTime,
    });

    res.json({
      success: true,
      data: result,
      meta: {
        processed_at: new Date(),
        api_processing_time_ms: processingTime,
        model_version: result.model_version,
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    mlLogger.error('Prediction request failed', error as Error, {
      modelType: req.body.model_type,
      entityId: req.body.entity_id,
      processingTime,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'PREDICTION_FAILED',
        message: 'Failed to process prediction request',
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
 * POST /api/v1/predictive-analytics/batch-predict
 * Make batch predictions
 */
router.post('/batch-predict', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { model_type, entity_ids, priority = 'normal' } = req.body;

    if (!model_type || !entity_ids || !Array.isArray(entity_ids)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'model_type and entity_ids array are required',
        },
      });
    }

    if (entity_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_ENTITY_LIST',
          message: 'entity_ids array cannot be empty',
        },
      });
    }

    if (entity_ids.length > 1000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_TOO_LARGE',
          message: 'Maximum batch size is 1000 entities',
        },
      });
    }

    mlLogger.prediction('Processing batch prediction request', {
      modelType: model_type,
      entityCount: entity_ids.length,
      priority,
    });

    const result = await predictiveAnalyticsService.batchPredict(entity_ids, model_type);

    const processingTime = Date.now() - startTime;

    mlLogger.prediction('Batch prediction request submitted', {
      jobId: result.job_id,
      modelType: model_type,
      entityCount: entity_ids.length,
      status: result.status,
      processingTime,
    });

    const statusCode = result.status === 'failed' ? 500 : 202;

    res.status(statusCode).json({
      success: result.status !== 'failed',
      data: result,
      meta: {
        submitted_at: new Date(),
        api_processing_time_ms: processingTime,
        priority,
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    mlLogger.error('Batch prediction request failed', error as Error, {
      modelType: req.body.model_type,
      entityCount: req.body.entity_ids?.length || 0,
      processingTime,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_PREDICTION_FAILED',
        message: 'Failed to submit batch prediction request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      meta: {
        submitted_at: new Date(),
        api_processing_time_ms: processingTime,
      },
    });
  }
});

/**
 * GET /api/v1/predictive-analytics/batch/:jobId
 * Get batch prediction job status
 */
router.get('/batch/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = predictiveAnalyticsService.getBatchJobStatus(jobId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Batch prediction job not found: ${jobId}`,
        },
      });
    }

    res.json({
      success: true,
      data: result,
      meta: {
        retrieved_at: new Date(),
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get batch job status', error as Error, {
      jobId: req.params.jobId,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'JOB_STATUS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve batch prediction job status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/predictive-analytics/models
 * Get available predictive models and their statistics
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = predictiveAnalyticsService.getModelStats();

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
    mlLogger.error('Failed to get model statistics', error as Error);

    res.status(500).json({
      success: false,
      error: {
        code: 'MODEL_STATS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve model statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/predictive-analytics/models/:modelType
 * Get detailed information about a specific model
 */
router.get('/models/:modelType', async (req: Request, res: Response) => {
  try {
    const { modelType } = req.params;
    const models = predictiveAnalyticsService.getModelStats();

    const model = models.find(m => m.type === modelType);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MODEL_NOT_FOUND',
          message: `Model not found: ${modelType}`,
        },
      });
    }

    res.json({
      success: true,
      data: model,
      meta: {
        retrieved_at: new Date(),
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get model details', error as Error, {
      modelType: req.params.modelType,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'MODEL_DETAILS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve model details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * POST /api/v1/predictive-analytics/models/:modelType/retrain
 * Trigger model retraining
 */
router.post('/models/:modelType/retrain', async (req: Request, res: Response) => {
  try {
    const { modelType } = req.params;
    const { force = false } = req.body;

    // Check if model exists
    const models = predictiveAnalyticsService.getModelStats();
    const model = models.find(m => m.type === modelType);

    if (!model) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MODEL_NOT_FOUND',
          message: `Model not found: ${modelType}`,
        },
      });
    }

    mlLogger.prediction('Model retraining triggered', {
      modelType,
      force,
      triggeredBy: (req.user as any)?.id ?? 'unknown',
    });

    // In a real implementation, this would trigger actual model retraining
    // For now, return a success response with job information

    const jobId = `retrain_${modelType}_${Date.now()}`;

    res.json({
      success: true,
      data: {
        job_id: jobId,
        model_type: modelType,
        status: 'queued',
        estimated_duration: '15-30 minutes',
        message: 'Model retraining job has been queued',
      },
      meta: {
        triggered_at: new Date(),
        force_retrain: force,
      },
    });

  } catch (error) {
    mlLogger.error('Failed to trigger model retraining', error as Error, {
      modelType: req.params.modelType,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'MODEL_RETRAINING_FAILED',
        message: 'Failed to trigger model retraining',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/predictive-analytics/predictions/:entityId
 * Get recent predictions for an entity
 */
router.get('/predictions/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const { model_type, limit = 10 } = req.query;

    // In a real implementation, this would query the prediction store
    // For now, return placeholder data

    const predictions = [
      {
        id: `${entityId}_churn_${Date.now()}`,
        model_type: 'churn',
        predicted_value: 0.15,
        confidence: 0.87,
        predicted_at: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        id: `${entityId}_revenue_${Date.now()}`,
        model_type: 'revenue',
        predicted_value: 1250.50,
        confidence: 0.92,
        predicted_at: new Date(Date.now() - 7200000), // 2 hours ago
      },
    ];

    const filteredPredictions = model_type
      ? predictions.filter(p => p.model_type === model_type)
      : predictions;

    const limitedPredictions = filteredPredictions.slice(0, parseInt(limit as string) || 10);

    res.json({
      success: true,
      data: {
        entity_id: entityId,
        predictions: limitedPredictions,
        total: filteredPredictions.length,
      },
      meta: {
        retrieved_at: new Date(),
        filters: { model_type, limit },
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get entity predictions', error as Error, {
      entityId: req.params.entityId,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'PREDICTIONS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve entity predictions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/predictive-analytics/analytics/trends
 * Get prediction trends and analytics
 */
router.get('/analytics/trends', async (req: Request, res: Response) => {
  try {
    const { model_type, period = '7d' } = req.query;

    // In a real implementation, this would query prediction analytics
    // For now, return placeholder data

    const trends = {
      model_type: model_type || 'all',
      period,
      predictions_over_time: [
        { date: '2024-01-20', count: 1250, avg_confidence: 0.85 },
        { date: '2024-01-21', count: 1320, avg_confidence: 0.87 },
        { date: '2024-01-22', count: 1180, avg_confidence: 0.83 },
        { date: '2024-01-23', count: 1450, avg_confidence: 0.89 },
        { date: '2024-01-24', count: 1390, avg_confidence: 0.86 },
        { date: '2024-01-25', count: 1510, avg_confidence: 0.88 },
        { date: '2024-01-26', count: 1280, avg_confidence: 0.84 },
      ],
      accuracy_trends: [
        { date: '2024-01-20', accuracy: 0.82 },
        { date: '2024-01-21', accuracy: 0.85 },
        { date: '2024-01-22', accuracy: 0.83 },
        { date: '2024-01-23', accuracy: 0.87 },
        { date: '2024-01-24', accuracy: 0.86 },
        { date: '2024-01-25', accuracy: 0.88 },
        { date: '2024-01-26', accuracy: 0.85 },
      ],
      summary: {
        total_predictions: 9380,
        average_confidence: 0.86,
        average_accuracy: 0.85,
        high_confidence_predictions: 7654,
        model_performance: {
          churn: { accuracy: 0.87, predictions: 3120 },
          revenue: { accuracy: 0.84, predictions: 2980 },
          quality: { accuracy: 0.86, predictions: 3280 },
        },
      },
    };

    res.json({
      success: true,
      data: trends,
      meta: {
        retrieved_at: new Date(),
        period,
        model_type,
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get prediction trends', error as Error, {
      modelType: req.query.model_type,
      period: req.query.period,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'TRENDS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve prediction trends',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/predictive-analytics/health
 * Health check endpoint for predictive analytics service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isActive = predictiveAnalyticsService.isActive();
    const stats = predictiveAnalyticsService.getServiceStats();

    const health = {
      status: isActive ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      service: 'predictive-analytics',
      models: {
        total: stats.modelsCount,
        active: stats.modelsCount,
      },
      jobs: {
        active: stats.activeJobs,
        cache_size: stats.cacheSize,
      },
      scheduled_tasks: stats.scheduledTasks,
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
        message: 'Predictive analytics service health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export { router as predictiveAnalyticsRoutes };
export default router;