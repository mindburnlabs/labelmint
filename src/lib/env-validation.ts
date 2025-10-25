
/**
 * Environment Variable Validation
 */
export function validateEnvironment() {
  const required = [
    'DB_PASSWORD',
    'JWT_SECRET',
    'API_KEY',
    'TON_PRIVATE_KEY',
    'SUPABASE_URL',
    'REDIS_URL'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate secret strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  return true;
}

// Auto-validate on import
validateEnvironment();
