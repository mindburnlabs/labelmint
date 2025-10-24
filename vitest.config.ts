/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { loadEnv } from 'vite'

// Base configuration for all test types
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'services/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'apps/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      'build',
      '.next',
      'coverage',
      '**/*.d.ts',
      '**/*.config.{js,ts}',
      '**/test/**',
      '**/tests/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      include: [
        'packages/**/*.{ts,tsx}',
        'services/**/*.{ts,tsx}',
        'apps/**/*.{ts,tsx}'
      ],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.config.{js,ts}',
        '**/test/**',
        '**/tests/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    },
    reporter: ['default'],
    outputFile: {
      junit: './test-results/junit.xml'
    },
    alias: {
      // Root aliases
      '@': resolve(__dirname, '.'),

      // Shared packages
      '@shared': resolve(__dirname, 'packages/shared/src'),
      '@shared/types': resolve(__dirname, 'packages/shared/types'),
      '@shared/validation': resolve(__dirname, 'packages/shared/validation'),
      '@shared/utils': resolve(__dirname, 'packages/shared/utils'),
      '@shared/database': resolve(__dirname, 'packages/shared/database'),
      '@shared/consensus': resolve(__dirname, 'packages/shared/src/consensus'),
      '@shared/api-client': resolve(__dirname, 'packages/api-client/src'),
      '@shared/observability': resolve(__dirname, 'packages/observability/src'),
      '@shared/redis-cluster': resolve(__dirname, 'packages/redis-cluster/src'),

      // UI package
      '@ui': resolve(__dirname, 'packages/ui/src'),

      // Services
      '@bot': resolve(__dirname, 'services/bot/src'),
      '@labeling-backend': resolve(__dirname, 'services/labeling-backend/src'),
      '@payment-backend': resolve(__dirname, 'services/payment-backend/src'),
      '@api-gateway': resolve(__dirname, 'services/api-gateway/src'),
      '@enterprise-api': resolve(__dirname, 'services/enterprise-api/src'),
      '@workflow-engine': resolve(__dirname, 'services/workflow-engine/src'),
      '@collaboration-service': resolve(__dirname, 'services/collaboration-service/src'),
      '@analytics-engine': resolve(__dirname, 'services/analytics-engine/src'),
      '@white-label-service': resolve(__dirname, 'services/white-label-service/src'),

      // Apps
      '@web': resolve(__dirname, 'apps/web/src'),
      '@admin': resolve(__dirname, 'apps/admin/src'),

      // Test utilities
      '@test': resolve(__dirname, 'tests/test-utils'),
      '@test/fixtures': resolve(__dirname, 'tests/test/fixtures'),
      '@test/mocks': resolve(__dirname, 'tests/test/mocks'),

      // Payment aliases
      '@payment/*': resolve(__dirname, 'services/payment-backend/src/*')
    },
    environmentOptions: {
      node: {
        include: ['node_modules']
      }
    }
  },
  resolve: {
    alias: {
      // Same aliases for module resolution
      '@': resolve(__dirname, '.'),
      '@shared': resolve(__dirname, 'packages/shared/src'),
      '@shared/types': resolve(__dirname, 'packages/shared/types'),
      '@shared/validation': resolve(__dirname, 'packages/shared/validation'),
      '@shared/utils': resolve(__dirname, 'packages/shared/utils'),
      '@shared/database': resolve(__dirname, 'packages/shared/database'),
      '@shared/consensus': resolve(__dirname, 'packages/shared/src/consensus'),
      '@shared/api-client': resolve(__dirname, 'packages/api-client/src'),
      '@shared/observability': resolve(__dirname, 'packages/observability/src'),
      '@shared/redis-cluster': resolve(__dirname, 'packages/redis-cluster/src'),
      '@ui': resolve(__dirname, 'packages/ui/src'),
      '@bot': resolve(__dirname, 'services/bot/src'),
      '@labeling-backend': resolve(__dirname, 'services/labeling-backend/src'),
      '@payment-backend': resolve(__dirname, 'services/payment-backend/src'),
      '@api-gateway': resolve(__dirname, 'services/api-gateway/src'),
      '@enterprise-api': resolve(__dirname, 'services/enterprise-api/src'),
      '@workflow-engine': resolve(__dirname, 'services/workflow-engine/src'),
      '@collaboration-service': resolve(__dirname, 'services/collaboration-service/src'),
      '@analytics-engine': resolve(__dirname, 'services/analytics-engine/src'),
      '@white-label-service': resolve(__dirname, 'services/white-label-service/src'),
      '@web': resolve(__dirname, 'apps/web/src'),
      '@admin': resolve(__dirname, 'apps/admin/src'),
      '@test': resolve(__dirname, 'tests/test-utils'),
      '@test/fixtures': resolve(__dirname, 'tests/test/fixtures'),
      '@test/mocks': resolve(__dirname, 'tests/test/mocks'),
      '@payment/*': resolve(__dirname, 'services/payment-backend/src/*')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'test'),
    'global': 'globalThis'
  }
})