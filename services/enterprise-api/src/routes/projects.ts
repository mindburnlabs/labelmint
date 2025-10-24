import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from '../middleware/auth.js'
import { tenantMiddleware } from '../middleware/tenant.js'
import { ProjectController } from '../controllers/ProjectController.js'
import {
  validateOrganizationIdParam,
  validateProjectIdParam,
  validateMemberIdParam,
  validateCreateProject,
  validateUpdateProject,
  validateListProjectsQuery,
  validateProjectMemberPayload,
  validateAnalyticsQuery
} from '../validators/projectValidators.js'
import { checkSubscriptionLimit } from '../middleware/multiTenant.js'

const router = Router()

const projectRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many project management requests, please try again later.'
  }
})

router.use(authMiddleware)
router.use(tenantMiddleware)
router.use(projectRateLimit)

router.get(
  '/organizations/:organizationId/projects',
  validateOrganizationIdParam,
  validateListProjectsQuery,
  ProjectController.list
)

router.post(
  '/organizations/:organizationId/projects',
  validateOrganizationIdParam,
  validateCreateProject,
  checkSubscriptionLimit('projects'),
  ProjectController.create
)

router.get(
  '/organizations/:organizationId/projects/:projectId',
  validateOrganizationIdParam,
  validateProjectIdParam,
  ProjectController.get
)

router.patch(
  '/organizations/:organizationId/projects/:projectId',
  validateOrganizationIdParam,
  validateProjectIdParam,
  validateUpdateProject,
  ProjectController.update
)

router.delete(
  '/organizations/:organizationId/projects/:projectId',
  validateOrganizationIdParam,
  validateProjectIdParam,
  ProjectController.archive
)

router.post(
  '/organizations/:organizationId/projects/:projectId/restore',
  validateOrganizationIdParam,
  validateProjectIdParam,
  ProjectController.restore
)

router.get(
  '/organizations/:organizationId/projects/:projectId/members',
  validateOrganizationIdParam,
  validateProjectIdParam,
  ProjectController.listMembers
)

router.post(
  '/organizations/:organizationId/projects/:projectId/members',
  validateOrganizationIdParam,
  validateProjectIdParam,
  validateProjectMemberPayload,
  ProjectController.addMember
)

router.delete(
  '/organizations/:organizationId/projects/:projectId/members/:memberId',
  validateOrganizationIdParam,
  validateProjectIdParam,
  validateMemberIdParam,
  ProjectController.removeMember
)

router.get(
  '/organizations/:organizationId/projects/:projectId/analytics',
  validateOrganizationIdParam,
  validateProjectIdParam,
  validateAnalyticsQuery,
  ProjectController.analytics
)

export default router
