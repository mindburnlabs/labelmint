import { Router } from 'express'
import { SSOController } from '../controllers/SSOController.js'
import { body, param, query } from 'express-validator'
import { authMiddleware } from '../middleware/auth.js'
import { tenantMiddleware } from '../middleware/tenant.js'

const router = Router()

// Apply middleware to all routes except SSO endpoints
router.use(tenantMiddleware)

/**
 * @route   POST /organizations/:organizationId/sso/config
 * @desc    Create SSO configuration
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/sso/config',
  authMiddleware,
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('provider').isIn(['saml', 'oidc', 'oauth2', 'ldap']).withMessage('Invalid provider'),
    body('enabled').isBoolean().withMessage('Enabled must be boolean'),
    body('config').isObject().withMessage('Config must be an object')
  ],
  SSOController.createConfig
)

/**
 * @route   GET /organizations/:organizationId/sso/config
 * @desc    Get SSO configuration
 * @access  Private (requires organization:read permission)
 */
router.get(
  '/organizations/:organizationId/sso/config',
  authMiddleware,
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID')
  ],
  SSOController.getConfig
)

/**
 * @route   PUT /organizations/:organizationId/sso/config
 * @desc    Update SSO configuration
 * @access  Private (requires organization:manage permission)
 */
router.put(
  '/organizations/:organizationId/sso/config',
  authMiddleware,
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('provider').optional().isIn(['saml', 'oidc', 'oauth2', 'ldap']).withMessage('Invalid provider'),
    body('enabled').optional().isBoolean().withMessage('Enabled must be boolean'),
    body('config').optional().isObject().withMessage('Config must be an object')
  ],
  SSOController.updateConfig
)

/**
 * @route   POST /organizations/:organizationId/sso/test
 * @desc    Test SSO configuration
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/sso/test',
  authMiddleware,
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('provider').isIn(['saml', 'oidc', 'oauth2', 'ldap']).withMessage('Invalid provider'),
    body('config').isObject().withMessage('Config must be an object')
  ],
  SSOController.testConfig
)

/**
 * @route   GET /organizations/:organizationId/sso/metadata
 * @desc    Get SAML metadata
 * @access  Public
 */
router.get(
  '/organizations/:organizationId/sso/metadata',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID')
  ],
  SSOController.getMetadata
)

/**
 * @route   POST /organizations/:organizationId/sso/login
 * @desc    Initiate SSO login
 * @access  Public
 */
router.post(
  '/organizations/:organizationId/sso/login',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    query('relayState').optional().isString().withMessage('Relay state must be string'),
    query('format').optional().isIn(['json']).withMessage('Invalid format')
  ],
  SSOController.initiateSSO
)

/**
 * @route   POST /organizations/:organizationId/sso/acs
 * @desc    SAML Assertion Consumer Service
 * @access  Public
 */
router.post(
  '/organizations/:organizationId/sso/acs',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('SAMLResponse').notEmpty().withMessage('SAML response is required'),
    body('RelayState').optional().isString().withMessage('Relay state must be string')
  ],
  SSOController.handleSSOResponse
)

/**
 * @route   POST /organizations/:organizationId/sso/disable
 * @desc    Disable SSO
 * @access  Private (requires organization:manage permission)
 */
router.post(
  '/organizations/:organizationId/sso/disable',
  authMiddleware,
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID')
  ],
  SSOController.disableSSO
)

/**
 * @route   POST /organizations/:organizationId/sso/validate
 * @desc    Validate SSO token
 * @access  Public
 */
router.post(
  '/organizations/:organizationId/sso/validate',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('token').notEmpty().withMessage('Token is required')
  ],
  SSOController.validateToken
)

/**
 * @route   POST /organizations/:organizationId/sso/logout
 * @desc    Logout from SSO
 * @access  Public
 */
router.post(
  '/organizations/:organizationId/sso/logout',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID'),
    body('token').notEmpty().withMessage('Token is required')
  ],
  SSOController.logout
)

export default router