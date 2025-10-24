import 'jest-extended';
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Global test database instance
export const testDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://test_user:test_pass@localhost:5433/labelmint_test'
    }
  }
});

// Global test Redis instance
export const testRedis = new Redis({
  host: 'localhost',
  port: 6380,
  password: 'test_redis_pass',
  db: 1 // Use different DB for tests
});

// Mock Service Worker for API mocking
export const server = setupServer(
  // Mock Telegram Bot API
  rest.get('https://api.telegram.org/bot:token/getMe', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          id: 123456789,
          is_bot: true,
          first_name: 'Test Bot',
          username: 'labelmint_test_bot'
        }
      })
    );
  }),

  // Mock TON blockchain API
  rest.post('https://testnet.toncenter.com/api/v2/getAddressInformation', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        ok: true,
        result: {
          balance: '1000000000', // 1 TON in nanotons
          state: 'active',
          data: ''
        }
      })
    );
  }),

  // Mock AWS S3
  rest.get('https://s3.amazonaws.com/test-bucket', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        Contents: []
      })
    );
  }),

  // Mock Supabase
  rest.post('https://test.supabase.co/auth/v1/token', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_in: 3600
      })
    );
  })
);

// Global test setup
beforeAll(async () => {
  // Start MSW server
  server.listen({
    onUnhandledRequest: 'warn'
  });

  // Connect to test database
  await testDb.$connect();

  // Connect to test Redis
  await testRedis.connect();
});

beforeEach(async () => {
  // Clean Redis before each test
  await testRedis.flushdb();
});

afterEach(() => {
  // Reset request handlers between tests
  server.resetHandlers();
});

afterAll(async () => {
  // Close MSW server
  server.close();

  // Disconnect from test database
  await testDb.$disconnect();

  // Disconnect from Redis
  await testRedis.disconnect();
});

// Global test utilities
export const cleanupTestData = async () => {
  // Clean up test data in reverse order due to foreign keys
  const tablenames = await testDb.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await testDb.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
      } catch (error) {
        console.log(`Note: ${tablename} doesn't exist, skipping`);
      }
    }
  }
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.TEST_DATABASE_URL = 'postgresql://test_user:test_pass@localhost:5433/labelmint_test';
process.env.TEST_REDIS_URL = 'redis://:test_redis_pass@localhost:6380/1';