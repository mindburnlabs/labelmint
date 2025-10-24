// Unified Jest Configuration for LabelMint
// ========================================
// This configuration supports all test types: unit, integration, e2e, frontend, backend

const { resolve } = require('path');
const { defaults: tsjPreset } = require('ts-jest/presets');

// Base configuration
const baseConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/packages', '<rootDir>/services', '<rootDir>/apps'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    ...tsjPreset.transform,
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: true
    }]
  },
  collectCoverageFrom: [
    'packages/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'apps/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/*.config.{js,ts}',
    '!**/test/**',
    '!**/tests/**',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'json', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@shared/types$': '<rootDir>/packages/shared/types',
    '^@shared/validation$': '<rootDir>/packages/shared/validation',
    '^@shared/utils$': '<rootDir>/packages/shared/utils',
    '^@shared/database$': '<rootDir>/packages/shared/database',
    '^@shared/consensus/(.*)$': '<rootDir>/packages/shared/src/consensus/$1',
    '^@shared/api-client/(.*)$': '<rootDir>/packages/shared/api-client/src/$1',
    '^@shared/observability/(.*)$': '<rootDir>/packages/shared/observability/src/$1',
    '^@shared/redis-cluster/(.*)$': '<rootDir>/packages/shared/redis-cluster/src/$1',
    '^@ui/(.*)$': '<rootDir>/packages/ui/src/$1',
    '^@bot/(.*)$': '<rootDir>/services/bot/src/$1',
    '^@labeling-backend/(.*)$': '<rootDir>/services/labeling-backend/src/$1',
    '^@payment-backend/(.*)$': '<rootDir>/services/payment-backend/src/$1',
    '^@api-gateway/(.*)$': '<rootDir>/services/api-gateway/src/$1',
    '^@enterprise-api/(.*)$': '<rootDir>/services/enterprise-api/src/$1',
    '^@workflow-engine/(.*)$': '<rootDir>/services/workflow-engine/src/$1',
    '^@collaboration-service/(.*)$': '<rootDir>/services/collaboration-service/src/$1',
    '^@analytics-engine/(.*)$': '<rootDir>/services/analytics-engine/src/$1',
    '^@white-label-service/(.*)$': '<rootDir>/services/white-label-service/src/$1',
    '^@contracts/(.*)$': '<rootDir>/packages/contracts/src/$1',
    '^@web/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@admin/(.*)$': '<rootDir>/apps/admin/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  testTimeout: 30000,
  maxWorkers: 4,
  verbose: true,
  bail: false,
  forceExit: false,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};

// Environment-specific configurations
const configs = {
  unit: {
    ...baseConfig,
    testEnvironment: 'node',
    testMatch: [
      '<rootDir>/tests/unit/**/*.test.{ts,tsx}',
      '<rootDir>/tests/unit/**/*.spec.{ts,tsx}',
      '<rootDir>/packages/*/test/**/*.test.{ts,tsx}',
      '<rootDir>/services/*/test/unit/**/*.test.{ts,tsx}'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup/unit-setup.ts']
  },

  integration: {
    ...baseConfig,
    testEnvironment: 'node',
    testMatch: [
      '<rootDir>/tests/integration/**/*.test.{ts,tsx}',
      '<rootDir>/services/*/test/integration/**/*.test.{ts,tsx}'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup/integration-setup.ts'],
    testTimeout: 60000
  },

  e2e: {
    ...baseConfig,
    testEnvironment: 'node',
    testMatch: [
      '<rootDir>/tests/e2e/**/*.test.{ts,tsx}',
      '<rootDir>/services/*/test/e2e/**/*.test.{ts,tsx}'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e-setup.ts'],
    testTimeout: 120000,
    maxWorkers: 1 // Run sequentially
  },

  frontend: {
    ...baseConfig,
    testEnvironment: 'jsdom',
    testMatch: [
      '<rootDir>/tests/frontend/**/*.test.{ts,tsx}',
      '<rootDir>/apps/*/test/**/*.test.{ts,tsx}',
      '<rootDir>/packages/*/test/**/*.test.{ts,tsx}'
    ],
    setupFilesAfterEnv: [
      '<rootDir>/tests/setup/frontend-setup.ts',
      '<rootDir>/tests/setup/jest-dom.setup.ts'
    ],
    moduleNameMapping: {
      ...baseConfig.moduleNameMapping,
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    }
  },

  backend: {
    ...baseConfig,
    testEnvironment: 'node',
    testMatch: [
      '<rootDir>/tests/backend/**/*.test.{ts,tsx}',
      '<rootDir>/services/*/test/**/*.test.{ts,tsx}'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup/backend-setup.ts'],
    testTimeout: 60000
  },

  bot: {
    ...baseConfig,
    testEnvironment: 'node',
    testMatch: [
      '<rootDir>/tests/bot/**/*.test.{ts,tsx}',
      '<rootDir>/services/*/test/bot/**/*.test.{ts,tsx}'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup/bot-setup.ts']
  },

  performance: {
    ...baseConfig,
    testEnvironment: 'node',
    testMatch: [
      '<rootDir>/tests/performance/**/*.test.{ts,tsx}',
      '<rootDir>/services/*/test/performance/**/*.test.{ts,tsx}'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup/performance-setup.ts'],
    testTimeout: 300000,
    maxWorkers: 1
  }
};

// Get configuration from command line arguments or default to unit
const getTestConfig = () => {
  const args = process.argv.slice(2);
  const testTypeIndex = args.findIndex(arg =>
    ['unit', 'integration', 'e2e', 'frontend', 'backend', 'bot', 'performance'].includes(arg)
  );

  const testType = testTypeIndex >= 0 ? args[testTypeIndex] : 'unit';
  return configs[testType] || configs.unit;
};

module.exports = getTestConfig();

// Export all configurations for programmatic usage
module.exports.configs = configs;
module.exports.baseConfig = baseConfig;