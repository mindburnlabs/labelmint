import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Define environments for different test types
const environments = {
  unit: 'node',
  integration: 'node',
  e2e: 'node',
  frontend: 'jsdom',
  backend: 'node',
  bot: 'node',
  performance: 'node'
}

// Base configuration
function createBaseConfig() {
  return {
    test: {
      globals: true,
      environment: 'node',
      setupFiles: [],
      include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '.next/**',
        'coverage/**',
        '**/*.d.ts'
      ],
      testTimeout: 30000,
      hookTimeout: 10000,
      isolate: true,
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false,
          maxThreads: 4,
          minThreads: 1
        }
      },
      env: {
        NODE_ENV: 'test'
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        exclude: [
          'node_modules/**',
          'dist/**',
          'build/**',
          '.next/**',
          'coverage/**',
          '**/*.d.ts',
          '**/*.config.{js,ts}',
          '**/test/**',
          '**/tests/**',
          '**/*.test.{js,ts}',
          '**/*.spec.{js,ts}'
        ],
        thresholds: {
          global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './'),
        '@shared': resolve(__dirname, './packages/shared/src'),
        '@shared/types': resolve(__dirname, './packages/shared/types'),
        '@shared/validation': resolve(__dirname, './packages/shared/validation'),
        '@shared/utils': resolve(__dirname, './packages/shared/utils'),
        '@shared/database': resolve(__dirname, './packages/shared/database'),
        '@shared/consensus': resolve(__dirname, './packages/shared/src/consensus'),
        '@shared/api-client': resolve(__dirname, './packages/shared/api-client/src'),
        '@shared/observability': resolve(__dirname, './packages/shared/observability/src'),
        '@shared/redis-cluster': resolve(__dirname, './packages/shared/redis-cluster/src'),
        '@ui': resolve(__dirname, './packages/ui/src'),
        '@bot': resolve(__dirname, './services/bot/src'),
        '@labeling-backend': resolve(__dirname, './services/labeling-backend/src'),
        '@payment-backend': resolve(__dirname, './services/payment-backend/src'),
        '@api-gateway': resolve(__dirname, './services/api-gateway/src'),
        '@enterprise-api': resolve(__dirname, './services/enterprise-api/src'),
        '@workflow-engine': resolve(__dirname, './services/workflow-engine/src'),
        '@collaboration-service': resolve(__dirname, './services/collaboration-service/src'),
        '@analytics-engine': resolve(__dirname, './services/analytics-engine/src'),
        '@white-label-service': resolve(__dirname, './services/white-label-service/src'),
        '@contracts': resolve(__dirname, './packages/contracts/src'),
        '@web': resolve(__dirname, './apps/web/src'),
        '@admin': resolve(__dirname, './apps/admin/src')
      }
    }
  }
}

// Environment-specific configurations
function createTestConfig(env: keyof typeof environments = 'unit') {
  const baseConfig = createBaseConfig()

  const envConfigs = {
    unit: {
      test: {
        ...baseConfig.test,
        environment: 'node',
        setupFiles: [],
        include: [
          'test/unit/**/*.test.{ts,tsx}',
          'test/unit/**/*.spec.{ts,tsx}',
          'packages/*/test/**/*.test.{ts,tsx}',
          'services/*/test/unit/**/*.test.{ts,tsx}'
        ]
      }
    },

    integration: {
      test: {
        ...baseConfig.test,
        environment: 'node',
        setupFiles: ['./test/setup/integration-setup.ts'],
        include: [
          'test/integration/**/*.test.{ts,tsx}',
          'services/*/test/integration/**/*.test.{ts,tsx}'
        ],
        testTimeout: 60000,
        hookTimeout: 15000
      }
    },

    e2e: {
      test: {
        ...baseConfig.test,
        environment: 'node',
        setupFiles: ['./test/setup/e2e-setup.ts'],
        include: [
          'test/e2e/**/*.test.{ts,tsx}',
          'services/*/test/e2e/**/*.test.{ts,tsx}'
        ],
        testTimeout: 120000,
        hookTimeout: 30000,
        poolOptions: {
          threads: {
            singleThread: true // E2E tests should run sequentially
          }
        }
      }
    },

    frontend: {
      test: {
        ...baseConfig.test,
        environment: 'jsdom',
        setupFiles: ['./test/setup/frontend-setup.ts'],
        include: [
          'test/frontend/**/*.test.{ts,tsx}',
          'apps/*/test/**/*.test.{ts,tsx}',
          'packages/*/test/**/*.test.{ts,tsx}'
        ],
        globals: false,
        environmentOptions: {
          jsdom: {
            resources: 'usable'
          }
        }
      }
    },

    backend: {
      test: {
        ...baseConfig.test,
        environment: 'node',
        setupFiles: ['./test/setup/backend-setup.ts'],
        include: [
          'test/backend/**/*.test.{ts,tsx}',
          'services/*/test/**/*.test.{ts,tsx}'
        ],
        testTimeout: 60000,
        env: {
          ...baseConfig.test.env,
          DATABASE_URL: 'postgresql://test:test@localhost:5433/labelmint_test',
          REDIS_URL: 'redis://localhost:6380/1',
          PLATFORM_MNEMONIC: 'test cancel ride gift float embark used oval armor top valve clutch exist glare fresh cage label about express style reflect chick flag memo'
        }
      }
    },

    bot: {
      test: {
        ...baseConfig.test,
        environment: 'node',
        setupFiles: ['./test/setup/bot-setup.ts'],
        include: [
          'test/bot/**/*.test.{ts,tsx}',
          'services/*/test/bot/**/*.test.{ts,tsx}'
        ],
        env: {
          ...baseConfig.test.env,
          TELEGRAM_BOT_TOKEN: 'test_token',
          PLATFORM_MNEMONIC: 'test cancel ride gift float embark used oval armor top valve clutch exist glare fresh cage label about express style reflect chick flag memo'
        }
      }
    },

    performance: {
      test: {
        ...baseConfig.test,
        environment: 'node',
        setupFiles: ['./test/setup/performance-setup.ts'],
        include: [
          'test/performance/**/*.test.{ts,tsx}',
          'services/*/test/performance/**/*.test.{ts,tsx}'
        ],
        testTimeout: 300000,
        hookTimeout: 60000,
        poolOptions: {
          threads: {
            singleThread: true,
            maxThreads: 1
          }
        }
      }
    }
  }

  return {
    ...baseConfig,
    test: {
      ...baseConfig.test,
      ...envConfigs[env].test
    }
  }
}

// Default export for unit tests
export default createTestConfig('unit')

// Named exports for different environments
export const frontendConfig = createTestConfig('frontend')
export const backendConfig = createTestConfig('backend')
export const botConfig = createTestConfig('bot')
export const integrationConfig = createTestConfig('integration')
export const e2eConfig = createTestConfig('e2e')
export const performanceConfig = createTestConfig('performance')