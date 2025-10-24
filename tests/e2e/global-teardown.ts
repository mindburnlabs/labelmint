import { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test cleanup...')

  const { execSync } = require('child_process')

  // Clean up test database
  console.log('📊 Cleaning up test database...')
  try {
    execSync('psql -U postgres -c "DROP DATABASE IF EXISTS labelmint_e2e;"', { stdio: 'pipe' })
    console.log('✅ Test database cleaned up')
  } catch (error) {
    console.error('❌ Database cleanup failed:', error)
  }

  // Clean up Redis
  console.log('🗄️ Cleaning up Redis...')
  try {
    execSync('redis-cli -n 15 FLUSHDB', { stdio: 'pipe' })
    console.log('✅ Redis cleaned up')
  } catch (error) {
    console.error('❌ Redis cleanup failed:', error)
  }

  // Clean up test artifacts
  console.log('🧹 Cleaning up test artifacts...')
  const fs = require('fs')
  const path = require('path')

  const cleanupDirs = [
    './test/e2e/results',
    './coverage/playwright-report',
    './test-results',
    './screenshots'
  ]

  for (const dir of cleanupDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      console.log(`✅ Cleaned ${dir}`)
    }
  }

  // Generate test report summary
  console.log('📊 Generating test report summary...')
  try {
    const reports = {
      timestamp: new Date().toISOString(),
      testRun: process.env.GITHUB_RUN_ID || 'local',
      coverage: fs.existsSync('./coverage/lcov.info') ? 'generated' : 'not generated',
      artifacts: cleanupDirs.filter(dir => fs.existsSync(dir))
    }

    fs.writeFileSync(
      './test-results/e2e-summary.json',
      JSON.stringify(reports, null, 2)
    )

    console.log('✅ Test report summary generated')
  } catch (error) {
    console.error('❌ Failed to generate report summary:', error)
  }

  console.log('✅ E2E cleanup complete!')
}

export default globalTeardown