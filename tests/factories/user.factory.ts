import { faker } from '@faker-js/faker'

export interface UserFactoryData {
  id?: number
  telegram_id?: number
  username?: string | null
  email?: string | null
  balance?: number
  trust_score?: number
  role?: 'worker' | 'client' | 'admin'
  created_at?: Date
  updated_at?: Date
}

export const UserFactory = {
  create: (overrides: UserFactoryData = {}) => ({
    id: faker.number.int({ min: 1, max: 100000 }),
    telegram_id: faker.number.int({ min: 1000000, max: 9999999 }),
    username: faker.internet.userName(),
    email: faker.internet.email(),
    balance: faker.number.int({ min: 0, max: 10000 }),
    trust_score: faker.number.float({ min: 0, max: 1, precision: 0.01 }),
    role: faker.helpers.arrayElement(['worker', 'client', 'admin']),
    created_at: faker.date.past(),
    updated_at: faker.date.recent(),
    ...overrides
  }),

  createMany: (count: number, overrides: UserFactoryData = {}) =>
    Array.from({ length: count }, () => UserFactory.create(overrides)),

  createWorker: (overrides: UserFactoryData = {}) =>
    UserFactory.create({
      role: 'worker',
      trust_score: faker.number.float({ min: 0.7, max: 1, precision: 0.01 }),
      ...overrides
    }),

  createClient: (overrides: UserFactoryData = {}) =>
    UserFactory.create({
      role: 'client',
      balance: faker.number.int({ min: 1000, max: 100000 }),
      ...overrides
    }),

  createAdmin: (overrides: UserFactoryData = {}) =>
    UserFactory.create({
      role: 'admin',
      email: faker.internet.email(),
      ...overrides
    })
}