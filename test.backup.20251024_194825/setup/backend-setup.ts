import { setup } from './unit-setup'
import { resetDatabase } from './database-setup'

// Backend-specific test setup
export function setupBackend() {
  const { cleanup: unitCleanup } = setup()

  // Setup process environment for backend tests
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5433/labelmint_test'
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380/1'
  process.env.JWT_SECRET = 'test-jwt-secret'
  process.env.TON_RPC_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC'
  process.env.USDT_CONTRACT_ADDRESS = 'test-address'
  process.env.NODE_ENV = 'test'

  // Extend test utilities with backend-specific helpers
  global.testUtils = {
    ...global.testUtils,

    // Database helpers
    createTestTaskInDb: async (taskData: any) => {
      return global.testDb.task.create({
        data: {
          ...global.testUtils.createMockTask('1'),
          ...taskData,
        },
      })
    },

    createTestUserInDb: async (userData: any = {}) => {
      return global.testDb.user.create({
        data: {
          ...global.testUtils.createMockUser(),
          ...userData,
        },
      })
    },

    createTestProjectInDb: async (projectData: any = {}) => {
      return global.testDb.project.create({
        data: {
          ...global.testUtils.createMockProject(),
          ...projectData,
        },
      })
    },

    // Service mocking helpers
    mockAuthService: () => ({
      generateToken: vi.fn().mockReturnValue('test-jwt-token'),
      verifyToken: vi.fn().mockReturnValue({
        userId: 'user_test_123',
        email: 'test@example.com',
        role: 'annotator',
      }),
      hashPassword: vi.fn().mockReturnValue('hashed-password'),
      comparePassword: vi.fn().mockReturnValue(true),
    }),

    mockPaymentService: () => ({
      createPayment: vi.fn().mockResolvedValue({
        id: 'payment_123',
        amount: 100,
        currency: 'USDT',
        status: 'pending',
        createdAt: new Date(),
      }),
      processPayment: vi.fn().mockResolvedValue({
        id: 'payment_123',
        status: 'completed',
        transactionHash: '0x123...abc',
        completedAt: new Date(),
      }),
      getUserBalance: vi.fn().mockResolvedValue({
        usdtBalance: 1000,
        tonBalance: 5.5,
      }),
    }),

    mockTONWalletService: () => ({
      createWallet: vi.fn().mockResolvedValue({
        address: 'EQDemoAddress123456789',
        publicKey: 'public_key_demo',
        mnemonic: ['word1', 'word2', 'word3', 'word4', 'word5', 'word6'],
      }),
      getBalance: vi.fn().mockResolvedValue({
        tonBalance: '5.5',
        usdtBalance: '1000',
      }),
      sendTransaction: vi.fn().mockResolvedValue({
        hash: 'transaction_hash_123',
        lt: 1234567890,
        success: true,
      }),
      validateAddress: vi.fn().mockReturnValue(true),
    }),

    mockRedisService: () => ({
      get: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn(),
      exists: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      flushall: vi.fn(),
    }),

    // HTTP mocking helpers
    mockApiResponse: (data: any, status: number = 200) => ({
      data,
      status,
      statusText: 'OK',
      headers: {},
      config: {},
    }),

    mockApiError: (message: string, status: number = 500) => ({
      message,
      status,
      statusText: 'Internal Server Error',
      headers: {},
      config: {},
    }),

    // Test data helpers
    createTestRequest: (overrides: any = {}) => ({
      method: 'GET',
      url: '/test',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer test-token',
      },
      body: null,
      ...overrides,
    }),

    createTestResponse: () => ({
      status: 200,
      json: vi.fn(),
      send: vi.fn(),
      status: vi.fn().mockReturnThis(),
    }),
  }

  // Setup global service mocks
  global.authService = global.testUtils.mockAuthService()
  global.paymentService = global.testUtils.mockPaymentService()
  global.tonWalletService = global.testUtils.mockTONWalletService()
  global.redisService = global.testUtils.mockRedisService()

  return {
    cleanup: async () => {
      // Cleanup backend tests
      await resetDatabase()
      unitCleanup()
      vi.clearAllMocks()
    },
  }
}

// Auto-setup for backend tests
const { cleanup } = setupBackend()

export { cleanup }