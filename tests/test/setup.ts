// Test setup for tests directory
import { vi } from 'vitest'

// Mock database setup
export const testDb = {
  transaction: {
    create: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({})
  },
  wallet: {
    create: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({})
  },
  user: {
    create: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({})
  }
}

// Mock Redis setup
export const testRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
  flushdb: vi.fn().mockResolvedValue('OK'),
  keys: vi.fn().mockResolvedValue([]),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1)
}

// Mock Prisma enums
export const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
}

export const TransactionType = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TASK_PAYMENT: 'TASK_PAYMENT',
  REFUND: 'REFUND'
}

// Global setup
beforeEach(() => {
  vi.clearAllMocks()
})