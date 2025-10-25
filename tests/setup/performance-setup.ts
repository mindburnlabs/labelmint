// Performance test setup file
import { performance } from 'perf_hooks';

// Global performance test utilities
global.performance = performance;

// Mock Redis for testing
global.Redis = class MockRedis {
  constructor() {}
  async get() { return null; }
  async set() { return 'OK'; }
  async del() { return 1; }
  async ping() { return 'PONG'; }
  async disconnect() {}
  on() {}
};

// Mock ioredis
global.default = global.Redis;

export default {};