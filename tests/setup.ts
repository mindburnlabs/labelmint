// Main test setup file for LabelMint tests
import { jest } from '@jest/globals'

// Mock database setup
export const testDb = {
  transaction: {
    create: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({})
  },
  wallet: {
    create: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({})
  },
  user: {
    create: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({})
  }
}

// Mock Redis setup
export const testRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  flushdb: jest.fn().mockResolvedValue('OK'),
  keys: jest.fn().mockResolvedValue([]),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1)
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
  jest.clearAllMocks()
})

// Set test timeout for async operations
jest.setTimeout(30000)