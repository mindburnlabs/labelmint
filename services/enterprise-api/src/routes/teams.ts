import { Router } from 'express'
import { TeamController } from '../controllers/TeamController.js'
import {
  validateCreateTeam,
  validateUpdateTeam,
  validateInviteMember,
  validateUpdateMemberRole,
  validateTransferOwnership,
  validateIdParam,
  validateOrganizationIdParam,
  validateMemberIdParam,
  validateQueryParams,
  validateWithZod,
  createTeamSchema,
  updateTeamSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema
} from '../validators/teamValidators.js'
import { authMiddleware } from '../middleware/auth.js'
import { tenantMiddleware } from '../middleware/tenant.js'
import { rateLimit } from 'express-rate-limit'

const router = Router()

// Rate limiting for team operations
const teamRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many team requests, please try again later.'
  }
})

// Apply middleware to all routes
router.use(authMiddleware)
router.use(tenantMiddleware)
router.use(teamRateLimit)

/**
 * @route   POST /organizations/:organizationId/teams
 * @desc    Create a new team
 * @access  Private
 */
router.post(
  '/organizations/:organizationId/teams',
  validateOrganizationIdParam,
  validateCreateTeam,
  TeamController.create
)

/**
 * @route   GET /organizations/:organizationId/teams
 * @desc    Get all teams for an organization
 * @access  Private
 */
router.get(
  '/organizations/:organizationId/teams',
  validateOrganizationIdParam,
  validateQueryParams,
  TeamController.getByOrganization
)

/**
 * @route   GET /organizations/:organizationId/teams/my
 * @desc    Get current user's teams in an organization
 * @access  Private
 */
router.get(
  '/organizations/:organizationId/teams/my',
  validateOrganizationIdParam,
  validateQueryParams,
  TeamController.getUserTeams
)

/**
 * @route   GET /organizations/:organizationId/teams/:id
 * @desc    Get team by ID
 * @access  Private
 */
router.get(
  '/organizations/:organizationId/teams/:id',
  validateOrganizationIdParam,
  validateIdParam,
  TeamController.getById
)

/**
 * @route   PUT /organizations/:organizationId/teams/:id
 * @desc    Update team
 * @access  Private
 */
router.put(
  '/organizations/:organizationId/teams/:id',
  validateOrganizationIdParam,
  validateIdParam,
  validateUpdateTeam,
  TeamController.update
)

/**
 * @route   DELETE /organizations/:organizationId/teams/:id
 * @desc    Archive team
 * @access  Private
 */
router.delete(
  '/organizations/:organizationId/teams/:id',
  validateOrganizationIdParam,
  validateIdParam,
  TeamController.archive
)

/**
 * @route   POST /organizations/:organizationId/teams/:id/restore
 * @desc    Restore archived team
 * @access  Private
 */
router.post(
  '/organizations/:organizationId/teams/:id/restore',
  validateOrganizationIdParam,
  validateIdParam,
  TeamController.restore
)

/**
 * @route   GET /organizations/:organizationId/teams/:id/stats
 * @desc    Get team statistics
 * @access  Private
 */
router.get(
  '/organizations/:organizationId/teams/:id/stats',
  validateOrganizationIdParam,
  validateIdParam,
  TeamController.getStats
)

/**
 * @route   GET /organizations/:organizationId/teams/:id/members
 * @desc    Get team members
 * @access  Private
 */
router.get(
  '/organizations/:organizationId/teams/:id/members',
  validateOrganizationIdParam,
  validateIdParam,
  validateQueryParams,
  TeamController.getMembers
)

/**
 * @route   POST /organizations/:organizationId/teams/:id/members
 * @desc    Invite member to team
 * @access  Private
 */
router.post(
  '/organizations/:organizationId/teams/:id/members',
  validateOrganizationIdParam,
  validateIdParam,
  validateInviteMember,
  TeamController.inviteMember
)

/**
 * @route   PUT /organizations/:organizationId/teams/:id/members/:memberId
 * @desc    Update member role
 * @access  Private
 */
router.put(
  '/organizations/:organizationId/teams/:id/members/:memberId',
  validateOrganizationIdParam,
  validateIdParam,
  validateMemberIdParam,
  validateUpdateMemberRole,
  TeamController.updateMemberRole
)

/**
 * @route   DELETE /organizations/:organizationId/teams/:id/members/:memberId
 * @desc    Remove member from team
 * @access  Private
 */
router.delete(
  '/organizations/:organizationId/teams/:id/members/:memberId',
  validateOrganizationIdParam,
  validateIdParam,
  validateMemberIdParam,
  TeamController.removeMember
)

/**
 * @route   POST /organizations/:organizationId/teams/:id/leave
 * @desc    Leave team
 * @access  Private
 */
router.post(
  '/organizations/:organizationId/teams/:id/leave',
  validateOrganizationIdParam,
  validateIdParam,
  TeamController.leave
)

/**
 * @route   POST /organizations/:organizationId/teams/:id/transfer-ownership
 * @desc    Transfer team ownership
 * @access  Private
 */
router.post(
  '/organizations/:organizationId/teams/:id/transfer-ownership',
  validateOrganizationIdParam,
  validateIdParam,
  validateTransferOwnership,
  TeamController.transferOwnership
)

export default router