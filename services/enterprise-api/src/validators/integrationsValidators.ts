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

// Integration ID parameter validation
export const validateIntegrationIdParam = [
  param('integrationId').isUUID().withMessage('Integration ID must be a valid UUID'),
  handleValidationErrors
]

// Webhook ID parameter validation
export const validateWebhookIdParam = [
  param('webhookId').isUUID().withMessage('Webhook ID must be a valid UUID'),
  handleValidationErrors
]

// Create integration validation
export const validateCreateIntegration = [
  body('type')
    .isString()
    .trim()
    .isIn([
      'slack',
      'teams',
      'jira',
      'asana',
      'github',
      'gitlab',
      'salesforce',
      'hubspot',
      'zendesk',
      'custom_webhook',
      'api_key'
    ])
    .withMessage('Type must be a supported integration type'),

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
    .isObject()
    .withMessage('Configuration must be an object'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),

  handleValidationErrors
]

// Update integration validation
export const validateUpdateIntegration = [
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

  body('config')
    .optional()
    .isObject()
    .withMessage('Configuration must be an object'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),

  handleValidationErrors
]

// Slack integration validation
export const validateSlackIntegration = [
  body('botToken')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Bot token is required'),

  body('signingSecret')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Signing secret is required'),

  body('channel')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Channel must be a non-empty string'),

  body('events')
    .optional()
    .isArray()
    .withMessage('Events must be an array'),

  handleValidationErrors
]

// Microsoft Teams integration validation
export const validateTeamsIntegration = [
  body('webhookUrl')
    .isURL()
    .withMessage('Webhook URL must be a valid URL'),

  body('tenantId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Tenant ID must be a non-empty string'),

  handleValidationErrors
]

// Jira integration validation
export const validateJiraIntegration = [
  body('url')
    .isURL()
    .withMessage('Jira URL must be a valid URL'),

  body('username')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Username is required'),

  body('apiToken')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('API token is required'),

  body('projectKey')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Project key must be a non-empty string'),

  handleValidationErrors
]

// GitHub integration validation
export const validateGithubIntegration = [
  body('repositoryUrl')
    .isURL()
    .withMessage('Repository URL must be a valid URL'),

  body('accessToken')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Access token is required'),

  body('webhookSecret')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Webhook secret must be a non-empty string'),

  handleValidationErrors
]

// Salesforce integration validation
export const validateSalesforceIntegration = [
  body('instanceUrl')
    .isURL()
    .withMessage('Instance URL must be a valid URL'),

  body('consumerKey')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Consumer key is required'),

  body('consumerSecret')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Consumer secret is required'),

  handleValidationErrors
]

// Create webhook validation
export const validateCreateWebhook = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be between 1 and 255 characters'),

  body('url')
    .isURL()
    .withMessage('URL must be a valid URL'),

  body('events')
    .isArray({ min: 1 })
    .withMessage('Events must be an array with at least one event'),

  body('events.*')
    .isString()
    .trim()
    .isIn([
      'task.created',
      'task.completed',
      'task.updated',
      'project.created',
      'project.updated',
      'user.created',
      'user.updated',
      'workflow.executed',
      'workflow.completed',
      'annotation.created',
      'annotation.updated'
    ])
    .withMessage('Event must be a valid webhook event'),

  body('secret')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 8 })
    .withMessage('Secret must be at least 8 characters long'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),

  body('retryConfig')
    .optional()
    .isObject()
    .withMessage('Retry configuration must be an object'),

  handleValidationErrors
]

// Update webhook validation
export const validateUpdateWebhook = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),

  body('url')
    .optional()
    .isURL()
    .withMessage('URL must be a valid URL'),

  body('events')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Events must be an array with at least one event'),

  body('secret')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 8 })
    .withMessage('Secret must be at least 8 characters long'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),

  body('retryConfig')
    .optional()
    .isObject()
    .withMessage('Retry configuration must be an object'),

  handleValidationErrors
]

// Integration query validation
export const validateIntegrationQuery = [
  query('type')
    .optional()
    .isString()
    .trim()
    .withMessage('Type must be a string'),

  query('status')
    .optional()
    .isIn(['active', 'inactive', 'error'])
    .withMessage('Status must be one of: active, inactive, error'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  handleValidationErrors
]

// Webhook query validation
export const validateWebhookQuery = [
  query('event')
    .optional()
    .isString()
    .trim()
    .withMessage('Event must be a string'),

  query('status')
    .optional()
    .isIn(['active', 'inactive', 'error'])
    .withMessage('Status must be one of: active, inactive, error'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  handleValidationErrors
]

// Test integration validation
export const validateTestIntegration = [
  body('config')
    .optional()
    .isObject()
    .withMessage('Configuration must be an object'),

  body('testData')
    .optional()
    .isObject()
    .withMessage('Test data must be an object'),

  handleValidationErrors
]

// Test webhook validation
export const validateTestWebhook = [
  body('event')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Event is required'),

  body('payload')
    .optional()
    .isObject()
    .withMessage('Payload must be an object'),

  handleValidationErrors
]

// Create API key validation
export const validateCreateApiKey = [
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

  body('scopes')
    .isArray({ min: 1 })
    .withMessage('Scopes must be an array with at least one scope'),

  body('scopes.*')
    .isString()
    .trim()
    .isIn([
      'read:projects',
      'write:projects',
      'read:tasks',
      'write:tasks',
      'read:users',
      'write:users',
      'read:analytics',
      'admin:integrations'
    ])
    .withMessage('Scope must be a valid API scope'),

  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expires at must be a valid ISO 8601 date'),

  handleValidationErrors
]

// API key ID parameter validation
export const validateApiKeyIdParam = [
  param('apiKeyId').isUUID().withMessage('API key ID must be a valid UUID'),
  handleValidationErrors
]