import { vi } from 'vitest';

export function createMockTonWallet() {
  return {
    contract: {
      address: {
        toString: () => 'EQTestAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      }
    },
    balance: vi.fn().mockResolvedValue('5000000000'), // 5 TON in nanotons
    getTransactions: vi.fn().mockResolvedValue([]),
    send: vi.fn().mockResolvedValue({ hash: 'mock-tx-hash' }),
    estimateGasFee: vi.fn().mockResolvedValue(50000000), // 0.05 TON
    findTransaction: vi.fn().mockResolvedValue(null),
    getSeqno: vi.fn().mockResolvedValue(1)
  };
}

export function createMockTonClient() {
  return {
    open: vi.fn(() => createMockTonWallet()),
    getBalance: vi.fn().mockResolvedValue(BigInt('5000000000')),
    runMethod: vi.fn().mockResolvedValue({
      stack: {
        readBigNumber: vi.fn().mockReturnValue(BigInt('200000000')) // 200 USDT balance
      }
    }),
    external: vi.fn().mockResolvedValue('0x1234567890abcdef'),
    getContract: vi.fn().mockResolvedValue({}),
    getBalance: vi.fn().mockResolvedValue(BigInt('5000000000'))
  };
}

export function createMockPaymentConfig() {
  return {
    network: 'testnet',
    workchain: 0,
    timeout: 30000,
    gasLimit: 1000000,
  };
}