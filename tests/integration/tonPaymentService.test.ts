import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TonPaymentService } from '../../../services/labeling-backend/src/services/tonPaymentService';
import { PrismaClient } from '@prisma/client';
import { RedisClient } from '../../../services/labeling-backend/src/lib/redis';
import { createMockWallet, createMockTransaction, createMockJettonTransfer, TON_TESTNET_ENDPOINTS } from '../../mocks/ton.mock';

// Mock dependencies
vi.mock('@prisma/client');
vi.mock('../../../services/labeling-backend/src/lib/redis');
vi.mock('../../../services/labeling-backend/src/utils/logger');

describe('TonPaymentService', () => {
  let service: TonPaymentService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
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
      project: {
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

    // Mock config
    mockConfig = {
      testnet: true,
      walletMnemonic: ['test', 'word', 'seed', 'phrase', 'with', 'twelve', 'words'],
      merchantAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
      usdtMasterContract: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
      tonApiEndpoint: 'https://testnet.toncenter.com/api/v2',
      toncenterApiKey: 'test-api-key',
    };

    // Create service instance
    service = new TonPaymentService(mockPrisma as any, mockRedis as any, mockConfig);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      // Mock TON client methods
      vi.doMock('@ton/ton', () => ({
        TonClient: vi.fn().mockImplementation(() => ({
          open: vi.fn().mockReturnValue({
            getSeqno: vi.fn().mockResolvedValue(0),
          }),
        })),
        WalletContractV4: {
          create: vi.fn().mockReturnValue({
            address: { toString: () => mockConfig.merchantAddress },
          }),
        },
      }));

      vi.doMock('@ton/crypto', () => ({
        mnemonicToPrivateKey: vi.fn().mockResolvedValue({
          publicKey: Buffer.from('public-key'),
          secretKey: Buffer.from('secret-key'),
        }),
      }));

      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should throw error with invalid mnemonic', async () => {
      const invalidConfig = { ...mockConfig, walletMnemonic: [] };
      const invalidService = new TonPaymentService(mockPrisma, mockRedis, invalidConfig);

      vi.doMock('@ton/crypto', () => ({
        mnemonicToPrivateKey: vi.fn().mockRejectedValue(new Error('Invalid mnemonic')),
      }));

      await expect(invalidService.initialize()).rejects.toThrow('Invalid mnemonic');
    });
  });

  describe('createPaymentTransaction', () => {
    beforeEach(() => {
      // Mock database transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
    });

    it('should create a TON payment transaction successfully', async () => {
      const userId = 'user123';
      const projectId = 'project456';
      const amount = 1.5;
      const currency = 'TON';

      const mockTransaction = {
        id: 'pay_123_user123',
        userId,
        projectId,
        type: 'DEPOSIT',
        amount: '1500000000', // 1.5 TON in nanotons
        currency,
        fee: '10000000', // 0.01 TON fee
        status: 'PENDING',
        description: `Funding project ${projectId}`,
        metadata: {
          paymentUrl: expect.any(String),
        },
      };

      mockPrisma.transaction.create.mockResolvedValue(mockTransaction);
      mockRedis.get.mockResolvedValue(null); // No rate limit

      const result = await service.createPaymentTransaction(userId, projectId, amount, currency);

      expect(result).toEqual({
        paymentUrl: expect.any(String),
        transactionId: mockTransaction.id,
      });

      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.stringMatching(/^pay_\d+_user123$/),
          userId,
          projectId,
          type: 'DEPOSIT',
          amount: '1500000000',
          currency: 'TON',
          fee: '10000000',
          status: 'PENDING',
        }),
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'rate_limit:user123',
        30,
        '1'
      );
    });

    it('should create a USDT payment transaction successfully', async () => {
      const userId = 'user123';
      const projectId = 'project456';
      const amount = 100;
      const currency = 'USDT';

      const mockTransaction = {
        id: 'pay_123_user123',
        userId,
        projectId,
        type: 'DEPOSIT',
        amount: '100000000', // 100 USDT with 6 decimals
        currency,
        fee: '300000', // Fixed fee for USDT
        status: 'PENDING',
        description: `Funding project ${projectId}`,
        metadata: {
          paymentUrl: expect.any(String),
        },
      };

      mockPrisma.transaction.create.mockResolvedValue(mockTransaction);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.createPaymentTransaction(userId, projectId, amount, currency);

      expect(result).toEqual({
        paymentUrl: expect.any(String),
        transactionId: mockTransaction.id,
      });

      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: '100000000', // 100 * 1,000,000 (6 decimals)
          currency: 'USDT',
          fee: '300000',
        }),
      });
    });

    it('should enforce rate limiting', async () => {
      const userId = 'user123';
      mockRedis.get.mockResolvedValue('1'); // Rate limit active

      await expect(
        service.createPaymentTransaction(userId, 'project456', 1.0, 'TON')
      ).rejects.toThrow('Rate limit exceeded');

      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('should handle database transaction timeout', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction timeout'));

      await expect(
        service.createPaymentTransaction('user123', 'project456', 1.0, 'TON')
      ).rejects.toThrow('Transaction timeout');
    });

    it('should create audit log entry', async () => {
      const mockTransaction = {
        id: 'pay_123_user123',
        userId: 'user123',
        projectId: 'project456',
      };

      mockPrisma.transaction.create.mockResolvedValue(mockTransaction);
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockRedis.get.mockResolvedValue(null);

      await service.createPaymentTransaction('user123', 'project456', 1.0, 'TON');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'Transaction',
          entityId: mockTransaction.id,
          action: 'CREATE',
          oldValues: null,
          newValues: expect.any(String),
          userId: 'user123',
          ipAddress: 'SYSTEM',
          userAgent: 'PAYMENT_SERVICE',
        },
      });
    });
  });

  describe('verifyPayment', () => {
    beforeEach(() => {
      // Mock database transaction for verification
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
    });

    it('should verify completed transaction successfully', async () => {
      const transactionId = 'pay_123_user123';
      const mockTransaction = {
        id: transactionId,
        userId: 'user123',
        projectId: 'project456',
        amount: '1500000000',
        currency: 'TON',
        status: 'COMPLETED',
        hash: '0x123abc',
        type: 'DEPOSIT',
        fee: '10000000',
        metadata: {},
        createdAt: new Date(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockTransaction));

      const result = await service.verifyPayment(transactionId);

      expect(result).toEqual({
        success: true,
        transactionHash: '0x123abc',
      });
    });

    it('should return error for non-existent transaction', async () => {
      const transactionId = 'nonexistent';
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      const result = await service.verifyPayment(transactionId);

      expect(result).toEqual({
        success: false,
        error: 'Transaction not found',
      });
    });

    it('should check blockchain for pending transaction', async () => {
      const transactionId = 'pay_123_user123';
      const mockTransaction = {
        id: transactionId,
        userId: 'user123',
        projectId: 'project456',
        amount: '1500000000',
        currency: 'TON',
        status: 'PENDING',
        hash: null,
        type: 'DEPOSIT',
        fee: '10000000',
        metadata: {},
        createdAt: new Date(),
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      // Mock blockchain check to return success
      const mockBlockchainResult = {
        success: true,
        transactionHash: '0x456def',
      };

      // Mock the private method using spy
      const checkBlockchainSpy = vi.spyOn(service as any, 'checkBlockchainTransaction')
        .mockResolvedValue(mockBlockchainResult);

      mockPrisma.transaction.update.mockResolvedValue({});
      mockPrisma.project.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.verifyPayment(transactionId);

      expect(result).toEqual(mockBlockchainResult);
      expect(checkBlockchainSpy).toHaveBeenCalledWith(mockTransaction);
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          hash: '0x456def',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should update project budget on successful verification', async () => {
      const transactionId = 'pay_123_user123';
      const mockTransaction = {
        id: transactionId,
        userId: 'user123',
        projectId: 'project456',
        amount: '1500000000', // 1.5 TON
        currency: 'TON',
        status: 'PENDING',
        hash: null,
        type: 'DEPOSIT',
        fee: '10000000',
        metadata: {},
        createdAt: new Date(),
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      vi.spyOn(service as any, 'checkBlockchainTransaction')
        .mockResolvedValue({ success: true, transactionHash: '0x456def' });

      mockPrisma.transaction.update.mockResolvedValue({});
      mockPrisma.project.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.verifyPayment(transactionId);

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project456' },
        data: {
          budget: { increment: 1.5 },
          budgetRemaining: { increment: 1.5 },
        },
      });
    });
  });

  describe('processWithdrawal', () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });
    });

    it('should process TON withdrawal successfully', async () => {
      const request = {
        userId: 'user123',
        amount: 2.0,
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        currency: 'TON' as const,
      };

      const mockUser = {
        id: 'user123',
        tonBalance: 5.0,
        usdtBalance: 100.0,
        frozenBalance: 0.0,
        trustScore: 0.9,
      };

      const mockWithdrawal = {
        id: 'withdraw_123',
        userId: 'user123',
        amount: 2.0,
        currency: 'TON',
        address: request.address,
        status: 'PENDING',
        fee: 0.01,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.withdrawal.create.mockResolvedValue(mockWithdrawal);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockRedis.get.mockResolvedValue(null); // No rate limit

      // Mock blockchain transaction
      vi.spyOn(service as any, 'sendWithdrawalTransaction')
        .mockResolvedValue({ success: true, transactionHash: '0x789ghi' });

      const result = await service.processWithdrawal(request);

      expect(result).toEqual({
        success: true,
        transactionHash: '0x789ghi',
      });

      expect(mockPrisma.withdrawal.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          amount: 2.0,
          currency: 'TON',
          address: request.address,
          status: 'PENDING',
          fee: 0.01,
        },
      });

      // Verify balance was frozen
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: {
          tonBalance: { decrement: 2.0 },
          frozenBalance: { increment: 2.0 },
        },
      });
    });

    it('should process USDT withdrawal successfully', async () => {
      const request = {
        userId: 'user123',
        amount: 50.0,
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        currency: 'USDT' as const,
      };

      const mockUser = {
        id: 'user123',
        tonBalance: 5.0,
        usdtBalance: 100.0,
        frozenBalance: 0.0,
        trustScore: 0.9,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.withdrawal.create.mockResolvedValue({ id: 'withdraw_123' });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockRedis.get.mockResolvedValue(null);

      vi.spyOn(service as any, 'sendWithdrawalTransaction')
        .mockResolvedValue({ success: true, transactionHash: '0x789ghi' });

      const result = await service.processWithdrawal(request);

      expect(result.success).toBe(true);

      // Verify USDT balance was frozen
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: {
          usdtBalance: { decrement: 50.0 },
          frozenBalance: { increment: 50.0 },
        },
      });
    });

    it('should reject withdrawal with insufficient balance', async () => {
      const request = {
        userId: 'user123',
        amount: 10.0,
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        currency: 'TON' as const,
      };

      const mockUser = {
        id: 'user123',
        tonBalance: 5.0,
        usdtBalance: 100.0,
        frozenBalance: 2.0, // 2 TON frozen
        trustScore: 0.9,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.processWithdrawal(request);

      expect(result).toEqual({
        success: false,
        error: 'Withdrawal processing failed',
      });

      expect(mockPrisma.withdrawal.create).not.toHaveBeenCalled();
    });

    it('should reject withdrawal exceeding trust score limit', async () => {
      const request = {
        userId: 'user123',
        amount: 1500.0, // High amount
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        currency: 'TON' as const,
      };

      const mockUser = {
        id: 'user123',
        tonBalance: 2000.0,
        usdtBalance: 100.0,
        frozenBalance: 0.0,
        trustScore: 0.7, // Low trust score
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.processWithdrawal(request);

      expect(result).toEqual({
        success: false,
        error: 'Withdrawal processing failed',
      });
    });

    it('should enforce withdrawal rate limiting', async () => {
      const request = {
        userId: 'user123',
        amount: 1.0,
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        currency: 'TON' as const,
      };

      mockRedis.get.mockResolvedValue('1'); // Rate limit active

      const result = await service.processWithdrawal(request);

      expect(result).toEqual({
        success: false,
        error: 'Withdrawal rate limit exceeded',
      });

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should handle withdrawal failure and refund balance', async () => {
      const request = {
        userId: 'user123',
        amount: 2.0,
        address: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        currency: 'TON' as const,
      };

      const mockUser = {
        id: 'user123',
        tonBalance: 5.0,
        usdtBalance: 100.0,
        frozenBalance: 0.0,
        trustScore: 0.9,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.withdrawal.create.mockResolvedValue({ id: 'withdraw_123' });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockRedis.get.mockResolvedValue(null);

      // Mock blockchain transaction failure
      vi.spyOn(service as any, 'sendWithdrawalTransaction')
        .mockResolvedValue({ success: false, error: 'Transaction failed' });

      const result = await service.processWithdrawal(request);

      expect(result).toEqual({
        success: false,
        error: 'Transaction failed',
      });

      // Verify balance was refunded
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: {
          tonBalance: { increment: 2.0 },
          frozenBalance: { decrement: 2.0 },
        },
      });

      // Verify withdrawal status updated to failed
      expect(mockPrisma.withdrawal.update).toHaveBeenCalledWith({
        where: { id: 'withdraw_123' },
        data: {
          status: 'FAILED',
          error: 'Transaction failed',
        },
      });
    });
  });

  describe('getUserBalance', () => {
    it('should return cached balance', async () => {
      const userId = 'user123';
      const cachedBalance = { ton: 5.5, usdt: 125.75 };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedBalance));

      const result = await service.getUserBalance(userId);

      expect(result).toEqual(cachedBalance);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch balance from database when not cached', async () => {
      const userId = 'user123';
      const mockUser = {
        tonBalance: 3.25,
        usdtBalance: 75.5,
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserBalance(userId);

      expect(result).toEqual({
        ton: 3.25,
        usdt: 75.5,
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `balance:${userId}`,
        300, // 5 minutes
        JSON.stringify(result)
      );
    });

    it('should return zero balance for non-existent user', async () => {
      const userId = 'nonexistent';

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserBalance(userId);

      expect(result).toEqual({ ton: 0, usdt: 0 });
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('getTransactionHistory', () => {
    it('should return cached transaction history', async () => {
      const userId = 'user123';
      const options = { type: 'DEPOSIT', limit: 10, offset: 0 };
      const cachedResult = {
        transactions: [
          { id: 'tx1', type: 'DEPOSIT', amount: '1000000000' },
        ],
        total: 1,
        hasMore: false,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.getTransactionHistory(userId, options);

      expect(result).toEqual(cachedResult);
      expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
    });

    it('should fetch transaction history from database', async () => {
      const userId = 'user123';
      const options = { limit: 5, offset: 10 };
      const mockTransactions = [
        { id: 'tx1', type: 'DEPOSIT', amount: '1000000000' },
        { id: 'tx2', type: 'WITHDRAWAL', amount: '500000000' },
      ];

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.transaction.count.mockResolvedValue(15);

      const result = await service.getTransactionHistory(userId, options);

      expect(result).toEqual({
        transactions: mockTransactions,
        total: 15,
        hasMore: false,
      });

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 6, // limit + 1
        skip: 10,
        select: expect.any(Object),
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `transactions:${userId}:${JSON.stringify(options)}`,
        30, // 30 seconds
        JSON.stringify(result)
      );
    });

    it('should handle hasMore correctly', async () => {
      const userId = 'user123';
      const options = { limit: 2 };
      const mockTransactions = [
        { id: 'tx1' },
        { id: 'tx2' },
        { id: 'tx3' }, // Extra transaction to indicate more
      ];

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.transaction.count.mockResolvedValue(10);

      const result = await service.getTransactionHistory(userId, options);

      expect(result.hasMore).toBe(true);
      expect(result.transactions).toHaveLength(2); // Extra one removed
    });

    it('should filter by type and date range', async () => {
      const userId = 'user123';
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      const options = { type: 'DEPOSIT', startDate, endDate };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await service.getTransactionHistory(userId, options);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          type: 'DEPOSIT',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 51, // Default limit + 1
        skip: 0,
        select: expect.any(Object),
      });
    });
  });

  describe('getPaymentMetrics', () => {
    it('should return cached metrics', async () => {
      const cachedMetrics = {
        totalTransactions: 1000,
        successRate: 95.5,
        avgProcessingTime: 2500,
        totalVolume: 50000.5,
        pendingCount: 25,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedMetrics));

      const result = await service.getPaymentMetrics();

      expect(result).toEqual(cachedMetrics);
      expect(mockPrisma.transaction.count).not.toHaveBeenCalled();
    });

    it('should calculate metrics from database', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.transaction.count
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(950)  // completed
        .mockResolvedValueOnce(25);  // pending

      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: '50000000000' }, // 50 TON in nanotons
      });

      vi.spyOn(service as any, 'getAverageProcessingTime')
        .mockResolvedValue(2500);

      const result = await service.getPaymentMetrics();

      expect(result).toEqual({
        totalTransactions: 1000,
        successRate: 95.0, // (950 / 1000) * 100
        avgProcessingTime: 2500,
        totalVolume: 50000000000,
        pendingCount: 25,
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'payment:metrics',
        60, // 1 minute
        JSON.stringify(result)
      );
    });

    it('should handle zero transactions gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.transaction.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0) // completed
        .mockResolvedValueOnce(0); // pending

      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      vi.spyOn(service as any, 'getAverageProcessingTime')
        .mockResolvedValue(0);

      const result = await service.getPaymentMetrics();

      expect(result).toEqual({
        totalTransactions: 0,
        successRate: 0,
        avgProcessingTime: 0,
        totalVolume: 0,
        pendingCount: 0,
      });
    });
  });

  describe('processPendingPayments', () => {
    it('should process pending payments in batches', async () => {
      const pendingTransactions = [
        { id: 'tx1', userId: 'user1', amount: '1000000000', currency: 'TON', createdAt: new Date() },
        { id: 'tx2', userId: 'user2', amount: '2000000000', currency: 'USDT', createdAt: new Date() },
        { id: 'tx3', userId: 'user3', amount: '500000000', currency: 'TON', createdAt: new Date() },
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(pendingTransactions);

      // Mock verifyPayment to return success for all transactions
      const verifySpy = vi.spyOn(service, 'verifyPayment')
        .mockResolvedValue({ success: true, transactionHash: '0xabc' });

      const result = await service.processPendingPayments();

      expect(result).toEqual({ processed: 3, errors: 0 });
      expect(verifySpy).toHaveBeenCalledTimes(3);
      expect(verifySpy).toHaveBeenCalledWith('tx1');
      expect(verifySpy).toHaveBeenCalledWith('tx2');
      expect(verifySpy).toHaveBeenCalledWith('tx3');
    });

    it('should handle mixed success and failure results', async () => {
      const pendingTransactions = [
        { id: 'tx1', userId: 'user1', amount: '1000000000', currency: 'TON', createdAt: new Date() },
        { id: 'tx2', userId: 'user2', amount: '2000000000', currency: 'USDT', createdAt: new Date() },
        { id: 'tx3', userId: 'user3', amount: '500000000', currency: 'TON', createdAt: new Date() },
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(pendingTransactions);

      const verifySpy = vi.spyOn(service, 'verifyPayment')
        .mockImplementation((txId) => {
          if (txId === 'tx1') return Promise.resolve({ success: true, transactionHash: '0xabc' });
          if (txId === 'tx2') return Promise.resolve({ success: false, error: 'Not found' });
          return Promise.reject(new Error('Network error'));
        });

      const result = await service.processPendingPayments();

      expect(result).toEqual({ processed: 1, errors: 2 });
      expect(verifySpy).toHaveBeenCalledTimes(3);
    });

    it('should limit transactions to last hour', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      mockPrisma.transaction.findMany.mockResolvedValue([]);

      await service.processPendingPayments();

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          createdAt: {
            gte: expect.any(Date),
          },
        },
        take: 100,
        select: {
          id: true,
          userId: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      });

      const call = mockPrisma.transaction.findMany.mock.calls[0][0];
      expect(call.where.createdAt.gte.getTime()).toBeCloseTo(oneHourAgo.getTime(), -3);
    });

    it('should process in batches with delays', async () => {
      // Create 15 transactions to test batching
      const pendingTransactions = Array(15).fill(null).map((_, i) => ({
        id: `tx${i}`,
        userId: `user${i}`,
        amount: '1000000000',
        currency: 'TON',
        createdAt: new Date(),
      }));

      mockPrisma.transaction.findMany.mockResolvedValue(pendingTransactions);

      const verifySpy = vi.spyOn(service, 'verifyPayment')
        .mockResolvedValue({ success: true, transactionHash: '0xabc' });

      const startTime = Date.now();
      await service.processPendingPayments();
      const endTime = Date.now();

      // Should take at least some time due to delays between batches
      expect(endTime - startTime).toBeGreaterThan(100); // At least 100ms for delays

      expect(verifySpy).toHaveBeenCalledTimes(15);
    });
  });

  describe('private helper methods', () => {
    describe('generatePaymentUrl', () => {
      it('should generate TON payment URL for testnet', async () => {
        const testConfig = { ...mockConfig, testnet: true };
        const testService = new TonPaymentService(mockPrisma, mockRedis, testConfig);

        const url = await (testService as any).generatePaymentUrl(
          'pay_123',
          1.5,
          'TON'
        );

        expect(url).toContain('https://test.tonhub.com/transfer/');
        expect(url).toContain(testConfig.merchantAddress);
        expect(url).toContain('LabelMint%20Payment%3A%20pay_123');
        expect(url).toContain('1500000000'); // 1.5 TON in nanotons
      });

      it('should generate USDT payment URL for mainnet', async () => {
        const mainConfig = { ...mockConfig, testnet: false };
        const mainService = new TonPaymentService(mockPrisma, mockRedis, mainConfig);

        const url = await (mainService as any).generatePaymentUrl(
          'pay_123',
          100,
          'USDT'
        );

        expect(url).toContain('https://tonhub.com/transfer/');
        expect(url).toContain(mainConfig.merchantAddress);
        expect(url).toContain('jetton=' + mainConfig.usdtMasterContract);
        expect(url).toContain('100000000'); // 100 USDT with 6 decimals
      });
    });

    describe('normalizeTonAmount', () => {
      it('should normalize various TON amount formats', () => {
        const service = new TonPaymentService(mockPrisma, mockRedis, mockConfig);

        expect((service as any).normalizeTonAmount('1000000000')).toBe(1000000000n);
        expect((service as any).normalizeTonAmount(1.5)).toBe(1500000000n);
        expect((service as any).normalizeTonAmount('1.5')).toBe(1500000000n);
        expect((service as any).normalizeTonAmount(BigInt('2000000000'))).toBe(2000000000n);
      });

      it('should throw error for unsupported TON amount format', () => {
        const service = new TonPaymentService(mockPrisma, mockRedis, mockConfig);

        expect(() => (service as any).normalizeTonAmount({})).toThrow('Unsupported TON amount format');
        expect(() => (service as any).normalizeTonAmount(null)).toThrow('Unsupported TON amount format');
        expect(() => (service as any).normalizeTonAmount(undefined)).toThrow('Unsupported TON amount format');
      });
    });

    describe('normalizeUsdtAmount', () => {
      it('should normalize various USDT amount formats', () => {
        const service = new TonPaymentService(mockPrisma, mockRedis, mockConfig);

        expect((service as any).normalizeUsdtAmount('100000000')).toBe(100000000n);
        expect((service as any).normalizeUsdtAmount(100.5)).toBe(100500000n);
        expect((service as any).normalizeUsdtAmount('100.5')).toBe(100500000n);
        expect((service as any).normalizeUsdtAmount(BigInt('200000000'))).toBe(200000000n);
      });

      it('should handle negative USDT amounts', () => {
        const service = new TonPaymentService(mockPrisma, mockRedis, mockConfig);

        expect((service as any).normalizeUsdtAmount(-50)).toBe(-50000000n);
        expect((service as any).normalizeUsdtAmount('-25.5')).toBe(-25500000n);
      });

      it('should throw error for unsupported USDT amount format', () => {
        const service = new TonPaymentService(mockPrisma, mockRedis, mockConfig);

        expect(() => (service as any).normalizeUsdtAmount({})).toThrow('Unsupported USDT amount format');
        expect(() => (service as any).normalizeUsdtAmount(null)).toThrow('Unsupported USDT amount format');
      });
    });

    describe('decimalStringToUnits', () => {
      it('should convert decimal strings to units correctly', () => {
        const service = new TonPaymentService(mockPrisma, mockRedis, mockConfig);

        expect((service as any).decimalStringToUnits('1.5', 6)).toBe(1500000n);
        expect((service as any).decimalStringToUnits('100', 6)).toBe(100000000n);
        expect((service as any).decimalStringToUnits('0.123456', 6)).toBe(123456n);
        expect((service as any).decimalStringToUnits('0.001', 6)).toBe(1000n);
      });

      it('should handle zero values', () => {
        const service = new TonPaymentService(mockPrisma, mockRedis, mockConfig);

        expect((service as any).decimalStringToUnits('0', 6)).toBe(0n);
        expect((service as any).decimalStringToUnits('0.0', 6)).toBe(0n);
        expect((service as any).decimalStringToUnits('.0', 6)).toBe(0n);
      });

      it('should pad or truncate decimal places correctly', () => {
        const service = new TonPaymentService(mockPrisma, mockRedis, mockConfig);

        expect((service as any).decimalStringToUnits('1.123456789', 6)).toBe(123456n); // Truncate
        expect((service as any).decimalStringToUnits('1.1', 6)).toBe(1100000n); // Pad
        expect((service as any).decimalStringToUnits('1', 6)).toBe(1000000n); // Pad
      });
    });

    describe('calculateWithdrawalFee', () => {
      it('should calculate correct fees for different currencies', () => {
        const service = new TonPaymentService(mockPrisma, mockRedis, mockConfig);

        expect((service as any).calculateWithdrawalFee(100, 'TON')).toBe(0.01);
        expect((service as any).calculateWithdrawalFee(0.5, 'TON')).toBe(0.01);
        expect((service as any).calculateWithdrawalFee(1000, 'USDT')).toBe(1);
        expect((service as any).calculateWithdrawalFee(10, 'USDT')).toBe(1);
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle database connection pool exhaustion gracefully', async () => {
      // Mock pool exhaustion scenario
      const errorService = new TonPaymentService(mockPrisma, mockRedis, mockConfig);

      // Mock database pool to be exhausted
      vi.spyOn(errorService as any, 'dbPool', 'get')
        .mockReturnValue({
          getClient: vi.fn().mockRejectedValue(new Error('Pool exhausted')),
        });

      await expect(
        errorService.createPaymentTransaction('user123', 'project456', 1.0, 'TON')
      ).rejects.toThrow('Pool exhausted');
    });

    it('should handle Redis connection failures', async () => {
      const userId = 'user123';

      // Mock Redis to throw connection error
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      // Service should fallback to database
      const result = await service.getUserBalance(userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
    });

    it('should handle malformed blockchain responses', async () => {
      const transactionId = 'pay_123';
      const mockTransaction = {
        id: transactionId,
        userId: 'user123',
        amount: '1500000000',
        currency: 'TON',
        status: 'PENDING',
        hash: null,
        type: 'DEPOSIT',
        fee: '10000000',
        metadata: {},
        createdAt: new Date(),
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      // Mock blockchain check to return malformed response
      vi.spyOn(service as any, 'checkBlockchainTransaction')
        .mockResolvedValue({ success: false, error: 'Malformed response' });

      const result = await service.verifyPayment(transactionId);

      expect(result).toEqual({
        success: false,
        error: 'Malformed response',
      });
    });

    it('should validate addresses properly', async () => {
      const request = {
        userId: 'user123',
        amount: 1.0,
        address: 'invalid-address',
        currency: 'TON' as const,
      };

      const mockUser = {
        id: 'user123',
        tonBalance: 5.0,
        usdtBalance: 100.0,
        frozenBalance: 0.0,
        trustScore: 0.9,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockRedis.get.mockResolvedValue(null);

      // Address validation should happen during blockchain transaction
      vi.spyOn(service as any, 'sendWithdrawalTransaction')
        .mockRejectedValue(new Error('Invalid address format'));

      const result = await service.processWithdrawal(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction failed');
    });
  });
});