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

// Subscription ID parameter validation
export const validateSubscriptionIdParam = [
  param('subscriptionId').isUUID().withMessage('Subscription ID must be a valid UUID'),
  handleValidationErrors
]

// Invoice ID parameter validation
export const validateInvoiceIdParam = [
  param('invoiceId').isUUID().withMessage('Invoice ID must be a valid UUID'),
  handleValidationErrors
]

// Payment method ID parameter validation
export const validatePaymentMethodIdParam = [
  param('paymentMethodId').isUUID().withMessage('Payment method ID must be a valid UUID'),
  handleValidationErrors
]

// Create subscription validation
export const validateCreateSubscription = [
  body('plan')
    .isString()
    .trim()
    .isIn(['starter', 'professional', 'enterprise', 'custom'])
    .withMessage('Plan must be one of: starter, professional, enterprise, custom'),

  body('billingCycle')
    .isIn(['monthly', 'yearly'])
    .withMessage('Billing cycle must be either monthly or yearly'),

  body('paymentMethodId')
    .optional()
    .isUUID()
    .withMessage('Payment method ID must be a valid UUID'),

  body('promoCode')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Promo code must be between 1 and 50 characters'),

  body('customLimits')
    .optional()
    .isObject()
    .withMessage('Custom limits must be an object'),

  handleValidationErrors
]

// Update subscription validation
export const validateUpdateSubscription = [
  body('plan')
    .optional()
    .isString()
    .trim()
    .isIn(['starter', 'professional', 'enterprise', 'custom'])
    .withMessage('Plan must be one of: starter, professional, enterprise, custom'),

  body('billingCycle')
    .optional()
    .isIn(['monthly', 'yearly'])
    .withMessage('Billing cycle must be either monthly or yearly'),

  body('customLimits')
    .optional()
    .isObject()
    .withMessage('Custom limits must be an object'),

  body('autoRenew')
    .optional()
    .isBoolean()
    .withMessage('Auto renew must be a boolean'),

  handleValidationErrors
]

// Create payment method validation
export const validateCreatePaymentMethod = [
  body('type')
    .isString()
    .trim()
    .isIn(['card', 'bank_account', 'paypal'])
    .withMessage('Type must be one of: card, bank_account, paypal'),

  body('nickname')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Nickname must be between 1 and 100 characters'),

  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('Is default must be a boolean'),

  // Card-specific validation
  body('cardNumber')
    .if(body('type').equals('card'))
    .isCreditCard()
    .withMessage('Card number must be a valid credit card number'),

  body('cardholderName')
    .if(body('type').equals('card'))
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Cardholder name must be between 2 and 100 characters'),

  body('expiryMonth')
    .if(body('type').equals('card'))
    .isInt({ min: 1, max: 12 })
    .withMessage('Expiry month must be between 1 and 12'),

  body('expiryYear')
    .if(body('type').equals('card'))
    .isInt({ min: new Date().getFullYear() })
    .withMessage('Expiry year must be current year or future'),

  body('cvv')
    .if(body('type').equals('card'))
    .isLength({ min: 3, max: 4 })
    .withMessage('CVV must be 3 or 4 digits'),

  // Bank account validation
  body('accountHolderName')
    .if(body('type').equals('bank_account'))
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Account holder name must be between 2 and 100 characters'),

  body('accountNumber')
    .if(body('type').equals('bank_account'))
    .isString()
    .trim()
    .isLength({ min: 8, max: 17 })
    .withMessage('Account number must be between 8 and 17 digits'),

  body('routingNumber')
    .if(body('type').equals('bank_account'))
    .isString()
    .trim()
    .isLength({ min: 9, max: 9 })
    .withMessage('Routing number must be 9 digits'),

  body('accountType')
    .if(body('type').equals('bank_account'))
    .isIn(['checking', 'savings'])
    .withMessage('Account type must be either checking or savings'),

  handleValidationErrors
]

// Billing query validation
export const validateBillingQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  query('status')
    .optional()
    .isIn(['active', 'trialing', 'past_due', 'canceled', 'unpaid'])
    .withMessage('Status must be one of: active, trialing, past_due, canceled, unpaid'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  handleValidationErrors
]

// Invoice query validation
export const validateInvoiceQuery = [
  query('status')
    .optional()
    .isIn(['draft', 'open', 'paid', 'void', 'uncollectible'])
    .withMessage('Status must be one of: draft, open, paid, void, uncollectible'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  handleValidationErrors
]

// Usage query validation
export const validateUsageQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  query('metric')
    .optional()
    .isString()
    .trim()
    .isIn(['storage', 'users', 'projects', 'tasks', 'api_calls', 'workflows'])
    .withMessage('Metric must be one of: storage, users, projects, tasks, api_calls, workflows'),

  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month'])
    .withMessage('Group by must be one of: day, week, month'),

  handleValidationErrors
]

// Cancel subscription validation
export const validateCancelSubscription = [
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason is required and must be between 1 and 500 characters'),

  body('feedback')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback must not exceed 1000 characters'),

  body('immediate')
    .optional()
    .isBoolean()
    .withMessage('Immediate must be a boolean'),

  handleValidationErrors
]

// Apply promo code validation
export const validateApplyPromoCode = [
  body('promoCode')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Promo code is required and must be between 1 and 50 characters'),

  handleValidationErrors
]

// Create usage alert validation
export const validateCreateUsageAlert = [
  body('metric')
    .isString()
    .trim()
    .isIn(['storage', 'users', 'projects', 'tasks', 'api_calls', 'workflows'])
    .withMessage('Metric must be one of: storage, users, projects, tasks, api_calls, workflows'),

  body('threshold')
    .isNumeric()
    .withMessage('Threshold must be a number'),

  body('thresholdType')
    .isIn(['percentage', 'absolute'])
    .withMessage('Threshold type must be either percentage or absolute'),

  body('channels')
    .isArray({ min: 1 })
    .withMessage('Channels must be an array with at least one channel'),

  body('channels.*')
    .isIn(['email', 'slack', 'webhook'])
    .withMessage('Channel must be one of: email, slack, webhook'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),

  handleValidationErrors
]

// Usage alert ID parameter validation
export const validateUsageAlertIdParam = [
  param('alertId').isUUID().withMessage('Usage alert ID must be a valid UUID'),
  handleValidationErrors
]