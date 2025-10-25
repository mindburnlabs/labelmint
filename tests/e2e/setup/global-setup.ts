// Global E2E Test Setup
// =====================
// Sets up the testing environment for all E2E tests

import { chromium, FullConfig } from '@playwright/test'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...')

  try {
    // 1. Ensure test database is ready
    console.log('📊 Setting up test database...')
    await setupTestDatabase()

    // 2. Start blockchain test node if needed
    console.log('⛓️ Starting TON test node...')
    await startBlockchainTestNode()

    // 3. Create test users and data
    console.log('👥 Creating test users and data...')
    await createTestData()

    // 4. Verify all services are ready
    console.log('🔍 Verifying service health...')
    await verifyServices()

    // 5. Setup browser context defaults
    console.log('🌐 Configuring browser defaults...')
    await setupBrowserDefaults()

    console.log('✅ E2E test environment ready!')
  } catch (error) {
    console.error('❌ E2E setup failed:', error)
    throw error
  }
}

async function setupTestDatabase() {
  try {
    // Reset and seed test database
    const { stdout, stderr } = await execAsync('pnpm run db:reset', {
      cwd: process.cwd(),
    })

    if (stderr) {
      console.warn('Database setup warning:', stderr)
    }

    console.log('✅ Test database ready')
  } catch (error) {
    console.error('Failed to setup test database:', error)
    throw error
  }
}

async function startBlockchainTestNode() {
  try {
    // Check if TON test node is already running
    const { stdout } = await execAsync('curl -f http://localhost:8080/status || echo "not running"')

    if (stdout.includes('not running')) {
      console.log('Starting TON test node...')
      // Start test node in background
      execAsync('pnpm run blockchain:testnet:start', {
        cwd: process.cwd(),
        detached: true,
      }).catch(error => {
        console.warn('Blockchain test node startup warning:', error.message)
      })

      // Wait for test node to be ready
      await waitForService('http://localhost:8080/status', 30000)
    }

    console.log('✅ TON test node ready')
  } catch (error) {
    console.warn('Blockchain test node setup failed (tests will use mocks):', error.message)
  }
}

async function createTestData() {
  try {
    // Run test data seeding script
    await execAsync('node scripts/seed-test-data.js', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    })

    console.log('✅ Test data created')
  } catch (error) {
    console.error('Failed to create test data:', error)
    throw error
  }
}

async function verifyServices() {
  const services = [
    { name: 'Web App', url: 'http://localhost:3000' },
    { name: 'API Gateway', url: 'http://localhost:3001/health' },
    { name: 'Payment Backend', url: 'http://localhost:3002/health' },
  ]

  for (const service of services) {
    try {
      await waitForService(service.url, 30000)
      console.log(`✅ ${service.name} is ready`)
    } catch (error) {
      console.error(`❌ ${service.name} is not ready:`, error.message)
      throw new Error(`Service ${service.name} failed to start`)
    }
  }
}

async function setupBrowserDefaults() {
  // This can be used to set global browser configurations
  // For example, default cookies, locale, etc.

  const browser = await chromium.launch()
  const context = await browser.newContext()

  // Set default locale
  await context.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  })

  // Set default timezone
  await context.addInitScript(() => {
    Date.prototype.getTimezoneOffset = () => 0 // UTC
  })

  await browser.close()
}

async function waitForService(url: string, timeout = 30000): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.ok) {
        return
      }
    } catch (error) {
      // Service not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error(`Service at ${url} not ready within ${timeout}ms`)
}

export default globalSetup