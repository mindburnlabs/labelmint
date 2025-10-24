import { wait } from '@testing-library/react';
import { faker } from '@faker-js/faker';

/**
 * Wait for a specified amount of time
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Wait for a condition to be true
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
};

/**
 * Wait for an async function to complete without error
 */
export const waitForNoError = async (
  fn: () => Promise<any>,
  timeout = 5000,
  interval = 100
): Promise<any> => {
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error as Error;
      await sleep(interval);
    }
  }

  throw lastError || new Error('Function never resolved');
};

/**
 * Generate a random string
 */
export const randomString = (length = 10): string => {
  return faker.string.alphanumeric(length);
};

/**
 * Generate a random email
 */
export const randomEmail = (): string => {
  return faker.internet.email();
};

/**
 * Generate a random UUID
 */
export const randomUUID = (): string => {
  return faker.string.uuid();
};

/**
 * Generate a random TON address
 */
export const randomTONAddress = (): string => {
  return `EQ${faker.string.alphanumeric({ length: 48, casing: 'mixed' })}`;
};

/**
 * Generate a random number within range
 */
export const randomInt = (min = 0, max = 100): number => {
  return faker.number.int({ min, max });
};

/**
 * Generate a random float within range
 */
export const randomFloat = (min = 0, max = 100, precision = 2): number => {
  return faker.number.float({ min, max, precision });
};

/**
 * Create a random date within range
 */
export const randomDate = (
  start = new Date(2024, 0, 1),
  end = new Date()
): Date => {
  return faker.date.between({ from: start, to: end });
};

/**
 * Pick a random item from array
 */
export const randomPick = <T>(array: T[]): T => {
  return faker.helpers.arrayElement(array);
};

/**
 * Pick random items from array
 */
export const randomPickMany = <T>(array: T[], count: number): T[] => {
  return faker.helpers.arrayElements(array, { min: count, max: count });
};

/**
 * Shuffle array
 */
export const shuffle = <T>(array: T[]): T[] => {
  return faker.helpers.shuffle(array);
};

/**
 * Deep clone object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Remove undefined/null values from object
 */
export const cleanObject = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const cleaned: Partial<T> = {};

  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null) {
      cleaned[key] = obj[key];
    }
  }

  return cleaned;
};

/**
 * Retry a function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }

  throw lastError!;
};

/**
 * Create a mock event emitter
 */
export const createMockEventEmitter = () => {
  const listeners: Record<string, Function[]> = {};

  return {
    on(event: string, listener: Function) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(listener);
    },

    off(event: string, listener: Function) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(l => l !== listener);
      }
    },

    emit(event: string, ...args: any[]) {
      if (listeners[event]) {
        listeners[event].forEach(listener => listener(...args));
      }
    },

    listenerCount(event: string) {
      return listeners[event]?.length || 0;
    },

    removeAllListeners(event?: string) {
      if (event) {
        delete listeners[event];
      } else {
        Object.keys(listeners).forEach(e => delete listeners[e]);
      }
    },
  };
};

/**
 * Create a readable stream from data
 */
export const createReadableStream = (data: any) => {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(JSON.stringify(data));
      controller.close();
    },
  });
};

/**
 * Parse a readable stream
 */
export const parseReadableStream = async (stream: ReadableStream): Promise<any> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return JSON.parse(new TextDecoder().decode(combined));
};

/**
 * Create a mock file
 */
export const createMockFile = (
  name: string,
  type: string,
  size: number = 1024
): File => {
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);

  // Fill with random data
  for (let i = 0; i < size; i++) {
    view[i] = Math.floor(Math.random() * 256);
  }

  return new File([buffer], name, { type });
};

/**
 * Create a mock image file
 */
export const createMockImageFile = (name = 'image.jpg', size = 1024): File => {
  return createMockFile(name, 'image/jpeg', size);
};

/**
 * Create a mock JSON file
 */
export const createMockJSONFile = (data: any, name = 'data.json'): File => {
  const jsonString = JSON.stringify(data);
  const buffer = new TextEncoder().encode(jsonString);
  return new File([buffer], name, { type: 'application/json' });
};

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Calculate percentage
 */
export const calculatePercentage = (value: number, total: number, decimals = 2): number => {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(decimals));
};

/**
 * Round to decimal places
 */
export const roundTo = (value: number, decimals = 2): number => {
  return Number(value.toFixed(decimals));
};

/**
 * Clamp value between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Lerp between two values
 */
export const lerp = (start: number, end: number, t: number): number => {
  return start + (end - start) * clamp(t, 0, 1);
};

/**
 * Debounce a function
 */
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Throttle a function
 */
export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
};

/**
 * Memoize a function
 */
export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  getKey?: (...args: Parameters<T>) => string
): ((...args: Parameters<T>) => ReturnType<T>) => {
  const cache = new Map<string, ReturnType<T>>();

  return (...args: Parameters<T>): ReturnType<T> => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Create a rate limiter
 */
export const createRateLimiter = (maxCalls: number, windowMs: number) => {
  const calls: number[] = [];

  return {
    check(): boolean {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove old calls
      while (calls.length > 0 && calls[0] < windowStart) {
        calls.shift();
      }

      if (calls.length < maxCalls) {
        calls.push(now);
        return true;
      }

      return false;
    },

    timeUntilNextCall(): number {
      if (calls.length < maxCalls) return 0;
      const oldestCall = calls[0];
      return Math.max(0, oldestCall + windowMs - Date.now());
    },
  };
};

/**
 * Generate test data for pagination
 */
export const generatePaginatedData = <T>(
  data: T[],
  page: number,
  limit: number
) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const items = data.slice(startIndex, endIndex);

  return {
    items,
    pagination: {
      page,
      limit,
      total: data.length,
      totalPages: Math.ceil(data.length / limit),
      hasNext: endIndex < data.length,
      hasPrev: page > 1,
    },
  };
};

/**
 * Create a test context object
 */
export const createTestContext = (overrides: Record<string, any> = {}) => {
  return {
    userId: randomUUID(),
    requestId: randomUUID(),
    timestamp: new Date(),
    ip: '127.0.0.1',
    userAgent: 'Test-Agent/1.0',
    locale: 'en-US',
    timezone: 'UTC',
    ...overrides,
  };
};