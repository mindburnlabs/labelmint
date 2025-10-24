// Test utility functions
import { vi } from 'vitest'

// Sleep function for async testing
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Mock fetch responses
export function mockFetch(responses: any = {}) {
  const mockFn = vi.fn()
  global.fetch = mockFn.mockImplementation((url: string, options?: RequestInit) => {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responses),
      text: () => Promise.resolve(JSON.stringify(responses)),
      blob: () => Promise.resolve(new Blob()),
      headers: new Headers(),
      url,
      ...responses
    } as Response)
  })
  return mockFn
}

// Create mock response objects
export function createMockResponse(data: any, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: new Headers(headers),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    clone: vi.fn(),
    bodyUsed: false,
    body: null,
    redirected: false,
    type: 'basic',
    url: 'http://localhost:3000',
    ...data
  }
}

// Consensus calculation helper
export function calculateConsensus(labels: string[], threshold = 0.7): string | null {
  if (labels.length === 0) return null

  const counts = labels.reduce((acc, label) => {
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const total = labels.length
  const majority = Math.floor(total * threshold) + 1

  for (const [label, count] of Object.entries(counts)) {
    if (count >= majority) {
      return label
    }
  }

  return null
}

// Email validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Phone validation
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10
}

// URL validation
export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// HTML sanitization
export function sanitizeHTML(html: string): string {
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// Generate random strings
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Generate random emails
export function generateRandomEmail(): string {
  const domains = ['example.com', 'test.org', 'demo.net', 'sample.io']
  const domain = domains[Math.floor(Math.random() * domains.length)]
  const local = generateRandomString(10)
  return `${local}@${domain}`
}

// Global test utilities interface
declare global {
  const testUtils: {
    createMockUser: () => any
    createMockTask: () => any
    createMockLabel: () => any
    expectValidEmail: (email: string) => void
    expectValidPhone: (phone: string) => void
    generateRandomString: (length: number) => string
    generateRandomEmail: () => string
  }
}

// Set up global test utilities
if (typeof global !== 'undefined') {
  global.testUtils = {
    createMockUser: () => ({
      id: Math.floor(Math.random() * 1000000),
      email: generateRandomEmail(),
      role: 'worker'
    }),
    createMockTask: () => ({
      id: Math.floor(Math.random() * 1000000),
      type: 'image_classification',
      difficulty: 'easy'
    }),
    createMockLabel: () => ({
      id: Math.floor(Math.random() * 1000000),
      taskId: Math.floor(Math.random() * 1000000),
      label: 'test'
    }),
    expectValidEmail: (email: string) => {
      if (!validateEmail(email)) {
        throw new Error(`Invalid email: ${email}`)
      }
    },
    expectValidPhone: (phone: string) => {
      if (!validatePhone(phone)) {
        throw new Error(`Invalid phone: ${phone}`)
      }
    },
    generateRandomString,
    generateRandomEmail
  }
}