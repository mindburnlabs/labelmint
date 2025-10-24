import { PrismaClient } from '@prisma/client'

let testDb: PrismaClient

export function setupDatabase() {
  if (testDb) {
    return testDb
  }

  // Create test database connection
  testDb = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5433/labelmint_test',
      },
    },
    log: process.env.NODE_ENV === 'test' ? [] : ['query', 'info', 'warn', 'error'],
  })

  // Make database available globally
  global.testDb = testDb

  return testDb
}

export async function resetDatabase() {
  if (!testDb) {
    setupDatabase()
  }

  // Delete all data in dependency order
  const models = ['label', 'task', 'project', 'user'] as const

  for (const model of models) {
    try {
      await testDb[model].deleteMany({})
    } catch (error) {
      console.warn(`Failed to clean ${model} table:`, error)
    }
  }
}

export async function disconnectDatabase() {
  if (testDb) {
    await testDb.$disconnect()
    testDb = null as any
    global.testDb = null
  }
}

// Auto-setup database connection
setupDatabase()

export { testDb }