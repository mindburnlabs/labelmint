import { disconnectDatabase } from '../setup/database-setup'

export async function teardownIntegration() {
  // Clean up database
  await disconnectDatabase()

  // Clear all mocks
  if (typeof vi !== 'undefined') {
    vi.clearAllMocks()
  }

  // Clear global test utilities
  if (typeof global !== 'undefined') {
    global.testUtils = null
    global.testDb = null
    global.paymentService = null
    global.telegramBot = null
    global.tonService = null
  }

  // Reset environment variables
  delete process.env.TEST_MODE
}

// Auto-teardown
process.on('exit', teardownIntegration)
process.on('SIGINT', () => {
  teardownIntegration()
  process.exit(0)
})
process.on('SIGTERM', () => {
  teardownIntegration()
  process.exit(0)
})