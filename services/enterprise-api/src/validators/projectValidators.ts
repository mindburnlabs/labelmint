import { body, param, query, validationResult } from 'express-validator'
import { Request, Response, NextFunction } from 'express'

const PROJECT_STATUSES = ['planning', 'active', 'review', 'completed', 'archived', 'paused']
const PROJECT_TYPES = [
  'image_classification',
  'text_annotation',
  'audio_transcription',
  'video_annotation',
  'data_validation',
  'custom'
]
const PROJECT_MEMBER_ROLES = ['lead', 'manager', 'reviewer', 'annotator', 'member', 'viewer']

export const validateOrganizationIdParam = [
  param('organizationId')
    .isUUID()
    .withMessage('organizationId must be a valid UUID'),
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

export const validateProjectIdParam = [
  param('projectId')
    .isUUID()
    .withMessage('projectId must be a valid UUID'),
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
    .withMessage('memberId must be a valid UUID'),
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

export const validateCreateProject = [
  body('teamId')
    .isUUID()
    .withMessage('teamId must be a valid UUID'),
  body('name')
    .isLength({ min: 3, max: 150 })
    .withMessage('name must be between 3 and 150 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('description must not exceed 2000 characters'),
  body('status')
    .optional()
    .isIn(PROJECT_STATUSES)
    .withMessage('status is invalid'),
  body('type')
    .optional()
    .isIn(PROJECT_TYPES)
    .withMessage('type is invalid'),
  body('workflowId')
    .optional()
    .isUUID()
    .withMessage('workflowId must be a valid UUID'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('settings must be an object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('metadata must be an object'),
  body('budget')
    .optional()
    .isObject()
    .withMessage('budget must be an object'),
  body('budget.total')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('budget.total must be greater than or equal to 0'),
  body('budget.spent')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('budget.spent must be greater than or equal to 0'),
  body('budget.currency')
    .optional()
    .isString()
    .isLength({ min: 3, max: 5 })
    .withMessage('budget.currency must be a valid ISO currency code'),
  body('timeline')
    .optional()
    .isObject()
    .withMessage('timeline must be an object'),
  body('timeline.startDate')
    .optional()
    .isISO8601()
    .withMessage('timeline.startDate must be an ISO8601 date'),
  body('timeline.endDate')
    .optional()
    .isISO8601()
    .withMessage('timeline.endDate must be an ISO8601 date'),
  body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('tags must be an array of strings'),
  body('tags.*')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('each tag must be between 1 and 50 characters'),
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

export const validateUpdateProject = [
  body('teamId')
    .optional()
    .isUUID()
    .withMessage('teamId must be a valid UUID'),
  body('name')
    .optional()
    .isLength({ min: 3, max: 150 })
    .withMessage('name must be between 3 and 150 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('description must not exceed 2000 characters'),
  body('status')
    .optional()
    .isIn(PROJECT_STATUSES)
    .withMessage('status is invalid'),
  body('type')
    .optional()
    .isIn(PROJECT_TYPES)
    .withMessage('type is invalid'),
  body('workflowId')
    .optional()
    .isUUID()
    .withMessage('workflowId must be a valid UUID'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('settings must be an object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('metadata must be an object'),
  body('budget')
    .optional()
    .isObject()
    .withMessage('budget must be an object'),
  body('timeline')
    .optional()
    .isObject()
    .withMessage('timeline must be an object'),
  body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('tags must be an array of strings'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
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

export const validateListProjectsQuery = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('page must be between 1 and 200'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(PROJECT_STATUSES)
    .withMessage('status is invalid'),
  query('teamId')
    .optional()
    .isUUID()
    .withMessage('teamId must be a valid UUID'),
  query('search')
    .optional()
    .isString()
    .withMessage('search must be a string'),
  query('includeArchived')
    .optional()
    .isBoolean()
    .withMessage('includeArchived must be a boolean'),
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

export const validateProjectMemberPayload = [
  body('userId')
    .isUUID()
    .withMessage('userId must be a valid UUID'),
  body('role')
    .isIn(PROJECT_MEMBER_ROLES)
    .withMessage('role is invalid'),
  body('permissions')
    .optional()
    .isArray({ max: 50 })
    .withMessage('permissions must be an array'),
  body('permissions.*')
    .optional()
    .isString()
    .withMessage('each permission must be a string'),
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

export const validateAnalyticsQuery = [
  query('range')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('range must be between 1 and 365 days'),
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
