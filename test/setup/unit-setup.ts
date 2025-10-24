// Unit test setup - minimal configuration
import { vi } from 'vitest'

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore console.log in tests
  // log: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
  // debug: vi.fn(),
}

// Set up global test utilities
declare global {
  namespace Vi {
    interface JestAssertion<T = any> extends jest.Matchers<void, T> {}
  }
}

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/labelmint_test'
process.env.REDIS_URL = 'redis://localhost:6380/1'

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})