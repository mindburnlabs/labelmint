import { config } from 'dotenv';

// Load test environment variables
config({ path: '../../.env.test' });

// Set default test values if not in environment
process.env.BLOCKCHAIN_TEST_TIMEOUT = process.env.BLOCKCHAIN_TEST_TIMEOUT || '30000';
process.env.TON_TESTNET_RPC_URL = process.env.TON_TESTNET_RPC_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC';
process.env.TON_MAINNET_RPC_URL = process.env.TON_MAINNET_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC';

// Global test timeout
jest.setTimeout(parseInt(process.env.BLOCKCHAIN_TEST_TIMEOUT || '30000'));

// Mock console methods for cleaner test output
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    // Suppress unnecessary logs during tests
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    // Keep errors and warnings for debugging
    warn: originalConsole.warn,
    error: originalConsole.error,
  };
});

afterAll(() => {
  global.console = originalConsole;
});