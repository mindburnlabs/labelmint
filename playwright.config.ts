import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  expect: {
    timeout: 10000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-results/e2e/html' }],
    ['json', { outputFile: 'test-results/e2e/results.json' }],
    ['junit', { outputFile: 'test-results/e2e/results.xml' }],
    ['list'],
  ],
  use: [
    {
      ...devices['Desktop Chrome'],
      viewport: { width: 1280, height: 720 },
      context: {
        recordVideo: 'on-first-failure',
        trace: 'retain-on-failure'
      }
    },
    {
      ...devices['Desktop Firefox'],
      viewport: { width: 1280, height: 720 }
    },
    {
      ...devices['Desktop Safari'],
      viewport: { width: 1280, height: 720 }
    },
    {
      ...devices['iPad Pro'],
      name: 'iPad Pro'
    },
    {
      ...devices['Pixel 5'],
      name: 'Pixel 5'
    },
    {
      ...devices['iPhone 12'],
      name: 'iPhone 12'
    }
  ],
  webServer: {
    command: 'pnpm run dev:test',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'LabelMint Web',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
        context: {
          recordVideo: 'on-first-failure',
          trace: 'retain-on-failure'
        }
      }
    },
    {
      name: 'LabelMint API',
      use: {
        baseURL: 'http://localhost:3001'
      }
    }
  ]
})