import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from '../middleware/auth.js'
import { tenantMiddleware } from '../middleware/tenant.js'
import { DirectoryController } from '../controllers/DirectoryController.js'
import { body, param, query } from 'express-validator'

const router = Router()

const directoryRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many directory requests, please try again later.'
  }
})

router.use(authMiddleware)
router.use(tenantMiddleware)
router.use(directoryRateLimit)

/**
 * @route   POST /organizations/:organizationId/directory/test-connection
 * @desc    Test LDAP/Active Directory connection
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/directory/test-connection',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('provider').isIn(['ldap']).withMessage('Invalid provider'),
    body('config').isObject().withMessage('Configuration is required'),
    body('config.url').notEmpty().withMessage('LDAP URL is required'),
    body('config.bindDN').notEmpty().withMessage('Bind DN is required'),
    body('config.bindCredentials').notEmpty().withMessage('Bind credentials are required'),
    body('config.searchBase').notEmpty().withMessage('Search base is required'),
    body('config.searchFilter').notEmpty().withMessage('Search filter is required')
  ],
  DirectoryController.testConnection
)

/**
 * @route   POST /organizations/:organizationId/directory/authenticate
 * @desc    Authenticate user against directory service
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/directory/authenticate',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('config').isObject().withMessage('Configuration is required'),
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  DirectoryController.authenticateUser
)

/**
 * @route   POST /organizations/:organizationId/directory/sync
 * @desc    Sync users from directory service
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/directory/sync',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('config').isObject().withMessage('Configuration is required')
  ],
  DirectoryController.syncUsers
)

/**
 * @route   POST /organizations/:organizationId/directory/auto-sync/start
 * @desc    Start automatic directory sync
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/directory/auto-sync/start',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('config').isObject().withMessage('Configuration is required')
  ],
  DirectoryController.startAutoSync
)

/**
 * @route   POST /organizations/:organizationId/directory/auto-sync/stop
 * @desc    Stop automatic directory sync
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/directory/auto-sync/stop',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID')
  ],
  DirectoryController.stopAutoSync
)

/**
 * @route   GET /organizations/:organizationId/directory/sync-status
 * @desc    Get directory sync status
 * @access  Private (requires organization:read permission)
 */
router.get(
  '/organizations/:organizationId/directory/sync-status',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID')
  ],
  DirectoryController.getSyncStatus
)

/**
 * @route   POST /organizations/:organizationId/directory/search-users
 * @desc    Search directory users
 * @access  Private (requires organization:read permission)
 */
router.post(
  '/organizations/:organizationId/directory/search-users',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('config').isObject().withMessage('Configuration is required'),
    body('query').isLength({ min: 1 }).withMessage('Search query is required'),
    body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  DirectoryController.searchUsers
)

/**
 * @route   GET /organizations/:organizationId/directory/user-count
 * @desc    Get directory user count
 * @access  Private (requires organization:read permission)
 */
router.get(
  '/organizations/:organizationId/directory/user-count',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID')
  ],
  DirectoryController.getUserCount
)

/**
 * @route   GET /directory/templates/:provider
 * @desc    Get directory configuration template
 * @access  Private
 */
router.get(
  '/directory/templates/:provider',
  [
    param('provider').isIn(['active-directory', 'openldap']).withMessage('Invalid provider')
  ],
  DirectoryController.getConfigTemplate
)

/**
 * @route   POST /directory/validate-config
 * @desc    Validate directory configuration
 * @access  Private
 */
router.post(
  '/directory/validate-config',
  [
    body('provider').isIn(['ldap']).withMessage('Invalid provider'),
    body('config').isObject().withMessage('Configuration is required')
  ],
  DirectoryController.validateConfig
)

export default router