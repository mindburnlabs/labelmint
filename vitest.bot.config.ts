/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      'tests/bot/**/*.test.{ts,tsx}',
      'services/*/test/bot/**/*.test.{ts,tsx}'
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
      '**/backend/**',
      '**/contracts/**'
    ],
    setupFiles: ['./tests/setup/bot-setup.ts'],
    environment: 'node',
    testTimeout: 30000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1
      }
    },
    coverage: {
      ...baseConfig.test?.coverage,
      include: [
        'services/bot/src/**/*.{ts,tsx}',
        'packages/clients/telegram-client/src/**/*.{ts,tsx}'
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