import { vi } from 'vitest'
import type { Mock } from 'vitest'

// Global test setup for unit tests
export function setup() {
  // Set global test environment variables
  process.env.NODE_ENV = 'test'
  process.env.TEST_MODE = 'unit'

  // Mock console methods for cleaner test output in unit tests
  const originalConsole = { ...console }
  const mockConsole = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }

  // Only mock in test environment to avoid affecting debugging
  if (process.env.NODE_ENV === 'test') {
    global.console = mockConsole as any
  }

  // Setup global test utilities
  global.testUtils = {
    // Mock data generators
    createMockUser: (overrides: any = {}) => ({
      id: 'user_test_123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'annotator',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),

    createMockTask: (id: string, overrides: any = {}) => ({
      id: `task_${id}`,
      type: 'image_classification',
      status: 'available',
      priority: 'medium',
      requiredLabels: 3,
      consensusRequired: 0.7,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),

    createMockLabel: (taskId: string, workerId: string, overrides: any = {}) => ({
      id: `label_${taskId}_${workerId}`,
      taskId,
      workerId,
      labels: ['cat'],
      confidence: 95,
      timeSpent: 120,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),

    createMockProject: (overrides: any = {}) => ({
      id: 'project_test_123',
      name: 'Test Project',
      description: 'Test project description',
      status: 'active',
      type: 'image_classification',
      expectedLabels: ['cat', 'dog', 'bird'],
      paymentPerLabel: 0.01,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),

    // Utility functions
    delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

    // Assertion helpers
    expectValidEmail: (email: string) => {
      const emailRegex = /^[^\s@.]+@[^\s@.]+\.[^\s@.]+$/
      if (!emailRegex.test(email)) {
        throw new Error(`Invalid email: ${email}`)
      }
    },

    expectValidPhone: (phone: string) => {
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/
      if (!phoneRegex.test(phone)) {
        throw new Error(`Invalid phone: ${phone}`)
      }
    },

    expectValidURL: (url: string) => {
      try {
        new URL(url)
      } catch {
        throw new Error(`Invalid URL: ${url}`)
      }
    },

    // Data generation helpers
    generateRandomString: (length: number = 10) => {
      return Math.random().toString(36).substring(2, length + 2)
    },

    generateRandomNumber: (min: number = 0, max: number = 100) => {
      return Math.floor(Math.random() * (max - min + 1)) + min
    },

    generateRandomEmail: () => {
      const domains = ['example.com', 'test.org', 'demo.net']
      const domain = domains[Math.floor(Math.random() * domains.length)]
      const username = Math.random().toString(36).substring(2, 10)
      return `${username}@${domain}`
    },

    // Date helpers
    daysFromNow: (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    daysBeforeNow: (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000),

    // Restore original console
    restoreConsole: () => {
      global.console = originalConsole
    },
  }

  // Mock common external services
  vi.mock('axios', () => ({
    default: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(() => ({
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      })),
    },
  }))

  // Mock fetch
  global.fetch = vi.fn() as any

  return {
    cleanup: () => {
      // Cleanup function to be called in teardown
      vi.clearAllMocks()
      global.console = originalConsole
    },
  }
}

// Auto-setup for unit tests
const { cleanup } = setup()

// Export cleanup for manual use
export { cleanup }