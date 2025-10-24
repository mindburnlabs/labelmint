export async function teardownDatabase() {
  // Clear database connection and cleanup
  if (typeof global !== 'undefined' && global.testDb) {
    try {
      await global.testDb.$disconnect()
    } catch (error) {
      console.warn('Error disconnecting from test database:', error)
    }
    global.testDb = null
  }
}

// Auto-teardown
process.on('exit', teardownDatabase)
process.on('SIGINT', () => {
  teardownDatabase()
  process.exit(0)
})
process.on('SIGTERM', () => {
  teardownDatabase()
  process.exit(0)
})