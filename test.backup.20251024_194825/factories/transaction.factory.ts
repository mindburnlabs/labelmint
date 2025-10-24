import { faker } from '@faker-js/faker'

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  REWARD = 'REWARD',
  FEE = 'FEE'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentMethod {
  TON = 'TON',
  USDT = 'USDT',
  BITCOIN = 'BITCOIN',
  ETHEREUM = 'ETHEREUM',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

export interface TransactionFactoryData {
  id?: number
  user_id?: number
  type?: TransactionType
  amount?: number
  currency?: string
  status?: TransactionStatus
  payment_method?: PaymentMethod
  from_address?: string
  to_address?: string
  tx_hash?: string
  block_number?: number
  fee?: number
  metadata?: Record<string, any>
  created_at?: Date
  updated_at?: Date
  completed_at?: Date
}

export const TransactionFactory = {
  create: (overrides: TransactionFactoryData = {}) => ({
    id: faker.number.int({ min: 1, max: 100000 }),
    user_id: faker.number.int({ min: 1, max: 10000 }),
    type: faker.helpers.arrayElement(Object.values(TransactionType)),
    amount: faker.number.int({ min: 0.01, max: 10000, precision: 0.01 }),
    currency: 'USDT',
    status: faker.helpers.arrayElement(Object.values(TransactionStatus)),
    payment_method: faker.helpers.arrayElement(Object.values(PaymentMethod)),
    from_address: faker.finance.ethereumAddress(),
    to_address: faker.finance.ethereumAddress(),
    tx_hash: faker.datatype.hexadecimal({ length: 64, prefix: '0x' }),
    block_number: faker.number.int({ min: 18000000, max: 19000000 }),
    fee: faker.number.int({ min: 0.001, max: 10, precision: 0.001 }),
    metadata: {
      task_id: faker.number.int(),
      project_id: faker.number.int(),
      ...overrides.metadata
    },
    created_at: faker.date.past(),
    updated_at: faker.date.recent(),
    completed_at: faker.datatype.recent(),
    ...overrides
  }),

  createMany: (count: number, overrides: TransactionFactoryData = {}) =>
    Array.from({ length: count }, () => TransactionFactory.create(overrides)),

  createDeposit: (overrides: TransactionFactoryData = {}) =>
    TransactionFactory.create({
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      ...overrides
    }),

  createWithdrawal: (overrides: TransactionFactoryData = {}) =>
    TransactionFactory.create({
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      ...overrides
    }),

  createPayment: (taskId: number, overrides: TransactionFactoryData = {}) =>
    TransactionFactory.create({
      type: TransactionType.PAYMENT,
      status: TransactionStatus.COMPLETED,
      metadata: { task_id: taskId },
      ...overrides
    }),

  createTonTransaction: (overrides: TransactionFactoryData = {}) =>
    TransactionFactory.create({
      payment_method: PaymentMethod.TON,
      currency: 'TON',
      ...overrides
    }),

  createUsdtTransaction: (overrides: TransactionFactoryData = {}) =>
    TransactionFactory.create({
      payment_method: PaymentMethod.USDT,
      currency: 'USDT',
      ...overrides
    }),

  createFailed: (overrides: TransactionFactoryData = {}) =>
    TransactionFactory.create({
      status: TransactionStatus.FAILED,
      ...overrides
    })
}