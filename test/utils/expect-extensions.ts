import { expect } from 'vitest';

// Custom matchers for better test assertions
expect.extend({
  // Check if date is within range
  toBeWithinRange(received: Date, floor: Date, ceiling: Date) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  // Check if number is approximately equal
  toBeApproximately(received: number, expected: number, precision = 2) {
    const diff = Math.abs(received - expected);
    const pass = diff < Math.pow(10, -precision) / 2;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be approximately ${expected} (±${Math.pow(10, -precision)})`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be approximately ${expected} (±${Math.pow(10, -precision)})`,
        pass: false,
      };
    }
  },

  // Check if array contains items matching predicate
  toContainItemsMatching(received: any[], predicate: (item: any) => boolean) {
    const matching = received.filter(predicate);
    const pass = matching.length > 0;
    if (pass) {
      return {
        message: () =>
          `expected array not to contain items matching predicate`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected array to contain items matching predicate`,
        pass: false,
      };
    }
  },

  // Check if array contains all items from another array
  toContainAllItems<T>(received: T[], expected: T[]) {
    const pass = expected.every(item => received.includes(item));
    if (pass) {
      return {
        message: () =>
          `expected array not to contain all expected items`,
        pass: true,
      };
    } else {
      const missing = expected.filter(item => !received.includes(item));
      return {
        message: () =>
          `expected array to contain all expected items, missing: ${missing.join(', ')}`,
        pass: false,
      };
    }
  },

  // Check if array contains only items from another array
  toContainOnlyItems<T>(received: T[], allowed: T[]) {
    const pass = received.every(item => allowed.includes(item));
    if (pass) {
      return {
        message: () =>
          `expected array not to contain only allowed items`,
        pass: true,
      };
    } else {
      const invalid = received.filter(item => !allowed.includes(item));
      return {
        message: () =>
          `expected array to contain only allowed items, found: ${invalid.join(', ')}`,
        pass: false,
      };
    }
  },

  // Check if object has required keys
  toHaveKeys(received: object, keys: string[]) {
    const receivedKeys = Object.keys(received);
    const missing = keys.filter(key => !receivedKeys.includes(key));
    const pass = missing.length === 0;
    if (pass) {
      return {
        message: () =>
          `expected object not to have keys: ${keys.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected object to have keys, missing: ${missing.join(', ')}`,
        pass: false,
      };
    }
  },

  // Check if object has only allowed keys
  toHaveOnlyKeys(received: object, keys: string[]) {
    const receivedKeys = Object.keys(received);
    const extra = receivedKeys.filter(key => !keys.includes(key));
    const pass = extra.length === 0;
    if (pass) {
      return {
        message: () =>
          `expected object not to have only keys: ${keys.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected object to have only allowed keys, extra: ${extra.join(', ')}`,
        pass: false,
      };
    }
  },

  // Check if string is valid UUID
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },

  // Check if string is valid TON address
  toBeValidTONAddress(received: string) {
    const tonAddressRegex = /^0:[0-9a-fA-F]{64}$/;
    const base64AddressRegex = /^EQ[a-zA-Z0-9_-]{48}$/;
    const pass = tonAddressRegex.test(received) || base64AddressRegex.test(received);
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be a valid TON address`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be a valid TON address`,
        pass: false,
      };
    }
  },

  // Check if string is valid email
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },

  // Check if number is within percentage of another
  toBeWithinPercentage(received: number, expected: number, percentage: number) {
    const diff = Math.abs(received - expected);
    const allowedDiff = (expected * percentage) / 100;
    const pass = diff <= allowedDiff;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within ${percentage}% of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within ${percentage}% of ${expected} (allowed diff: ${allowedDiff}, actual diff: ${diff})`,
        pass: false,
      };
    }
  },

  // Check if array is sorted
  toBeSorted<T>(received: T[], key?: keyof T, direction: 'asc' | 'desc' = 'asc') {
    const compare = (a: T, b: T) => {
      const aVal = key ? a[key] : a;
      const bVal = key ? b[key] : b;
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    };

    const sorted = [...received].sort(compare);
    const pass = JSON.stringify(received) === JSON.stringify(sorted);
    if (pass) {
      return {
        message: () =>
          `expected array not to be sorted in ${direction} order`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected array to be sorted in ${direction} order`,
        pass: false,
      };
    }
  },

  // Check if promise resolves within time
  toResolveWithin(received: Promise<any>, milliseconds: number) {
    let resolved = false;
    let timedOut = false;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        timedOut = true;
        reject(new Error(`Promise did not resolve within ${milliseconds}ms`));
      }, milliseconds);
    });

    const resultPromise = received.then(() => {
      resolved = true;
    });

    return {
      then: (onFulfilled: any, onRejected?: any) => {
        return Promise.race([resultPromise, timeoutPromise])
          .then(
            () => onFulfilled({
              message: () => `expected promise not to resolve within ${milliseconds}ms`,
              pass: true,
            }),
            () => onRejected({
              message: () => `expected promise to resolve within ${milliseconds}ms`,
              pass: false,
            })
          );
      },
    };
  },

  // Check if function was called with specific args
  toHaveBeenCalledWithMatching(received: any, ...expectedArgs: any[]) {
    const calls = received.mock.calls;
    const pass = calls.some(call =>
      expectedArgs.every((arg, index) => {
        const actual = call[index];
        if (typeof arg === 'function') {
          return arg(actual);
        } else if (typeof arg === 'object' && arg !== null) {
          return expect.objectContaining(arg).equals(actual);
        } else {
          return actual === arg;
        }
      })
    );

    if (pass) {
      return {
        message: () =>
          `expected mock not to have been called with matching args`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected mock to have been called with matching args`,
        pass: false,
      };
    }
  },
});

// Extend type definitions
declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toBeWithinRange(floor: Date, ceiling: Date): T;
      toBeApproximately(expected: number, precision?: number): T;
      toContainItemsMatching(predicate: (item: any) => boolean): T;
      toContainAllItems<U>(expected: U[]): T;
      toContainOnlyItems<U>(allowed: U[]): T;
      toHaveKeys(keys: string[]): T;
      toHaveOnlyKeys(keys: string[]): T;
      toBeValidUUID(): T;
      toBeValidTONAddress(): T;
      toBeValidEmail(): T;
      toBeWithinPercentage(expected: number, percentage: number): T;
      toBeSorted<K extends keyof T>(key?: K, direction?: 'asc' | 'desc'): T;
      toResolveWithin(milliseconds: number): any;
      toHaveBeenCalledWithMatching(...expectedArgs: any[]): T;
    }
  }
}