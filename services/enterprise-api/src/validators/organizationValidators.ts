import { body, param, validationResult } from 'express-validator'
import { z } from 'zod'

// Zod schemas for validation
export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  domain: z.string().optional().trim(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  settings: z.object({
    timezone: z.string().optional(),
    locale: z.string().optional(),
    currency: z.string().optional(),
    branding: z.object({
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      companyName: z.string().optional()
    }).optional()
  }).optional()
})

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  domain: z.string().trim().optional(),
  logo: z.string().url().optional(),
  settings: z.object({
    timezone: z.string().optional(),
    locale: z.string().optional(),
    currency: z.string().optional()
  }).optional()
}).partial()

export const updateSettingsSchema = z.object({
  timezone: z.string().optional(),
  locale: z.string().optional(),
  currency: z.string().optional(),
  dateFormat: z.string().optional(),
  features: z.record(z.boolean()).optional(),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    companyName: z.string().optional(),
    supportEmail: z.string().email().optional()
  }).optional(),
  workflows: z.object({
    requireApproval: z.boolean().optional(),
    autoAssignTasks: z.boolean().optional(),
    consensusThreshold: z.number().min(0).max(1).optional()
  }).optional(),
  security: z.object({
    mfaRequired: z.boolean().optional(),
    sessionTimeout: z.number().min(5).max(1440).optional()
  }).optional()
}).partial()

export const updateSubscriptionSchema = z.object({
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  status: z.enum(['active', 'trialing', 'past_due', 'cancelled', 'unpaid']).optional(),
  features: z.record(z.boolean()).optional(),
  limits: z.record(z.number()).optional()
}).partial()

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'manager', 'member', 'viewer']),
  teamIds: z.array(z.string()).optional(),
  message: z.string().max(500).optional()
})

export const acceptInvitationSchema = z.object({
  token: z.string().uuid()
})

// Express-validator rules for compatibility
export const validateCreateOrganization = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('domain')
    .optional()
    .isURL({ require_protocol: false })
    .withMessage('Domain must be a valid URL'),
  body('plan')
    .optional()
    .isIn(['starter', 'professional', 'enterprise'])
    .withMessage('Invalid plan type')
]

export const validateUpdateOrganization = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('domain')
    .optional()
    .isURL({ require_protocol: false })
    .withMessage('Domain must be a valid URL')
]

export const validateUpdateSettings = [
  body('timezone')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Timezone is required'),
  body('locale')
    .optional()
    .matches(/^[a-z]{2}-[A-Z]{2}$/)
    .withMessage('Locale must be in format en-US'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be 3 characters (e.g., USD)'),
  body('branding.primaryColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Primary color must be a valid hex color'),
  body('workflows.consensusThreshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Consensus threshold must be between 0 and 1'),
  body('security.sessionTimeout')
    .optional()
    .isInt({ min: 5, max: 1440 })
    .withMessage('Session timeout must be between 5 and 1440 minutes')
]

export const validateUpdateSubscription = [
  body('plan')
    .optional()
    .isIn(['starter', 'professional', 'enterprise'])
    .withMessage('Invalid plan type'),
  body('status')
    .optional()
    .isIn(['active', 'trialing', 'past_due', 'cancelled', 'unpaid'])
    .withMessage('Invalid subscription status')
]

export const validateInviteUser = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('role')
    .isIn(['owner', 'admin', 'manager', 'member', 'viewer'])
    .withMessage('Invalid role'),
  body('teamIds')
    .optional()
    .isArray()
    .withMessage('Team IDs must be an array'),
  body('message')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters')
]

export const validateAcceptInvitation = [
  body('token')
    .isUUID()
    .withMessage('Valid invitation token is required')
]

export const validateOrganizationId = [
  param('id')
    .isUUID()
    .withMessage('Valid organization ID is required')
]

export const validateMetricsQuery = [
  param('id').isUUID().withMessage('Valid organization ID is required'),
  // Period validation (7d, 30d, 90d, 1y)
  // Add custom validation if needed
]

// Validation middleware factory
export const validate = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        })
      }
      next(error)
    }
  }
}

// Validation result handler
export const handleValidationErrors = (req: any, res: any, next: any): void => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((error: any) => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    })
    return
  }
  next()
}