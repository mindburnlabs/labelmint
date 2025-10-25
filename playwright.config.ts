import { defineConfig, devices } from '@playwright/test'
import path from 'path'

/**
 * Playwright Configuration for LabelMint E2E Tests
 * ================================================
 * Comprehensive configuration for end-to-end testing
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.test.ts',

  // Global setup and teardown
  globalSetup: './tests/e2e/setup/global-setup.ts',
  globalTeardown: './tests/e2e/setup/global-teardown.ts',

  // Test timeout configuration
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  // Retry configuration for flaky tests
  retries: process.env.CI ? 2 : 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: './test-results/playwright-report' }],
    ['json', { outputFile: './test-results/playwright-results.json' }],
    ['junit', { outputFile: './test-results/playwright-junit.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  // Output configuration
  outputDir: './test-results/artifacts',

  // Test artifacts
  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    // Browser context options
    ignoreHTTPSErrors: true,

    // Action and navigation timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Configure projects for different browsers and devices
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet browsers
    {
      name: 'iPad Safari',
      use: { ...devices['iPad Pro'] },
    },

    // Dark mode testing
    {
      name: 'chromium-dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
    },

    // High contrast mode
    {
      name: 'chromium-high-contrast',
      use: {
        ...devices['Desktop Chrome'],
        forcedColors: 'active',
      },
    },

    // CI-specific configuration
    ...(process.env.CI ? [
      {
        name: 'ci-chromium',
        use: {
          ...devices['Desktop Chrome'],
          headless: true,
        },
      },
    ] : []),
  ],

  // Development server configuration
  webServer: [
    {
      command: 'pnpm run dev:web',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120000, // 2 minutes to start
    },
    {
      command: 'pnpm run dev:api',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'pnpm run dev:payment-backend',
      port: 3002,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],

  // Test organization
  grep: process.env.GREP ? new RegExp(process.env.GREP) : undefined,
  grepInvert: process.env.GREP_INVERT ? new RegExp(process.env.GREP_INVERT) : undefined,

  // Environment variables
  defineEnv: {
    NODE_ENV: 'test',
    E2E_TEST: 'true',
  },

  // Metadata configuration
  metadata: {
    'Test Environment': process.env.NODE_ENV || 'test',
    'Base URL': process.env.BASE_URL || 'http://localhost:3000',
    'Browser': 'playwright',
  },
})