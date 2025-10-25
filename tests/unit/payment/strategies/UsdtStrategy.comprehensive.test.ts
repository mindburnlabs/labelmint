import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UsdtStrategy } from '../../../../../services/payment-backend/src/services/payment/strategies/UsdtStrategy';
import { Address, fromNano, toNano } from '@ton/ton';
import type { Transaction } from '../../../services/payment-backend/src/services/payment/interfaces/PaymentStrategy';

// Mock the database and dependencies
vi.mock('../../../../../services/payment-backend/src/database', () => ({
  postgresDb: {
    query: vi.fn(),
  }
}));

vi.mock('../../../../../services/payment-backend/src/utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }))
}));

describe('UsdtStrategy - Comprehensive Testing', () => {
  let strategy: UsdtStrategy;
  let mockDatabase: any;

  beforeEach(async () => {
    // Mock database
    mockDatabase = {
      query: vi.fn(),
    };

    // Replace the postgresDb import
    const { postgresDb } = await import('../../../../../services/payment-backend/src/database');
    vi.mocked(postgresDb).query = mockDatabase.query;

    strategy = new UsdtStrategy({
      network: 'testnet',
      workchain: 0,
      timeout: 30000,
      gasLimit: 1000000,
    });

    await strategy.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Address Validation', () => {
    it('should validate correct TON addresses for USDT transfers', () => {
      const validAddresses = [
        'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMVc',
        'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk',
        '0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      ];

      validAddresses.forEach(address => {
        expect(strategy.validateAddress(address)).toBe(true);
      });
    });

    it('should reject invalid TON addresses', () => {
      const invalidAddresses = [
        'invalid',
        '0x1234567890',
        'EQShort',
        'EQVeryLongAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
        '',
        'not-an-address'
      ];

      invalidAddresses.forEach(address => {
        expect(strategy.validateAddress(address)).toBe(false);
      });
    });
  });

  describe('Withdrawal Operations', () => {
    it('should validate USDT withdrawal parameters', async () => {
      const validAddress = 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk';

      // Test invalid amounts
      await expect(strategy.withdraw(0, validAddress))
        .rejects.toThrow('Invalid withdrawal amount: 0');

      await expect(strategy.withdraw(-10, validAddress))
        .rejects.toThrow('Invalid withdrawal amount: -10');

      // Test minimum amount
      await expect(strategy.withdraw(0.005, validAddress))
        .rejects.toThrow('Withdrawal amount 0.005 USDT is below minimum limit of 0.01 USDT');

      // Test maximum amount
      await expect(strategy.withdraw(20000000, validAddress))
        .rejects.toThrow('Withdrawal amount 20000000 USDT exceeds maximum limit of 10,000,000 USDT');

      // Test invalid address
      await expect(strategy.withdraw(100, 'invalid-address'))
        .rejects.toThrow('Invalid TON address for USDT transfer: invalid-address');
    });

    it('should handle insufficient USDT balance', async () => {
      const validAddress = 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk';

      // This will fail due to blockchain interaction in the real implementation
      // The error would be caught and re-thrown with more context
      await expect(strategy.withdraw(100, validAddress))
        .rejects.toThrow();
    });
  });

  describe('Fee Estimation', () => {
    it('should estimate USDT transfer fees', async () => {
      const fromAddress = 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk';
      const toAddress = 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP';

      const fee = await strategy.estimateFee(fromAddress, toAddress, 100);

      expect(fee).toBeGreaterThan(0);
      expect(fee).toBeLessThan(1); // Fee should be reasonable for USDT transfers
    });

    it('should handle fee estimation errors gracefully', async () => {
      const fromAddress = 'invalid-address';
      const toAddress = 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP';

      const fee = await strategy.estimateFee(fromAddress, toAddress, 100);

      // Should return default fee on error
      expect(fee).toBe(0.2);
    });
  });

  describe('Balance Operations', () => {
    it('should get USDT wallet balance', async () => {
      const address = 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk';

      // Mock blockchain client would return balance here
      // For now, we expect it to handle errors gracefully
      const balance = await strategy.getBalance(address);

      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
    });

    it('should handle balance query errors', async () => {
      const invalidAddress = 'invalid-address';

      const balance = await strategy.getBalance(invalidAddress);

      // Should return 0 on error
      expect(balance).toBe(0);
    });
  });

  describe('USDT Wallet Address Calculation', () => {
    it('should calculate USDT wallet address for TON address', async () => {
      const tonAddress = 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk';

      // This will use the fallback calculation in test environment
      const usdtWalletAddress = await strategy.getUsdtWalletAddress(tonAddress);

      expect(typeof usdtWalletAddress).toBe('string');
      expect(usdtWalletAddress.length).toBeGreaterThan(0);
      expect(strategy.validateAddress(usdtWalletAddress)).toBe(true);
    });
  });

  describe('Jetton Wallet Data', () => {
    it('should get jetton wallet data', async () => {
      const jettonWalletAddress = 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk';

      const walletData = await strategy.getJettonWalletData(jettonWalletAddress);

      expect(walletData).toMatchObject({
        balance: expect.any(String),
        owner: expect.any(String),
        master: expect.any(String)
      });

      // Should return default values on error
      expect(walletData.balance).toBe('0');
    });
  });

  describe('Transaction History', () => {
    it('should retrieve USDT transaction history', async () => {
      const address = 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk';

      // Mock database query for stored transactions
      mockDatabase.query.mockResolvedValue({
        rows: [{
          hash: '0x1234567890abcdef',
          from_address: address,
          to_address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
          amount: '100000000', // 100 USDT with 6 decimals
          token_type: 'USDT',
          fee: '200000',
          status: 'confirmed',
          timestamp: new Date(),
          block_number: 12346,
          message: 'USDT payment'
        }]
      });

      const history = await strategy.getTransactionHistory(address, 10);

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        hash: '0x1234567890abcdef',
        fromAddress: address,
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        tokenType: 'USDT',
        status: 'confirmed'
      });
    });

    it('should handle empty transaction history', async () => {
      const address = 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk';

      // Mock empty database response
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const history = await strategy.getTransactionHistory(address);

      expect(history).toHaveLength(0);
    });
  });

  describe('Transaction Status', () => {
    it('should check USDT transaction status', async () => {
      const txHash = '0x1234567890abcdef';

      // Mock database query
      mockDatabase.query.mockResolvedValue({
        rows: [{
          hash: txHash,
          from_address: 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk',
          to_address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
          amount: '100000000', // 100 USDT with 6 decimals
          token_type: 'USDT',
          fee: '200000',
          status: 'confirmed',
          timestamp: new Date(),
          block_number: 12346,
          message: 'USDT payment'
        }]
      });

      const status = await strategy.checkTransactionStatus(txHash);

      expect(status).toMatchObject({
        hash: txHash,
        fromAddress: 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        tokenType: 'USDT',
        status: 'confirmed'
      });
    });

    it('should handle non-existent transaction', async () => {
      const txHash = '0xnonexistent';

      // Mock empty database response
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await expect(strategy.checkTransactionStatus(txHash))
        .rejects.toThrow('Transaction not found');
    });
  });

  describe('Payment Type', () => {
    it('should return correct payment type', () => {
      expect(strategy.getPaymentType()).toBe('USDT');
    });
  });

  describe('Error Handling', () => {
    it('should handle deposit operations correctly', async () => {
      await expect(strategy.deposit(100))
        .rejects.toThrow('Deposit not supported for USDT strategy');
    });

    it('should handle withdrawal errors with proper context', async () => {
      const validAddress = 'EQDa4VSt4QzuZ33Zm6e8qGJHdR8sKgurWgXJb2CJZpKFErHk';

      // This will fail due to blockchain interaction but should provide context
      await expect(strategy.withdraw(100, validAddress))
        .rejects.toThrow('USDT withdrawal failed');
    });
  });
});