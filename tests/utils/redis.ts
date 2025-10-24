import Redis from 'ioredis';

// Test Redis configuration
const TEST_REDIS_CONFIG = {
  host: process.env.TEST_REDIS_HOST || 'localhost',
  port: parseInt(process.env.TEST_REDIS_PORT || '6380'),
  db: parseInt(process.env.TEST_REDIS_DB || '1'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

let testRedis: Redis;

/**
 * Initialize test Redis connection
 */
export async function initializeTestRedis(): Promise<Redis> {
  if (testRedis) return testRedis;

  testRedis = new Redis(TEST_REDIS_CONFIG);

  // Test connection
  testRedis.on('connect', () => {
    console.log('✅ Test Redis connected');
  });

  testRedis.on('error', (error) => {
    console.error('❌ Redis connection error:', error);
  });

  try {
    await testRedis.connect();
  } catch (error) {
    console.error('❌ Failed to connect to test Redis:', error);
    throw error;
  }

  return testRedis;
}

/**
 * Get test Redis client
 */
export function getTestRedis(): Redis {
  if (!testRedis) {
    throw new Error('Test Redis not initialized. Call initializeTestRedis() first.');
  }
  return testRedis;
}

/**
 * Clean all Redis data
 */
export async function cleanRedis(): Promise<void> {
  const redis = getTestRedis();

  try {
    await redis.flushdb();
    console.log('✅ Redis cleaned');
  } catch (error) {
    console.error('❌ Failed to clean Redis:', error);
    throw error;
  }
}

/**
 * Close Redis connection
 */
export async function closeTestRedis(): Promise<void> {
  if (testRedis) {
    await testRedis.quit();
    console.log('✅ Test Redis connection closed');
  }
}

/**
 * Set a key with expiration
 */
export async function setWithExpiry(
  key: string,
  value: string,
  ttl: number
): Promise<void> {
  const redis = getTestRedis();
  await redis.setex(key, ttl, value);
}

/**
 * Get a value
 */
export async function get(key: string): Promise<string | null> {
  const redis = getTestRedis();
  return await redis.get(key);
}

/**
 * Set a hash field
 */
export async function hset(
  key: string,
  field: string,
  value: string
): Promise<number> {
  const redis = getTestRedis();
  return await redis.hset(key, field, value);
}

/**
 * Get a hash field
 */
export async function hget(key: string, field: string): Promise<string | null> {
  const redis = getTestRedis();
  return await redis.hget(key, field);
}

/**
 * Get all hash fields
 */
export async function hgetall(key: string): Promise<Record<string, string>> {
  const redis = getTestRedis();
  return await redis.hgetall(key);
}

/**
 * Add to a list
 */
export async function lpush(key: string, ...values: string[]): Promise<number> {
  const redis = getTestRedis();
  return await redis.lpush(key, ...values);
}

/**
 * Get list range
 */
export async function lrange(
  key: string,
  start: number = 0,
  stop: number = -1
): Promise<string[]> {
  const redis = getTestRedis();
  return await redis.lrange(key, start, stop);
}

/**
 * Add to a set
 */
export async function sadd(key: string, ...members: string[]): Promise<number> {
  const redis = getTestRedis();
  return await redis.sadd(key, ...members);
}

/**
 * Get all set members
 */
export async function smembers(key: string): Promise<string[]> {
  const redis = getTestRedis();
  return await redis.smembers(key);
}

/**
 * Check if member exists in set
 */
export async function sismember(key: string, member: string): Promise<number> {
  const redis = getTestRedis();
  return await redis.sismember(key, member);
}

/**
 * Increment a value
 */
export async function incr(key: string): Promise<number> {
  const redis = getTestRedis();
  return await redis.incr(key);
}

/**
 * Increment a value by amount
 */
export async function incrby(key: string, increment: number): Promise<number> {
  const redis = getTestRedis();
  return await redis.incrby(key, increment);
}

/**
 * Set JSON value
 */
export async function jsonSet(key: string, path: string, value: any): Promise<string> {
  const redis = getTestRedis();
  return await redis.call('JSON.SET', key, path, JSON.stringify(value)) as string;
}

/**
 * Get JSON value
 */
export async function jsonGet(key: string, path: string = '$'): Promise<any> {
  const redis = getTestRedis();
  const result = await redis.call('JSON.GET', key, path);
  return JSON.parse(result as string);
}

/**
 * Delete keys
 */
export async function del(...keys: string[]): Promise<number> {
  const redis = getTestRedis();
  return await redis.del(...keys);
}

/**
 * Check if key exists
 */
export async function exists(key: string): Promise<number> {
  const redis = getTestRedis();
  return await redis.exists(key);
}

/**
 * Set TTL for a key
 */
export async function expire(key: string, ttl: number): Promise<number> {
  const redis = getTestRedis();
  return await redis.expire(key, ttl);
}

/**
 * Get TTL for a key
 */
export async function ttl(key: string): Promise<number> {
  const redis = getTestRedis();
  return await redis.ttl(key);
}

/**
 * Get all keys matching pattern
 */
export async function keys(pattern: string): Promise<string[]> {
  const redis = getTestRedis();
  return await redis.keys(pattern);
}

/**
 * Pipeline multiple commands
 */
export async function pipeline<T>(
  commands: Array<(redis: Redis) => Promise<any>>
): Promise<T[]> {
  const redis = getTestRedis();
  const pipe = redis.pipeline();

  commands.forEach(cmd => {
    // Note: This is a simplified pipeline. In practice, you might want to
    // build the pipeline with specific Redis commands
  });

  const results = await pipe.exec();
  return results?.map(r => r[1]) as T[];
}