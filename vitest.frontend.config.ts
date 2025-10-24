/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: [
      'tests/frontend/**/*.test.{ts,tsx}',
      'apps/*/test/**/*.test.{ts,tsx}',
      'packages/*/test/**/*.test.{ts,tsx}'
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
      '**/backend/**',
      '**/bot/**',
      '**/contracts/**'
    ],
    setupFiles: [
      './tests/setup/frontend-setup.ts',
      './tests/setup/jsdom-setup.ts'
    ],
    environment: 'jsdom',
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
        'apps/*/src/**/*.{ts,tsx}',
        'packages/ui/src/**/*.{ts,tsx}',
        'packages/clients/*/src/**/*.{ts,tsx}'
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
  css: {
    postcss: './postcss.config.js',
    modules: {
      classNameStrategy: 'stable'
    }
  }
})