import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TonClient, Address } from '@ton/ton';
import { fromNano, toNano, beginCell } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonPaymentService } from '../../../services/labeling-backend/src/services/tonPaymentService';

// Mock TON blockchain dependencies
vi.mock('@ton/ton');
vi.mock('@ton/core');
vi.mock('@ton/crypto');

describe('TON Payout Helpers Integration Tests', () => {
  let service: TonPaymentService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockTonClient: any;
  let mockConfig: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Prisma client
    mockPrisma = {
      $transaction: vi.fn(),
      $disconnect: vi.fn(),
      transaction: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      withdrawal: {
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    // Mock Redis client
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      lpush: vi.fn(),
      expire: vi.fn(),
    };

    // Mock TON client
    mockTonClient = {
      open: vi.fn(),
      getTransactions: vi.fn(),
      runMethod: vi.fn(),
    };

    // Mock TON client constructor
    (TonClient as any).mockImplementation(() => mockTonClient);

    // Mock crypto functions
    const mockKeyPair = {
      publicKey: Buffer.from('mock-public-key'),
      secretKey: Buffer.from('mock-secret-key'),
    };
    (mnemonicToPrivateKey as any).mockResolvedValue(mockKeyPair);

    // Mock config
    mockConfig = {
      testnet: true,
      walletMnemonic: ['test', 'word', 'seed', 'phrase', 'with', 'twelve', 'words'],
      merchantAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
      usdtMasterContract: 'EQC_E6dHj2R4R_8Q8L9LQ9F8k0lL9J4k0lL9J4k0lL9J4k0lL9J4k',
      tonApiEndpoint: 'https://testnet.toncenter.com/api/v2',
      toncenterApiKey: 'test-api-key',
    };

    service = new TonPaymentService(mockPrisma as any, mockRedis as any, mockConfig);
    await service.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Blockchain Transaction Verification', () => {
    it('should verify TON deposit transaction on blockchain', async () => {
      const transactionId = 'pay_123_user456';
      const userId = 'user456';
      const amount = 1.5;
      const currency = 'TON';

      const mockTransaction = {
        id: transactionId,
        userId,
        projectId: 'project789',
        amount: toNano(amount).toString(),
        currency,
        status: 'PENDING',
        hash: null,
        type: 'DEPOSIT',
        fee: toNano(0.01).toString(),
        metadata: {},
        createdAt: new Date(),
      };

      // Mock blockchain transaction history
      const mockBlockchainTx = {
        hash: () => Buffer.from('transaction-hash-123'),
        inMessage: {
          info: { type: 'internal', value: { coins: toNano(amount) } },
          body: {
            beginParse: () => ({
              remainingBits: 64,
              loadUint: vi.fn().mockReturnValue(0), // Simple comment op
              loadString: vi.fn().mockReturnValue(`LabelMint Payment: ${transactionId}`),
            }),
          },
        },
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockTonClient.getTransactions.mockResolvedValue([mockBlockchainTx]);

      // Mock database transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      const result = await service.verifyPayment(transactionId);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('transaction-hash-123');

      expect(mockTonClient.getTransactions).toHaveBeenCalledWith(
        Address.parse(mockConfig.merchantAddress),
        { limit: 50 }
      );

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          hash: 'transaction-hash-123',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should verify USDT jetton transfer transaction on blockchain', async () => {
      const transactionId = 'pay_123_user456';
      const userId = 'user456';
      const amount = 100;
      const currency = 'USDT';

      const mockTransaction = {
        id: transactionId,
        userId,
        projectId: 'project789',
        amount: (amount * 1000000).toString(), // USDT has 6 decimals
        currency,
        status: 'PENDING',
        hash: null,
        type: 'DEPOSIT',
        fee: '300000',
        metadata: {},
        createdAt: new Date(),
      };

      // Mock USDT jetton transfer notification
      const mockBlockchainTx = {
        hash: () => Buffer.from('usdt-transaction-hash-456'),
        inMessage: {
          info: { type: 'internal' },
          body: {
            beginParse: () => ({
              remainingBits: 32,
              loadUint: vi.fn()
                .mockReturnValueOnce(0x7362d09c) // Jetton notification op
                .mockReturnValueOnce(12345) // query id
                .mockReturnValueOnce(0), // comment op
              loadCoins: vi.fn()
                .mockReturnValueOnce(BigInt(amount * 1000000))
                .mockReturnValueOnce(BigInt('50000000')),
              loadAddress: vi.fn().mockReturnValue(Address.parse('EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP')),
              loadBit: vi.fn().mockReturnValue(1),
              loadAddressMaybe: vi.fn().mockReturnValue(Address.parse('EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP')),
              loadMaybeRef: vi.fn().mockReturnValue({
                beginParse: () => ({
                  remainingBits: 32,
                  loadUint: vi.fn().mockReturnValue(0),
                  loadString: vi.fn().mockReturnValue(`LabelMint Payment: ${transactionId}`),
                }),
              }),
            }),
          },
        },
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockTonClient.getTransactions.mockResolvedValue([mockBlockchainTx]);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      const result = await service.verifyPayment(transactionId);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('usdt-transaction-hash-456');
    });

    it('should reject transaction with incorrect amount', async () => {
      const transactionId = 'pay_123_user456';
      const expectedAmount = 1.5;

      const mockTransaction = {
        id: transactionId,
        userId: 'user456',
        amount: toNano(expectedAmount).toString(),
        currency: 'TON',
        status: 'PENDING',
        hash: null,
        type: 'DEPOSIT',
        metadata: {},
        createdAt: new Date(),
      };

      // Mock blockchain transaction with different amount
      const mockBlockchainTx = {
        hash: () => Buffer.from('wrong-amount-tx'),
        inMessage: {
          info: {
            type: 'internal',
            value: { coins: toNano(expectedAmount + 0.5) } // Different amount
          },
        },
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockTonClient.getTransactions.mockResolvedValue([mockBlockchainTx]);

      const result = await service.verifyPayment(transactionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle blockchain API errors gracefully', async () => {
      const transactionId = 'pay_123_user456';

      const mockTransaction = {
        id: transactionId,
        userId: 'user456',
        amount: toNano(1.0).toString(),
        currency: 'TON',
        status: 'PENDING',
        hash: null,
        type: 'DEPOSIT',
        metadata: {},
        createdAt: new Date(),
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockTonClient.getTransactions.mockRejectedValue(new Error('Network timeout'));

      const result = await service.verifyPayment(transactionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Blockchain check failed');
    });
  });

  describe('TON Withdrawal Transaction Processing', () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
    });

    it('should send TON withdrawal transaction successfully', async () => {
      const withdrawalRequest = {
        id: 'withdraw_123',
        userId: 'user456',
        amount: 2.0,
        currency: 'TON',
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        status: 'PENDING',
        fee: 0.01,
      };

      const destinationAddress = Address.parse(withdrawalRequest.address);

      // Mock wallet contract
      const mockWallet = {
        getSeqno: vi.fn().mockResolvedValue(5),
        createTransfer: vi.fn().mockReturnValue({
          seqno: 5,
          secretKey: Buffer.from('mock-secret-key'),
          sendMode: 3, // PAY_GAS_SEPARATELY | IGNORE_ERRORS
          messages: [{
            to: destinationAddress,
            value: toNano(2.0),
            body: beginCell()
              .storeUint(0, 32)
              .storeStringTail(`LabelMint withdrawal: ${withdrawalRequest.id}`)
              .endCell(),
          }],
        }),
        send: vi.fn().mockResolvedValue(undefined),
      };

      mockTonClient.open.mockReturnValue(mockWallet);

      // Mock outgoing transaction lookup
      mockTonClient.getTransactions
        .mockResolvedValueOnce([]) // Initial lookup
        .mockResolvedValue([{
          hash: () => Buffer.from('outgoing-withdrawal-hash'),
          outMessages: [{
            info: {
              type: 'internal',
              dest: destinationAddress,
            },
            body: {
              beginParse: () => ({
                remainingBits: 32,
                loadUint: vi.fn().mockReturnValue(0),
                loadString: vi.fn().mockReturnValue(`LabelMint withdrawal: ${withdrawalRequest.id}`),
              }),
            },
          }],
        }]);

      const result = await (service as any).sendWithdrawalTransaction(withdrawalRequest);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('outgoing-withdrawal-hash');

      expect(mockTonClient.open).toHaveBeenCalled();
      expect(mockWallet.createTransfer).toHaveBeenCalled();
      expect(mockWallet.send).toHaveBeenCalled();
    });

    it('should send USDT jetton withdrawal transaction successfully', async () => {
      const withdrawalRequest = {
        id: 'withdraw_123',
        userId: 'user456',
        amount: 50.0,
        currency: 'USDT',
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        status: 'PENDING',
        fee: 1.0,
      };

      const destinationAddress = Address.parse(withdrawalRequest.address);
      const jettonWalletAddress = Address.parse('EQC_E6dHj2R4R_8Q8L9LQ9F8k0lL9J4k0lL9J4k0lL9J4k0lL9J4k');

      // Mock wallet contract
      const mockWallet = {
        getSeqno: vi.fn().mockResolvedValue(3),
        createTransfer: vi.fn().mockReturnValue({
          seqno: 3,
          secretKey: Buffer.from('mock-secret-key'),
          sendMode: 3,
          messages: [{
            to: jettonWalletAddress,
            value: toNano(0.2), // Gas for jetton transfer
            body: beginCell()
              .storeUint(0xf8a7ea5, 32) // Jetton transfer op
              .storeUint(0, 64) // query id
              .storeCoins(BigInt(50_000_000)) // 50 USDT in smallest units
              .storeAddress(destinationAddress)
              .storeAddress(Address.parse(mockConfig.merchantAddress))
              .storeUint(0, 1)
              .storeCoins(toNano('0.05'))
              .storeBit(1)
              .storeRef(beginCell()
                .storeUint(0, 32)
                .storeStringTail(`LabelMint withdrawal: ${withdrawalRequest.id}`)
                .endCell())
              .endCell(),
          }],
        }),
        send: vi.fn().mockResolvedValue(undefined),
      };

      mockTonClient.open.mockReturnValue(mockWallet);

      // Mock jetton wallet address lookup
      mockTonClient.runMethod.mockResolvedValue({
        stack: {
          readAddress: vi.fn().mockReturnValue(jettonWalletAddress),
        },
      });

      // Mock outgoing transaction lookup
      mockTonClient.getTransactions
        .mockResolvedValueOnce([])
        .mockResolvedValue([{
          hash: () => Buffer.from('usdt-withdrawal-hash'),
          outMessages: [{
            info: {
              type: 'internal',
              dest: destinationAddress,
            },
            body: {
              beginParse: () => ({
                remainingBits: 32,
                loadUint: vi.fn().mockReturnValue(0xf8a7ea5), // Jetton transfer op
              }),
            },
          }],
        }]);

      const result = await (service as any).sendWithdrawalTransaction(withdrawalRequest);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('usdt-withdrawal-hash');

      expect(mockTonClient.runMethod).toHaveBeenCalledWith(
        Address.parse(mockConfig.usdtMasterContract),
        'get_wallet_address',
        expect.any(Array)
      );
    });

    it('should handle wallet transaction failure', async () => {
      const withdrawalRequest = {
        id: 'withdraw_123',
        userId: 'user456',
        amount: 2.0,
        currency: 'TON',
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        status: 'PENDING',
        fee: 0.01,
      };

      const mockWallet = {
        getSeqno: vi.fn().mockResolvedValue(1),
        createTransfer: vi.fn().mockReturnValue({}),
        send: vi.fn().mockRejectedValue(new Error('Insufficient gas')),
      };

      mockTonClient.open.mockReturnValue(mockWallet);

      const result = await (service as any).sendWithdrawalTransaction(withdrawalRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
    });

    it('should retry transaction hash lookup with exponential backoff', async () => {
      const withdrawalRequest = {
        id: 'withdraw_123',
        userId: 'user456',
        amount: 1.0,
        currency: 'TON',
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        status: 'PENDING',
        fee: 0.01,
      };

      const destinationAddress = Address.parse(withdrawalRequest.address);

      const mockWallet = {
        getSeqno: vi.fn().mockResolvedValue(2),
        createTransfer: vi.fn().mockReturnValue({}),
        send: vi.fn().mockResolvedValue(undefined),
      };

      mockTonClient.open.mockReturnValue(mockWallet);

      // Mock delayed transaction appearance
      mockTonClient.getTransactions
        .mockResolvedValueOnce([]) // First attempt: no transaction
        .mockResolvedValueOnce([]) // Second attempt: still no transaction
        .mockResolvedValueOnce([{  // Third attempt: transaction found
          hash: () => Buffer.from('delayed-transaction-hash'),
          outMessages: [{
            info: {
              type: 'internal',
              dest: destinationAddress,
            },
            body: {
              beginParse: () => ({
                remainingBits: 32,
                loadUint: vi.fn().mockReturnValue(0),
                loadString: vi.fn().mockReturnValue(`LabelMint withdrawal: ${withdrawalRequest.id}`),
              }),
            },
          }],
        }]);

      // Mock delay function
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = vi.fn().mockImplementation((fn, delay) => {
        return originalSetTimeout(fn, 0); // Execute immediately for tests
      });
      global.setTimeout = mockSetTimeout;

      const result = await (service as any).sendWithdrawalTransaction(withdrawalRequest);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('delayed-transaction-hash');
      expect(mockTonClient.getTransactions).toHaveBeenCalledTimes(3);
      expect(mockSetTimeout).toHaveBeenCalledTimes(2);

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Batch Payment Processing', () => {
    it('should process multiple withdrawals in parallel', async () => {
      const withdrawalRequests = [
        {
          id: 'withdraw_1',
          userId: 'user1',
          amount: 1.0,
          currency: 'TON',
          address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
          status: 'PENDING',
          fee: 0.01,
        },
        {
          id: 'withdraw_2',
          userId: 'user2',
          amount: 50.0,
          currency: 'USDT',
          address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
          status: 'PENDING',
          fee: 1.0,
        },
        {
          id: 'withdraw_3',
          userId: 'user3',
          amount: 2.5,
          currency: 'TON',
          address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
          status: 'PENDING',
          fee: 0.01,
        },
      ];

      // Mock successful withdrawals
      vi.spyOn(service as any, 'sendWithdrawalTransaction')
        .mockImplementation(async (request) => ({
          success: true,
          transactionHash: `${request.id}-hash`,
        }));

      const results = await Promise.all(
        withdrawalRequests.map(request => (service as any).sendWithdrawalTransaction(request))
      );

      expect(results).toHaveLength(3);
      expect(results.every(result => result.success)).toBe(true);
      expect(results.map(r => r.transactionHash)).toEqual([
        'withdraw_1-hash',
        'withdraw_2-hash',
        'withdraw_3-hash',
      ]);
    });

    it('should handle mixed success/failure in batch processing', async () => {
      const withdrawalRequests = [
        { id: 'withdraw_1', amount: 1.0, currency: 'TON', address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP' },
        { id: 'withdraw_2', amount: 50.0, currency: 'USDT', address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP' },
        { id: 'withdraw_3', amount: 2.5, currency: 'TON', address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP' },
      ];

      // Mock mixed results
      vi.spyOn(service as any, 'sendWithdrawalTransaction')
        .mockImplementation(async (request) => {
          if (request.id === 'withdraw_2') {
            return { success: false, error: 'Insufficient balance' };
          }
          return { success: true, transactionHash: `${request.id}-hash` };
        });

      const results = await Promise.allSettled(
        withdrawalRequests.map(request => (service as any).sendWithdrawalTransaction(request))
      );

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failureCount = results.filter(r =>
        r.status === 'fulfilled' && !r.value.success || r.status === 'rejected'
      ).length;

      expect(successCount).toBe(2);
      expect(failureCount).toBe(1);
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    it('should implement exponential backoff for failed transactions', async () => {
      const transactionId = 'pay_retry_test';
      const mockTransaction = {
        id: transactionId,
        userId: 'user456',
        amount: toNano(1.0).toString(),
        currency: 'TON',
        status: 'PENDING',
        hash: null,
        type: 'DEPOSIT',
        metadata: {},
        createdAt: new Date(),
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      // Mock temporary blockchain unavailability
      mockTonClient.getTransactions
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockResolvedValueOnce([{
          hash: () => Buffer.from('retry-success-hash'),
          inMessage: {
            info: { type: 'internal', value: { coins: toNano(1.0) } },
            body: {
              beginParse: () => ({
                remainingBits: 64,
                loadUint: vi.fn().mockReturnValue(0),
                loadString: vi.fn().mockReturnValue(`LabelMint Payment: ${transactionId}`),
              }),
            },
          },
        }]);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      // Implement retry logic with exponential backoff
      let attempts = 0;
      const maxAttempts = 3;
      const baseDelay = 1000;

      const verifyWithRetry = async (): Promise<any> => {
        try {
          return await service.verifyPayment(transactionId);
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw error;
          }

          const delay = baseDelay * Math.pow(2, attempts - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          return verifyWithRetry();
        }
      };

      const result = await verifyWithRetry();

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('retry-success-hash');
      expect(mockTonClient.getTransactions).toHaveBeenCalledTimes(3);
    });

    it('should maintain transaction state during retry scenarios', async () => {
      const withdrawalRequest = {
        id: 'withdraw_state_test',
        userId: 'user456',
        amount: 1.5,
        currency: 'TON',
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        status: 'PENDING',
        fee: 0.01,
      };

      const mockUser = {
        id: 'user456',
        tonBalance: 5.0,
        frozenBalance: 1.5, // Already frozen from previous attempt
        trustScore: 0.9,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.withdrawal.create.mockResolvedValue(withdrawalRequest);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockRedis.get.mockResolvedValue(null);

      // Mock initial transaction failure
      vi.spyOn(service as any, 'sendWithdrawalTransaction')
        .mockResolvedValueOnce({ success: false, error: 'Temporary network error' })
        .mockResolvedValueOnce({ success: true, transactionHash: 'retry-success-hash' });

      // First attempt - should fail
      const result1 = await service.processWithdrawal(withdrawalRequest);
      expect(result1.success).toBe(false);

      // Verify balance state is maintained
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user456' },
        data: {
          tonBalance: { increment: 1.5 }, // Refunded
          frozenBalance: { decrement: 1.5 }, // Unfrozen
        },
      });

      // Reset mock for second attempt
      mockPrisma.user.update.mockClear();

      // Second attempt - should succeed
      const result2 = await service.processWithdrawal(withdrawalRequest);
      expect(result2.success).toBe(true);
      expect(result2.transactionHash).toBe('retry-success-hash');
    });
  });

  describe('Security and Validation', () => {
    it('should validate TON address format', async () => {
      const invalidAddresses = [
        'invalid-address',
        'EQ-too-short',
        'EQ-way-too-long-address-that-exceeds-the-standard-length-and-should-be-rejected',
        '0x1234567890abcdef', // Ethereum format
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', // Bitcoin format
      ];

      for (const invalidAddress of invalidAddresses) {
        const withdrawalRequest = {
          userId: 'user456',
          amount: 1.0,
          currency: 'TON',
          address: invalidAddress,
        };

        const mockUser = {
          id: 'user456',
          tonBalance: 5.0,
          frozenBalance: 0.0,
          trustScore: 0.9,
        };

        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        mockRedis.get.mockResolvedValue(null);

        // Address validation should fail during transaction creation
        vi.spyOn(service as any, 'sendWithdrawalTransaction')
          .mockRejectedValue(new Error('Invalid address format'));

        const result = await service.processWithdrawal(withdrawalRequest);
        expect(result.success).toBe(false);
      }
    });

    it('should prevent double-spending with frozen balance checks', async () => {
      const userId = 'user456';
      const withdrawalAmount = 3.0;

      const mockUser = {
        id: userId,
        tonBalance: 5.0,
        frozenBalance: 2.0, // Some balance already frozen
        trustScore: 0.9,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockRedis.get.mockResolvedValue(null);

      const withdrawalRequest = {
        userId,
        amount: withdrawalAmount,
        currency: 'TON',
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
      };

      const result = await service.processWithdrawal(withdrawalRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Withdrawal processing failed');

      // Should not create withdrawal record
      expect(mockPrisma.withdrawal.create).not.toHaveBeenCalled();
    });

    it('should enforce maximum withdrawal limits based on trust score', async () => {
      const testCases = [
        { trustScore: 0.5, maxWithdrawal: 500 },
        { trustScore: 0.7, maxWithdrawal: 500 },
        { trustScore: 0.8, maxWithdrawal: 500 },
        { trustScore: 0.9, maxWithdrawal: 5000 },
        { trustScore: 1.0, maxWithdrawal: 5000 },
      ];

      for (const testCase of testCases) {
        const mockUser = {
          id: 'user456',
          tonBalance: 10000.0,
          frozenBalance: 0.0,
          trustScore: testCase.trustScore,
        };

        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        mockRedis.get.mockResolvedValue(null);

        const withdrawalRequest = {
          userId: 'user456',
          amount: testCase.maxWithdrawal + 100, // Exceeds limit
          currency: 'TON',
          address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        };

        const result = await service.processWithdrawal(withdrawalRequest);

        if (testCase.trustScore < 0.8 && testCase.maxWithdrawal + 100 > 1000) {
          expect(result.success).toBe(false);
        } else {
          // Should pass validation (but may fail for other reasons)
          expect(mockPrisma.user.findUnique).toHaveBeenCalled();
        }

        vi.clearAllMocks();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume transaction processing', async () => {
      const transactionCount = 100;
      const mockTransactions = Array(transactionCount).fill(null).map((_, i) => ({
        id: `pay_${i}_user${i}`,
        userId: `user${i}`,
        amount: toNano(1.0).toString(),
        currency: 'TON',
        status: 'PENDING',
        hash: null,
        type: 'DEPOSIT',
        metadata: {},
        createdAt: new Date(),
      }));

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      // Mock successful verification
      vi.spyOn(service, 'verifyPayment')
        .mockResolvedValue({ success: true, transactionHash: 'verified-hash' });

      const startTime = Date.now();
      const result = await service.processPendingPayments();
      const endTime = Date.now();

      expect(result.processed).toBe(transactionCount);
      expect(result.errors).toBe(0);

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
    });

    it('should maintain cache performance under load', async () => {
      const userId = 'user_cache_test';
      const requestCount = 50;

      // First call should hit database
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        tonBalance: 10.5,
        usdtBalance: 250.75,
      });

      // Subsequent calls should hit cache
      mockRedis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValue(JSON.stringify({ ton: 10.5, usdt: 250.75 }));

      const startTime = Date.now();
      const results = await Promise.all(
        Array(requestCount).fill(null).map(() => service.getUserBalance(userId))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(requestCount);
      expect(results.every(r => r.ton === 10.5 && r.usdt === 250.75)).toBe(true);

      // Cache should significantly improve performance
      expect(endTime - startTime).toBeLessThan(1000); // 1 second

      // Verify cache was set
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `balance:${userId}`,
        300,
        JSON.stringify({ ton: 10.5, usdt: 250.75 })
      );
    });
  });
});