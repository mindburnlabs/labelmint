// ============================================================================
// APP CONFIGURATION
// ============================================================================

import { AppConfig } from '../types/common';

/**
 * Default app configuration
 */
export const defaultAppConfig: AppConfig = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'labelmint',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
    db: parseInt(process.env.REDIS_DB || '0', 10)
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    ...(process.env.TELEGRAM_WEBHOOK_URL && { webhookUrl: process.env.TELEGRAM_WEBHOOK_URL })
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || ''
  }
};

/**
 * Get app configuration based on environment
 */
export function getAppConfig(env: string = process.env.NODE_ENV || 'development'): AppConfig {
  const config = { ...defaultAppConfig };

  // Environment-specific overrides
  if (env === 'production') {
    // Production-specific settings
    config.jwt!.secret = process.env.JWT_SECRET || config.jwt!.secret;
  } else if (env === 'test') {
    // Test-specific settings
    config.database!.database = process.env.TEST_DB_NAME || 'labelmint_test';
  }

  return config;
}