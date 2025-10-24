/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      'tests/backend/**/*.test.{ts,tsx}',
      'services/*/test/**/*.test.{ts,tsx}'
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
      '**/integration/**',
      '**/e2e/**',
      '**/performance/**',
      '**/frontend/**',
      '**/bot/**',
      '**/contracts/**'
    ],
    setupFiles: ['./tests/setup/backend-setup.ts'],
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
    globalSetup: ['./tests/setup/global-backend-setup.ts'],
    coverage: {
      ...baseConfig.test?.coverage,
      include: [
        'services/*/src/**/*.{ts,tsx}',
        'packages/shared/src/**/*.{ts,tsx}'
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
  }
})