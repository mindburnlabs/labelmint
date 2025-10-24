// Test data factories for tests directory
import { faker } from '@faker-js/faker'

export function createTestUser(overrides: any = {}) {
  return {
    id: faker.number.int({ min: 100000, max: 999999 }),
    email: `test_${faker.number.int({ min: 1, max: 9999 })}@example.com`,
    username: faker.internet.userName(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: 'WORKER',
    status: 'ACTIVE',
    accuracy: faker.number.float({ min: 0.8, max: 1.0, precision: 0.01 }),
    phoneNumber: faker.phone.number(),
    telegramId: faker.number.int({ min: 100000, max: 999999 }),
    walletAddress: faker.string.alphanumeric({ length: 48 }),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides
  }
}

export function createTestWallet(userId: number, overrides: any = {}) {
  return {
    id: faker.number.int({ min: 1000, max: 9999 }),
    userId,
    currency: 'TON',
    address: `EQD${faker.string.alphanumeric({ length: 47 })}`,
    balance: faker.number.float({ min: 0, max: 1000, precision: 0.01 }),
    isMain: true,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides
  }
}

export function createTestTransaction(userId: number, overrides: any = {}) {
  return {
    id: faker.number.int({ min: 10000, max: 99999 }),
    userId,
    type: 'DEPOSIT',
    status: 'COMPLETED',
    amount: faker.number.float({ min: 0.01, max: 100, precision: 0.01 }),
    currency: 'TON',
    blockchainTxHash: faker.string.alphanumeric({ length: 64 }),
    fromAddress: `EQD${faker.string.alphanumeric({ length: 47 })}`,
    toAddress: `EQD${faker.string.alphanumeric({ length: 47 })}`,
    metadata: {},
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides
  }
}