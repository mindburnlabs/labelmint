import { body, param, query, validationResult } from 'express-validator'
import { Request, Response, NextFunction } from 'express'

const ROLE_VALUES = ['owner', 'admin', 'manager', 'member', 'viewer', 'project_manager', 'annotator', 'reviewer']
const STATUS_VALUES = ['active', 'inactive', 'pending', 'suspended', 'invited']

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

export const validateUserIdParam = [
  param('userId')
    .isUUID()
    .withMessage('userId must be a valid UUID'),
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

export const validateInviteUser = [
  body('email')
    .isEmail()
    .withMessage('email must be a valid email address')
    .normalizeEmail(),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('firstName must be between 1 and 100 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('lastName must be between 1 and 100 characters'),
  body('role')
    .isIn(ROLE_VALUES)
    .withMessage('role is invalid'),
  body('permissions')
    .optional()
    .isArray({ max: 50 })
    .withMessage('permissions must be an array of strings'),
  body('permissions.*')
    .optional()
    .isString()
    .withMessage('each permission must be a string'),
  body('teamIds')
    .optional()
    .isArray({ max: 20 })
    .withMessage('teamIds must be an array of UUID strings'),
  body('teamIds.*')
    .optional()
    .isUUID()
    .withMessage('teamIds must contain valid UUID values'),
  body('message')
    .optional()
    .isLength({ max: 500 })
    .withMessage('message must not exceed 500 characters'),
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

export const validateUpdateUser = [
  body('role')
    .optional()
    .isIn(ROLE_VALUES)
    .withMessage('role is invalid'),
  body('permissions')
    .optional()
    .isArray({ max: 50 })
    .withMessage('permissions must be an array'),
  body('permissions.*')
    .optional()
    .isString()
    .withMessage('each permission must be a string'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('metadata must be an object'),
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

export const validateDeactivateUser = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('reason must not exceed 500 characters'),
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

export const validateListQuery = [
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
    .isIn(STATUS_VALUES)
    .withMessage('status is invalid'),
  query('role')
    .optional()
    .isIn(ROLE_VALUES)
    .withMessage('role is invalid'),
  query('search')
    .optional()
    .isString()
    .withMessage('search must be a string'),
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

export const validateActivityQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('limit must be between 1 and 200'),
  query('cursor')
    .optional()
    .isUUID()
    .withMessage('cursor must be a valid UUID'),
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
