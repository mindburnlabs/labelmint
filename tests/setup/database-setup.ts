// Database setup for testing
import { Client } from 'pg'

let testDb: Client

export async function setupDatabase() {
  if (testDb) {
    return testDb
  }

  testDb = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5433/labelmint_test'
  })

  try {
    await testDb.connect()
    console.log('Test database connected successfully')
  } catch (error) {
    console.warn('Test database connection failed, using mocks:', error)
    testDb = null as any
  }

  return testDb
}

export function getTestDb() {
  return testDb
}

export async function cleanupDatabase() {
  if (testDb) {
    await testDb.end()
    testDb = null as any
  }
}

// Truncate tables for clean test state
export async function truncateTestTables() {
  if (!testDb) return

  const tables = [
    'worker_payments',
    'payment_channels',
    'worker_balances',
    'withdrawal_batch',
    'tasks',
    'labels',
    'users',
    'projects'
  ]

  for (const table of tables) {
    try {
      await testDb.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
    } catch (error) {
      // Table might not exist, which is fine for some tests
      console.warn(`Failed to truncate table ${table}:`, error)
    }
  }
}