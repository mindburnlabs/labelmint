import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { SecurityService } from '../services/auth/SecurityService';

interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

const securityService = new SecurityService();

/**
 * Strong password validator for Joi
 */
const strongPassword = Joi.string()
  .min(12)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
  .custom((value, helpers) => {
    const check = securityService.checkPasswordComplexity(value);
    if (!check.isValid) {
      return helpers.error('custom.weakPassword');
    }
    return value;
  })
  .messages({
    'string.min': 'Password must be at least 12 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
    'custom.weakPassword': 'Password does not meet security requirements'
  });

/**
 * Email validator
 */
const email = Joi.string()
  .email()
  .lowercase()
  .max(255)
  .messages({
    'string.email': 'Please enter a valid email address',
    'string.lowercase': 'Email must be lowercase',
    'string.max': 'Email cannot exceed 255 characters'
  });

/**
 * UUID validator
 */
const uuid = Joi.string()
  .uuid()
  .messages({
    'string.uuid': 'Invalid UUID format'
  });

/**
 * Date validator
 */
const date = Joi.date()
  .iso()
  .messages({
    'date.format': 'Date must be in ISO format (YYYY-MM-DD)'
  });

/**
 * Pagination validator
 */
const pagination = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0)
});

/**
 * Common validation schemas
 */
export const schemas = {
  // Authentication
  email,
  strongPassword,
  uuid,
  date,
  pagination,

  // User information
  firstName: Joi.string().trim().min(1).max(50).required(),
  lastName: Joi.string().trim().min(1).max(50).required(),
  phone: Joi.string()
    .pattern(/^[+]?[\d\s-()]+$/)
    .max(20)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),

  // Password requirements
  currentPassword: strongPassword.required(),
  newPassword: strongPassword.required(),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords must match'
    }),

  // 2FA
  twoFactorToken: Joi.string().length(6).pattern(/^\d+$/).required(),
  backupCode: Joi.string()
    .pattern(/^[A-F0-9]{8}$/)
    .optional(),

  // Payment amounts
  amount: Joi.number()
    .positive()
    .precision(2)
    .min(0.01)
    .max(1000000)
    .required(),

  // Cryptocurrency addresses
  tonAddress: Joi.string()
    .pattern(/^[0-9a-zA-Z_-]+$/)
    .required(),

  // Token identifiers
  sessionId: uuid.required(),
  deviceId: uuid.required(),
  tokenHash: Joi.string().length(64).required(),

  // File uploads
  fileSize: Joi.number()
    .integer()
    .max(10 * 1024 * 1024) // 10MB
    .required(),
  mimeType: Joi.string()
    .valid('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    .required(),

  // URLs
  url: Joi.string()
    .uri()
    .max(2048)
    .optional(),

  // Text fields
  message: Joi.string()
    .trim()
    .min(1)
    .max(1000)
    .optional(),
  description: Joi.string()
    .trim()
    .min(1)
    .max(500)
    .optional(),
  reason: Joi.string()
    .trim()
    .min(5)
    .max(500)
    .optional()
};

/**
 * Request validation middleware
 */
export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(...error.details.map(d => `${d.path.join('.')}: ${d.message}`));
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(...error.details.map(d => `${d.path.join('.')}: ${d.message}`));
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(...error.details.map(d => `${d.path.join('.')}: ${d.message}`));
      }
    }

    // Check for additional validation errors
    const additionalErrors = validateRequestData(req);
    errors.push(...additionalErrors);

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      });
      return;
    }

    next();
  };
};

/**
 * Additional validation for specific request patterns
 */
