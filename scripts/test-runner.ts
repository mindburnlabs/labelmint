#!/usr/bin/env tsx

import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

interface TestConfig {
  type: 'unit' | 'integration' | 'e2e' | 'contracts' | 'all'
  coverage?: boolean
  watch?: boolean
  reporter?: string
  grep?: string
  bail?: number
  retries?: number
  parallel?: boolean
}

class TestRunner {
  private config: TestConfig
  private results: {
    unit?: TestResult
    integration?: TestResult
    e2e?: TestResult
    contracts?: TestResult
  } = {}

  constructor(config: TestConfig) {
    this.config = config
  }

  async run(): Promise<void> {
    console.log(`🧪 Running ${this.config.type} tests...\n`)

    const startTime = Date.now()

    try {
      if (this.config.type === 'all') {
        await this.runUnitTests()
        await this.runIntegrationTests()
        await this.runContractTests()
        await this.runE2ETests()
      } else {
        switch (this.config.type) {
          case 'unit':
            await this.runUnitTests()
            break
          case 'integration':
            await this.runIntegrationTests()
            break
          case 'e2e':
            await this.runE2ETests()
            break
          case 'contracts':
            await this.runContractTests()
            break
        }
      }

      this.printSummary(Date.now() - startTime)
    } catch (error) {
      console.error('❌ Test run failed:', error)
      process.exit(1)
    }
  }

  private async runUnitTests(): Promise<void> {
    console.log('📦 Running unit tests...')

    const args = this.buildVitestArgs('test/unit')
    const result = await this.runCommand('npx', ['vitest', ...args])

    this.results.unit = result
    this.printResult('Unit Tests', result)
  }

  private async runIntegrationTests(): Promise<void> {
    console.log('🔗 Running integration tests...')

    const args = this.buildVitestArgs('test/integration')
    const result = await this.runCommand('npx', ['vitest', ...args])

    this.results.integration = result
    this.printResult('Integration Tests', result)
  }

  private async runE2ETests(): Promise<void> {
    console.log('🌐 Running E2E tests...')

    // Check if playwright is installed
    if (!existsSync('./node_modules/.bin/playwright')) {
      console.log('⚠️  Playwright not found, installing browsers...')
      await this.runCommand('npx', ['playwright', 'install'])
    }

    const args = this.buildPlaywrightArgs()
    const result = await this.runCommand('npx', ['playwright', 'test', ...args])

    this.results.e2e = result
    this.printResult('E2E Tests', result)
  }

  private async runContractTests(): Promise<void> {
    console.log('📜 Running contract tests...')

    // Check if hardhat is available
    if (!existsSync('./contracts/hardhat.config.js')) {
      console.log('⚠️  No hardhat config found, skipping contract tests')
      return
    }

    const args = ['test']

    if (this.config.coverage) {
      args.push('--coverage')
    }

    if (this.config.grep) {
      args.push('--grep', this.config.grep)
    }

    const result = await this.runCommand('npx', ['hardhat', ...args])

    this.results.contracts = result
    this.printResult('Contract Tests', result)
  }

  private buildVitestArgs(testDir: string): string[] {
    const args = ['run', testDir]

    if (this.config.coverage) {
      args.push('--coverage')
    }

    if (this.config.watch) {
      args[args.indexOf('run')] = 'watch'
    }

    if (this.config.reporter) {
      args.push('--reporter', this.config.reporter)
    }

    if (this.config.grep) {
      args.push('-t', this.config.grep)
    }

    if (this.config.bail) {
      args.push('--bail', this.config.bail.toString())
    }

    if (this.config.retries) {
      args.push('--retry', this.config.retries.toString())
    }

    if (this.config.parallel === false) {
      args.push('--no-threads')
    }

    return args
  }

  private buildPlaywrightArgs(): string[] {
    const args = []

    if (this.config.coverage) {
      args.push('--coverage')
    }

    if (this.config.reporter) {
      args.push('--reporter', this.config.reporter)
    }

    if (this.config.grep) {
      args.push('--grep', this.config.grep)
    }

    if (this.config.bail) {
      args.push('--max-failures', this.config.bail.toString())
    }

    if (this.config.retries) {
      args.push('--retries', this.config.retries.toString())
    }

    if (this.config.parallel === false) {
      args.push('--workers', '1')
    }

    return args
  }

