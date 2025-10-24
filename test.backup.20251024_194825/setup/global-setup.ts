import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Mock Telegram Web App SDK
vi.mock('@telegram-apps/sdk', () => ({
  Telegram: {
    WebApp: {
      ready: vi.fn(),
      expand: vi.fn(),
      close: vi.fn(),
      initData: { user: { id: 123, username: 'testuser' } },
      theme: { getScheme: () => 'light' },
      viewport: { getStableHeight: () => 800 },
      backButton: { isVisible: false, hide: vi.fn(), show: vi.fn() },
      mainButton: { text: '', onClick: vi.fn(), show: vi.fn(), hide: vi.fn() },
      haptic: { impactOccurred: vi.fn(), notificationOccurred: vi.fn() },
      cloudStorage: { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
    }
  }
}))

// Mock TON SDK
vi.mock('@ton/ton', () => ({
  TonClient: {
    mainnet: vi.fn(() => ({
      provider: vi.fn(),
      open: vi.fn(),
      close: vi.fn()
    }))
  },
  TonClient4: {
    mainnet: vi.fn(() => ({
      open: vi.fn(),
      close: vi.fn(),
      getLastBlock: vi.fn(),
      getAccount: vi.fn(),
      runMethod: vi.fn()
    }))
  }
}))

// Mock Redis
vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    flushall: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn()
  }))
}))

// Mock PostgreSQL
vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    connect: vi.fn(() => ({
      query: vi.fn(),
      release: vi.fn()
    })),
    end: vi.fn(),
    query: vi.fn()
  })),
  Client: vi.fn(() => ({
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn()
  }))
}))

// Mock Grammy (Telegram Bot)
vi.mock('grammy', () => ({
  Bot: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    use: vi.fn(),
    command: vi.fn(),
    on: vi.fn(),
    callbackQuery: vi.fn(),
    api: {
      sendMessage: vi.fn(),
      editMessageText: vi.fn(),
      answerCallbackQuery: vi.fn()
    }
  })),
  Composer: vi.fn(() => ({
    middleware: vi.fn(),
    on: vi.fn(),
    command: vi.fn(),
    callbackQuery: vi.fn()
  }))
}))

// Global test utilities
global.testUtils = {
  createMockUser: (overrides = {}) => ({
    id: 12345,
    telegram_id: 12345,
    username: 'testuser',
    email: 'test@example.com',
    balance: 1000,
    trust_score: 0.95,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  }),

  createMockTask: (overrides = {}) => ({
    id: 100,
    project_id: 10,
    type: 'IMAGE_CLASSIFICATION',
    data: { image_url: 'https://example.com/image.jpg' },
    status: 'CREATED',
    required_labels: 3,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  }),

  createMockProject: (overrides = {}) => ({
    id: 10,
    name: 'Test Project',
    description: 'A test project',
    task_type: 'IMAGE_CLASSIFICATION',
    status: 'ACTIVE',
    total_tasks: 100,
    completed_tasks: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  })
}

// Set up global test timeout
vi.setConfig({ testTimeout: 10000 })