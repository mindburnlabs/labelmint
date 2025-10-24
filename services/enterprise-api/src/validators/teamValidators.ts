import { body, param, query, validationResult } from 'express-validator'
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

// Zod schemas for validation
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  settings: z.object({
    isPublic: z.boolean().optional(),
    allowJoinRequests: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    maxMembers: z.number().min(1).max(1000).optional(),
    defaultRole: z.enum(['owner', 'admin', 'manager', 'lead', 'member', 'viewer']).optional(),
    permissions: z.object({
      canCreateProjects: z.boolean().optional(),
      canInviteMembers: z.boolean().optional(),
      canManageSettings: z.boolean().optional(),
      canViewAnalytics: z.boolean().optional()
    }).optional(),
    notifications: z.object({
      newMember: z.boolean().optional(),
      projectUpdates: z.boolean().optional(),
      mentions: z.boolean().optional()
    }).optional()
  }).optional()
})

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  settings: z.object({
    isPublic: z.boolean().optional(),
    allowJoinRequests: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    maxMembers: z.number().min(1).max(1000).optional(),
    defaultRole: z.enum(['owner', 'admin', 'manager', 'lead', 'member', 'viewer']).optional(),
    permissions: z.object({
      canCreateProjects: z.boolean().optional(),
      canInviteMembers: z.boolean().optional(),
      canManageSettings: z.boolean().optional(),
      canViewAnalytics: z.boolean().optional()
    }).optional(),
    notifications: z.object({
      newMember: z.boolean().optional(),
      projectUpdates: z.boolean().optional(),
      mentions: z.boolean().optional()
    }).optional()
  }).optional()
})

export const inviteMemberSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'manager', 'lead', 'member', 'viewer']),
  message: z.string().max(500).optional()
}).refine(
  (data) => data.userId || data.email,
  {
    message: "Either userId or email must be provided",
    path: ["userId"]
  }
)

export const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'manager', 'lead', 'member', 'viewer'])
})

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid()
})

// Express-validator chains for middleware
export const validateCreateTeam = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),
  body('settings.isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('settings.allowJoinRequests')
    .optional()
    .isBoolean()
    .withMessage('allowJoinRequests must be a boolean'),
  body('settings.requireApproval')
    .optional()
    .isBoolean()
    .withMessage('requireApproval must be a boolean'),
  body('settings.maxMembers')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('maxMembers must be between 1 and 1000'),
  body('settings.defaultRole')
    .optional()
    .isIn(['owner', 'admin', 'manager', 'lead', 'member', 'viewer'])
    .withMessage('Invalid default role'),
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
      return
    }
    next()
  }
]

export const validateUpdateTeam = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
      return
    }
    next()
  }
]

export const validateInviteMember = [
  body('userId')
    .optional()
    .isUUID()
    .withMessage('userId must be a valid UUID'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('email must be a valid email address'),
  body('role')
    .isIn(['admin', 'manager', 'lead', 'member', 'viewer'])
    .withMessage('Invalid role'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message must not exceed 500 characters'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    // Custom validation: ensure either userId or email is provided
    const { userId, email } = req.body
    if (!userId && !email) {
      res.status(400).json({
        success: false,
        error: 'Either userId or email must be provided'
      })
      return
    }

    next()
  }
]

export const validateUpdateMemberRole = [
  body('role')
    .isIn(['owner', 'admin', 'manager', 'lead', 'member', 'viewer'])
    .withMessage('Invalid role'),
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
      return
    }
    next()
  }
]

export const validateTransferOwnership = [
  body('newOwnerId')
    .isUUID()
    .withMessage('newOwnerId must be a valid UUID'),
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
      return
    }
    next()
  }
]

export const validateIdParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid team ID'),
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
      return
    }
    next()
  }
]

export const validateOrganizationIdParam = [
  param('organizationId')
    .isUUID()
    .withMessage('Invalid organization ID'),
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
      return
    }
    next()
  }
]

export const validateMemberIdParam = [
  param('memberId')
    .isUUID()
    .withMessage('Invalid member ID'),
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
      return
    }
    next()
  }
]

export const validateQueryParams = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must not exceed 100 characters'),
  query('status')
    .optional()
    .isIn(['active', 'archived'])
    .withMessage('Status must be either active or archived'),
  query('role')
    .optional()
    .isIn(['owner', 'admin', 'manager', 'lead', 'member', 'viewer'])
    .withMessage('Invalid role filter'),
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
      return
    }
    next()
  }
]

// Helper function to validate with Zod
export function validateWithZod(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        })
        return
      }
      next(error)
    }
  }
}