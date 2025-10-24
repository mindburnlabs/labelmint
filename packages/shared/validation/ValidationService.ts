import { FIELD_CONSTRAINTS } from '../src/schemas/database';

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: any;
}

export interface ValidationRule {
  validate: (value: any) => ValidationResult;
  message?: string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationSchema;
}

// ============================================================================
// VALIDATION SERVICE
// ============================================================================

export class ValidationService {
  /**
   * Validate email address
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!email) {
      return {
        isValid: false,
        errors: ['Email is required'],
        warnings: []
      };
    }

    // Check length
    if (email.length > FIELD_CONSTRAINTS.EMAIL_MAX_LENGTH) {
      errors.push(`Email exceeds maximum length of ${FIELD_CONSTRAINTS.EMAIL_MAX_LENGTH} characters`);
    }

    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }

    // Check for common typos
    const commonTypoDomains = ['gnail.com', 'gmal.com', 'gmial.com', 'yahooo.com', 'hotmal.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && commonTypoDomains.includes(domain)) {
      warnings.push('Possible typo in email domain');
    }

    // Check for temporary email providers
    const tempEmailDomains = ['10minutemail.com', 'tempmail.org', 'guerrillamail.com'];
    if (domain && tempEmailDomains.some(temp => domain.includes(temp))) {
      warnings.push('Using temporary email provider');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate Telegram user ID
   */
  static validateTelegramId(id: number | string | bigint): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Convert to number for validation
    const numId = typeof id === 'bigint' ? Number(id) : typeof id === 'string' ? parseInt(id) : id;

    if (isNaN(numId)) {
      return {
        isValid: false,
        errors: ['Invalid Telegram ID format'],
        warnings: []
      };
    }

    // Telegram IDs are positive integers
    if (numId <= 0) {
      errors.push('Telegram ID must be positive');
    }

    // Check if within reasonable range (Telegram user IDs are typically < 2^53)
    if (numId > Number.MAX_SAFE_INTEGER) {
      errors.push('Telegram ID is too large');
    }

    // Check for suspicious patterns
    const idStr = numId.toString();
    if (idStr.length < 5) {
      warnings.push('Unusually short Telegram ID');
    }

