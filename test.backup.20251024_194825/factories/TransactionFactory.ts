import { faker } from '@faker-js/faker';
import type { Transaction, TransactionType, TransactionStatus, PaymentMethod } from '@shared/types/database';

export class TransactionFactory {
  static create(overrides: Partial<Transaction> = {}): Transaction {
    const now = new Date();
    const id = faker.string.uuid();

    return {
      id,
      userId: faker.string.uuid(),
      type: faker.helpers.arrayElement<TransactionType>(['deposit', 'withdraw', 'payment', 'refund', 'reward']),
      status: faker.helpers.arrayElement<TransactionStatus>(['pending', 'processing', 'completed', 'failed', 'cancelled']),
      amount: faker.number.float({ min: 0.01, max: 1000, multipleOf: 0.01 }),
      fee: faker.number.float({ min: 0, max: 5, multipleOf: 0.01 }),
      method: faker.helpers.arrayElement<PaymentMethod>(['ton', 'usdt', 'internal']),
      fromAddress: faker.datatype.boolean(0.5) ? faker.finance.ethereumAddress() : null,
      toAddress: faker.finance.ethereumAddress(),
      txHash: faker.datatype.boolean(0.7) ? faker.string.hexadecimal({ length: 64 }) : null,
      blockNumber: faker.datatype.boolean(0.6) ? faker.number.int({ min: 1000000, max: 9999999 }) : null,
      blockHash: faker.datatype.boolean(0.6) ? faker.string.hexadecimal({ length: 64 }) : null,
      gasUsed: faker.datatype.boolean(0.5) ? faker.number.int({ min: 21000, max: 1000000 }) : null,
      gasPrice: faker.datatype.boolean(0.5) ? faker.number.int({ min: 1000000000, max: 10000000000 }) : null,
      confirmations: faker.datatype.boolean(0.6) ? faker.number.int({ min: 1, max: 100 }) : null,
      metadata: {
        taskId: faker.datatype.boolean(0.3) ? faker.string.uuid() : undefined,
        projectId: faker.datatype.boolean(0.3) ? faker.string.uuid() : undefined,
        description: faker.lorem.sentence(),
        category: faker.helpers.arrayElement(['task_payment', 'deposit', 'withdrawal', 'refund', 'bonus']),
        tags: faker.helpers.arrayElements(['urgent', 'bulk', 'automatic', 'manual']),
      },
      createdAt: faker.date.past({ months: 1 }),
      updatedAt: faker.date.recent({ days: 7 }),
      processedAt: faker.datatype.boolean(0.5) ? faker.date.recent({ days: 3 }) : null,
      completedAt: faker.datatype.boolean(0.4) ? faker.date.recent({ days: 1 }) : null,
      failedAt: faker.datatype.boolean(0.1) ? faker.date.recent({ days: 1 }) : null,
      cancelledAt: faker.datatype.boolean(0.05) ? faker.date.recent({ days: 1 }) : null,
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<Transaction> = {}): Transaction[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createDeposit(userId: string, amount: number, overrides: Partial<Transaction> = {}): Transaction {
    return this.create({
      userId,
      type: 'deposit',
      amount,
      status: 'completed',
      method: faker.helpers.arrayElement(['ton', 'usdt']),
      txHash: faker.string.hexadecimal({ length: 64 }),
      confirmations: faker.number.int({ min: 10, max: 100 }),
      processedAt: faker.date.recent({ hours: 2 }),
      completedAt: faker.date.recent({ hours: 1 }),
      metadata: {
        description: 'Deposit to wallet',
        category: 'deposit',
      },
      ...overrides,
    });
  }

  static createWithdrawal(userId: string, amount: number, overrides: Partial<Transaction> = {}): Transaction {
    return this.create({
      userId,
      type: 'withdraw',
      amount,
      status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
      method: faker.helpers.arrayElement(['ton', 'usdt']),
      fee: faker.number.float({ min: 0.1, max: 2, multipleOf: 0.01 }),
      metadata: {
        description: 'Withdrawal to external wallet',
        category: 'withdrawal',
      },
      ...overrides,
    });
  }

  static createPayment(fromUserId: string, toUserId: string, amount: number, taskId?: string, overrides: Partial<Transaction> = {}): Transaction {
    return this.create({
      userId: fromUserId,
      type: 'payment',
      amount,
      status: 'completed',
      method: 'internal',
      fee: 0,
      toAddress: toUserId,
      metadata: {
        taskId,
        description: 'Payment for completed task',
        category: 'task_payment',
      },
      processedAt: faker.date.recent({ hours: 2 }),
      completedAt: faker.date.recent({ hours: 1 }),
      ...overrides,
    });
  }

  static createReward(userId: string, amount: number, reason: string, overrides: Partial<Transaction> = {}): Transaction {
    return this.create({
      userId,
      type: 'reward',
      amount,
      status: 'completed',
      method: 'internal',
      fee: 0,
      metadata: {
        description: reason,
        category: 'bonus',
        tags: ['automatic', 'reward'],
      },
      processedAt: faker.date.recent({ hours: 1 }),
      completedAt: faker.date.recent({ minutes: 30 }),
      ...overrides,
    });
  }

  static createRefund(userId: string, amount: number, reason: string, overrides: Partial<Transaction> = {}): Transaction {
    return this.create({
      userId,
      type: 'refund',
      amount,
      status: 'completed',
      method: 'internal',
      fee: 0,
      metadata: {
        description: reason,
        category: 'refund',
        tags: ['automatic'],
      },
      processedAt: faker.date.recent({ hours: 2 }),
      completedAt: faker.date.recent({ hours: 1 }),
      ...overrides,
    });
  }

  static createPending(userId: string, overrides: Partial<Transaction> = {}): Transaction {
    return this.create({
      userId,
      status: 'pending',
      ...overrides,
    });
  }

  static createFailed(userId: string, reason: string, overrides: Partial<Transaction> = {}): Transaction {
    return this.create({
      userId,
      status: 'failed',
      failedAt: faker.date.recent({ hours: 1 }),
      metadata: {
        description: reason,
        error: faker.lorem.sentence(),
        category: 'error',
      },
      ...overrides,
    });
  }

  static createBatchPayments(payments: Array<{ fromUserId: string; toUserId: string; amount: number; taskId?: string }>): Transaction[] {
    return payments.map(payment =>
      this.createPayment(payment.fromUserId, payment.toUserId, payment.amount, payment.taskId)
    );
  }

  static createWithBlockData(overrides: Partial<Transaction> = {}): Transaction {
    return this.create({
      txHash: faker.string.hexadecimal({ length: 64 }),
      blockNumber: faker.number.int({ min: 1000000, max: 9999999 }),
      blockHash: faker.string.hexadecimal({ length: 64 }),
      gasUsed: faker.number.int({ min: 21000, max: 1000000 }),
      gasPrice: faker.number.int({ min: 1000000000, max: 10000000000 }),
      confirmations: faker.number.int({ min: 1, max: 100 }),
      ...overrides,
    });
  }

  // For database insertion
  static createForInsert(overrides: Partial<Transaction> = {}): Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> {
    const transaction = this.create(overrides);
    const { id, createdAt, updatedAt, ...insertData } = transaction;
    return insertData;
  }
}