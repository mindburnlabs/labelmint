// Jest Global Setup
// ==================
// This file contains global Jest configuration and setup

import 'jest-extended/all';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods in tests unless explicitly needed
const originalConsole = { ...console };

beforeEach(() => {
  // Reset console mocks before each test
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods after each test
  console.log.mockRestore();
  console.warn.mockRestore();
  console.error.mockRestore();
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUserId(): R;
      toBeValidTaskId(): R;
      toBeValidPaymentAmount(): R;
      toBeValidTelegramToken(): R;
      toBeValidTonAddress(): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidUserId(received: string) {
    const pass = typeof received === 'string' && received.length > 0 && /^\d+$/.test(received);
    return {
      message: () => `expected ${received} to be a valid user ID`,
      pass,
    };
  },

  toBeValidTaskId(received: string) {
    const pass = typeof received === 'string' && received.length > 0 && /^[a-zA-Z0-9_-]+$/.test(received);
    return {
      message: () => `expected ${received} to be a valid task ID`,
      pass,
    };
  },

  toBeValidPaymentAmount(received: number) {
    const pass = typeof received === 'number' && received > 0 && Number.isInteger(received);
    return {
      message: () => `expected ${received} to be a valid payment amount`,
      pass,
    };
  },

  toBeValidTelegramToken(received: string) {
    const pass = typeof received === 'string' &&
                  received.length > 0 &&
                  /^\d+:[a-zA-Z0-9_-]+$/.test(received);
    return {
      message: () => `expected ${received} to be a valid Telegram bot token`,
      pass,
    };
  },

  toBeValidTonAddress(received: string) {
    const pass = typeof received === 'string' &&
                  received.length > 0 &&
                  /^[0-9a-fA-F]{64}$/.test(received.replace('0:', ''));
    return {
      message: () => `expected ${received} to be a valid TON address`,
      pass,
    };
  }
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Mock environment variables for all tests
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Global test cleanup
afterAll(() => {
  // Cleanup any global resources
  jest.clearAllTimers();
  jest.useRealTimers();
});