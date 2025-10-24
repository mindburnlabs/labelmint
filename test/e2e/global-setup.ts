import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...')

  // Set up test database
  console.log('📊 Setting up test database...')
  const { execSync } = require('child_process')

  try {
    // Create test database
    execSync('psql -U postgres -c "DROP DATABASE IF EXISTS labelmint_e2e;"', { stdio: 'pipe' })
    execSync('psql -U postgres -c "CREATE DATABASE labelmint_e2e;"', { stdio: 'pipe' })

    // Run migrations
    execSync('cd services/backend && npm run db:migrate', { stdio: 'pipe' })
    execSync('cd services/payment-backend && npm run db:migrate', { stdio: 'pipe' })

    // Seed test data
    execSync('cd services/backend && npm run db:seed:test', { stdio: 'pipe' })

    console.log('✅ Test database setup complete')
  } catch (error) {
    console.error('❌ Database setup failed:', error)
    throw error
  }

  // Set up Redis test instance
  console.log('🗄️ Setting up Redis test instance...')
  try {
    // Clear Redis
    execSync('redis-cli -n 15 FLUSHDB', { stdio: 'pipe' })
    console.log('✅ Redis setup complete')
  } catch (error) {
    console.error('❌ Redis setup failed:', error)
    throw error
  }

  // Create test users and tokens
  console.log('👤 Creating test users...')
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Register test users
    const testUsers = [
      { username: 'testworker', email: 'worker@test.com', role: 'worker' },
      { username: 'testclient', email: 'client@test.com', role: 'client' },
      { username: 'testadmin', email: 'admin@test.com', role: 'admin' }
    ]

    for (const user of testUsers) {
      await page.post('/api/auth/register', {
        data: {
          username: user.username,
          email: user.email,
          password: 'testpassword123',
          role: user.role
        }
      })
    }

    console.log('✅ Test users created')
  } catch (error) {
    console.error('❌ Failed to create test users:', error)
  } finally {
    await browser.close()
  }

  // Store test configuration
  process.env.E2E_TEST_DATA = JSON.stringify({
    testUsers: [
      { username: 'testworker', password: 'testpassword123' },
      { username: 'testclient', password: 'testpassword123' },
      { username: 'testadmin', password: 'testpassword123' }
    ],
    testWallets: [
      { address: 'EQD_test_wallet_1', mnemonic: 'test mnemonic 1' },
      { address: 'EQD_test_wallet_2', mnemonic: 'test mnemonic 2' }
    ],
    testProjects: [
      { id: 1, name: 'Test Image Classification Project' },
      { id: 2, name: 'Test Text Labeling Project' }
    ]
  })

  console.log('✅ E2E setup complete!')
}

export default globalSetup