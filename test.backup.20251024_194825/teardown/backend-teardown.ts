import { disconnectDatabase } from '../setup/database-setup'

export async function teardownBackend() {
  // Clean up database connections
  await disconnectDatabase()

  // Clear all mocks
  if (typeof vi !== 'undefined') {
    vi.clearAllMocks()
  }

  // Clear global service mocks
  if (typeof global !== 'undefined') {
    global.testUtils = null
    global.testDb = null
    global.authService = null
    global.paymentService = null
    global.tonWalletService = null
    global.redisService = null
  }

  // Reset process environment
  delete process.env.TEST_MODE
  delete process.env.DATABASE_URL
  delete process.env.REDIS_URL
  delete process.env.JWT_SECRET
}

// Auto-teardown
process.on('exit', teardownBackend)
process.on('SIGINT', () => {
  teardownBackend()
  process.exit(0)
})
process.on('SIGTERM', () => {
  teardownBackend()
  process.exit(0)
})