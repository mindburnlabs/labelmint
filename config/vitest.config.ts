/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

// Base configuration shared across all environments
const baseConfig = {
  globals: true,
  testTimeout: 30000,
  hookTimeout: 30000,
  isolate: true,
  passWithNoTests: false,
  retry: 2,
  bail: 5,
  reporters: ['verbose'],
  coverage: {
    provider: 'v8' as const,
    reporter: ['text', 'json', 'html', 'lcov'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.config.{js,ts}',
      '**/stories/**',
      '**/test-utils/**',
      '**/fixtures/**',
      '**/pages/_app.tsx',
      '**/pages/_document.tsx',
      '**/styles/**',
      '**/__mocks__/**',
      '**/config/**',
      '**/migrations/**',
      '**/seeds/**',
    ],
    all: true,
    clean: true,
    thresholds: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
}

// Environment-specific configurations
const environments = {
  unit: {
    include: ['test/unit/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      '**/*.d.ts',
      'test/unit/performance-disabled/**', // Disabled performance tests
    ],
    setupFiles: ['./test/setup/unit-setup.ts'],
    environment: 'node' as const,
    pool: 'threads' as const,
    sequence: {
      concurrent: true,
      shuffle: false,
    },
  },

  integration: {
    include: [
      'test/integration/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'test/features/**/*.{test,spec}.{ts,tsx,js,jsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      '**/*.d.ts',
      '**/test-utils/**',
      '**/fixtures/**',
    ],
    setupFiles: [
      './test/setup/integration-setup.ts',
      './test/setup/database-setup.ts',
    ],
    teardownFiles: ['./test/teardown/integration-teardown.ts'],
    environment: 'node' as const,
    pool: 'threads' as const,
    poolOptions: {
      threads: {
        maxThreads: 4,
        isolate: true,
      },
    },
    sequence: {
      concurrent: true,
      shuffle: false,
    },
  },

  frontend: {
    include: [
      'apps/web/src/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'apps/admin/src/**/*.{test,spec}.{ts,tsx,js,jsx}',
      'test/unit/frontend/**/*.{test,spec}.{ts,tsx,js,jsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      '**/*.d.ts',
      '**/test-utils/**',
      '**/fixtures/**',
      '**/stories/**',
    ],
    setupFiles: [
      './test/setup/frontend-setup.ts',
      './test/setup/msw-setup.ts',
    ],
    environment: 'jsdom' as const,
    pool: 'threads' as const,
    sequence: {
      concurrent: true,
      shuffle: false,
    },
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXT_PUBLIC_WS_URL: 'ws://localhost:3001',
      NEXT_PUBLIC_TON_MANIFEST: '/tonconnect-manifest.json',
    },
    coverage: {
      ...baseConfig.coverage,
      thresholds: {
        global: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
        // Critical UI components have higher thresholds
        'apps/web/src/components/**': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        'apps/admin/src/components/**': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },

  backend: {
    include: [
      'services/labeling-backend/src/**/*.{test,spec}.{ts,js}',
      'services/payment-backend/src/**/*.{test,spec}.{ts,js}',
      'services/api-gateway/src/**/*.{test,spec}.{ts,js}',
      'test/unit/backend/**/*.{test,spec}.{ts,js}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      '**/*.d.ts',
      '**/test-utils/**',
      '**/fixtures/**',
      '**/config/**',
      '**/migrations/**',
      '**/seeds/**',
    ],
    setupFiles: [
      './test/setup/backend-setup.ts',
      './test/setup/database-setup.ts',
      './test/setup/redis-setup.ts',
    ],
    teardownFiles: [
      './test/teardown/backend-teardown.ts',
      './test/teardown/database-teardown.ts',
    ],
    environment: 'node' as const,
    pool: 'threads' as const,
    poolOptions: {
      threads: {
        maxThreads: 2,
        isolate: true,
      },
    },
    sequence: {
      concurrent: false, // Run tests sequentially for database tests
    },
    testTimeout: 60000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5433/labelmint_test',
      REDIS_URL: 'redis://localhost:6380/1',
      JWT_SECRET: 'test-jwt-secret',
      TON_RPC_ENDPOINT: 'https://testnet.toncenter.com/api/v2/jsonRPC',
      USDT_CONTRACT_ADDRESS: 'test-address',
    },
    coverage: {
      ...baseConfig.coverage,
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
  },

  bot: {
    include: [
      'services/telegram-bot/src/**/*.{test,spec}.{ts,js}',
      'test/unit/bot/**/*.{test,spec}.{ts,js}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      '**/*.d.ts',
      '**/test-utils/**',
      '**/fixtures/**',
      '**/config/**',
    ],
    setupFiles: [
      './test/setup/bot-setup.ts',
      './test/setup/telegram-mock-setup.ts',
    ],
    environment: 'node' as const,
    pool: 'threads' as const,
    poolOptions: {
      threads: {
        maxThreads: 1,
        isolate: true,
      },
    },
    sequence: {
      concurrent: false, // Bot tests often need sequential execution
    },
    testTimeout: 15000,
    hookTimeout: 15000,
    env: {
      NODE_ENV: 'test',
      BOT_TOKEN: 'test-bot-token',
      BACKEND_URL: 'http://localhost:3001',
      PAYMENT_SERVICE_URL: 'http://localhost:3002',
    },
    coverage: {
      ...baseConfig.coverage,
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // Bot handlers are critical
        'services/telegram-bot/src/handlers/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },

  e2e: {
    include: ['test/e2e/**/*.{test,spec}.{ts,js}'],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      '**/*.d.ts',
    ],
    environment: 'node' as const,
    testTimeout: 120000,
    hookTimeout: 120000,
    pool: 'forks' as const,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    sequence: {
      concurrent: false, // E2E tests should run sequentially
    },
    bail: 1,
    retry: 1,
  },

  performance: {
    include: ['test/performance/**/*.{test,spec}.{ts,js}'],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      '**/*.d.ts',
      'test/unit/performance-disabled/**', // Disabled performance tests
    ],
    environment: 'node' as const,
    testTimeout: 300000,
    hookTimeout: 300000,
    pool: 'forks' as const,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    sequence: {
      concurrent: false, // Performance tests need isolation
    },
    bail: 1,
    retry: 1,
  },
}

// Create configuration factory for different environments
export function createTestConfig(env: keyof typeof environments = 'unit') {
  const config = environments[env]

  return defineConfig({
    plugins: env === 'frontend' ? [react()] : [],
    test: {
      ...baseConfig,
      ...config,
      coverage: {
        ...baseConfig.coverage,
        ...config.coverage,
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, '.'),
        '@shared': resolve(__dirname, 'packages/shared/src'),
        '@test': resolve(__dirname, 'test'),
        // Backend aliases
        '@labeling': resolve(__dirname, 'services/labeling-backend/src'),
        '@payment': resolve(__dirname, 'services/payment-backend/src'),
        '@bot': resolve(__dirname, 'services/telegram-bot/src'),
        // Frontend aliases
        '@frontend': resolve(__dirname, 'apps/web/src'),
        '@admin': resolve(__dirname, 'apps/admin/src'),
        // Service aliases
        '@api-gateway': resolve(__dirname, 'services/api-gateway/src'),
      },
    },
    define: {
      'process.env.NODE_ENV': '"test"',
      __TEST__: 'true',
      ...(env === 'frontend' ? {
        'process.env': '{}',
        'global': 'globalThis',
      } : {}),
    },
  })
}

// Default configuration for general usage
export default createTestConfig('unit')

// Named exports for different environments
export const unitConfig = createTestConfig('unit')
export const integrationConfig = createTestConfig('integration')
export const frontendConfig = createTestConfig('frontend')
export const backendConfig = createTestConfig('backend')
export const botConfig = createTestConfig('bot')
export const e2eConfig = createTestConfig('e2e')
export const performanceConfig = createTestConfig('performance')