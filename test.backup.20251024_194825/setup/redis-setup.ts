import { Redis } from 'ioredis'

let mockRedis: any

export function setupRedisMock() {
  // Create Redis mock for testing
  mockRedis = {
    // Basic operations
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),

    // List operations
    lpush: vi.fn(),
    rpush: vi.fn(),
    lpop: vi.fn(),
    rpop: vi.fn(),
    lrange: vi.fn(),
    llen: vi.fn(),

    // Set operations
    sadd: vi.fn(),
    srem: vi.fn(),
    smembers: vi.fn(),
    sismember: vi.fn(),
    scard: vi.fn(),

    // Hash operations
    hset: vi.fn(),
    hget: vi.fn(),
    hgetall: vi.fn(),
    hdel: vi.fn(),
    hexists: vi.fn(),

    // Pub/Sub
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),

    // Connection
    connect: vi.fn(),
    disconnect: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),

    // Transaction
    multi: vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue([]),
    }),

    // Cleanup
    flushall: vi.fn(),
    flushdb: vi.fn(),
  }

  // Mock ioredis
  vi.mock('ioredis', () => ({
    default: vi.fn(() => mockRedis),
  }))

  // Setup global Redis mock
  global.redisClient = mockRedis

  return {
    mockRedis,
    cleanup: () => {
      vi.clearAllMocks()
      // Reset all mock data
      Object.keys(mockRedis).forEach(key => {
        if (typeof mockRedis[key] === 'function') {
          mockRedis[key].mockClear()
        }
      })
    },
  }
}

// Auto-setup
const { mockRedis, cleanup } = setupRedisMock()

export { mockRedis, cleanup }