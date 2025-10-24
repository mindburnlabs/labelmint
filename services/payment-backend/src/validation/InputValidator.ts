import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { Logger } from '../../utils/logger';
import { redisManager } from '../../cache/RedisManager';

const logger = new Logger('InputValidator');

// Common validation schemas
const addressSchema = z.string().regex(/^[a-zA-Z0-9_-]{48,}$/);
const emailSchema = z.string().email();
const uuidSchema = z.string().uuid();
const tonAmountSchema = z.string().regex(/^\d+(\.\d{1,9})?$/);
const phoneNumberSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/);

export class InputValidator {
  private static instance: InputValidator;
  private rateLimitCache = new Map<string, { count: number; resetTime: number }>();

  static getInstance(): InputValidator {
    if (!InputValidator.instance) {
      InputValidator.instance = new InputValidator();
    }
    return InputValidator.instance;
  }

  /**
   * Sanitize HTML content
   */
  private static sanitizeHtml(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        'a', 'b', 'i', 'u', 'strong', 'em',
        'ul', 'ol', 'li', 'p', 'br', 'span',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'alt', 'class', 'id',
        'style', 'data-*'
      ],
      ALLOW_DATA_ATTR: false
    });
  }

  /**
   * Validate and sanitize string input
   */
  static validateString(
    value: string,
    options: {
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      allowEmpty?: boolean;
      sanitizeHtml?: boolean;
    } = {}
  ): { valid: boolean; value: string; error?: string } {
    let { valid = true, error } = this.checkRequired(value, options.allowEmpty);

    if (!valid) {
      return { valid: false, value, error };
    }

    // Check length
    if (options.minLength && value.length < options.minLength) {
      valid = false;
      error = `Must be at least ${options.minLength} characters long`;
    }

    if (options.maxLength && value.length > options.maxLength) {
      valid = false;
      error = `Must be no more than ${options.maxLength} characters long`;
    }

    // Check pattern
    if (options.pattern && !options.pattern.test(value)) {
      valid = false;
      error = 'Invalid format';
    }

    // Sanitize HTML if needed
    let processedValue = value;
    if (options.sanitizeHtml) {
      processedValue = this.sanitizeHtml(value);
    }

    // Trim whitespace
    processedValue = processedValue.trim();

    return { valid, value: processedValue, error };
  }

  /**
   * Validate email
   */
  static validateEmail(email: string): { valid: boolean; email: string; error?: string } {
    try {
      const result = emailSchema.safeParse(email.toLowerCase().trim());
      if (!result.success) {
        return {
          valid: false,
          email: email.toLowerCase().trim(),
          error: 'Invalid email format'
        };
      }

      // Additional checks
      if (email.length > 254) {
        return {
          valid: false,
          email: email.toLowerCase().trim(),
          error: 'Email address too long'
        };
      }

      // Check for suspicious domains
      const suspiciousDomains = [
        'tempmail.org',
        '10minutemail.com',
        'guerrillamail.com',
        'mailinator.org',
        'yopmail.com'
      ];

      const domain = email.split('@')[1];
      if (suspiciousDomains.includes(domain)) {
        return {
          valid: false,
          email: email.toLowerCase().trim(),
          error: 'Disposable email addresses not allowed'
        };
      }

      return { valid: true, email: email.toLowerCase().trim() };
    } catch (error) {
      return {
        valid: false,
        email: email.toLowerCase().trim(),
        error: 'Email validation failed'
      };
    }
  }

  /**
   * Validate TON address
   */
  static validateTonAddress(address: string): { valid: boolean; address: string; error?: string } {
    try {
      // Basic format check
      if (!addressSchema.safeParse(address)) {
        return {
          valid: false,
          address,
          error: 'Invalid TON address format'
        };
      }

      // Additional validation using @ton/core
      const { Address } = require('@ton/core');
      Address.parse(address); // Will throw if invalid

      return { valid: true, address };
    } catch (error) {
      return {
        valid: false,
        address,
        error: 'Invalid TON address'
      };
    }
  }

  /**
   * Validate phone number
   */
  static validatePhoneNumber(phone: string): { valid: boolean; phone: string; error?: string } {
    const result = phoneNumberSchema.safeParse(phone);
    if (!result.success) {
      return {
        valid: false,
        phone,
        error: 'Invalid phone number format'
      };
    }

    return { valid: true, phone };
  }

  /**
   * Validate amount (TON/USDT)
   */
  static validateAmount(amount: string, currency: 'TON' | 'USDT'): { valid: boolean; amount: string; error?: string } {
    if (!tonAmountSchema.safeParse(amount)) {
      return {
        valid: false,
        amount,
        error: `Invalid ${currency} amount format`
      };
    }

    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return {
        valid: false,
        amount,
        error: `Amount must be a positive number`
      };
    }

    // Currency-specific limits
    if (currency === 'TON') {
      if (numAmount < 0.001) {
        return {
          valid: false,
          amount,
          error: 'Minimum TON amount is 0.001'
        };
      }
      if (numAmount > 1000000) {
        return {
          valid: false,
          amount,
          error: 'Maximum TON amount is 1,000,000'
        };
      }
    } else if (currency === 'USDT') {
      if (numAmount < 0.000001) {
        return {
          valid: false,
          amount,
          error: 'Minimum USDT amount is 0.000001'
        };
      }
      if (numAmount > 10000000) {
        return {
          valid: false,
          amount,
          error: 'Maximum USDT amount is 10,000,000'
        };
      }
    }

    return { valid: true, amount };
  }

  /**
   * Validate UUID
   */
  static validateUUID(uuid: string): { valid: boolean; uuid: string; error?: string } {
    const result = uuidSchema.safeParse(uuid);
    if (!result.success) {
      return {
        valid: false,
        uuid,
        error: 'Invalid UUID format'
      };
    }

    return { valid: true, uuid };
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { valid: boolean; error?: string; score?: number } {
    if (!password || password.length < 8) {
      return {
        valid: false,
        error: 'Password must be at least 8 characters long'
      };
    }

    if (password.length > 128) {
      return {
        valid: false,
        error: 'Password must not exceed 128 characters'
      };
    }

    // Password strength scoring
    let score = 0;
    const checks = {
      length: password.length >= 12,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{}|;:'"<>?,./]/.test(password),
      common: this.isCommonPassword(password)
    };

    // Calculate score
    score += checks.length ? 2 : 0;
    score += checks.lowercase ? 1 : 0;
    score += checks.uppercase ? 1 : 0;
    score += checks.numbers ? 1 : 0;
    score += checks.special ? 1 : 0;
    score -= checks.common ? 2 : 0;

    if (score < 3) {
      return {
        valid: false,
        error: 'Password is too weak. Must include uppercase, lowercase, numbers, and special characters',
        score
      };
    }

    return { valid: true, score };
  }

  /**
   * Check if password is common
   */
  private static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', '12345678', 'qwerty', 'abc123',
      'password123', 'admin123', 'root', 'toor',
      'letmein', 'welcome', 'monkey', 'dragon',
      'master', 'hello', 'freedom'
    ];

    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Check required field
   */
  private static checkRequired(value: any, allowEmpty: boolean = false): { valid: boolean } {
    if (allowEmpty && (value === undefined || value === null || value === '')) {
      return true;
    }
    return value !== undefined && value !== null && value !== '';
  }

  /**
   * Sanitize file name
   */
  static sanitizeFileName(fileName: string): string {
    // Remove path components
    const name = fileName.split('/').pop() || fileName;

    // Remove extension
    const nameWithoutExt = name.split('.')[0];

    // Sanitize
    const sanitized = nameWithoutExt
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .replace(/\.+/g, '.')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);

    const extension = name.split('.').slice(1).join('.');
    return sanitized + (extension ? '.' + extension : '');
  }

  /**
   * Validate file upload
   */
  static validateFileUpload(
    file: Express.Multer.File,
    options: {
      maxSize?: number;
      allowedMimeTypes?: string[];
      allowedExtensions?: string[];
    } = {}
  ): { valid: boolean; error?: string } {
    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${options.maxSize} bytes`
      };
    }

    // Check MIME type
    if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: `File type ${file.mimetype} is not allowed`
      };
    }

    // Check file extension
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (options.allowedExtensions && !options.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension .${ext} is not allowed`
      };
    }

    return { valid: true };
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit(
    identifier: string,
    limit: number,
    windowMs: number = 60000, // 1 minute default
    userId?: string
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = userId ? `rate_limit:${identifier}:${userId}` : `rate_limit:${identifier}`;

    // Check Redis first
    const cached = await redisManager.get(key);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() < data.resetTime) {
        const remaining = Math.max(0, data.count);
        return { allowed: remaining > 0, remaining };
      }
    }

    // Use memory cache as fallback
    const cacheKey = InputValidator.rateLimitCache.get(key);
    if (cacheKey && Date.now() < cacheKey.resetTime) {
      return { allowed: cacheKey.count < limit, remaining: Math.max(0, limit - cacheKey.count) };
    }

    // Allow the request and update cache
    const now = Date.now();
    const newCount = (cacheKey?.count || 0) + 1;

    InputValidator.rateLimitCache.set(key, {
      count: newCount,
      resetTime: now + windowMs
    });

    // Update Redis
    await redisManager.set(key, {
      count: newCount,
      resetTime: now + windowMs
    }, windowMs);

    const remaining = Math.max(0, limit - newCount);
    return { allowed: remaining > 0, remaining };
  }

  /**
   * Validate batch request
   */
  static validateBatchRequest<T>(
    items: T[],
    maxItems: number = 100,
    validator: (item: T) => { valid: boolean; error?: string }
  ): { valid: boolean; validItems: T[]; errors: string[] } {
    if (items.length > maxItems) {
      return {
        valid: false,
        validItems: [],
        errors: [`Batch request exceeds maximum of ${maxItems} items`]
      };
    }

    const validItems: T[] = [];
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const validation = validator(items[i]);
      if (validation.valid) {
        validItems.push(items[i]);
      } else {
        errors.push(`Item ${i + 1}: ${validation.error}`);
      }
    }

    return {
      valid: validItems.length === items.length,
      validItems,
      errors
    };
  }

  /**
   * Create validation middleware
   */
  static createValidationMiddleware(schema: z.ZodSchema) {
    return (req: any, res: any, next: any) => {
      try {
        const result = schema.safeParse(req.body);
        if (!result.success) {
          logger.warn('Input validation failed', {
            url: req.url,
            method: req.method,
            errors: result.error.issues,
            body: req.body
          });

          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: result.error.issues
          });
        }

        // Sanitize validated data
        req.body = this.sanitizeObject(result.data);
        next();
      } catch (error) {
        logger.error('Validation middleware error', error);
        return res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    };
  }

  /**
   * Recursively sanitize object
   */
  private static sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeHtml(value);
        } else if (Array.isArray(value)) {
          sanitized[key] = value.map(item => this.sanitizeObject(item));
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(params: any): {
    valid: boolean;
    page?: number;
    limit?: number;
    offset?: number;
    error?: string;
  } {
    const { page = 1, limit = 50, offset = 0 } = params;

    if (isNaN(page) || page < 1) {
      return {
        valid: false,
        error: 'Invalid page number'
      };
    }

    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return {
        valid: false,
        error: 'Invalid limit (must be between 1 and 1000)'
      };
    }

    if (isNaN(offset) || offset < 0) {
      return {
        valid: false,
        error: 'Invalid offset'
      };
    }

    return {
      valid: true,
      page: parseInt(page),
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
  }
}

export default InputValidator.getInstance();