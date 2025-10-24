import { faker } from '@faker-js/faker';
import type { User, UserRole, UserStatus } from '@shared/types/database';

export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    const now = new Date();
    const id = faker.string.uuid();

    return {
      id,
      telegramId: faker.number.int({ min: 1000000, max: 9999999 }).toString(),
      username: faker.internet.userName().toLowerCase(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      role: faker.helpers.arrayElement<UserRole>(['worker', 'requester', 'admin']),
      status: faker.helpers.arrayElement<UserStatus>(['active', 'inactive', 'suspended']),
      tonWalletAddress: faker.finance.ethereumAddress(),
      reputation: faker.number.int({ min: 0, max: 100 }),
      completedTasks: faker.number.int({ min: 0, max: 1000 }),
      accuracy: faker.number.float({ min: 0, max: 1, multipleOf: 0.01 }),
      averageTimePerTask: faker.number.int({ min: 30, max: 300 }),
      createdAt: faker.date.past({ years: 2 }),
      updatedAt: faker.date.recent({ days: 30 }),
      lastActiveAt: faker.date.recent({ days: 7 }),
      emailVerifiedAt: faker.datatype.boolean(0.8) ? faker.date.past({ years: 1 }) : null,
      kycStatus: faker.helpers.arrayElement(['pending', 'verified', 'rejected']),
      kycSubmittedAt: faker.datatype.boolean(0.5) ? faker.date.past({ months: 6 }) : null,
      timezone: faker.location.timeZone(),
      language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de', 'it', 'pt']),
      referralCode: faker.string.alphanumeric(8).toUpperCase(),
      referredBy: faker.datatype.boolean(0.3) ? faker.string.uuid() : null,
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createWorker(overrides: Partial<User> = {}): User {
    return this.create({
      role: 'worker',
      status: 'active',
      reputation: faker.number.int({ min: 50, max: 100 }),
      accuracy: faker.number.float({ min: 0.7, max: 1, multipleOf: 0.01 }),
      ...overrides,
    });
  }

  static createRequester(overrides: Partial<User> = {}): User {
    return this.create({
      role: 'requester',
      status: 'active',
      tonWalletAddress: faker.finance.ethereumAddress(),
      ...overrides,
    });
  }

  static createAdmin(overrides: Partial<User> = {}): User {
    return this.create({
      role: 'admin',
      status: 'active',
      emailVerifiedAt: faker.date.past({ years: 1 }),
      kycStatus: 'verified',
      ...overrides,
    });
  }

  static createWithTelegramData(telegramData: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  }, overrides: Partial<User> = {}): User {
    return this.create({
      telegramId: telegramData.id.toString(),
      firstName: telegramData.first_name,
      lastName: telegramData.last_name || null,
      username: telegramData.username || null,
      language: telegramData.language_code?.split('-')[0] || 'en',
      status: 'active',
      emailVerifiedAt: new Date(),
      ...overrides,
    });
  }

  static createWithReputation(reputation: number, overrides: Partial<User> = {}): User {
    return this.create({
      role: 'worker',
      status: reputation > 50 ? 'active' : 'inactive',
      reputation: Math.max(0, Math.min(100, reputation)),
      accuracy: reputation > 50 ? faker.number.float({ min: 0.7, max: 1, multipleOf: 0.01 }) : faker.number.float({ min: 0.3, max: 0.7, multipleOf: 0.01 }),
      ...overrides,
    });
  }

  // For database insertion
  static createForInsert(overrides: Partial<User> = {}): Omit<User, 'id' | 'createdAt' | 'updatedAt'> {
    const user = this.create(overrides);
    const { id, createdAt, updatedAt, ...insertData } = user;
    return insertData;
  }
}