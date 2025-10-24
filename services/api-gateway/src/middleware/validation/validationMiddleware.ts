import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

class ValidationMiddleware {
  validate = (schema: ValidationSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const correlationId = (req as any).correlationId;
      const errors: Array<{ field: string; message: string; value: any }> = [];

      // Validate request body
      if (schema.body) {
        const { error, value } = schema.body.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
          convert: true
        });

        if (error) {
          error.details.forEach(detail => {
            errors.push({
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value
            });
          });
        } else {
          req.body = value; // Use cleaned values
        }
      }

      // Validate query parameters
      if (schema.query) {
        const { error, value } = schema.query.validate(req.query, {
          abortEarly: false,
          stripUnknown: true,
          convert: true
        });

        if (error) {
          error.details.forEach(detail => {
            errors.push({
              field: `query.${detail.path.join('.')}`,
              message: detail.message,
              value: detail.context?.value
            });
          });
        } else {
          req.query = value;
        }
      }

      // Validate path parameters
      if (schema.params) {
        const { error, value } = schema.params.validate(req.params, {
          abortEarly: false,
          stripUnknown: true,
          convert: true
        });

        if (error) {
          error.details.forEach(detail => {
            errors.push({
              field: `params.${detail.path.join('.')}`,
              message: detail.message,
              value: detail.context?.value
            });
          });
        } else {
          req.params = value;
        }
      }

      // Validate headers
      if (schema.headers) {
        const { error, value } = schema.headers.validate(req.headers, {
          abortEarly: false,
          stripUnknown: false,
          convert: true,
          allowUnknown: true // Don't strip other headers
        });

        if (error) {
          error.details.forEach(detail => {
            errors.push({
              field: `headers.${detail.path.join('.')}`,
              message: detail.message,
              value: detail.context?.value
            });
          });
        } else {
          // Merge validated headers but keep all existing headers
          Object.assign(req.headers, value);
        }
      }

      if (errors.length > 0) {
        logger.warn('Validation failed', {
          errors,
          correlationId,
          method: req.method,
          url: req.url,
          ip: req.ip
        });

        return next(createError('Validation failed', 400, 'VALIDATION_ERROR', {
          errors
        }));
      }

      next();
    };
  };

  // Common validation schemas
  schemas = {
    id: Joi.string().uuid().required(),
    pagination: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0)
    }),
    sorting: Joi.object({
      sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'id').default('createdAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    }),
    dateRange: Joi.object({
      startDate: Joi.date().iso(),
      endDate: Joi.date().iso().min(Joi.ref('startDate'))
    }),
    search: Joi.object({
      q: Joi.string().min(1).max(100).trim(),
      fields: Joi.array().items(Joi.string())
    }),
    apiKey: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).min(16).max(128),
    email: Joi.string().email().max(255),
    password: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    token: Joi.string().pattern(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/),
    correlationId: Joi.string().uuid(),
    requestId: Joi.string().alphanum().min(16).max(64)
  };

  // Security validation schemas
  security = {
    // Prevent NoSQL injection
    objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    // Prevent XSS in strings
    safeString: Joi.string().custom((value, helpers) => {
      // Check for potentially dangerous patterns
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          return helpers.error('string.xss');
        }
      }

      return value;
    }, 'XSS protection'),
    // Prevent command injection
    safeCommand: Joi.string().custom((value, helpers) => {
      const dangerousChars = [';', '|', '&', '$', '`', '(', ')', '{', '}', '[', ']', '>', '<'];
      const containsDangerous = dangerousChars.some(char => value.includes(char));

      if (containsDangerous) {
        return helpers.error('string.injection');
      }

      return value;
    }, 'Command injection protection')
  };

  // Request size validation
  validateSize = (maxSizeBytes: number = 10 * 1024 * 1024) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const contentLength = parseInt(req.get('Content-Length') || '0', 10);

      if (contentLength > maxSizeBytes) {
        return next(createError(
          `Request too large. Maximum size is ${maxSizeBytes / 1024 / 1024}MB`,
          413,
          'REQUEST_TOO_LARGE'
        ));
      }

      next();
    };
  };

  // Content type validation
  validateContentType = (allowedTypes: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const contentType = req.get('Content-Type');

      if (!contentType) {
        return next(createError('Content-Type header is required', 400, 'MISSING_CONTENT_TYPE'));
      }

      const isAllowed = allowedTypes.some(type => contentType.toLowerCase().startsWith(type.toLowerCase()));

      if (!isAllowed) {
        return next(createError(
          `Content-Type ${contentType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
          400,
          'INVALID_CONTENT_TYPE'
        ));
      }

      next();
    };
  };

  // Sanitize input data
  sanitize = () => {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Sanitize body
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = this.sanitizeObject(req.query);
      }

      next();
    };
  };

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip prototype properties
      if (!obj.hasOwnProperty(key)) {
        continue;
      }

      // Sanitize key name
      const sanitizedKey = this.sanitizeString(key);

      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized;
  }

  private sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    return str
      .trim()
      // Remove potential XSS patterns
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
}

export const validationMiddleware = new ValidationMiddleware();
export const validate = validationMiddleware.validate;
export const validateSize = validationMiddleware.validateSize;
export const validateContentType = validationMiddleware.validateContentType;
export const sanitize = validationMiddleware.sanitize;