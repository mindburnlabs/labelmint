import { Router, Request, Response } from 'express';
import { analyticsService } from '../../../services/analytics/AnalyticsService';
import { requireAuth } from '../../../middleware/auth';
import { requireAdmin } from '../../../middleware/adminAuth';

const router = Router();

/**
 * @route POST /api/v1/analytics/track
 * @desc Track custom analytics event
 * @access Private (or Public with anonymous tracking)
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const {
      eventName,
      eventType,
      eventData,
      userProperties,
      platform = 'web'
    } = req.body;

    if (!eventName || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'eventName and eventType are required'
      });
    }

    const event = {
      eventName,
      eventType,
      userId: req.auth?.payload.userId,
      sessionId: req.headers['x-session-id'] as string,
      eventData: eventData || {},
      userProperties: userProperties || {},
      platform,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    await analyticsService.trackEvent(event);

    res.json({
      success: true,
      message: 'Event tracked successfully'
    });
  } catch (error: any) {
    console.error('Error tracking event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track event',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/v1/analytics/page-view
 * @desc Track page view
 * @access Public (with optional user tracking)
 */
router.post('/page-view', async (req: Request, res: Response) => {
  try {
    const { page, title, referrer } = req.body;

    if (!page) {
      return res.status(400).json({
        success: false,
        error: 'page is required'
      });
    }

    await analyticsService.trackPageView({
      userId: req.auth?.payload.userId,
      sessionId: req.headers['x-session-id'] as string,
      page,
      title,
      referrer,
      platform: 'web',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Page view tracked successfully'
    });
  } catch (error: any) {
    console.error('Error tracking page view:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track page view'
    });
  }
});

/**
 * @route POST /api/v1/analytics/interaction
 * @desc Track user interaction
 * @access Public
 */
router.post('/interaction', async (req: Request, res: Response) => {
  try {
    const {
      elementType,
      elementId,
      elementText,
      action,
      page
    } = req.body;

    if (!elementType || !action || !page) {
      return res.status(400).json({
        success: false,
        error: 'elementType, action, and page are required'
      });
    }

    await analyticsService.trackInteraction({
      userId: req.auth?.payload.userId,
      sessionId: req.headers['x-session-id'] as string,
      elementType,
      elementId,
      elementText,
      action,
      page,
      platform: 'web',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Interaction tracked successfully'
    });
  } catch (error: any) {
    console.error('Error tracking interaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track interaction'
    });
  }
});

/**
 * @route POST /api/v1/analytics/conversion
 * @desc Track conversion event
 * @access Private
 */
router.post('/conversion', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      conversionType,
      value,
      currency,
      items,
      metadata
    } = req.body;

    if (!conversionType) {
      return res.status(400).json({
        success: false,
        error: 'conversionType is required'
      });
    }

    await analyticsService.trackConversion({
      userId: req.auth!.payload.userId,
      sessionId: req.headers['x-session-id'] as string,
      conversionType,
      value,
      currency,
      items,
      metadata,
      platform: 'web',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Conversion tracked successfully'
    });
  } catch (error: any) {
    console.error('Error tracking conversion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track conversion'
    });
  }
});

/**
 * @route POST /api/v1/analytics/task-completion
 * @desc Track task completion
 * @access Private
 */
router.post('/task-completion', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      taskId,
      taskType,
      timeSpent,
      quality
    } = req.body;

    if (!taskId || !taskType) {
      return res.status(400).json({
        success: false,
        error: 'taskId and taskType are required'
      });
    }

    await analyticsService.trackTaskCompletion({
      userId: req.auth!.payload.userId,
      sessionId: req.headers['x-session-id'] as string,
      taskId,
      taskType,
      timeSpent,
      quality,
      platform: 'web',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Task completion tracked successfully'
    });
  } catch (error: any) {
    console.error('Error tracking task completion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track task completion'
    });
  }
});

/**
 * @route POST /api/v1/analytics/error
 * @desc Track error events
 * @access Public
 */
router.post('/error', async (req: Request, res: Response) => {
  try {
    const {
      errorType,
      errorMessage,
      stack,
      page
    } = req.body;

    if (!errorType || !errorMessage) {
      return res.status(400).json({
        success: false,
        error: 'errorType and errorMessage are required'
      });
    }

    await analyticsService.trackError({
      userId: req.auth?.payload.userId,
      sessionId: req.headers['x-session-id'] as string,
      errorType,
      errorMessage,
      stack,
      page,
      platform: 'web',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Error tracked successfully'
    });
  } catch (error: any) {
    console.error('Error tracking error event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track error'
    });
  }
});