    if (/^(\d)\1+$/.test(idStr)) {
      warnings.push('Suspicious Telegram ID pattern (repeating digits)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate payment amount
   */
  static validatePaymentAmount(amount: number, currency: string = 'TON'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof amount !== 'number' || isNaN(amount)) {
      return {
        isValid: false,
        errors: ['Amount must be a valid number'],
        warnings: []
      };
    }

    // Check if amount is positive
    if (amount <= 0) {
      errors.push('Amount must be positive');
    }

    // Currency-specific validation
    switch (currency.toUpperCase()) {
      case 'TON':
        // TON has 9 decimal places
        if (amount < 0.000000001) {
          errors.push('Minimum TON amount is 0.000000001');
        }
        if (amount > 1000000) {
          warnings.push('Very large TON amount');
        }
        // Check precision
        const amountStr = amount.toString();
        const decimalPart = amountStr.split('.')[1];
        if (decimalPart && decimalPart.length > 9) {
          errors.push('TON amount precision exceeds 9 decimal places');
        }
        break;

      case 'USDT':
        // USDT has 6 decimal places
        if (amount < 0.000001) {
          errors.push('Minimum USDT amount is 0.000001');
        }
        if (amount > 10000000) {
          warnings.push('Very large USDT amount');
        }
        // Check precision
        const usdtStr = amount.toString();
        const usdtDecimal = usdtStr.split('.')[1];
        if (usdtDecimal && usdtDecimal.length > 6) {
          errors.push('USDT amount precision exceeds 6 decimal places');
        }
        break;

      default:
        warnings.push(`Unknown currency: ${currency}`);
    }

    // Check for suspicious patterns
    if (amount === 0.00000001 || amount === 0.0000001) {
      warnings.push('Dust amount detected');
    }

    if (Number.isInteger(amount) && currency.toUpperCase() === 'USDT') {
      warnings.push('Consider fractional USDT for better precision');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate username
   */
  static validateUsername(username: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!username) {
      return {
        isValid: false,
        errors: ['Username is required'],
        warnings: []
      };
    }

    // Length validation
    if (username.length < 3) {
      errors.push('Username must be at least 3 characters');
    }
    if (username.length > FIELD_CONSTRAINTS.USERNAME_MAX_LENGTH) {
      errors.push(`Username exceeds maximum length of ${FIELD_CONSTRAINTS.USERNAME_MAX_LENGTH} characters`);
    }

    // Character validation
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, and underscores');
    }

    // Cannot start with underscore or number
    if (/^[0-9_]/.test(username)) {
      errors.push('Username must start with a letter');
    }

    // Cannot end with underscore
    if (username.endsWith('_')) {
      errors.push('Username cannot end with underscore');
    }

    // No consecutive underscores
    if (username.includes('__')) {
      errors.push('Username cannot contain consecutive underscores');
    }

    // Check for common patterns
    if (username.toLowerCase().includes('admin')) {
      warnings.push('Username contains "admin" - may be confusing');
    }

    if (/^\d+$/.test(username)) {
      warnings.push('Username contains only numbers - may be hard to remember');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate TON wallet address
   */
  static validateTonAddress(address: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!address) {
      return {
        isValid: false,
        errors: ['Address is required'],
        warnings: []
      };
    }

    // Basic format validation
    if (!address.startsWith('EQ') && !address.startsWith('0Q')) {
      errors.push('Invalid TON address format: must start with EQ or 0Q');
    }

    // Length validation
    if (address.length !== 66) {
      errors.push('Invalid TON address length: must be 66 characters');
    }

    // Check for valid hex characters (skip prefix)
    const hexPart = address.slice(2);
    if (!/^[a-fA-F0-9]+$/.test(hexPart)) {
      errors.push('Invalid TON address: contains non-hexadecimal characters');
    }

    // Check for common patterns
    if (hexPart === 'A'.repeat(64) || hexPart === '0'.repeat(64)) {
      warnings.push('Suspicious address pattern detected');
    }

    // Check if it's a testnet address when mainnet is expected
    if (address.startsWith('0Q') && hexPart.startsWith('0')) {
      warnings.push('This appears to be a testnet address');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate task data
   */
  static validateTaskData(data: any, taskType: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: ['Task data must be an object'],
        warnings: []
      };
    }

    // Task type specific validation
    switch (taskType) {
      case 'IMAGE_CLASSIFICATION':
      case 'BOUNDING_BOX':
      case 'POLYGON_ANNOTATION':
      case 'SEMANTIC_SEGMENTATION':
        if (!data.imageUrl && !data.image) {
          errors.push('Image task requires imageUrl or image data');
        }
        if (data.imageUrl && !this.isValidUrl(data.imageUrl)) {
          errors.push('Invalid image URL format');
        }
        break;

      case 'TEXT_CLASSIFICATION':
      case 'NAMED_ENTITY_RECOGNITION':
      case 'TRANSCRIPTION':
      case 'TRANSLATION':
      case 'SENTIMENT_ANALYSIS':
        if (!data.text) {
          errors.push('Text task requires text data');
        }
        if (data.text && typeof data.text !== 'string') {
          errors.push('Text data must be a string');
        }
        if (data.text && data.text.length > 10000) {
          warnings.push('Very long text - may affect performance');
        }
        break;

      case 'RLHF_COMPARISON':
        if (!data.options || !Array.isArray(data.options) || data.options.length < 2) {
          errors.push('RLHF task requires at least 2 options');
        }
        break;

      default:
        warnings.push(`Unknown task type: ${taskType}`);
    }

    // Common validation
    if (data.instructions && data.instructions.length > 1000) {
      warnings.push('Instructions are very long - may be hard to read');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate project data
   */
  static validateProjectData(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: ['Project data must be an object'],
        warnings: []
      };
    }

    // Required fields
    if (!data.name) {
      errors.push('Project name is required');
    } else {
      if (data.name.length < 3) {
        errors.push('Project name must be at least 3 characters');
      }
      if (data.name.length > FIELD_CONSTRAINTS.PROJECT_NAME_MAX_LENGTH) {
        errors.push(`Project name exceeds maximum length of ${FIELD_CONSTRAINTS.PROJECT_NAME_MAX_LENGTH}`);
      }
    }

    if (!data.ownerId) {
      errors.push('Project owner is required');
    }

    // Optional fields
    if (data.description && data.description.length > FIELD_CONSTRAINTS.PROJECT_DESCRIPTION_MAX_LENGTH) {
      errors.push(`Project description exceeds maximum length of ${FIELD_CONSTRAINTS.PROJECT_DESCRIPTION_MAX_LENGTH}`);
    }

    if (data.budget && (typeof data.budget !== 'number' || data.budget < 0)) {
      errors.push('Budget must be a positive number');
    }

    if (data.paymentPerTask && (typeof data.paymentPerTask !== 'number' || data.paymentPerTask < 0)) {
      errors.push('Payment per task must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate object against schema
   */
  static validateSchema(obj: any, schema: ValidationSchema): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [key, rule] of Object.entries(schema)) {
      const value = obj?.[key];

      if (typeof rule === 'object' && rule.validate) {
        // It's a validation rule
        const result = rule.validate(value);
        errors.push(...result.errors.map(e => `${key}: ${e}`));
        warnings.push(...result.warnings.map(w => `${key}: ${w}`));
      } else {
        // It's a nested schema
        const result = this.validateSchema(value, rule as ValidationSchema);
        errors.push(...result.errors.map(e => `${key}.${e}`));
        warnings.push(...result.warnings.map(w => `${key}.${w}`));
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if URL is valid
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate phone number
   */
  static validatePhoneNumber(phone: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!phone) {
      return {
        isValid: false,
        errors: ['Phone number is required'],
        warnings: []
      };
    }

    // Remove common formatting
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Check if it contains only digits (with optional +)
    if (!/^\+?\d+$/.test(cleanPhone)) {
      errors.push('Phone number can only contain digits and optional +');
    }

    // Check length
    if (cleanPhone.length < 10) {
      errors.push('Phone number is too short');
    }
    if (cleanPhone.length > 15) {
      errors.push('Phone number is too long');
    }

    // Check country code
    if (!cleanPhone.startsWith('+')) {
      warnings.push('Phone number should include country code');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!password) {
      return {
        isValid: false,
        errors: ['Password is required'],
        warnings: []
      };
    }

    // Length requirements
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (password.length > 128) {
      errors.push('Password is too long (max 128 characters)');
    }

    // Character requirements
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain numbers');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      warnings.push('Password should contain special characters');
    }

    // Common patterns
    if (/^[a-zA-Z]+$/.test(password) || /^\d+$/.test(password)) {
      errors.push('Password cannot be all letters or all numbers');
    }

    if (password.toLowerCase().includes('password') ||
        password.toLowerCase().includes('qwerty') ||
        password.toLowerCase().includes('123456')) {
      errors.push('Password contains common patterns');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}