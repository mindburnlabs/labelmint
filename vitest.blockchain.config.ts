/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Configuration for blockchain and smart contract tests
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/blockchain/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/contracts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'contracts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      'build',
      '.next',
      'coverage',
      '**/*.d.ts',
      '**/*.config.{js,ts}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      include: [
        'contracts/**/*.{ts,tsx}',
        'tests/blockchain/**/*.{ts,tsx}'
      ],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/output/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    testTimeout: 60000, // Longer timeout for blockchain tests
    hookTimeout: 60000,
    teardownTimeout: 60000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2, // Fewer threads for blockchain tests
        minThreads: 1
      }
    },
    reporter: ['default', 'verbose'],
    outputFile: {
      junit: './test-results/blockchain-junit.xml'
    },
    alias: {
      '@': resolve(__dirname, '.'),
      '@contracts': resolve(__dirname, 'contracts'),
      '@contracts/output': resolve(__dirname, 'contracts/output')
    },
    environmentOptions: {
      node: {
        include: ['node_modules']
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@contracts': resolve(__dirname, 'contracts'),
      '@contracts/output': resolve(__dirname, 'contracts/output')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'test'),
    'global': 'globalThis'
  }
})