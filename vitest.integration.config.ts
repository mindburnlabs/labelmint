/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      'tests/integration/**/*.test.{ts,tsx}',
      'services/*/test/integration/**/*.test.{ts,tsx}'
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
      '**/tests/**',
      '**/unit/**',
      '**/e2e/**',
      '**/performance/**',
      '**/frontend/**',
      '**/bot/**'
    ],
    setupFiles: ['./tests/setup/integration-setup.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 60000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1
      }
    },
    globalSetup: ['./tests/setup/global-integration-setup.ts'],
    coverage: {
      ...baseConfig.test?.coverage,
      include: [
        'services/*/src/**/*.{ts,tsx}',
        'packages/shared/src/**/*.{ts,tsx}'
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75
        }
      }
    }
  }
})