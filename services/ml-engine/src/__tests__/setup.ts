/**
 * Test Setup Configuration
 * Global test setup and mocking configuration
 */

import { vi } from 'vitest';
import { mlLogger } from '@/utils/logger';

// Global type declarations for test utilities
declare global {
  var createMockFeatures: (overrides?: any) => any;
  var createMockTransactionFeatures: (overrides?: any) => any;
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock logger to avoid actual logging during tests
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mlLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fraudDetection: vi.fn(),
    prediction: vi.fn(),
    anomalyDetection: vi.fn(),
    modelMonitoring: vi.fn(),
  },
}));

// Setup global test timeout
vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 60000,
});

// Global test utilities
global.createMockFeatures = (overrides = {}) => ({
  account_age_days: 60,
  verification_status: 'verified',
  risk_tier: 'low',
  login_frequency_24h: 5,
  task_completion_rate: 0.85,
  average_task_time: 300,
  total_earned: 2500,
  total_spent: 1200,
  transaction_count: 45,
  avg_transaction_amount: 55,
  payment_method_count: 2,
  average_quality_score: 0.92,
  rejection_rate: 0.05,
  dispute_count: 1,
  consensus_agreement_rate: 0.95,
  peak_activity_hours: [14, 15, 16],
  preferred_task_types: ['image_classification', 'text_annotation'],
  device_usage_pattern: { mobile: 0.7, desktop: 0.3 },
  location_consistency_score: 0.98,
  ...overrides,
});

global.createMockTransactionFeatures = (overrides = {}) => ({
  amount: 1000,
  currency: 'USDT',
  timestamp: new Date(),
  wallet_address: 'EQD1234567890abcdef1234567890abcdef12345678',
  recipient_address: 'EQD0987654321fedcba0987654321fedcba09876543',
  hour_of_day: 14,
  day_of_week: 3,
  is_weekend: 0,
  is_holiday: 0,
  transaction_frequency_1h: 2,
  transaction_frequency_24h: 8,
  avg_transaction_amount_24h: 500,
  amount_deviation_from_avg: 1.0,
  wallet_age_days: 30,
  wallet_transaction_count: 25,
  wallet_total_volume: 5000,
  is_new_wallet: 0,
  is_high_risk_country: 0,
  is_vpn_or_proxy: 0,
  device_fingerprint: 'fp_123456',
  is_new_location: 0,
  ip_country: 'US',
  ip_city: 'New York',
  device_risk_score: 0.3,
  ip_risk_score: 0.2,
  ...overrides,
});

// Mock TensorFlow for tests that don't require actual ML operations
vi.mock('@tensorflow/tfjs-node', () => ({
  setBackend: vi.fn(),
  sequential: vi.fn(() => ({
    add: vi.fn(),
    compile: vi.fn(),
    fit: vi.fn(() => ({
      history: {
        history: {
          loss: [0.5, 0.3, 0.2],
          accuracy: [0.8, 0.9, 0.92],
        },
      },
    })),
    predict: vi.fn(() => ({
      data: vi.fn(() => Promise.resolve([0.25])),
    })),
    save: vi.fn(),
    loadLayersModel: vi.fn(),
    countParams: vi.fn(() => 1000),
    dispose: vi.fn(),
  })),
  layers: {
    dense: vi.fn(() => ({
      add: vi.fn(),
    })),
    dropout: vi.fn(() => ({
      add: vi.fn(),
    })),
  },
  train: {
    adam: vi.fn(() => ({})),
  },
  losses: {
    meanSquaredError: vi.fn(),
    binaryCrossentropy: vi.fn(),
  },
  callbacks: {
    earlyStopping: vi.fn(() => ({})),
  },
  data: {
    sync: vi.fn(() => Promise.resolve([1, 2, 3])),
  },
  scalar: {
    data: vi.fn(() => Promise.resolve([0.5])),
  },
  tensor: {
    tensor2d: vi.fn(),
    dispose: vi.fn(),
  },
}));

// Mock Redis for tests
vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve('OK')),
    setex: vi.fn(() => Promise.resolve('OK')),
    del: vi.fn(() => Promise.resolve(1)),
    keys: vi.fn(() => Promise.resolve([])),
    quit: vi.fn(() => Promise.resolve()),
  })),
}));

// Mock Prisma for tests
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $queryRaw: vi.fn(() => Promise.resolve([])),
    $executeRaw: vi.fn(() => Promise.resolve({ rowCount: 1 })),
    $disconnect: vi.fn(() => Promise.resolve()),
  })),
}));

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock process.exit to prevent tests from actually exiting
const mockExit = vi.fn();
process.exit = mockExit as any;

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global test cleanup
afterAll(() => {
  vi.restoreAllMocks();
});