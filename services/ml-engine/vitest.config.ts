import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
    ],
    testTimeout: 30000, // 30 seconds timeout for ML operations
    hookTimeout: 60000, // 60 seconds for hooks
    teardownTimeout: 10000, // 10 seconds for cleanup
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        'src/types/',
        'src/config/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/index.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    // Performance test configuration
    benchmark: {
      include: ['src/__tests__/**/*.benchmark.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: ['node_modules', 'dist'],
    },
    // Integration test configuration
    sequence: {
      parallel: true,
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/types': resolve(__dirname, './src/types'),
      '@/models': resolve(__dirname, './src/models'),
      '@/services': resolve(__dirname, './src/services'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/config': resolve(__dirname, './src/config'),
      '@/api': resolve(__dirname, './src/api'),
      '@/middleware': resolve(__dirname, './src/middleware'),
    },
  },
  define: {
    'process.env.NODE_ENV': '"test"',
  },
});