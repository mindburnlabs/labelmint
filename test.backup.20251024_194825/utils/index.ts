// Re-export all test utilities
export * from './test-helpers'
export * from './mock-services'

// Additional convenience exports
export { faker } from '@faker-js/faker'

// Common test constants
export const TEST_CONFIG = {
  TIMEOUTS: {
    SHORT: 5000,
    MEDIUM: 15000,
    LONG: 30000
  },
  ENDPOINTS: {
    API: 'http://localhost:3001/api',
    PAYMENTS: 'http://localhost:3002/api',
    WEBHOOK: 'http://localhost:3001/webhooks'
  },
  USERS: {
    WORKER: { username: 'testworker', password: 'testpassword123' },
    CLIENT: { username: 'testclient', password: 'testpassword123' },
    ADMIN: { username: 'testadmin', password: 'testpassword123' }
  },
  WALLETS: {
    TON: { address: 'EQD_test_wallet_address', mnemonic: 'test mnemonic phrase' },
    BITCOIN: { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', wif: 'test_wif' },
    ETHEREUM: { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' }
  }
}

// Global test setup helpers
export async function setupTestEnvironment() {
  console.log('Setting up test environment...')
  // Add global test setup logic here
}

export async function teardownTestEnvironment() {
  console.log('Tearing down test environment...')
  // Add global test cleanup logic here
}

// Performance monitoring
export class PerformanceMonitor {
  private timers = new Map<string, number>()

  start(name: string): void {
    this.timers.set(name, Date.now())
  }

  end(name: string): number {
    const startTime = this.timers.get(name)
    if (!startTime) throw new Error(`Timer '${name}' not found`)
    const duration = Date.now() - startTime
    this.timers.delete(name)
    return duration
  }

  measure<T>(name: string, fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
    this.start(name)
    return Promise.resolve(fn()).then(result => {
      const duration = this.end(name)
      return { result, duration }
    })
  }
}

// Test data generators
export class TestDataGenerator {
  static generatePhoneNumber(country = 'US'): string {
    return faker.phone.number(country === 'US' ? '+1 ###-###-####' : '+############')
  }

  static generateCreditCard(): {
    number: string
    cvv: string
    expiry: string
    holder: string
  } {
    return {
      number: '4242424242424242',
      cvv: faker.datatype.string({ length: 3, numeric: true }),
      expiry: `${faker.number.int({ min: 1, max: 12 }).toString().padStart(2, '0')}/${faker.number.int({ min: 24, max: 34 }).toString().slice(-2)}`,
      holder: faker.name.fullName()
    }
  }

  static generateImageData() {
    return {
      url: faker.image.url(),
      width: faker.number.int({ min: 100, max: 1920 }),
      height: faker.number.int({ min: 100, max: 1080 }),
      format: faker.helpers.arrayElement(['jpg', 'png', 'webp']),
      size: faker.number.int({ min: 1000, max: 5000000 })
    }
  }

  static generateLocation() {
    return {
      latitude: faker.address.latitude(),
      longitude: faker.address.longitude(),
      address: faker.address.streetAddress(),
      city: faker.address.city(),
      state: faker.address.state(),
      country: faker.address.country(),
      zipCode: faker.address.zipCode()
    }
  }

  static generateCompany() {
    return {
      name: faker.company.name(),
      industry: faker.company.industry(),
      catchPhrase: faker.company.catchPhrase(),
      bs: faker.company.bs(),
      address: faker.address.streetAddress(),
      phone: faker.phone.number(),
      website: faker.internet.url(),
      employees: faker.number.int({ min: 1, max: 10000 }),
      founded: faker.number.int({ min: 1900, max: 2023 })
    }
  }

  static generateProduct() {
    return {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: parseFloat(faker.commerce.price()),
      category: faker.commerce.department(),
      material: faker.commerce.productMaterial(),
      color: faker.commerce.color(),
      brand: faker.company.name(),
      sku: faker.datatype.string({ length: 8 }),
      barcode: faker.datatype.string({ length: 13, numeric: true }),
      weight: faker.number.int({ min: 1, max: 10000 }),
      dimensions: {
        length: faker.number.int({ min: 1, max: 100 }),
        width: faker.number.int({ min: 1, max: 100 }),
        height: faker.number.int({ min: 1, max: 100 })
      }
    }
  }
}

// Assertion helpers
export class AssertionHelpers {
  static assertISODate(dateString: string): void {
    expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/)
  }

  static assertUUID(uuid: string): void {
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  }

  static assertEmail(email: string): void {
    expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  }

  static assertURL(url: string): void {
    expect(url).toMatch(/^https?:\/\/.+/)
  }

  static assertPhoneNumber(phone: string): void {
    expect(phone).toMatch(/^\+?[\d\s\-\(\)]+$/)
  }

  static assertAddress(address: string): void {
    // TON address format check
    expect(address).toMatch(/^0:[a-fA-F0-9]{64}$/)
  }

  static assertWithinRange(value: number, min: number, max: number): void {
    expect(value).toBeGreaterThanOrEqual(min)
    expect(value).toBeLessThanOrEqual(max)
  }

  static assertSuccessfulResponse(response: any): void {
    expect(response).toHaveProperty('status')
    expect(response.status).toBeGreaterThanOrEqual(200)
    expect(response.status).toBeLessThan(300)
  }

  static assertValidTimestamp(timestamp: number | string): void {
    const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp
    const now = Date.now()
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000
    expect(ts).toBeGreaterThanOrEqual(oneYearAgo)
    expect(ts).toBeLessThanOrEqual(now + 60000) // Allow 1 minute in future
  }
}

// Database helpers
export class DatabaseHelpers {
  static buildInsertQuery(table: string, data: Record<string, any>): {
    query: string
    values: any[]
  } {
    const columns = Object.keys(data)
    const values = Object.values(data)
    const placeholders = values.map((_, i) => `$${i + 1}`)

    return {
      query: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    }
  }

  static buildUpdateQuery(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>
  ): { query: string; values: any[] } {
    const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 1}`)
    const whereClause = Object.keys(where).map((key, i) => `${key} = $${setClause.length + i + 1}`)

    return {
      query: `UPDATE ${table} SET ${setClause.join(', ')} WHERE ${whereClause.join(' AND ')}`,
      values: [...Object.values(data), ...Object.values(where)]
    }
  }

  static escapeLike(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&')
  }
}

// HTTP helpers
export class HttpHelpers {
  static buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    }
    return searchParams.toString()
  }

  static buildAuthHeader(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }

  static parseResponseHeaders(headers: string[]): Record<string, string> {
    const result: Record<string, string> = {}
    for (const header of headers) {
      const [key, ...values] = header.split(':')
      if (key && values.length) {
        result[key.trim()] = values.join(':').trim()
      }
    }
    return result
  }
}

// Export default test utilities object
export default {
  TestHelpers: await import('./test-helpers').then(m => m.TestHelpers),
  MockServices: await import('./mock-services').then(m => m.MockServices),
  TestDataGenerator,
  AssertionHelpers,
  DatabaseHelpers,
  HttpHelpers,
  PerformanceMonitor,
  TEST_CONFIG,
  setupTestEnvironment,
  teardownTestEnvironment
}