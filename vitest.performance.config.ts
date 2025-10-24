/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      'tests/performance/**/*.test.{ts,tsx}',
      'services/*/test/performance/**/*.test.{ts,tsx}'
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
      '**/frontend/**',
      '**/backend/**',
      '**/bot/**',
      '**/contracts/**'
    ],
    setupFiles: ['./tests/setup/performance-setup.ts'],
    environment: 'node',
    testTimeout: 300000,
    hookTimeout: 300000,
    teardownTimeout: 300000,
    isolate: false,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },
    globalSetup: ['./tests/setup/global-performance-setup.ts'],
    coverage: {
      ...baseConfig.test?.coverage,
      enabled: false // Performance tests focus on metrics, not coverage
    }
  }
})