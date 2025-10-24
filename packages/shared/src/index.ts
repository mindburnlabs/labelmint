// ============================================================================
// SHARED PACKAGE MAIN EXPORTS
// ============================================================================

// Types
export * from './types';

// Schemas
export * from './schemas/database';
export * from './schemas/zod';

// Validation
export { ValidationService } from './validation/ValidationService';
export type {
  ValidationResult,
  ValidationRule,
  ValidationSchema
} from './validation/ValidationService';

// Repositories
export * from './repositories';

// Database
export * from './database';

// Utils
export * from './utils';

// Config
export * from './config';

// Auth
export * from './auth';