function validateRequestData(req: Request): string[] {
  const errors: string[] = [];

  // Check for SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|"|`)/,
    /\b(OR|AND)\s+\d+\s*=\s*\d+/i
  ];

  const checkString = (str: string, field: string): void => {
    if (str && typeof str === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(str)) {
          errors.push(`Invalid characters in ${field}`);
          break;
        }
      }
    }
  };

  // Check common fields
  const fieldsToCheck = ['email', 'message', 'description', 'reason', 'query'];
  for (const field of fieldsToCheck) {
    if (req.body && req.body[field]) {
      checkString(req.body[field], field);
    }
    if (req.query && req.query[field]) {
      checkString(req.query[field] as string, field);
    }
  }

  // Check for XSS patterns in string inputs
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ];

  const checkXSS = (obj: any, prefix = ''): void => {
    if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
          for (const pattern of xssPatterns) {
            if (pattern.test(value)) {
              errors.push(`Invalid characters in ${fieldPath}`);
              break;
            }
          }
        } else if (typeof value === 'object') {
          checkXSS(value, fieldPath);
        }
      }
    }
  };

  checkXSS(req.body);

  // Validate JSON payload size
  const jsonString = JSON.stringify(req.body);
  if (jsonString.length > 10 * 1024 * 1024) { // 10MB
    errors.push('Request payload too large');
  }

  return errors;
}

/**
 * Sanitize string input
 */
export const sanitize = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return input;
  }

  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/['"]/g, '') // Remove quotes
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

/**
 * Validate and sanitize email
 */
export const validateEmail = (email: string): { valid: boolean; sanitized: string } => {
  const schema = Joi.string().email();
  const { error } = schema.validate(email);

  return {
    valid: !error,
    sanitized: error ? email : sanitize(email)
  };
};

/**
 * Validate file upload
 */
export const validateFile = (
  file: Express.Multer.File,
  options: {
    allowedTypes?: string[];
    maxSize?: number;
    required?: boolean;
  } = {}
) => {
  const errors: string[] = [];
  const { allowedTypes = ['image/jpeg', 'image/png', 'image/webp'], maxSize = 5 * 1024 * 1024, required = false } = options;

  if (!file && required) {
    errors.push('File is required');
  }

  if (file) {
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`);
    }

    // Check file name
    if (!file.originalname || file.originalname.length > 255) {
      errors.push('Invalid file name');
    }

    // Check for dangerous characters in filename
    const dangerousChars = /[<>:"\\|?*\/]/;
    if (file.originalname && dangerousChars.test(file.originalname)) {
      errors.push('File name contains invalid characters');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate date range
 */
export const validateDateRange = (
  startDate: string,
  endDate: string,
  maxDays: number = 365
): { valid: boolean; error?: string } => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  if (start > end) {
    return { valid: false, error: 'Start date must be before end date' };
  }

  if (start > now) {
    return { valid: false, error: 'Start date cannot be in the future' };
  }

  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > maxDays) {
    return { valid: false, error: `Date range cannot exceed ${maxDays} days` };
  }

  return { valid: true };
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (query: any) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  });

  const { error, value } = schema.validate(query);

  if (error) {
    throw new Error(`Invalid pagination parameters: ${error.message}`);
  }

  return value;
};

/**
 * Custom validators for specific use cases
 */
export const validators = {
  /**
   * Validate cryptocurrency address
   */
  cryptoAddress: (chain: string) => {
    const patterns: Record<string, RegExp> = {
      ton: /^[0-9a-zA-Z_-]+$/,
      eth: /^0x[a-fA-F0-9]{40}$/,
      btc: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    };

    return Joi.string()
      .pattern(patterns[chain] || patterns.ton)
      .required()
      .messages({
        'string.pattern.base': `Invalid ${chain.toUpperCase()} address format`
      });
  },

  /**
   * Validate payment amount
   */
  paymentAmount: (currency = 'USD') => {
    return Joi.number()
      .positive()
      .precision(2)
      .min(currency === 'USD' ? 0.01 : 0.000001)
      .max(currency === 'USD' ? 1000000 : 1000000)
      .required();
  },

  /**
   * Validate timezone
   */
  timezone: Joi.string()
    .valid(...Intl.supportedValuesOf(Intl.DateTimeFormat().resolvedOptions().timeZone))
    .required(),

  /**
   * Validate hex color
   */
  hexColor: Joi.string()
    .pattern(/^#[0-9A-F]{6}$/i)
    .required(),

  /**
   * Validate URL with specific protocol
   */
  secureUrl: Joi.string()
    .uri()
    .pattern(/^https:\/\//)
    .required()
    .messages({
      'string.pattern.base': 'URL must use HTTPS protocol'
    })
};

export default validate;