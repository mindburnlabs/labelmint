import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaymentManager } from '../services/payment-backend/src/services/payment/PaymentManager';
import { TonWalletStrategy } from '../services/payment-backend/src/services/payment/strategies/TonWalletStrategy';
import { UsdtStrategy } from '../services/payment-backend/src/services/payment/strategies/UsdtStrategy';
import { postgresDb } from '../services/payment-backend/src/database';

// Mock dependencies
vi.mock('../services/payment-backend/src/database');
vi.mock('@ton/ton');
vi.mock('@ton/crypto');

describe('Payment System Integration Tests', () => {
  let paymentManager: PaymentManager;
  let mockPostgresDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database
    mockPostgresDb = {
      query: vi.fn(),
      $transaction: vi.fn(),
    };
    (postgresDb as any) = mockPostgresDb;

    // Initialize payment manager with test config
    paymentManager = new PaymentManager({
      network: 'testnet',
      enableValidation: true,
      enableCaching: true,
      defaultFeeMultiplier: 1.0,
      maxRetries: 3,
      timeoutMs: 30000
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete TON Payment Workflow', () => {
    it('should process a complete TON payment workflow end-to-end', async () => {
      const paymentRequest = {
        type: 'TON' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1.5,
        userId: 123,
        message: 'Integration test payment'
      };

      // Mock wallet lookup
      mockPostgresDb.query.mockResolvedValue({
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

      // Mock successful transaction
      vi.mocked(require('@ton/ton').TonClient.prototype.external).mockResolvedValue('0x1234567890abcdef');

      // Mock balance check
      vi.mocked(require('@ton/ton').TonClient.prototype.getBalance).mockResolvedValue(BigInt('2000000000')); // 2 TON

      // Process the payment
      const result = await paymentManager.processPayment(paymentRequest);

      // Verify the payment was processed successfully
      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction.fromAddress).toBe(paymentRequest.fromAddress);
      expect(result.transaction.toAddress).toBe(paymentRequest.toAddress);
      expect(result.transaction.amount).toBe(paymentRequest.amount.toString());
      expect(result.transaction.tokenType).toBe('TON');
      expect(result.transaction.status).toBe('pending');

      // Verify transaction was stored in database
      expect(mockPostgresDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        expect.arrayContaining([
          expect.any(String), // hash
          paymentRequest.fromAddress,
          paymentRequest.toAddress,
          expect.any(String), // amount in nanotons
          'TON',
          expect.any(String), // fee
          'pending',
          paymentRequest.message
        ])
      );
    });

    it('should handle insufficient balance scenario in TON payment', async () => {
      const paymentRequest = {
        type: 'TON' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 100, // Very high amount
        userId: 123,
        message: 'Test insufficient balance'
      };

      // Mock wallet lookup
      mockPostgresDb.query.mockResolvedValue({
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

      // Mock low balance
      vi.mocked(require('@ton/ton').TonClient.prototype.getBalance).mockResolvedValue(BigInt('1000000000')); // 1 TON

      // Process the payment (should fail)
      const result = await paymentManager.processPayment(paymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
      expect(result.errorCode).toBe('PROCESSING_FAILED');
    });
  });

  describe('Complete USDT Payment Workflow', () => {
    it('should process a complete USDT payment workflow end-to-end', async () => {
      const paymentRequest = {
        type: 'USDT' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 100, // 100 USDT
        userId: 123,
        message: 'Integration test USDT payment'
      };

      // Mock wallet lookup
      mockPostgresDb.query.mockResolvedValue({
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

      // Mock TON balance for gas fees
      vi.mocked(require('@ton/ton').TonClient.prototype.getBalance).mockResolvedValue(BigInt('500000000')); // 0.5 TON

      // Mock USDT balance check
      vi.mocked(require('@ton/ton').TonClient.prototype.runMethod).mockResolvedValue({
        stack: {
          readBigNumber: vi.fn().mockReturnValue(BigInt('200000000')) // 200 USDT balance (6 decimals)
        }
      });

      // Mock successful transaction
      vi.mocked(require('@ton/ton').TonClient.prototype.external).mockResolvedValue('0xabcdef1234567890');

      // Process the payment
      const result = await paymentManager.processPayment(paymentRequest);

      // Verify the payment was processed successfully
      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction.fromAddress).toBe(paymentRequest.fromAddress);
      expect(result.transaction.toAddress).toBe(paymentRequest.toAddress);
      expect(result.transaction.amount).toBe(paymentRequest.amount.toString());
      expect(result.transaction.tokenType).toBe('USDT');
      expect(result.transaction.status).toBe('pending');

      // Verify transaction was stored in database
      expect(mockPostgresDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        expect.arrayContaining([
          expect.any(String), // hash
          paymentRequest.fromAddress,
          paymentRequest.toAddress,
          expect.any(String), // amount in nanotons
          'USDT',
          expect.any(String), // fee
          'pending',
          paymentRequest.message
        ])
      );
    });

    it('should handle insufficient USDT balance scenario', async () => {
      const paymentRequest = {
        type: 'USDT' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 500, // 500 USDT
        userId: 123,
        message: 'Test insufficient USDT balance'
      };

      // Mock wallet lookup
      mockPostgresDb.query.mockResolvedValue({
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

      // Mock TON balance for gas fees
      vi.mocked(require('@ton/ton').TonClient.prototype.getBalance).mockResolvedValue(BigInt('500000000')); // 0.5 TON

      // Mock insufficient USDT balance
      vi.mocked(require('@ton/ton').TonClient.prototype.runMethod).mockResolvedValue({
        stack: {
          readBigNumber: vi.fn().mockReturnValue(BigInt('100000000')) // 100 USDT balance (6 decimals)
        }
      });

      // Process the payment (should fail)
      const result = await paymentManager.processPayment(paymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient USDT balance');
      expect(result.errorCode).toBe('PROCESSING_FAILED');
    });
  });

  describe('Batch Payment Processing', () => {
    it('should process batch payments successfully', async () => {
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
      mockPostgresDb.query.mockResolvedValue({
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

      // Mock balances
      vi.mocked(require('@ton/ton').TonClient.prototype.getBalance).mockResolvedValue(BigInt('2000000000')); // 2 TON
      vi.mocked(require('@ton/ton').TonClient.prototype.runMethod).mockResolvedValue({
        stack: {
          readBigNumber: vi.fn().mockReturnValue(BigInt('100000000')) // 100 USDT balance
        }
      });

      // Mock successful transactions
      vi.mocked(require('@ton/ton').TonClient.prototype.external).mockResolvedValue('0x1234567890abcdef');

      // Process batch payment
      const result = await paymentManager.processBatchPayments(batchRequest);

      expect(result.results).toHaveLength(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(0);
      expect(result.summary.totalAmount).toBe(51); // 1 TON + 50 USDT

      // All payments should be successful
      result.results.forEach((paymentResult, index) => {
        expect(paymentResult.success).toBe(true);
        expect(paymentResult.transaction).toBeDefined();
        expect(paymentResult.transaction.tokenType).toBe(batchRequest.payments[index].type);
      });
    });
  });

  describe('Transaction Status and History', () => {
    it('should check transaction status for both TON and USDT', async () => {
      const tonTxHash = '0x1234567890abcdef';
      const usdtTxHash = '0xabcdef1234567890';

      // Mock transaction lookup
      mockPostgresDb.query
        .mockResolvedValueOnce({
          rows: [{
            hash: tonTxHash,
            from_address: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
            to_address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
            amount: '1500000000', // 1.5 TON in nanotons
            token_type: 'TON',
            fee: '6000000', // fee in nanotons
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
            fee: '200000', // fee in nanotons
            status: 'pending',
            timestamp: new Date(),
            block_number: null
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
      expect(usdtResult.status).toBe('pending');
    });

    it('should retrieve transaction history', async () => {
      const address = 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF';

      // Mock transaction history
      mockPostgresDb.query.mockResolvedValue({
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
      expect(history[0].amount).toBe('1.5'); // Converted from nanotons
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid addresses gracefully', async () => {
      const invalidPaymentRequest = {
        type: 'TON' as const,
        fromAddress: 'invalid-address',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1.0,
        userId: 123
      };

      const result = await paymentManager.processPayment(invalidPaymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle network timeouts and retries', async () => {
      const paymentRequest = {
        type: 'TON' as const,
        fromAddress: 'EQDA5Z8HHHiKbZxhTqJKkFvQRfq8rhxBuC6hncmjhA3eSKqF',
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        amount: 1.0,
        userId: 123
      };

      // Mock wallet lookup
      mockPostgresDb.query.mockResolvedValue({
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

      // Mock network timeout
      const externalMock = vi.mocked(require('@ton/ton').TonClient.prototype.external);
      externalMock
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout')) // All retries fail
        .mockResolvedValue('0x1234567890abcdef'); // Would succeed on 4th attempt but we only have 3 retries

      const result = await paymentManager.processPayment(paymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
      expect(result.errorCode).toBe('PROCESSING_FAILED');

      // Should have attempted 4 times (1 initial + 3 retries)
      expect(externalMock).toHaveBeenCalledTimes(4);
    });
  });
});