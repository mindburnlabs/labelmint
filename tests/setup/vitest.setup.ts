// Global Vitest Test Setup
// =========================
// Comprehensive test setup for all test types

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { config } from '@vue/test-utils'
import { Redis } from 'ioredis'

// Global test utilities
export * from './test-utils/global-mocks'
export * from './test-utils/factories'
export * from './test-utils/helpers'

// Global test configuration
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'error'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/labelmint_test'
process.env.REDIS_URL = 'redis://localhost:6380/1'
process.env.TON_TESTNET = 'true'
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'

// Mock TON blockchain for testing
vi.mock('@ton/ton', () => ({
  TonClient: vi.fn(() => ({
    address: vi.fn(),
    runMethod: vi.fn().mockResolvedValue({ stack: [] }),
    sendExternalMessage: vi.fn().mockResolvedValue({}),
  })),
  Address: vi.fn(() => 'mock-address'),
  beginCell: vi.fn(() => ({
    storeUint: vi.fn().mockReturnThis(),
    storeCoins: vi.fn().mockReturnThis(),
    storeAddress: vi.fn().mockReturnThis(),
    endCell: vi.fn(),
  })),
  toNano: vi.fn(() => BigInt('1000000000')),
}))

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      signIn: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      update: vi.fn().mockResolvedValue({ data: {}, error: null }),
      delete: vi.fn().mockResolvedValue({ data: {}, error: null }),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        remove: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.url' } }),
      })),
    },
  })),
}))

// Mock Redis
vi.mock('ioredis', () => ({
  Redis: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    incr: vi.fn().mockResolvedValue(1),
    incrby: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    hget: vi.fn().mockResolvedValue(null),
    hset: vi.fn().mockResolvedValue(1),
    hdel: vi.fn().mockResolvedValue(1),
    hexists: vi.fn().mockResolvedValue(0),
    hgetall: vi.fn().mockResolvedValue({}),
    lpush: vi.fn().mockResolvedValue(1),
    rpop: vi.fn().mockResolvedValue(null),
    lrange: vi.fn().mockResolvedValue([]),
    flushall: vi.fn().mockResolvedValue('OK'),
    subscribe: vi.fn().mockReturnValue({}),
    unsubscribe: vi.fn().mockReturnValue({}),
    publish: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
  })),
}))

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
  useParams: vi.fn(() => ({ id: 'test-id' })),
}))

// Mock Next.js image
vi.mock('next/image', () => ({
  default: vi.fn(({ src, alt, ...props }) => (
    <img src={src} alt={alt} {...props} />
  )),
}))

// Mock Telegram SDK
vi.mock('@twa-dev/sdk', () => ({
  initData: {
    user: {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      language_code: 'en',
    },
    query_id: 'test-query-id',
    auth_date: Math.floor(Date.now() / 1000),
    hash: 'test-hash',
  },
  WebApp: {
    ready: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    sendData: vi.fn(),
    headerColor: vi.fn(),
    backgroundColor: vi.fn(),
    onEvent: vi.fn(),
    offEvent: vi.fn(),
  },
}))

// Mock JWT
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(() => 'mock-jwt-token'),
  verify: vi.fn(() => ({ userId: 'test-user-id', role: 'user' })),
}))

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
}))

// Mock Winston logger
vi.mock('winston', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    errors: vi.fn(),
    json: vi.fn(),
    prettyPrint: vi.fn(),
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn(),
  },
}))

// Mock Nodemailer
vi.mock('nodemailer', () => ({
  createTransporter: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  })),
}))

// Mock crypto module for deterministic behavior in tests
Object.defineProperty(global, 'crypto', {
  value: {
    ...crypto,
    randomUUID: vi.fn(() => 'test-uuid-1234-5678-9012'),
    randomInt: vi.fn((min, max) => Math.floor(Math.random() * (max - min) + min)),
  },
})

// Global test helpers
export const createMockUser = () => ({
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

export const createMockProject = () => ({
  id: 'test-project-id',
  name: 'Test Project',
  description: 'Test Description',
  status: 'active',
  budget: 1000,
  createdBy: 'test-user-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

export const createMockTask = () => ({
  id: 'test-task-id',
  projectId: 'test-project-id',
  title: 'Test Task',
  description: 'Test Task Description',
  status: 'pending',
  reward: 10,
  type: 'image_classification',
  data: { imageUrl: 'https://example.com/image.jpg' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

// Test timeout configuration
vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000,
})

// Setup and teardown
beforeAll(async () => {
  // Global test setup
  console.log('🧪 Setting up test environment...')
})

afterAll(async () => {
  // Global cleanup
  console.log('🧹 Cleaning up test environment...')
})

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks()

  // Clear localStorage and sessionStorage
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  // Cleanup React testing library
  cleanup()
})

// Global error handling for unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection in test:', error)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in test:', error)
})

// Performance monitoring utilities
export const measurePerformance = (name: string, fn: () => Promise<any>) => {
  return async () => {
    const start = performance.now()
    try {
      await fn()
    } finally {
      const end = performance.now()
      console.log(`⏱️ ${name}: ${(end - start).toFixed(2)}ms`)
    }
  }
}

// Load testing utilities
export const simulateConcurrentUsers = async (
  userCount: number,
  userAction: (userId: number) => Promise<void>
) => {
  const promises = Array.from({ length: userCount }, (_, i) =>
    userAction(i + 1)
  )
  await Promise.all(promises)
}

export {}