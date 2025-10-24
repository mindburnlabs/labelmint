import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { AnalyticsController } from '../controllers/AnalyticsController.js'
import {
  validateOrganizationIdParam,
  validateOptionalRangeQuery,
  validateMetricQuery,
  validateExportRequest
} from '../validators/analyticsValidators.js'
import { authMiddleware } from '../middleware/auth.js'
import { tenantMiddleware } from '../middleware/tenant.js'

const router = Router()

const analyticsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many analytics requests, please try again later.'
  }
})

router.use(authMiddleware)
router.use(tenantMiddleware)
router.use(analyticsRateLimit)

router.get(
  '/organizations/:organizationId/analytics/overview',
  validateOrganizationIdParam,
  validateOptionalRangeQuery,
  AnalyticsController.getOverview
)

router.get(
  '/organizations/:organizationId/analytics/users',
  validateOrganizationIdParam,
  validateOptionalRangeQuery,
  AnalyticsController.getUserAnalytics
)

router.get(
  '/organizations/:organizationId/analytics/projects',
  validateOrganizationIdParam,
  validateOptionalRangeQuery,
  AnalyticsController.getProjectAnalytics
)

router.get(
  '/organizations/:organizationId/analytics/workflows',
  validateOrganizationIdParam,
  validateOptionalRangeQuery,
  AnalyticsController.getWorkflowAnalytics
)

router.get(
  '/organizations/:organizationId/analytics/metric',
  validateOrganizationIdParam,
  validateMetricQuery,
  AnalyticsController.getMetric
)

router.post(
  '/organizations/:organizationId/analytics/export',
  validateOrganizationIdParam,
  validateExportRequest,
  AnalyticsController.exportData
)

export default router
