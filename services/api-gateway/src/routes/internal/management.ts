import { Router, Request, Response } from 'express';
import { requireRole } from '@middleware/auth/authMiddleware';
import { invalidatePattern, invalidateUrl, getCacheStats } from '@middleware/cache/cacheMiddleware';
import { healthChecker } from '@services/health';
import { serviceRegistry } from '@services/registry';
import { metricsCollector } from '@services/metrics';
import { logger } from '@utils/logger';
import { asyncHandler } from '@middleware/errorHandler';

const router = Router();

/**
 * @swagger
 * /internal/management/stats:
 *   get:
 *     summary: Get gateway statistics
 *     tags: [Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gateway statistics
 */
router.get('/stats', requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const stats = {
    services: serviceRegistry.getAllServices(),
    health: healthChecker.getAllServiceHealth(),
    cache: await getCacheStats(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  };

  res.json(stats);
}));

/**
 * @swagger
 * /internal/management/cache/invalidate:
 *   post:
 *     summary: Invalidate cache entries
 *     tags: [Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pattern:
 *                 type: string
 *                 description: Pattern to match cache keys
 *               url:
 *                 type: string
 *                 description: Specific URL to invalidate
 *     responses:
 *       200:
 *         description: Cache invalidated
 */
router.post('/cache/invalidate', requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { pattern, url } = req.body;

  if (pattern) {
    await invalidatePattern(pattern);
    logger.info('Cache invalidated by pattern', { pattern, user: (req as any).user?.id });
    res.json({ message: 'Cache invalidated by pattern', pattern });
  } else if (url) {
    await invalidateUrl(url);
    logger.info('Cache invalidated by URL', { url, user: (req as any).user?.id });
    res.json({ message: 'Cache invalidated by URL', url });
  } else {
    res.status(400).json({ error: 'Either pattern or url must be provided' });
  }
}));

/**
 * @swagger
 * /internal/management/services/recheck:
 *   post:
 *     summary: Trigger health check for all services
 *     tags: [Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health checks triggered
 */
router.post('/services/recheck', requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await healthChecker.checkAllServices();
  logger.info('Manual health check triggered', { user: (req as any).user?.id });
  res.json({ message: 'Health checks triggered', results: healthChecker.getAllServiceHealth() });
}));

/**
 * @swagger
 * /internal/management/logs:
 *   get:
 *     summary: Get recent logs
 *     tags: [Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *     responses:
 *       200:
 *         description: Recent logs
 */
router.get('/logs', requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { level, limit = 100 } = req.query;

  // In production, you'd query your log storage system
  // For now, return a placeholder response
  res.json({
    message: 'Log retrieval not implemented',
    level,
    limit,
    note: 'In production, integrate with ELK stack or similar'
  });
}));

/**
 * @swagger
 * /internal/management/metrics/export:
 *   get:
 *     summary: Export metrics in various formats
 *     tags: [Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, prometheus]
 *           default: json
 *     responses:
 *       200:
 *         description: Metrics exported
 */
router.get('/metrics/export', requireRole(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { format = 'json' } = req.query;

  if (format === 'prometheus') {
    const metrics = await metricsCollector.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } else {
    const metrics = await metricsCollector.getMetrics();
    res.json({ format, metrics });
  }
}));

export default router;