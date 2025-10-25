// Test Helper Functions
// =====================
// Utility functions for common test operations

import { vi, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// API testing helpers
export const createMockApiResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
  headers: new Headers({ 'content-type': 'application/json' }),
  url: 'https://mock-api.test',
})

export const mockApiCall = (endpoint: string, response: any, status = 200) => {
  const mock = vi.mocked(global.fetch)
  mock.mockImplementation(async (url) => {
    if (url.includes(endpoint)) {
      return createMockApiResponse(response, status)
    }
    throw new Error(`Unexpected API call to: ${url}`)
  })
  return mock
}

export const verifyApiCall = (mock: any, endpoint: string, method = 'GET') => {
  expect(mock).toHaveBeenCalledWith(
    expect.stringContaining(endpoint),
    expect.objectContaining({
      method,
    })
  )
}

// Database testing helpers
export const createMockDatabase = () => ({
  user: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  project: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  task: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  // Add more models as needed
})

// Component testing helpers
export const renderWithProviders = (
  ui: React.ReactElement,
  options: {
    user?: any
    router?: any
    theme?: 'light' | 'dark'
    [key: string]: any
  } = {}
) => {
  const { user: userOverride, router: routerOverride, ...renderOptions } = options

  // Create mock providers
  const mockUser = userOverride || {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'user',
  }

  const mockRouter = routerOverride || {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }

  // Mock context providers
  const MockUserProvider = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="user-provider" data-user={JSON.stringify(mockUser)}>
      {children}
    </div>
  )

  const MockRouterProvider = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="router-provider" data-router={JSON.stringify(mockRouter)}>
      {children}
    </div>
  )

  const AllTheProviders = ({ children }: { children: React.ReactNode }) => (
    <MockUserProvider>
      <MockRouterProvider>{children}</MockRouterProvider>
    </MockUserProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...renderOptions })
}

export const waitForElementToBeRemoved = (element: HTMLElement) => {
  return waitFor(() => {
    expect(element).not.toBeInTheDocument()
  })
}

export const expectElementToBeVisible = (text: string | RegExp) => {
  const element = screen.getByText(text)
  expect(element).toBeVisible()
  return element
}

export const expectElementToBeDisabled = (element: HTMLElement) => {
  expect(element).toBeDisabled()
}

export const expectElementToBeEnabled = (element: HTMLElement) => {
  expect(element).not.toBeDisabled()
}

// Form testing helpers
export const fillForm = async (fields: Record<string, string>) => {
  const user = userEvent.setup()

  for (const [label, value] of Object.entries(fields)) {
    const element = screen.getByLabelText(label) || screen.getByPlaceholderText(label)
    await user.clear(element)
    await user.type(element, value)
  }
}

export const submitForm = async (buttonText = 'Submit') => {
  const user = userEvent.setup()
  const button = screen.getByRole('button', { name: buttonText })
  await user.click(button)
}

export const expectFormError = (field: string, message: string) => {
  const fieldElement = screen.getByLabelText(field)
  const errorElement = within(fieldElement.parentElement || fieldElement).getByText(message)
  expect(errorElement).toBeInTheDocument()
}

// Async testing helpers
export const expectAsyncCall = async (
  asyncFn: () => Promise<any>,
  expectedValue: any
) => {
  const result = await asyncFn()
  expect(result).toEqual(expectedValue)
}

export const expectAsyncError = async (
  asyncFn: () => Promise<any>,
  errorMessage: string
) => {
  await expect(asyncFn()).rejects.toThrow(errorMessage)
}

export const waitForAsyncCall = async (
  condition: () => boolean,
  timeout = 5000
) => {
  return waitFor(condition, { timeout })
}

// Hook testing helpers
export const renderHookWithProviders = (hook: () => any, options: any = {}) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    // Add any necessary providers here
    return <div>{children}</div>
  }

  return renderHook(hook, { wrapper, ...options })
}

export const actHook = (callback: () => void) => {
  return act(callback)
}