// ============ A/B Testing Routes ============

/**
 * @route GET /api/v1/analytics/ab-tests/:testName/assignment
 * @desc Get A/B test assignment for user
 * @access Private
 */
router.get('/ab-tests/:testName/assignment', requireAuth, async (req: Request, res: Response) => {
  try {
    const { testName } = req.params;
    const userId = req.auth!.payload.userId;

    const variant = await analyticsService.getABTestAssignment(
      userId,
      testName,
      req.user || {}
    );

    res.json({
      success: true,
      data: {
        testName,
        variant,
        userId
      }
    });
  } catch (error: any) {
    console.error('Error getting A/B test assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get test assignment'
    });
  }
});

/**
 * @route POST /api/v1/analytics/ab-tests/:testName/convert
 * @desc Track A/B test conversion
 * @access Private
 */
router.post('/ab-tests/:testName/convert', requireAuth, async (req: Request, res: Response) => {
  try {
    const { testName } = req.params;
    const { metric, value = 1 } = req.body;
    const userId = req.auth!.payload.userId;

    if (!metric) {
      return res.status(400).json({
        success: false,
        error: 'metric is required'
      });
    }

    await analyticsService.trackABTestConversion(userId, testName, metric, value);

    res.json({
      success: true,
      message: 'Conversion tracked successfully'
    });
  } catch (error: any) {
    console.error('Error tracking A/B test conversion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track conversion'
    });
  }
});

/**
 * @route POST /api/v1/admin/analytics/ab-tests
 * @desc Create A/B test
 * @access Admin
 */
router.post('/admin/analytics/ab-tests', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const testConfig = req.body;
    const createdBy = req.auth!.payload.userId;

    const test = await analyticsService.createABTest(testConfig, createdBy);

    res.json({
      success: true,
      data: test
    });
  } catch (error: any) {
    console.error('Error creating A/B test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create A/B test',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/v1/admin/analytics/ab-tests/:testId/results
 * @desc Get A/B test results
 * @access Admin
 */
router.get('/admin/analytics/ab-tests/:testId/results', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const results = await analyticsService.getABTestResults(testId);

    if (!results) {
      return res.status(404).json({
        success: false,
        error: 'A/B test not found'
      });
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    console.error('Error getting A/B test results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get test results'
    });
  }
});

/**
 * @route POST /api/v1/admin/analytics/funnel
 * @desc Get funnel analysis
 * @access Admin
 */
router.post('/admin/analytics/funnel', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      steps,
      startDate,
      endDate,
      userId
    } = req.body;

    if (!steps || !Array.isArray(steps) || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'steps (array), startDate, and endDate are required'
      });
    }

    const funnel = await analyticsService.getFunnelAnalysis(
      steps,
      new Date(startDate),
      new Date(endDate),
      userId
    );

    res.json({
      success: true,
      data: funnel
    });
  } catch (error: any) {
    console.error('Error getting funnel analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get funnel analysis',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/v1/admin/analytics/users/:userId/behavior
 * @desc Get user behavior analytics
 * @access Admin
 */
router.get('/admin/analytics/users/:userId/behavior', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const behavior = await analyticsService.getUserBehaviorAnalytics(
      userId,
      parseInt(days as string)
    );

    res.json({
      success: true,
      data: behavior
    });
  } catch (error: any) {
    console.error('Error getting user behavior:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user behavior'
    });
  }
});

/**
 * @route POST /api/v1/admin/analytics/process-events
 * @desc Process pending analytics events
 * @access Admin
 */
router.post('/admin/analytics/process-events', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const processedCount = await analyticsService.processPendingEvents();

    res.json({
      success: true,
      data: {
        processedEvents: processedCount
      },
      message: `Processed ${processedCount} events`
    });
  } catch (error: any) {
    console.error('Error processing events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process events'
    });
  }
});

/**
 * @route POST /api/v1/admin/analytics/cleanup
 * @desc Cleanup old analytics events
 * @access Admin
 */
router.post('/admin/analytics/cleanup', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { retentionDays = 90 } = req.body;

    const deletedCount = await analyticsService.cleanupOldEvents(retentionDays);

    res.json({
      success: true,
      data: {
        deletedEvents: deletedCount,
        retentionDays
      },
      message: `Deleted ${deletedCount} old events`
    });
  } catch (error: any) {
    console.error('Error cleaning up events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup events'
    });
  }
});

export default router;