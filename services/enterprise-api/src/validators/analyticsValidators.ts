import { body, param, query, validationResult } from 'express-validator'
import { Request, Response, NextFunction } from 'express'

const SUPPORTED_METRICS = [
  'users_active',
  'users_new',
  'projects_active',
  'projects_total',
  'workflows_total',
  'workflows_executed',
  'storage_used'
]

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
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

export const validateOrganizationIdParam = [
  param('organizationId').isUUID().withMessage('Organization ID must be a valid UUID'),
  handleValidationErrors
]

export const validateOptionalRangeQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date'),
  handleValidationErrors
]

export const validateRequiredRangeBody = [
  body('startDate').isISO8601().withMessage('startDate is required and must be an ISO 8601 date'),
  body('endDate').isISO8601().withMessage('endDate is required and must be an ISO 8601 date'),
  handleValidationErrors
]

export const validateMetricQuery = [
  query('metric')
    .isString()
    .trim()
    .isIn(SUPPORTED_METRICS)
    .withMessage(`metric must be one of: ${SUPPORTED_METRICS.join(', ')}`),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date'),
  handleValidationErrors
]

export const validateExportRequest = [
  body('metrics')
    .isArray({ min: 1 })
    .withMessage('metrics must be a non-empty array')
    .custom(metrics =>
      metrics.every((metric: string) => ['overview', 'users', 'projects', 'workflows'].includes(metric))
    )
    .withMessage('metrics contains unsupported values'),
  ...validateRequiredRangeBody
]