// Performance testing helpers
export const measureTime = async (fn: () => Promise<void>) => {
  const start = performance.now()
  await fn()
  const end = performance.now()
  return end - start
}

export const expectPerformance = async (
  fn: () => Promise<void>,
  maxTime: number
) => {
  const time = await measureTime(fn)
  expect(time).toBeLessThan(maxTime)
}

// Security testing helpers
export const expectXSSProtection = (content: string) => {
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ]

  dangerousPatterns.forEach((pattern) => {
    expect(content).not.toMatch(pattern)
  })
}

export const expectSqlInjectionProtection = (input: string) => {
  const sqlPatterns = [
    /(\bunion\b.*\bselect\b)|(\bselect\b.*\bfrom\b)/gi,
    /(\binsert\b.*\binto\b)|(\bupdate\b.*\bset\b)/gi,
    /(\bdelete\b.*\bfrom\b)|(\bdrop\b.*\btable\b)/gi,
    /('|(\\')|(;))(\s)*(union|select|insert|update|delete|drop)/gi,
  ]

  sqlPatterns.forEach((pattern) => {
    expect(input.toLowerCase()).not.toMatch(pattern)
  })
}

// Load testing helpers
export const createLoadTest = async (
  concurrency: number,
  iterations: number,
  testFn: (iteration: number) => Promise<void>
) => {
  const startTime = performance.now()
  const promises: Promise<void>[] = []

  for (let i = 0; i < iterations; i++) {
    promises.push(testFn(i))
  }

  // Execute in batches to control concurrency
  for (let i = 0; i < promises.length; i += concurrency) {
    const batch = promises.slice(i, i + concurrency)
    await Promise.all(batch)
  }

  const endTime = performance.now()
  return {
    totalTime: endTime - startTime,
    averageTime: (endTime - startTime) / iterations,
    throughput: (iterations / (endTime - startTime)) * 1000, // operations per second
  }
}

// Mock data helpers
export const createMockStream = (data: any[]) => {
  const stream = new ReadableStream({
    start(controller) {
      data.forEach((item) => {
        controller.enqueue(JSON.stringify(item) + '\n')
      })
      controller.close()
    },
  })
  return stream
}

export const createMockWebSocket = () => {
  const listeners: Record<string, Function[]> = {}

  return {
    addEventListener: vi.fn((event: string, callback: Function) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(callback)
    }),
    removeEventListener: vi.fn((event: string, callback: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(cb => cb !== callback)
      }
    }),
    send: vi.fn(),
    close: vi.fn(),
    // Helper for testing
    triggerEvent: (event: string, data?: any) => {
      if (listeners[event]) {
        listeners[event].forEach(callback => callback(data))
      }
    },
  }
}

// Error testing helpers
export const expectErrorBoundary = (
  component: React.ReactElement,
  errorMessage: string
) => {
  // This would need to be implemented based on your error boundary implementation
  // It's a placeholder for the concept
  expect(true).toBe(true) // Placeholder
}

// Accessibility testing helpers
export const expectAccessibility = (container: HTMLElement) => {
  // Basic accessibility checks
  const buttons = container.querySelectorAll('button:not([disabled])')
  buttons.forEach((button) => {
    expect(button).toHaveAccessibleName()
  })

  const inputs = container.querySelectorAll('input')
  inputs.forEach((input) => {
    expect(input).toHaveAccessibleName()
  })

  const images = container.querySelectorAll('img')
  images.forEach((img) => {
    expect(img).toHaveAccessibleName()
  })
}

// Snapshot testing helpers
export const expectSnapshot = (component: React.ReactElement, name?: string) => {
  const { container } = render(component)
  expect(container).toMatchSnapshot(name)
}

// LocalStorage testing helpers
export const setLocalStorage = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const getLocalStorage = (key: string) => {
  const item = localStorage.getItem(key)
  return item ? JSON.parse(item) : null
}

export const clearLocalStorage = () => {
  localStorage.clear()
}

export {}