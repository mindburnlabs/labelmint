// Bot test setup
import { vi } from 'vitest'
import { setupDatabase, truncateTestTables } from './database-setup'

// Mock Telegraf more thoroughly
const mockContext = {
  from: { id: 12345, username: 'testuser' },
  chat: { id: 12345 },
  message: { text: '/start', message_id: 1 },
  reply: vi.fn(),
  replyWith: vi.fn(),
  editMessageText: vi.fn(),
  deleteMessage: vi.fn(),
  sendMessage: vi.fn(),
  telegram: {
    sendMessage: vi.fn(),
    editMessageText: vi.fn(),
    deleteMessage: vi.fn()
  }
}

vi.mock('telegraf', () => ({
  Telegraf: vi.fn().mockImplementation(() => ({
    command: vi.fn((command: string, handler: Function) => {
      // Store command handlers for testing
      ;(global as any).mockBotCommands = (global as any).mockBotCommands || new Map()
      ;(global as any).mockBotCommands.set(command, handler)
    }),
    on: vi.fn((event: string, handler: Function) => {
      // Store event handlers for testing
      ;(global as any).mockBotHandlers = (global as any).mockBotHandlers || new Map()
      ;(global as any).mockBotHandlers.set(event, handler)
    }),
    launch: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    // Expose mock methods for testing
    simulateCommand: async (command: string, ctx = mockContext) => {
      const handlers = (global as any).mockBotCommands
      if (handlers?.has(command)) {
        const handler = handlers.get(command)
        await handler(ctx)
      }
    },
    simulateEvent: async (event: string, ctx = mockContext) => {
      const handlers = (global as any).mockBotHandlers
      if (handlers?.has(event)) {
        const handler = handlers.get(event)
        await handler(ctx)
      }
    }
  })),
  Context: vi.fn(() => mockContext),
  Markup: {
    inlineKeyboard: vi.fn((buttons: any[][]) => ({
      reply_markup: { inline_keyboard: buttons }
    })),
    keyboard: vi.fn((buttons: any[][]) => ({
      reply_markup: { keyboard: buttons, resize_keyboard: true }
    })),
    removeKeyboard: vi.fn(() => ({
      reply_markup: { remove_keyboard: true }
    }))
  }
}))

// Mock TON blockchain interactions
vi.mock('@ton/ton', () => ({
  TonClient: vi.fn().mockImplementation(() => ({
    openContract: vi.fn(() => ({
      send: vi.fn(() => Promise.resolve({
        transactions: [{
          address: 'EQD___vdB-35R-5aC_5Pq0rh0L2A_sO8U_9nZb7QJ1k0QfE',
          amount: '10000000'
        }]
      })),
      getBalance: vi.fn(() => Promise.resolve('5000000000')), // 5 TON
      getTransactions: vi.fn(() => Promise.resolve([]))
    }))
  })),
  Address: {
    parse: vi.fn((addr: string) => ({
      toString: () => addr,
      toRawString: () => addr
    })),
    parseFriendly: vi.fn(() => ({
      address: {
        toString: () => 'EQD___vdB-35R-5aC_5Pq0rh0L2A_sO8U_9nZb7QJ1k0QfE'
      }
    }))
  },
  fromNano: vi.fn((nano: string) => (parseInt(nano) / 1000000000).toString()),
  toNano: vi.fn((ton: string) => (parseFloat(ton) * 1000000000).toString()),
  beginCell: vi.fn(() => ({
    storeUint: vi.fn().mockReturnThis(),
    storeAddress: vi.fn().mockReturnThis(),
    storeCoins: vi.fn().mockReturnThis(),
    endCell: vi.fn(() => ({
      toBoc: vi.fn(() => Buffer.from('test'))
    }))
  })),
  TonContract: vi.fn()
}))

// Set environment variables
process.env.NODE_ENV = 'test'
process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token'
process.env.PLATFORM_MNEMONIC = 'test cancel ride gift float embark used oval armor top valve clutch exist glare fresh cage label about express style reflect chick flag memo'
process.env.TONCENTER_TESTNET_API_KEY = 'test_api_key'

// Setup database
beforeAll(async () => {
  await setupDatabase()
})

// Clean database before each test
beforeEach(async () => {
  await truncateTestTables()
  vi.clearAllMocks()

  // Reset mock bot state
  ;(global as any).mockBotCommands = new Map()
  ;(global as any).mockBotHandlers = new Map()
})

afterAll(async () => {
  const { cleanupDatabase } = await import('./database-setup')
  await cleanupDatabase()
})

// Export mock helpers for tests
export { mockContext }