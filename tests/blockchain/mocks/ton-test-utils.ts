import { expect } from 'vitest';

// Custom chai matcher for transaction matching
expect.extend({
  toHaveTransaction(received: any[], expected: any) {
    if (!Array.isArray(received)) {
      return {
        message: () => `Expected transactions array, received ${typeof received}`,
        pass: false
      };
    }

    const matchingTx = received.find(tx => {
      if (expected.from && tx.from?.toString() !== expected.from.toString()) return false;
      if (expected.to && tx.to?.toString() !== expected.to.toString()) return false;
      if (expected.value !== undefined && tx.value !== expected.value) return false;
      if (expected.success !== undefined && tx.success !== expected.success) return false;
      if (expected.deploy !== undefined && tx.deploy !== expected.deploy) return false;
      if (expected.exitCode !== undefined && tx.exitCode !== expected.exitCode) return false;
      return true;
    });

    return {
      message: () => {
        const safeStringify = (obj: any) => {
          return JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() + 'n' : value
          );
        };

        if (matchingTx) {
          return `Expected transaction NOT to match, but found: ${safeStringify(matchingTx)}`;
        }
        return `Expected transaction matching ${safeStringify(expected)} but found: ${safeStringify(received)}`;
      },
      pass: !!matchingTx
    };
  }
});

// Export types for TypeScript
declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toHaveTransaction(expected: {
        from?: any;
        to?: any;
        value?: bigint;
        success?: boolean;
        deploy?: boolean;
        exitCode?: number;
      }): T;
    }
  }
}