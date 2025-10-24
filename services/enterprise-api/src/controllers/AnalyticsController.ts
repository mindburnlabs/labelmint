import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { AnalyticsService } from '../services/AnalyticsService.js'
import { logger } from '../utils/logger.js'

export class AnalyticsController {
  static async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const range = AnalyticsService.parseRange(req.query.startDate as string | undefined, req.query.endDate as string | undefined)
      const { data, cached } = await AnalyticsService.getOverview(organizationId, range)

      res.json({
        success: true,
        data,
        cached
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('date')) {
        res.status(400).json({ success: false, error: error.message })
        return
      }

      logger.error('Failed to fetch analytics overview', {
        organizationId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  static async getUserAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const range = AnalyticsService.parseRange(req.query.startDate as string | undefined, req.query.endDate as string | undefined)
      const data = await AnalyticsService.getUserAnalytics(organizationId, range)

      res.json({
        success: true,
        data
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('date')) {
        res.status(400).json({ success: false, error: error.message })
        return
      }
      logger.error('Failed to fetch user analytics', {
        organizationId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  static async getProjectAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const range = AnalyticsService.parseRange(req.query.startDate as string | undefined, req.query.endDate as string | undefined)
      const data = await AnalyticsService.getProjectAnalytics(organizationId, range)

      res.json({
        success: true,
        data
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('date')) {
        res.status(400).json({ success: false, error: error.message })
        return
      }
      logger.error('Failed to fetch project analytics', {
        organizationId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  static async getWorkflowAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const range = AnalyticsService.parseRange(req.query.startDate as string | undefined, req.query.endDate as string | undefined)
      const data = await AnalyticsService.getWorkflowAnalytics(organizationId, range)

      res.json({
        success: true,
        data
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('date')) {
        res.status(400).json({ success: false, error: error.message })
        return
      }
      logger.error('Failed to fetch workflow analytics', {
        organizationId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  static async getMetric(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      const metric = req.query.metric as any
      const range = AnalyticsService.parseRange(req.query.startDate as string | undefined, req.query.endDate as string | undefined)
      const data = await AnalyticsService.getMetric(organizationId, metric, range)

      res.json({
        success: true,
        data
      })
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Unsupported metric') || error.message.includes('date'))) {
        res.status(400).json({ success: false, error: error.message })
        return
      }
      logger.error('Failed to fetch analytics metric', {
        organizationId: req.params.organizationId,
        metric: req.query.metric,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  static async exportData(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.params
      AnalyticsController.getUserId(req)
      const { startDate, endDate, metrics } = req.body as { startDate: string; endDate: string; metrics: string[] }
      const options = {
        startDate,
        endDate,
        metrics: metrics as AnalyticsServiceExportMetric[]
      }

      const exportResult = await AnalyticsService.exportToCsv(organizationId, options)

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`)
      res.send(exportResult.content)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid')) {
        res.status(400).json({ success: false, error: error.message })
        return
      }
      logger.error('Failed to export analytics data', {
        organizationId: req.params.organizationId,
        error: error instanceof Error ? error.message : String(error)
      })
      next(error)
    }
  }

  private static getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id
    if (!userId) {
      throw new Error('User authentication required')
    }
    return userId
  }
}

type AnalyticsServiceExportMetric = Parameters<typeof AnalyticsService.exportToCsv>[1]['metrics'][number]
