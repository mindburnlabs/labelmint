// Global Integration Test Setup
// ==============================
// Setup for integration tests that runs once before all tests

import { server } from './msw-setup'

// Global setup function for Vitest
export default async function setup() {
  // Set global test environment variables
  process.env.NODE_ENV = 'test'
  process.env.LOG_LEVEL = 'error'
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/labelmint_test'
  process.env.REDIS_URL = 'redis://localhost:6380/1'
  process.env.TON_TESTNET_API_KEY = 'test-api-key'
  process.env.SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

  console.log('🧪 Global integration test setup completed')
}

// Global teardown function
export async function teardown() {
  // MSW server is automatically managed by msw-setup.ts
  console.log('🧪 Global integration test teardown completed')
}