  private async runCommand(command: string, args: string[]): Promise<TestResult> {
    return new Promise((resolve) => {
      const startTime = Date.now()
      const process = spawn(command, args, { stdio: 'pipe', shell: true })

      let stdout = ''
      let stderr = ''

      process.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        resolve({
          exitCode: code || 0,
          duration: Date.now() - startTime,
          stdout,
          stderr
        })
      })
    })
  }

  private printResult(name: string, result: TestResult): void {
    const status = result.exitCode === 0 ? '✅' : '❌'
    const duration = (result.duration / 1000).toFixed(2)

    console.log(`${status} ${name} - ${duration}s`)

    if (result.stderr && result.exitCode !== 0) {
      console.log('   Errors:')
      console.log('   ', result.stderr.split('\n').filter((l, i, a) => i < 5 || i === a.length - 1).join('\n   '))
    }
    console.log('')
  }

  private printSummary(totalDuration: number): void {
    console.log('\n📊 Test Summary')
    console.log('─'.repeat(50))

    let totalPassed = 0
    let totalFailed = 0
    let totalTests = 0

    for (const [type, result] of Object.entries(this.results)) {
      if (!result) continue

      const passed = this.extractTestCount(result.stdout, 'passed')
      const failed = this.extractTestCount(result.stdout, 'failed')
      const total = passed + failed

      totalPassed += passed
      totalFailed += failed
      totalTests += total

      const status = result.exitCode === 0 ? '✅' : '❌'
      const duration = (result.duration / 1000).toFixed(2)

      console.log(`${status} ${type.charAt(0).toUpperCase() + type.slice(1)}: ${passed}/${total} passed (${duration}s)`)
    }

    console.log('─'.repeat(50))
    console.log(`Total: ${totalPassed}/${totalTests} tests passed (${(totalDuration / 1000).toFixed(2)}s)`)

    if (totalFailed > 0) {
      console.log(`\n❌ ${totalFailed} test${totalFailed > 1 ? 's' : ''} failed`)
      process.exit(1)
    } else {
      console.log('\n✅ All tests passed!')
    }

    if (this.config.coverage) {
      console.log('\n📈 Coverage reports generated:')
      console.log('  - HTML: ./coverage/index.html')
      console.log('  - LCOV: ./coverage/lcov.info')
      console.log('  - JSON: ./coverage/coverage-final.json')
    }
  }

  private extractTestCount(output: string, type: 'passed' | 'failed'): number {
    const regex = new RegExp(`(\\d+) ${type}`, 'i')
    const match = output.match(regex)
    return match ? parseInt(match[1]) : 0
  }
}

interface TestResult {
  exitCode: number
  duration: number
  stdout: string
  stderr: string
}

// CLI argument parsing
function parseArgs(): TestConfig {
  const args = process.argv.slice(2)
  const config: Partial<TestConfig> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--type':
        config.type = args[++i] as any
        break
      case '--coverage':
        config.coverage = true
        break
      case '--watch':
        config.watch = true
        break
      case '--reporter':
        config.reporter = args[++i]
        break
      case '--grep':
        config.grep = args[++i]
        break
      case '--bail':
        config.bail = parseInt(args[++i])
        break
      case '--retries':
        config.retries = parseInt(args[++i])
        break
      case '--no-parallel':
        config.parallel = false
        break
      case '--help':
        console.log(`
Test Runner Usage:
  --type <type>        Test type: unit, integration, e2e, contracts, all (default: all)
  --coverage           Generate coverage reports
  --watch              Run tests in watch mode
  --reporter <type>    Reporter: verbose, json, html, junit
  --grep <pattern>     Run tests matching pattern
  --bail <number>      Stop after N test failures
  --retries <number>   Retry failed tests N times
  --no-parallel        Run tests serially
  --help               Show this help

Examples:
  npm run test:all                           # Run all tests
  npm run test:all --type unit              # Run only unit tests
  npm run test:all --coverage               # Run with coverage
  npm run test:all --watch                  # Run in watch mode
  npm run test:all --grep "payment"        # Run payment tests
  npm run test:all --type e2e --bail 1     # Run E2E tests, stop on first failure
        `)
        process.exit(0)
    }
  }

  return {
    type: config.type || 'all',
    coverage: config.coverage || false,
    watch: config.watch || false,
    reporter: config.reporter || 'verbose',
    grep: config.grep,
    bail: config.bail,
    retries: config.retries,
    parallel: config.parallel !== false
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const config = parseArgs()
  const runner = new TestRunner(config)
  runner.run()
}