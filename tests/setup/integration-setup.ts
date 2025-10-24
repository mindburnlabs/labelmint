// Integration test setup
import { vi } from 'vitest'
import { setupDatabase } from './database-setup'

// Mock external services
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          data: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }))
}))

// Mock Redis
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve('OK')),
    del: vi.fn(() => Promise.resolve(1)),
    exists: vi.fn(() => Promise.resolve(0))
  }))
}))

// Setup database before integration tests
beforeAll(async () => {
  await setupDatabase()
})

// Clean up after integration tests
afterAll(async () => {
  // Add cleanup logic here
})

beforeEach(async () => {
  // Reset database state before each test
  vi.clearAllMocks()
})