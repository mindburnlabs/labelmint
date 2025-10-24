/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      'tests/e2e/**/*.test.{ts,tsx}',
      'services/*/test/e2e/**/*.test.{ts,tsx}'
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
      '**/performance/**',
      '**/frontend/**',
      '**/backend/**',
      '**/bot/**',
      '**/contracts/**'
    ],
    setupFiles: ['./tests/setup/e2e-setup.ts'],
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 120000,
    isolate: false,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },
    globalSetup: ['./tests/setup/global-e2e-setup.ts'],
    coverage: {
      ...baseConfig.test?.coverage,
      enabled: false // E2E tests typically don't need coverage
    }
  }
})