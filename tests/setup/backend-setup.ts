// Backend test setup
import { vi } from 'vitest'
import { setupDatabase, truncateTestTables } from './database-setup'

// Mock Telegram Bot API
vi.mock('telegraf', () => ({
  Telegraf: vi.fn().mockImplementation(() => ({
    command: vi.fn(),
    on: vi.fn(),
    launch: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve())
  })),
  Markup: {
    inlineKeyboard: vi.fn(() => ({ reply_markup: { inline_keyboard: [] } })),
    keyboard: vi.fn(() => ({ reply_markup: { keyboard: [] } }))
  }
}))

// Mock TON (The Open Network)
vi.mock('@ton/ton', () => ({
  TonClient: vi.fn().mockImplementation(() => ({
    openContract: vi.fn(() => ({
      send: vi.fn(() => Promise.resolve({ transactions: [] })),
      getBalance: vi.fn(() => Promise.resolve('1000000000')),
      getTransactions: vi.fn(() => Promise.resolve([]))
    }))
  })),
  Address: {
    parse: vi.fn(() => ({ toString: () => 'EQD___vdB-35R-5aC_5Pq0rh0L2A_sO8U_9nZb7QJ1k0QfE' }))
  },
  fromNano: vi.fn(() => '1.0'),
  toNano: vi.fn(() => '1000000000')
}))

// Mock payment processing
vi.mock('@labelmint/payment-backend', () => ({
  PaymentHandler: vi.fn().mockImplementation(() => ({
    calculateTaskPayment: vi.fn(() => Promise.resolve({
      amount: 0.02,
      baseRate: 0.02,
      multiplier: 1,
      qualityBonus: 0
    })),
    payWorker: vi.fn(() => Promise.resolve({ success: true, amount: 0.02 })),
    createPaymentChannel: vi.fn(() => Promise.resolve({
      id: 'test-channel',
      capacity: 10,
      spent: 0,
      isActive: true
    })),
    getWorkerBalance: vi.fn(() => Promise.resolve({
      balance: 0,
      channelBalance: 0
    })),
    withdrawFunds: vi.fn(() => Promise.resolve({
      success: true,
      amount: 10,
      fee: 0.1,
      batchId: 'test-batch'
    }))
  }))
}))

// Set up environment variables for backend tests
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/labelmint_test'
process.env.REDIS_URL = 'redis://localhost:6380/1'
process.env.TONCENTER_TESTNET_API_KEY = 'test_key'
process.env.PLATFORM_MNEMONIC = 'test cancel ride gift float embark used oval armor top valve clutch exist glare fresh cage label about express style reflect chick flag memo'

// Setup database
beforeAll(async () => {
  await setupDatabase()
})

// Clean database before each test
beforeEach(async () => {
  await truncateTestTables()
  vi.clearAllMocks()
})

// Cleanup after tests
afterAll(async () => {
  const { cleanupDatabase } = await import('./database-setup')
  await cleanupDatabase()
})