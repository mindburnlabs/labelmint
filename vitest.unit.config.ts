/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/unit/**/*.spec.{ts,tsx}',
      'packages/*/test/**/*.test.{ts,tsx}',
      'services/*/test/unit/**/*.test.{ts,tsx}'
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
      'tests/integration/**',
      'tests/e2e/**',
      'tests/performance/**',
      '**/integration/**',
      '**/e2e/**',
      '**/performance/**',
      '**/frontend/**',
      '**/backend/**',
      '**/bot/**'
    ],
    setupFiles: ['./tests/setup/unit-setup.ts'],
    environment: 'node',
    testTimeout: 30000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    },
    coverage: {
      ...baseConfig.test?.coverage,
      include: [
        'packages/shared/src/**/*.{ts,tsx}',
        'services/*/src/**/*.{ts,tsx}',
        'apps/*/src/**/*.{ts,tsx}'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    }
  }
})