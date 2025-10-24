// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Get current environment
 */
export function getEnvironment(): Environment {
  return (process.env.NODE_ENV as Environment) || 'development';
}

/**
 * Check if environment is development
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Check if environment is production
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if environment is test
 */
export function isTest(): boolean {
  return getEnvironment() === 'test';
}

/**
 * Get required environment variable or throw error
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
export function getOptionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

/**
 * Get numeric environment variable
 */
export function getNumericEnv(key: string, defaultValue: number = 0): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get boolean environment variable
 */
export function getBooleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}