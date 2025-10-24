import { Router } from 'express';
import { notificationService } from '../../services/notifications/NotificationService';
import { Logger } from '../../utils/logger';
import { authenticateAdmin } from '../../middleware/auth';

const logger = new Logger('NotificationsRoutes');
const router = Router();

// Apply admin authentication to all routes
router.use(authenticateAdmin);

/**
 * GET /api/admin/notifications/status
 * Get notification service status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await notificationService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get notification status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification status',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/notifications/test-low-balance
 * Send a test low balance alert
 */
router.post('/test-low-balance', async (req, res) => {
  try {
    const result = await notificationService.testNotifications();

    if (result.success) {
      logger.info('Test low balance notification sent successfully');
      res.json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('Test low balance notification failed', result.message);
      res.status(500).json({
        success: false,
        error: 'Test notification failed',
        message: result.message
      });
    }
  } catch (error) {
    logger.error('Failed to send test low balance notification', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/notifications/send-custom-alert
 * Send a custom system alert
 */
router.post('/send-custom-alert', async (req, res) => {
  try {
    const { type, severity, message } = req.body;

    if (!type || !severity || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, severity, message'
      });
    }

    await notificationService.sendSystemAlert({
      type,
      severity,
      message,
      data: req.body.data || {},
      timestamp: new Date()
    });

    logger.info(`Custom alert sent: ${type} (${severity})`);
    res.json({
      success: true,
      message: 'Custom alert sent successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to send custom alert', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send custom alert',
      message: error.message
    });
  }
});

export default router;