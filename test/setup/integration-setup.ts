import { setup } from './unit-setup'
import { testDb } from './database-setup'

// Integration test setup extends unit setup with database and service mocking
export function setupIntegration() {
  const { cleanup: unitCleanup } = setup()

  // Setup integration-specific globals
  global.testUtils = {
    ...global.testUtils,

    // Database helpers for integration tests
    createTestTask: async (projectId: string, overrides: any = {}) => {
      const mockTask = global.testUtils.createMockTask('1', overrides)
      return await testDb.task.create({
        data: {
          ...mockTask,
          projectId,
        },
      })
    },

    createTestLabel: async (taskId: string, workerId: number, overrides: any = {}) => {
      const mockLabel = global.testUtils.createMockLabel(taskId, workerId.toString(), overrides)
      return await testDb.label.create({
        data: {
          ...mockLabel,
          workerId,
          taskId,
        },
      })
    },

    createTestProject: async (overrides: any = {}) => {
      const mockProject = global.testUtils.createMockProject(overrides)
      return await testDb.project.create({
        data: mockProject,
      })
    },

    createTestUser: async (overrides: any = {}) => {
      const mockUser = global.testUtils.createMockUser(overrides)
      return await testDb.user.create({
        data: mockUser,
      })
    },

    // Cleanup helpers
    clearDatabase: async () => {
      await testDb.label.deleteMany()
      await testDb.task.deleteMany()
      await testDb.project.deleteMany()
      await testDb.user.deleteMany()
    },

    // Service mocking helpers
    mockPaymentService: () => ({
      createPayment: vi.fn().mockResolvedValue({
        id: 'payment_123',
        amount: 100,
        currency: 'USDT',
        status: 'pending',
        createdAt: new Date(),
      }),
      confirmPayment: vi.fn().mockResolvedValue({
        id: 'payment_123',
        status: 'completed',
        completedAt: new Date(),
      }),
      withdrawFunds: vi.fn().mockResolvedValue({
        id: 'withdrawal_123',
        amount: 50,
        status: 'processing',
        createdAt: new Date(),
      }),
    }),

    mockTelegramBot: () => ({
      sendMessage: vi.fn().mockResolvedValue({ message_id: 12345 }),
      sendPhoto: vi.fn().mockResolvedValue({ message_id: 12346 }),
      sendChatAction: vi.fn().mockResolvedValue(true),
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue({ message_id: 12345 }),
    }),

    mockTONService: () => ({
      createWallet: vi.fn().mockResolvedValue({
        address: 'EQDemoAddress123456789',
        publicKey: 'public_key_demo',
        mnemonic: ['word1', 'word2', 'word3'],
      }),
      getBalance: vi.fn().mockResolvedValue({
        balance: 1000000000, // in nanoTON
        usdtBalance: 50000000, // in nanoUSDT
      }),
      sendTransaction: vi.fn().mockResolvedValue({
        hash: 'transaction_hash_123',
        lt: 1234567890,
      }),
    }),
  }

  // Setup service mocks
  global.paymentService = global.testUtils.mockPaymentService()
  global.telegramBot = global.testUtils.mockTelegramBot()
  global.tonService = global.testUtils.mockTONService()

  return {
    cleanup: async () => {
      // Cleanup integration tests
      await global.testUtils.clearDatabase()
      unitCleanup()
      vi.clearAllMocks()
    },
  }
}

// Auto-setup for integration tests
const { cleanup } = setupIntegration()

export { cleanup }