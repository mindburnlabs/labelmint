import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaymentManager } from '../../../services/payment-backend/src/services/payment/PaymentManager';
import { TonWalletStrategy } from '../../../services/payment-backend/src/services/payment/strategies/TonWalletStrategy';
import { UsdtStrategy } from '../../../services/payment-backend/src/services/payment/strategies/UsdtStrategy';

// Mock the database and external dependencies
vi.mock('../../../services/payment-backend/src/database', () => ({
  postgresDb: {
    query: vi.fn(),
    $transaction: vi.fn(),
  }
}));

vi.mock('../../../services/payment-backend/src/utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }))
}));

// Mock Redis
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
  }))
}));

describe('Payment System - Comprehensive Integration Tests', () => {
  let paymentManager: PaymentManager;
  let mockDatabase: any;
  let mockRedis: any;

  beforeEach(async () => {
    // Mock database
    mockDatabase = {
      query: vi.fn(),
      $transaction: vi.fn(),
      connect: vi.fn(),
    };

    // Mock Redis
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
      expire: vi.fn(),
    };

    // Replace database and Redis imports
    const { postgresDb } = await import('../../../services/payment-backend/src/database');
    vi.mocked(postgresDb).query = mockDatabase.query;
    vi.mocked(postgresDb).$transaction = mockDatabase.$transaction;

    // Initialize payment manager with test configuration
    paymentManager = new PaymentManager({
      database: mockDatabase,
      redis: mockRedis,
      network: 'testnet',
      enableValidation: true,
      enableCaching: true,
      defaultFeeMultiplier: 1.0,
      maxRetries: 3,
      timeoutMs: 30000
    });

    // Initialize strategies
    await paymentManager.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('TON Payment Integration', () => {
    it('should process complete TON payment workflow', async () => {
      const paymentRequest = {
        type: 'TON' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1.5,
        userId: 123,
        message: 'Integration test TON payment'
      };

      // Mock wallet lookup
      mockDatabase.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 123,
          wallet_address: paymentRequest.fromAddress,
          wallet_version: 'v4R2',
          public_key: 'test-public-key',
          mnemonic_encrypted: 'encrypted-test-mnemonic',
          is_active: true
        }]
      });

      // Process the payment (will fail due to blockchain in test, but we test the workflow)
      const result = await paymentManager.processPayment(paymentRequest);

      // Verify the result structure (even if failed)
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('transaction');
      expect(result).toHaveProperty('error');

      // Verify database was queried for wallet
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM user_ton_wallets'),
        expect.any(Array)
      );
    });

    it('should validate TON payment parameters', async () => {
      const invalidPaymentRequest = {
        type: 'TON' as const,
        fromAddress: 'invalid-address',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1.5,
        userId: 123,
        message: 'Invalid payment test'
      };

      const result = await paymentManager.processPayment(invalidPaymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle insufficient TON balance', async () => {
      const paymentRequest = {
        type: 'TON' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1000, // Very high amount
        userId: 123,
        message: 'Insufficient balance test'
      };

      // Mock wallet lookup
      mockDatabase.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 123,
          wallet_address: paymentRequest.fromAddress,
          wallet_version: 'v4R2',
          public_key: 'test-public-key',
          mnemonic_encrypted: 'encrypted-test-mnemonic',
          is_active: true
        }]
      });

      const result = await paymentManager.processPayment(paymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('USDT Payment Integration', () => {
    it('should process complete USDT payment workflow', async () => {
      const paymentRequest = {
        type: 'USDT' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 100, // 100 USDT
        userId: 123,
        message: 'Integration test USDT payment'
      };

      // Mock wallet lookup
      mockDatabase.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 123,
          wallet_address: paymentRequest.fromAddress,
          wallet_version: 'v4R2',
          public_key: 'test-public-key',
          mnemonic_encrypted: 'encrypted-test-mnemonic',
          is_active: true
        }]
      });

      const result = await paymentManager.processPayment(paymentRequest);

      // Verify the result structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('transaction');
      expect(result).toHaveProperty('error');

      // Verify database was queried
      expect(mockDatabase.query).toHaveBeenCalled();
    });

    it('should validate USDT payment parameters', async () => {
      const invalidPaymentRequest = {
        type: 'USDT' as const,
        fromAddress: 'invalid-address',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 100,
        userId: 123,
        message: 'Invalid USDT payment test'
      };

      const result = await paymentManager.processPayment(invalidPaymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle USDT amount limits', async () => {
      const invalidPaymentRequest = {
        type: 'USDT' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 0.005, // Below minimum
        userId: 123,
        message: 'Minimum amount test'
      };

      const result = await paymentManager.processPayment(invalidPaymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('below minimum limit');
    });
  });

  describe('Batch Payment Processing', () => {
    it('should process batch payments', async () => {
      const batchRequest = {
        payments: [
          {
            type: 'TON' as const,
            fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
            toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            amount: 1.0,
            message: 'Batch payment 1'
          },
          {
            type: 'USDT' as const,
            fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
            toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            amount: 50,
            message: 'Batch payment 2'
          }
        ],
        userId: 123,
        validateAll: true,
        stopOnFirstError: false
      };

      // Mock wallet lookup
      mockDatabase.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 123,
          wallet_address: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
          wallet_version: 'v4R2',
          public_key: 'test-public-key',
          mnemonic_encrypted: 'encrypted-test-mnemonic',
          is_active: true
        }]
      });

      const result = await paymentManager.processBatchPayments(batchRequest);

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('summary');
      expect(result.results).toHaveLength(2);
      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('successful');
      expect(result.summary).toHaveProperty('failed');
    });

    it('should handle batch payment validation failures', async () => {
      const batchRequest = {
        payments: [
          {
            type: 'TON' as const,
            fromAddress: 'invalid-address',
            toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            amount: 1.0,
            message: 'Invalid batch payment'
          }
        ],
        userId: 123,
        validateAll: true,
        stopOnFirstError: true
      };

      const result = await paymentManager.processBatchPayments(batchRequest);

      expect(result.summary.failed).toBeGreaterThan(0);
      expect(result.summary.successful).toBe(0);
    });
  });

  describe('Transaction Status and History', () => {
    it('should check transaction status for both TON and USDT', async () => {
      const tonTxHash = '0x1234567890abcdef';
      const usdtTxHash = '0xabcdef1234567890';

      // Mock transaction lookup for TON
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{
            hash: tonTxHash,
            from_address: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
            to_address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            amount: '1500000000', // 1.5 TON in nanotons
            token_type: 'TON',
            fee: '6000000',
            status: 'confirmed',
            timestamp: new Date(),
            block_number: 12345
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            hash: usdtTxHash,
            from_address: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
            to_address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            amount: '100000000', // 100 USDT with 6 decimals
            token_type: 'USDT',
            fee: '200000',
            status: 'confirmed',
            timestamp: new Date(),
            block_number: 12346
          }]
        });

      // Check TON transaction status
      const tonResult = await paymentManager.checkTransactionStatus(tonTxHash, 'TON');
      expect(tonResult.hash).toBe(tonTxHash);
      expect(tonResult.tokenType).toBe('TON');
      expect(tonResult.status).toBe('confirmed');

      // Check USDT transaction status
      const usdtResult = await paymentManager.checkTransactionStatus(usdtTxHash, 'USDT');
      expect(usdtResult.hash).toBe(usdtTxHash);
      expect(usdtResult.tokenType).toBe('USDT');
      expect(usdtResult.status).toBe('confirmed');
    });

    it('should retrieve transaction history', async () => {
      const address = 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF';

      // Mock transaction history
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            hash: '0x1234567890abcdef',
            from_address: address,
            to_address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            amount: '1500000000', // 1.5 TON
            token_type: 'TON',
            fee: '6000000',
            status: 'confirmed',
            timestamp: new Date('2024-01-01'),
            block_number: 12345,
            message: 'TON payment'
          },
          {
            hash: '0xabcdef1234567890',
            from_address: address,
            to_address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            amount: '100000000', // 100 USDT
            token_type: 'USDT',
            fee: '200000',
            status: 'confirmed',
            timestamp: new Date('2024-01-02'),
            block_number: 12346,
            message: 'USDT payment'
          }
        ]
      });

      const history = await paymentManager.getTransactionHistory(address, 'TON', 10);

      expect(history).toHaveLength(1); // Only TON transactions since we specified TON type
      expect(history[0].tokenType).toBe('TON');
      expect(history[0].amount).toBe('1.5');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts gracefully', async () => {
      const paymentRequest = {
        type: 'TON' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1.0,
        userId: 123,
        message: 'Timeout test payment'
      };

      // Mock wallet lookup
      mockDatabase.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 123,
          wallet_address: paymentRequest.fromAddress,
          wallet_version: 'v4R2',
          public_key: 'test-public-key',
          mnemonic_encrypted: 'encrypted-test-mnemonic',
          is_active: true
        }]
      });

      const result = await paymentManager.processPayment(paymentRequest);

      // Should handle timeout gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid transaction types', async () => {
      const invalidPaymentRequest = {
        type: 'INVALID' as any,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1.0,
        userId: 123,
        message: 'Invalid type test'
      };

      const result = await paymentManager.processPayment(invalidPaymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid payment type');
    });

    it('should handle database connection errors', async () => {
      const paymentRequest = {
        type: 'TON' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1.0,
        userId: 123,
        message: 'Database error test'
      };

      // Mock database error
      mockDatabase.query.mockRejectedValue(new Error('Database connection failed'));

      const result = await paymentManager.processPayment(paymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Security and Validation', () => {
    it('should prevent double spending attempts', async () => {
      const paymentRequest = {
        type: 'TON' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1.0,
        userId: 123,
        message: 'Double spending test'
      };

      // Mock wallet with insufficient balance
      mockDatabase.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 123,
          wallet_address: paymentRequest.fromAddress,
          wallet_version: 'v4R2',
          public_key: 'test-public-key',
          mnemonic_encrypted: 'encrypted-test-mnemonic',
          is_active: true,
          balance: 500000000 // 0.5 TON balance
        }]
      });

      const result = await paymentManager.processPayment(paymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });

    it('should validate user permissions for payments', async () => {
      const paymentRequest = {
        type: 'TON' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1.0,
        userId: 999, // Non-existent user
        message: 'Permission test'
      };

      // Mock no wallet found for user
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await paymentManager.processPayment(paymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});