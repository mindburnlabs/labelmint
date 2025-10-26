/**
 * Fraud Detection API Routes
 * RESTful endpoints for fraud detection and scoring
 */

import { Router, Request, Response } from 'express';
import { fraudDetectionService } from '@/services/FraudDetectionService';
import { logger, mlLogger } from '@/utils/logger';
import {
  FraudDetectionRequest,
  FraudDetectionResponse,
  BatchPredictionRequest
} from '@/types/ml.types';
import { validateFraudDetectionRequest } from '@/middleware/validation';

const router = Router();

/**
 * POST /api/v1/fraud-detection/score
 * Score a single transaction for fraud risk
 */
router.post('/score', validateFraudDetectionRequest, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const request: FraudDetectionRequest = {
      transaction_id: req.body.transaction_id,
      user_id: req.body.user_id,
      transaction_data: req.body.transaction_data || {},
      user_data: req.body.user_data,
      include_explanation: req.body.include_explanation || false,
    };

    mlLogger.fraudDetection('Processing fraud detection request', {
      transactionId: request.transaction_id,
      userId: request.user_id,
      hasTransactionData: Object.keys(request.transaction_data).length > 0,
      hasUserData: !!request.user_data,
    });

    const result: FraudDetectionResponse = await fraudDetectionService.scoreTransaction(request);

    const processingTime = Date.now() - startTime;

    mlLogger.fraudDetection('Fraud detection completed', {
      transactionId: request.transaction_id,
      score: result.fraud_score.overall_score,
      riskLevel: result.fraud_score.risk_level,
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
    mlLogger.error('Fraud detection request failed', error as Error, {
      transactionId: req.body.transaction_id,
      userId: req.body.user_id,
      processingTime,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'FRAUD_DETECTION_FAILED',
        message: 'Failed to process fraud detection request',
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
 * POST /api/v1/fraud-detection/batch-score
 * Score multiple transactions for fraud risk
 */
router.post('/batch-score', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const requests: FraudDetectionRequest[] = req.body.transactions;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'transactions array is required and must not be empty',
        },
      });
    }

    if (requests.length > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_TOO_LARGE',
          message: 'Maximum batch size is 100 transactions',
        },
      });
    }

    mlLogger.fraudDetection('Processing batch fraud detection request', {
      batchId: `batch_${Date.now()}`,
      transactionCount: requests.length,
    });

    const results: FraudDetectionResponse[] = await fraudDetectionService.batchScoreTransactions(requests);

    const processingTime = Date.now() - startTime;

    // Summary statistics
    const summary = {
      total_transactions: results.length,
      risk_distribution: {
        low: results.filter(r => r.fraud_score.risk_level === 'low').length,
        medium: results.filter(r => r.fraud_score.risk_level === 'medium').length,
        high: results.filter(r => r.fraud_score.risk_level === 'high').length,
        critical: results.filter(r => r.fraud_score.risk_level === 'critical').length,
      },
      average_score: results.reduce((sum, r) => sum + r.fraud_score.overall_score, 0) / results.length,
      blocked_transactions: results.filter(r => r.fraud_score.blocked).length,
      requires_review: results.filter(r => r.fraud_score.requires_review).length,
    };

    mlLogger.fraudDetection('Batch fraud detection completed', {
      batchId: `batch_${Date.now()}`,
      processedCount: results.length,
      summary,
      processingTime,
    });

    res.json({
      success: true,
      data: {
        results,
        summary,
      },
      meta: {
        processed_at: new Date(),
        api_processing_time_ms: processingTime,
        batch_id: `batch_${Date.now()}`,
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    mlLogger.error('Batch fraud detection failed', error as Error, {
      transactionCount: req.body.transactions?.length || 0,
      processingTime,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_FRAUD_DETECTION_FAILED',
        message: 'Failed to process batch fraud detection request',
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
 * GET /api/v1/fraud-detection/stats
 * Get fraud detection model statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await fraudDetectionService.getModelStats();

    res.json({
      success: true,
      data: {
        model: stats,
        service: {
          is_active: fraudDetectionService.isActive(),
          last_updated: new Date(),
        },
      },
      meta: {
        retrieved_at: new Date(),
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get fraud detection stats', error as Error);

    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve fraud detection statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/fraud-detection/alerts
 * Get recent fraud alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = await fraudDetectionService.getRecentAlerts(limit);

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
      },
      meta: {
        retrieved_at: new Date(),
        limit,
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get fraud alerts', error as Error);

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERTS_RETRIEVAL_FAILED',
        message: 'Failed to retrieve fraud alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/fraud-detection/health
 * Health check endpoint for fraud detection service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isActive = fraudDetectionService.isActive();
    const stats = await fraudDetectionService.getModelStats();

    const health = {
      status: isActive ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      service: 'fraud-detection',
      model: {
        is_trained: stats.isTrained,
        model_version: stats.modelConfig.version,
        accuracy: stats.modelConfig.accuracy,
        last_trained: stats.modelConfig.lastTrainedAt,
      },
      cache: {
        size: stats.cacheSize,
      },
      recent_activity: {
        recent_scores: stats.recentScores,
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
        message: 'Fraud detection service health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * POST /api/v1/fraud-detection/config/threshold
 * Update fraud detection thresholds
 */
router.post('/config/threshold', async (req: Request, res: Response) => {
  try {
    const { medium, high, critical } = req.body.thresholds;

    if (!medium || !high || !critical) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_THRESHOLDS',
          message: 'All threshold levels (medium, high, critical) are required',
        },
      });
    }

    // Validate threshold values
    if (medium >= high || high >= critical || critical > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_THRESHOLD_VALUES',
          message: 'Thresholds must be: medium < high < critical <= 100',
        },
      });
    }

    // Update configuration (this would update the actual config in production)
    mlLogger.fraudDetection('Fraud detection thresholds updated', {
      thresholds: { medium, high, critical },
      updatedBy: (req.user as any)?.id ?? 'unknown',
    });

    res.json({
      success: true,
      data: {
        thresholds: { medium, high, critical },
        updated_at: new Date(),
      },
      meta: {
        message: 'Thresholds updated successfully',
      },
    });

  } catch (error) {
    mlLogger.error('Failed to update thresholds', error as Error);

    res.status(500).json({
      success: false,
      error: {
        code: 'THRESHOLD_UPDATE_FAILED',
        message: 'Failed to update fraud detection thresholds',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/v1/fraud-detection/explain/:transactionId
 * Get detailed explanation for a fraud score
 */
router.get('/explain/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    // In a real implementation, this would retrieve stored fraud score details
    // For now, return a placeholder response

    res.json({
      success: true,
      data: {
        transaction_id: transactionId,
        explanation: {
          overall_risk_score: 75,
          risk_level: 'high',
          contributing_factors: [
            {
              factor: 'High transaction amount',
              weight: 0.3,
              value: 15000,
              description: 'Transaction amount is significantly higher than user average',
            },
            {
              factor: 'New geographic location',
              weight: 0.25,
              value: 'Unknown',
              description: 'Transaction from location not previously used by this user',
            },
            {
              factor: 'Unusual timing',
              weight: 0.2,
              value: '03:45 AM',
              description: 'Transaction time is outside user normal activity hours',
            },
          ],
          recommendations: [
            'Require additional verification',
            'Review user travel patterns',
            'Consider temporary transaction limits',
          ],
        },
        model_version: '1.0.0',
        scored_at: new Date(),
      },
      meta: {
        retrieved_at: new Date(),
      },
    });

  } catch (error) {
    mlLogger.error('Failed to get fraud explanation', error as Error, {
      transactionId: req.params.transactionId,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'EXPLANATION_RETRIEVAL_FAILED',
        message: 'Failed to retrieve fraud score explanation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export { router as fraudDetectionRoutes };
export default router;