// ============================================================================
// ERROR UTILITIES
// ============================================================================

/**
 * Custom error class with additional context
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, field?: string, value?: any) {
    super(message, 'VALIDATION_ERROR', 400, true, { field, value });
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, true, { resource, id });
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401, true);
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403, true);
  }
}

/**
 * Conflict error
 */
export class ConflictError extends AppError {
  constructor(message: string, resource?: string) {
    super(message, 'CONFLICT', 409, true, { resource });
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true);
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(message: string, query?: string) {
    super(message, 'DATABASE_ERROR', 500, false, { query });
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(`${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502, false, { service });
  }
}

/**
 * Create error from unknown error
 */
export function createError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 'INTERNAL_ERROR', 500, false, {
      originalError: error.name,
      stack: error.stack
    });
  }

  if (typeof error === 'string') {
    return new AppError(error);
  }

  return new AppError('Unknown error occurred', 'UNKNOWN_ERROR', 500, false, { originalError: error });
}

/**
 * Check if error is operational
 */
export function isOperationalError(error: Error): boolean {
  return error instanceof AppError && error.isOperational;
}

/**
 * Get error message for user
 */
export function getUserMessage(error: Error): string {
  if (error instanceof AppError) {
    return error.message;
  }

  // Don't expose internal error details to users
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Get error details for logging
 */
export function getErrorDetails(error: Error): Record<string, any> {
  if (error instanceof AppError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      context: error.context,
      stack: error.stack
    };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}