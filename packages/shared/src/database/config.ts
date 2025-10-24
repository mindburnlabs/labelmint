// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

import { DatabaseConfig } from '../types/database';

/**
 * Default database configuration
 */
export const defaultDatabaseConfig: DatabaseConfig = {
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'labelmint',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '60000', 10),
      createTimeoutMillis: parseInt(process.env.DB_POOL_CREATE_TIMEOUT || '30000', 10),
      destroyTimeoutMillis: parseInt(process.env.DB_POOL_DESTROY_TIMEOUT || '5000', 10),
      reapIntervalMillis: parseInt(process.env.DB_POOL_REAP_INTERVAL || '1000', 10),
      createRetryIntervalMillis: parseInt(process.env.DB_POOL_CREATE_RETRY_INTERVAL || '200', 10)
    }
  },
  migrations: {
    directory: './migrations',
    tableName: 'migrations',
    disableTransactions: false
  },
  seeds: {
    directory: './seeds'
  },
  logging: {
    enabled: process.env.DB_LOGGING === 'true',
    level: (process.env.DB_LOG_LEVEL as any) || 'info',
    sql: process.env.DB_LOG_SQL === 'true'
  }
};

/**
 * Test database configuration
 */
export const testDatabaseConfig: DatabaseConfig = {
  ...defaultDatabaseConfig,
  connection: {
    ...defaultDatabaseConfig.connection,
    database: process.env.TEST_DB_NAME || 'labelmint_test',
    pool: {
      min: 1,
      max: 5,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    }
  },
  logging: {
    enabled: false,
    level: 'error',
    sql: false
  }
};

/**
 * Get database configuration based on environment
 */
export function getDatabaseConfig(env: string = process.env.NODE_ENV || 'development'): DatabaseConfig {
  switch (env) {
    case 'test':
      return testDatabaseConfig;
    case 'production':
      return {
        ...defaultDatabaseConfig,
        logging: {
          enabled: true,
          level: 'warn',
          sql: false
        }
      };
    default:
      return defaultDatabaseConfig;
  }
}