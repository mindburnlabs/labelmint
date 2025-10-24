import { vi } from 'vitest'
import faker from '@faker-js/faker'

// Test utility functions and helpers

export function createMockResponse<T = any>(data: T, status = 200) {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {},
  }
}

export function createMockError(message: string, status = 500) {
  const error = new Error(message) as any
  error.response = {
    status,
    statusText: 'Internal Server Error',
    data: { error: message },
  }
  return error
}

export function createAsyncMock<T = any>(data: T, delay = 0) {
  return vi.fn().mockImplementation(async () => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    return data
  })
}

export function createAsyncError<T = any>(message: string, delay = 0) {
  return vi.fn().mockImplementation(async () => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    throw new Error(message)
  })
}

export function mockFetch(responseData: any, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => responseData,
    text: async () => JSON.stringify(responseData),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  })
}

export function createTestEvent(type: string, detail: any = {}) {
  return new CustomEvent(type, { detail })
}

export function createMockElement(tagName: string, attributes: Record<string, string> = {}, children: string[] = []) {
  const element = document.createElement(tagName)

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })

  children.forEach(child => {
    element.appendChild(document.createTextNode(child))
  })

  return element
}

export function createMockFile(name: string, content: string, type = 'text/plain') {
  const file = new File([content], name, { type })
  return file
}

export function createMockFileList(files: File[]) {
  const fileList = new DataTransfer()
  files.forEach(file => fileList.items.add(file))
  return fileList.files
}

export function flushPromises() {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

export function mockLocalStorage() {
  const store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => {
      return Object.keys(store)[index] || null
    }),
  }
}

export function mockSessionStorage() {
  return mockLocalStorage()
}

export function createMockWebSocket() {
  const mockWS = {
    readyState: WebSocket.CONNECTING,
    url: 'ws://localhost:8080',
    protocol: '',
    extensions: '',
    binaryType: 'blob',

    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),

    send: vi.fn(),
    close: vi.fn(),

    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  }

  return mockWS
}

export function mockResizeObserver() {
  const mockRO = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }

  return mockRO
}

export function mockIntersectionObserver() {
  const mockIO = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }

  return mockIO
}

export function createMockHistory() {
  const history = {
    length: 1,
    state: {},
    goBack: vi.fn(),
    goForward: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    createHref: vi.fn(() => '/test'),
  }

  return history
}

export function createMockLocation() {
  return {
    href: 'http://localhost:3000/test',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/test',
    search: '',
    hash: '',
    state: {},
  }
}

export function assertCalledWith<T>(mock: any, ...args: T[]) {
  expect(mock).toHaveBeenCalledWith(...args)
}

export function assertCalledWithMatching(mock: any, matcher: any) {
  expect(mock).toHaveBeenCalledWith(expect.objectContaining(matcher))
}

export function assertErrorThrown(fn: () => void, expectedError?: string | RegExp) {
  expect(fn).toThrow(expectedError)
}

export function assertAsyncError(fn: () => Promise<any>, expectedError?: string | RegExp) {
  return expect(fn()).rejects.toThrow(expectedError)
}

export function createDeferredPromise() {
  let resolve: (value?: any) => void
  let reject: (reason?: any) => void
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}

export function waitFor(condition: () => boolean, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    const checkCondition = () => {
      if (condition()) {
        resolve(true)
        return
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'))
        return
      }

      setTimeout(checkCondition, 10)
    }

    checkCondition()
  })
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function getRandomFloat(min: number, max: number, precision = 2) {
  const randomFloat = Math.random() * (max - min) + min
  return parseFloat(randomFloat.toFixed(precision))
}

export function getRandomString(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function getRandomEmail() {
  const domains = ['example.com', 'test.org', 'demo.net']
  const domain = domains[Math.floor(Math.random() * domains.length)]
  const username = Math.random().toString(36).substring(2, 10)
  return `${username}@${domain}`
}

export function getRandomPhone() {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('')
  return `+${Math.floor(Math.random() * 900) + 100}${digits}`
}

export function formatCurrency(amount: number, currency = 'USDT') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'USDT' ? 'USD' : currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: currency === 'TON' ? 3 : 2,
  }).format(amount)
}

export function calculateConsensus(labels: string[], threshold = 0.67) {
  const counts = labels.reduce((acc, label) => {
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalLabels = labels.length
  const maxCount = Math.max(...Object.values(counts))
  const topLabel = Object.entries(counts).find(([, count]) => count === maxCount)?.[0]

  const agreementScore = maxCount / totalLabels

  return {
    result: agreementScore >= threshold ? topLabel : null,
    confidence: agreementScore,
    counts,
    hasConsensus: agreementScore >= threshold,
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@.]+@[^\s@.]+\.[^\s@.]+$/
  return emailRegex.test(email)
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/
  return phoneRegex.test(phone)
}

export function validateURL(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function sanitizeHTML(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function debounce<T extends any[]>(func: (...args: T) => void, delay: number) {
  let timeoutId: NodeJS.Timeout

  return (...args: T) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

export function throttle<T extends any[]>(func: (...args: T) => void, limit: number) {
  let inThrottle = false
  let lastCall = 0

  return (...args: T) => {
    const now = Date.now()

    if (!inThrottle || now - lastCall > limit) {
      inThrottle = true
      lastCall = now
      func(...args)

      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

export function memoize<T, U>(func: (arg: T) => U): ((arg: T) => U) {
  const cache = new Map<T, U>()

  return (arg: T): U => {
    if (cache.has(arg)) {
      return cache.get(arg)!
    }

    const result = func(arg)
    cache.set(arg, result)
    return result
  }
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function formatDate(date: Date, format = 'ISO'): string {
  switch (format) {
    case 'ISO':
      return date.toISOString()
    case 'locale':
      return date.toLocaleDateString()
    case 'time':
      return date.toLocaleTimeString()
    case 'datetime':
      return date.toLocaleString()
    default:
      return date.toISOString()
  }
}

export function calculateAge(birthDate: Date): number {
  const today = new Date()
  const birthDate2 = new Date(birthDate)
  let age = today.getFullYear() - birthDate2.getFullYear()
  const monthDifference = today.getMonth() - birthDate2.getMonth()

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate2.getDate())) {
    age--
  }

  return age
}

export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function isEmpty(value: any): boolean {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj } as Omit<T, K>
  keys.forEach(key => {
    delete result[key]
  })
  return result
}