import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from '../middleware/auth.js'
import { tenantMiddleware } from '../middleware/tenant.js'
import { UserController } from '../controllers/UserController.js'
import {
  validateOrganizationIdParam,
  validateUserIdParam,
  validateInviteUser,
  validateUpdateUser,
  validateDeactivateUser,
  validateListQuery,
  validateAnalyticsQuery,
  validateActivityQuery
} from '../validators/userValidators.js'
import { checkSubscriptionLimit } from '../middleware/multiTenant.js'

const router = Router()

const userRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many user management requests, please try again later.'
  }
})

router.use(authMiddleware)
router.use(tenantMiddleware)
router.use(userRateLimit)

router.get(
  '/organizations/:organizationId/users',
  validateOrganizationIdParam,
  validateListQuery,
  UserController.list
)

router.get(
  '/organizations/:organizationId/users/analytics',
  validateOrganizationIdParam,
  validateAnalyticsQuery,
  UserController.analytics
)

router.post(
  '/organizations/:organizationId/users',
  validateOrganizationIdParam,
  validateInviteUser,
  checkSubscriptionLimit('users'),
  UserController.invite
)

router.get(
  '/organizations/:organizationId/users/:userId',
  validateOrganizationIdParam,
  validateUserIdParam,
  UserController.get
)

router.patch(
  '/organizations/:organizationId/users/:userId',
  validateOrganizationIdParam,
  validateUserIdParam,
  validateUpdateUser,
  UserController.update
)

router.post(
  '/organizations/:organizationId/users/:userId/activate',
  validateOrganizationIdParam,
  validateUserIdParam,
  UserController.activate
)

router.post(
  '/organizations/:organizationId/users/:userId/deactivate',
  validateOrganizationIdParam,
  validateUserIdParam,
  validateDeactivateUser,
  UserController.deactivate
)

router.get(
  '/organizations/:organizationId/users/:userId/activity',
  validateOrganizationIdParam,
  validateUserIdParam,
  validateActivityQuery,
  UserController.activity
)

export default router
