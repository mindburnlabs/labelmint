// ============================================================================
// VALIDATION SERVICE
// ============================================================================

import { z } from 'zod';

export interface ValidationRule {
  field: string;
  schema: z.ZodSchema;
  required?: boolean;
  message?: string;
}

export interface ValidationSchema {
  [field: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export class ValidationService {
  private schemas: Map<string, ValidationSchema> = new Map();

  /**
   * Register a validation schema
   */
  registerSchema(name: string, schema: ValidationSchema): void {
    this.schemas.set(name, schema);
  }

  /**
   * Get a validation schema
   */
  getSchema(name: string): ValidationSchema | undefined {
    return this.schemas.get(name);
  }

  /**
   * Validate data against a schema
   */
  validate(schemaName: string, data: any): ValidationResult {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Validation schema '${schemaName}' not found`);
    }

    const errors: ValidationError[] = [];
    const processedData: any = {};

    // Check each field in the schema
    for (const [field, rule] of Object.entries(schema)) {
      const value = data[field];

      try {
        // Check if required field is missing
        if (rule.required && (value === undefined || value === null)) {
          errors.push({
            field,
            message: rule.message || `${field} is required`,
            code: 'REQUIRED_FIELD',
            value
          });
          continue;
        }

        // Skip validation for optional fields that are undefined
        if (!rule.required && (value === undefined || value === null)) {
          continue;
        }

        // Validate against Zod schema
        const result = rule.schema.safeParse(value);
        if (!result.success) {
          const firstError = result.error.issues[0];
          errors.push({
            field,
            message: rule.message || firstError.message,
            code: firstError.code.toUpperCase(),
            value
          });
        } else {
          processedData[field] = result.data;
        }
      } catch (error) {
        errors.push({
          field,
          message: rule.message || `Validation failed for ${field}`,
          code: 'VALIDATION_ERROR',
          value
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? processedData : undefined
    };
  }

  /**
   * Validate multiple schemas
   */
  validateMultiple(schemas: Array<{ name: string; data: any }>): Array<ValidationResult> {
    return schemas.map(({ name, data }) => this.validate(name, data));
  }

  /**
   * Create a Zod schema from validation rules
   */
  static createZodSchema(rules: ValidationRule[]): z.ZodObject {
    const schemaShape: Record<string, z.ZodSchema> = {};

    for (const rule of rules) {
      if (rule.required) {
        schemaShape[rule.field] = rule.schema;
      } else {
        schemaShape[rule.field] = rule.schema.optional();
      }
    }

    return z.object(schemaShape);
  }

  /**
   * Validate email format
   */
  static email(): z.ZodString {
    return z.string().email('Invalid email format');
  }

  /**
   * Validate password strength
   */
  static password(minLength: number = 8): z.ZodString {
    return z.string()
      .min(minLength, `Password must be at least ${minLength} characters`)
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
  }

  /**
   * Validate URL format
   */
  static url(): z.ZodString {
    return z.string().url('Invalid URL format');
  }

  /**
   * Validate UUID format
   */
  static uuid(): z.ZodString {
    return z.string().uuid('Invalid UUID format');
  }

  /**
   * Validate numeric range
   */
  static number(min?: number, max?: number): z.ZodNumber {
    let schema = z.number();
    if (min !== undefined) schema = schema.min(min);
    if (max !== undefined) schema = schema.max(max);
    return schema;
  }

  /**
   * Validate string length
   */
  static string(min?: number, max?: number): z.ZodString {
    let schema = z.string();
    if (min !== undefined) schema = schema.min(min);
    if (max !== undefined) schema = schema.max(max);
    return schema;
  }

  /**
   * Validate date range
   */
  static date(min?: Date, max?: Date): z.ZodDate {
    let schema = z.date();
    if (min !== undefined) schema = schema.min(min);
    if (max !== undefined) schema = schema.max(max);
    return schema;
  }

  /**
   * Validate enum values
   */
  static enum<T extends readonly string[]>(values: T): z.ZodEnum<T> {
    return z.enum(values);
  }

  /**
   * Validate array with constraints
   */
  static array<T>(itemSchema: z.ZodType<T>, min?: number, max?: number): z.ZodArray<z.ZodType<T>> {
    let schema = z.array(itemSchema);
    if (min !== undefined) schema = schema.min(min);
    if (max !== undefined) schema = schema.max(max);
    return schema;
  }

  /**
   * Validate object with shape
   */
  static object<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
    return z.object(shape);
  }

  /**
   * Create conditional validation
   */
  static conditional<T>(
    condition: (data: any) => boolean,
    trueSchema: z.ZodType<T>,
    falseSchema: z.ZodType<T>
  ): z.ZodEffects<z.ZodAny, T, T> {
    return z.custom<T>((data) => {
      return condition(data) ? trueSchema.safeParse(data).success : falseSchema.safeParse(data).success;
    });
  }
}

// Common validation schemas
export const CommonValidationSchemas = {
  user: {
    id: { field: 'id', schema: ValidationService.uuid(), required: true },
    email: { field: 'email', schema: ValidationService.email(), required: false },
    username: { field: 'username', schema: ValidationService.string(3, 50), required: false },
    role: { field: 'role', schema: ValidationService.enum(['admin', 'user', 'moderator'] as const), required: true }
  } as ValidationSchema,

  task: {
    id: { field: 'id', schema: ValidationService.uuid(), required: true },
    title: { field: 'title', schema: ValidationService.string(1, 200), required: true },
    description: { field: 'description', schema: ValidationService.string(0, 1000), required: false },
    status: { field: 'status', schema: ValidationService.enum(['pending', 'in_progress', 'completed', 'cancelled'] as const), required: true },
    priority: { field: 'priority', schema: ValidationService.number(1, 5), required: true }
  } as ValidationSchema,

  project: {
    id: { field: 'id', schema: ValidationService.uuid(), required: true },
    name: { field: 'name', schema: ValidationService.string(1, 100), required: true },
    description: { field: 'description', schema: ValidationService.string(0, 500), required: false },
    budget: { field: 'budget', schema: ValidationService.number(0), required: true },
    currency: { field: 'currency', schema: ValidationService.enum(['USD', 'EUR', 'TON', 'USDT'] as const), required: true }
  } as ValidationSchema
};

export default ValidationService;