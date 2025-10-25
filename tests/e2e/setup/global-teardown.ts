// Global E2E Test Teardown
// ========================
// Cleans up the testing environment after all E2E tests

import { FullConfig } from '@playwright/test'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...')

  try {
    // 1. Stop blockchain test node
    console.log('⛓️ Stopping TON test node...')
    await stopBlockchainTestNode()

    // 2. Clean up test database (optional - keep for debugging)
    if (process.env.CLEANUP_DB === 'true') {
      console.log('📊 Cleaning up test database...')
      await cleanupTestDatabase()
    }

    // 3. Clean up test artifacts (optional)
    if (process.env.CLEANUP_ARTIFACTS === 'true') {
      console.log('🗂️ Cleaning up test artifacts...')
      await cleanupArtifacts()
    }

    console.log('✅ E2E test environment cleaned up!')
  } catch (error) {
    console.error('❌ E2E teardown failed:', error)
    // Don't throw - teardown failures shouldn't fail the test run
  }
}

async function stopBlockchainTestNode() {
  try {
    // Stop TON test node if it was started by our setup
    await execAsync('pkill -f "ton-testnet" || echo "No testnet process found"')
    console.log('✅ TON test node stopped')
  } catch (error) {
    console.warn('Warning stopping blockchain test node:', error.message)
  }
}

async function cleanupTestDatabase() {
  try {
    // Reset test database to clean state
    await execAsync('pnpm run db:reset', {
      cwd: process.cwd(),
    })
    console.log('✅ Test database cleaned up')
  } catch (error) {
    console.warn('Warning cleaning up test database:', error.message)
  }
}

async function cleanupArtifacts() {
  try {
    // Clean up temporary files and artifacts
    await execAsync('rm -rf test-results/temp/* test-results/screenshots/*', {
      cwd: process.cwd(),
    })
    console.log('✅ Test artifacts cleaned up')
  } catch (error) {
    console.warn('Warning cleaning up artifacts:', error.message)
  }
}

export default globalTeardown