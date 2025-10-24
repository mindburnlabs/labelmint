import { body, param, query, validationResult } from 'express-validator'
import { Request, Response, NextFunction } from 'express'

// Handle validation errors
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
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

// Organization ID parameter validation
export const validateOrganizationIdParam = [
  param('organizationId').isUUID().withMessage('Organization ID must be a valid UUID'),
  handleValidationErrors
]

// Workflow ID parameter validation
export const validateWorkflowIdParam = [
  param('workflowId').isUUID().withMessage('Workflow ID must be a valid UUID'),
  handleValidationErrors
]

// Template ID parameter validation
export const validateTemplateIdParam = [
  param('templateId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Template ID is required'),
  handleValidationErrors
]

// Execution ID parameter validation
export const validateExecutionIdParam = [
  param('executionId').isUUID().withMessage('Execution ID must be a valid UUID'),
  handleValidationErrors
]

// Create workflow validation
export const validateCreateWorkflow = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be between 1 and 255 characters'),

  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),

  body('trigger')
    .isObject()
    .withMessage('Trigger must be an object'),

  body('trigger.type')
    .isString()
    .isIn(['manual', 'webhook', 'schedule', 'event'])
    .withMessage('Trigger type must be one of: manual, webhook, schedule, event'),

  body('nodes')
    .isArray({ min: 1 })
    .withMessage('Nodes must be an array with at least one element'),

  body('nodes.*.id')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Each node must have an ID'),

  body('nodes.*.type')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Each node must have a type'),

  body('nodes.*.position')
    .optional()
    .isObject()
    .withMessage('Node position must be an object'),

  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),

  handleValidationErrors
]

// Update workflow validation
export const validateUpdateWorkflow = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),

  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),

  body('trigger')
    .optional()
    .isObject()
    .withMessage('Trigger must be an object'),

  body('trigger.type')
    .optional()
    .isString()
    .isIn(['manual', 'webhook', 'schedule', 'event'])
    .withMessage('Trigger type must be one of: manual, webhook, schedule, event'),

  body('nodes')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Nodes must be an array with at least one element'),

  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),

  body('status')
    .optional()
    .isIn(['draft', 'active', 'archived'])
    .withMessage('Status must be one of: draft, active, archived'),

  handleValidationErrors
]

// List workflows query validation
export const validateListWorkflowsQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn(['draft', 'active', 'archived'])
    .withMessage('Status must be one of: draft, active, archived'),

  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  query('sortBy')
    .optional()
    .isIn(['name', 'createdAt', 'updatedAt', 'status'])
    .withMessage('Sort by must be one of: name, createdAt, updatedAt, status'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc'),

  handleValidationErrors
]

// Execute workflow validation
export const validateExecuteWorkflow = [
  body('input')
    .optional()
    .isObject()
    .withMessage('Input must be an object'),

  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),

  body('async')
    .optional()
    .isBoolean()
    .withMessage('Async must be a boolean'),

  handleValidationErrors
]

// Workflow template query validation
export const validateWorkflowTemplateQuery = [
  query('category')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),

  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  handleValidationErrors
]

// Clone workflow validation
export const validateCloneWorkflow = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be between 1 and 255 characters'),

  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),

  handleValidationErrors
]

// Test workflow validation
export const validateTestWorkflow = [
  body('input')
    .optional()
    .isObject()
    .withMessage('Input must be an object'),

  body('testData')
    .optional()
    .isObject()
    .withMessage('Test data must be an object'),

  body('dryRun')
    .optional()
    .isBoolean()
    .withMessage('Dry run must be a boolean'),

  handleValidationErrors
]

// Import workflow validation
export const validateImportWorkflow = [
  body('workflow')
    .isObject()
    .withMessage('Workflow data is required'),

  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),

  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),

  handleValidationErrors
]

// Create workflow from template validation
export const validateCreateFromTemplate = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be between 1 and 255 characters'),

  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),

  body('config')
    .optional()
    .isObject()
    .withMessage('Config must be an object'),

  handleValidationErrors
]

// List executions query validation
export const validateListExecutionsQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn(['running', 'completed', 'failed', 'cancelled'])
    .withMessage('Status must be one of: running, completed, failed, cancelled'),

  query('triggeredBy')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Triggered by must be a non-empty string'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  handleValidationErrors
]