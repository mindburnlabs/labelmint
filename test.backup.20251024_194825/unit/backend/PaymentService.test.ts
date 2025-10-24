import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PaymentProcessor } from '@payment/services/PaymentProcessor';
import { TonWalletService } from '@payment/ton/TonWalletService';
import { initializeTestDatabase, cleanDatabase, closeTestDatabase } from '@test/utils/database';
import { UserFactory } from '@test/factories/UserFactory';
import { TransactionFactory } from '@test/factories/TransactionFactory';
import { createMockTonWallet, createMockUSDTContract } from '@test/utils/mocks';
import type { User, Transaction } from '@shared/types/database';

describe('PaymentProcessor', () => {
  let paymentProcessor: PaymentProcessor;
  let tonWalletService: TonWalletService;
  let testUsers: User[];

  beforeAll(async () => {
    await initializeTestDatabase();
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();

    // Create mock payment strategies
    tonStrategy = new TonWalletStrategy({
      tonClient: {
        open: vi.fn(() => createMockTonWallet()),
      },
    } as any);

    usdtStrategy = new USDTStrategy({
      contract: createMockUSDTContract(),
    } as any);

    paymentManager = new PaymentManager({
      strategies: {
        ton: tonStrategy,
        usdt: usdtStrategy,
      },
    });

    paymentService = new PaymentService(paymentManager);

    // Create test users
    testUsers = [
      UserFactory.create({ tonWalletAddress: 'EQTestAddress1' }),
      UserFactory.create({ tonWalletAddress: 'EQTestAddress2' }),
    ];
  });

  describe('Deposits', () => {
    it('should process TON deposit successfully', async () => {
      const user = testUsers[0];
      const amount = 100;

      const transaction = await paymentService.processDeposit({
        userId: user.id,
        amount,
        method: 'ton',
        fromAddress: 'EQSenderAddress',
      });

      expect(transaction).toBeDefined();
      expect(transaction.userId).toBe(user.id);
      expect(transaction.amount).toBe(amount);
      expect(transaction.type).toBe('deposit');
      expect(transaction.status).toBe('completed');
      expect(transaction.method).toBe('ton');
      expect(transaction.txHash).toBeDefined();
    });

    it('should process USDT deposit successfully', async () => {
      const user = testUsers[1];
      const amount = 500;

      const transaction = await paymentService.processDeposit({
        userId: user.id,
        amount,
        method: 'usdt',
        fromAddress: '0xSenderAddress',
      });

      expect(transaction).toBeDefined();
      expect(transaction.method).toBe('usdt');
      expect(transaction.status).toBe('completed');
    });

    it('should reject deposit with invalid address', async () => {
      const user = testUsers[0];

      await expect(paymentService.processDeposit({
        userId: user.id,
        amount: 100,
        method: 'ton',
        fromAddress: 'invalid_address',
      })).rejects.toThrow('Invalid TON address');
    });

    it('should track deposit in user balance', async () => {
      const user = testUsers[0];
      const amount = 100;

      await paymentService.processDeposit({
        userId: user.id,
        amount,
        method: 'ton',
        fromAddress: 'EQSenderAddress',
      });

      const balance = await paymentService.getUserBalance(user.id);
      expect(balance).toBe(amount);
    });
  });

  describe('Withdrawals', () => {
    beforeEach(async () => {
      // Add initial balance to users
      await paymentService.processDeposit({
        userId: testUsers[0].id,
        amount: 200,
        method: 'ton',
        fromAddress: 'EQSenderAddress',
      });

      await paymentService.processDeposit({
        userId: testUsers[1].id,
        amount: 1000,
        method: 'usdt',
        fromAddress: '0xSenderAddress',
      });
    });

    it('should process TON withdrawal successfully', async () => {
      const user = testUsers[0];
      const amount = 50;
      const toAddress = 'EQReceiverAddress';

      const transaction = await paymentService.processWithdrawal({
        userId: user.id,
        amount,
        method: 'ton',
        toAddress,
      });

      expect(transaction).toBeDefined();
      expect(transaction.userId).toBe(user.id);
      expect(transaction.amount).toBe(amount);
      expect(transaction.type).toBe('withdraw');
      expect(transaction.toAddress).toBe(toAddress);
      expect(transaction.status).toBe('completed');
    });

    it('should process USDT withdrawal successfully', async () => {
      const user = testUsers[1];
      const amount = 200;
      const toAddress = '0xReceiverAddress';

      const transaction = await paymentService.processWithdrawal({
        userId: user.id,
        amount,
        method: 'usdt',
        toAddress,
      });

      expect(transaction).toBeDefined();
      expect(transaction.method).toBe('usdt');
      expect(transaction.status).toBe('completed');
    });

    it('should reject withdrawal with insufficient balance', async () => {
      const user = testUsers[0]; // Has 200 balance

      await expect(paymentService.processWithdrawal({
        userId: user.id,
        amount: 300, // More than balance
        method: 'ton',
        toAddress: 'EQReceiverAddress',
      })).rejects.toThrow('Insufficient balance');
    });

    it('should update user balance after withdrawal', async () => {
      const user = testUsers[0];
      const initialBalance = await paymentService.getUserBalance(user.id);
      const withdrawalAmount = 50;

      await paymentService.processWithdrawal({
        userId: user.id,
        amount: withdrawalAmount,
        method: 'ton',
        toAddress: 'EQReceiverAddress',
      });

      const finalBalance = await paymentService.getUserBalance(user.id);
      expect(finalBalance).toBe(initialBalance - withdrawalAmount);
    });
  });

  describe('Task Payments', () => {
    beforeEach(async () => {
      // Fund requester account
      await paymentService.processDeposit({
        userId: testUsers[0].id,
        amount: 500,
        method: 'ton',
        fromAddress: 'EQSenderAddress',
      });
    });

    it('should process task payment from requester to worker', async () => {
      const requester = testUsers[0];
      const worker = testUsers[1];
      const amount = 10;

      const transaction = await paymentService.processTaskPayment({
        fromUserId: requester.id,
        toUserId: worker.id,
        amount,
        taskId: 'task-123',
      });

      expect(transaction).toBeDefined();
      expect(transaction.userId).toBe(requester.id);
      expect(transaction.type).toBe('payment');
      expect(transaction.amount).toBe(amount);
      expect(transaction.method).toBe('internal');
      expect(transaction.status).toBe('completed');
      expect(transaction.metadata.taskId).toBe('task-123');
    });

    it('should process batch task payments', async () => {
      const requester = testUsers[0];
      const payments = [
        { toUserId: 'worker-1', amount: 5, taskId: 'task-1' },
        { toUserId: 'worker-2', amount: 7, taskId: 'task-2' },
        { toUserId: 'worker-3', amount: 6, taskId: 'task-3' },
      ];

      const transactions = await paymentService.processBatchTaskPayments(
        requester.id,
        payments
      );

      expect(transactions).toHaveLength(3);
      transactions.forEach((tx, index) => {
        expect(tx.amount).toBe(payments[index].amount);
        expect(tx.metadata.taskId).toBe(payments[index].taskId);
      });
    });

    it('should refund failed task payments', async () => {
      const requester = testUsers[0];
      const worker = testUsers[1];
      const amount = 10;

      // Process payment
      await paymentService.processTaskPayment({
        fromUserId: requester.id,
        toUserId: worker.id,
        amount,
        taskId: 'task-123',
      });

      // Refund due to task cancellation
      const refund = await paymentService.processRefund({
        userId: requester.id,
        amount,
        reason: 'Task cancelled',
        originalTransactionId: 'tx-123',
      });

      expect(refund.type).toBe('refund');
      expect(refund.amount).toBe(amount);
      expect(refund.status).toBe('completed');
    });
  });

  describe('Rewards and Bonuses', () => {
    it('should give accuracy bonus to high-performing workers', async () => {
      const worker = testUsers[0];

      const reward = await paymentService.processReward({
        userId: worker.id,
        amount: 5,
        reason: 'Weekly accuracy bonus - 98% accuracy',
        metadata: {
          accuracy: 0.98,
          weekNumber: 2,
          year: 2024,
        },
      });

      expect(reward.type).toBe('reward');
      expect(reward.amount).toBe(5);
      expect(reward.status).toBe('completed');
      expect(reward.metadata.accuracy).toBe(0.98);
    });

    it('should give referral bonus', async () => {
      const referrer = testUsers[0];
      const referred = testUsers[1];

      const bonus = await paymentService.processReferralBonus({
        referrerId: referrer.id,
        referredId: referred.id,
        amount: 2,
      });

      expect(bonus.type).toBe('reward');
      expect(bonus.amount).toBe(2);
      expect(bonus.metadata.referredId).toBe(referred.id);
    });

    it('should apply streak bonus for consecutive tasks', async () => {
      const worker = testUsers[0];
      const streakCount = 10;

      const bonus = await paymentService.processStreakBonus({
        userId: worker.id,
        streakCount,
        baseAmount: 1,
      });

      expect(bonus.amount).toBeGreaterThan(1); // Should have bonus multiplier
      expect(bonus.metadata.streakCount).toBe(streakCount);
    });
  });

  describe('Penalties', () => {
    it('should apply penalty for failed honeypot', async () => {
      const worker = testUsers[0];

      // Give worker initial balance
      await paymentService.processDeposit({
        userId: worker.id,
        amount: 50,
        method: 'ton',
        fromAddress: 'EQSenderAddress',
      });

      const penalty = await paymentService.processPenalty({
        userId: worker.id,
        amount: 1,
        reason: 'Failed honeypot verification',
        taskId: 'honeypot-123',
      });

      expect(penalty.type).toBe('penalty');
      expect(penalty.amount).toBe(1);
      expect(penalty.status).toBe('completed');

      // Check balance is reduced
      const balance = await paymentService.getUserBalance(worker.id);
      expect(balance).toBe(49); // 50 - 1 penalty
    });

    it('should apply penalty for poor quality work', async () => {
      const worker = testUsers[0];
      const accuracy = 0.6; // Below threshold

      const penalty = await paymentService.processQualityPenalty({
        userId: worker.id,
        accuracy,
        amount: 2.5,
      });

      expect(penalty.metadata.accuracy).toBe(accuracy);
      expect(penalty.metadata.reason).toBe('Quality below threshold');
    });
  });

  describe('Transaction History', () => {
    beforeEach(async () => {
      // Create various transactions for history
      const user = testUsers[0];

      await paymentService.processDeposit({
        userId: user.id,
        amount: 100,
        method: 'ton',
        fromAddress: 'EQSenderAddress',
      });

      await paymentService.processWithdrawal({
        userId: user.id,
        amount: 20,
        method: 'ton',
        toAddress: 'EQReceiverAddress',
      });

      await paymentService.processReward({
        userId: user.id,
        amount: 5,
        reason: 'Bonus',
      });
    });

    it('should retrieve transaction history', async () => {
      const user = testUsers[0];
      const history = await paymentService.getTransactionHistory(user.id);

      expect(history).toHaveLength(3);
      expect(history[0].type).toBe('reward');
      expect(history[1].type).toBe('withdraw');
      expect(history[2].type).toBe('deposit');
    });

    it('should filter transactions by type', async () => {
      const user = testUsers[0];
      const deposits = await paymentService.getTransactionHistory(user.id, {
        type: 'deposit',
      });

      expect(deposits).toHaveLength(1);
      expect(deposits[0].type).toBe('deposit');
    });

    it('should filter transactions by date range', async () => {
      const user = testUsers[0];
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentTransactions = await paymentService.getTransactionHistory(user.id, {
        startDate: yesterday,
        endDate: now,
      });

      expect(recentTransactions.length).toBeGreaterThan(0);
    });

    it('should paginate transaction history', async () => {
      const user = testUsers[0];
      const page1 = await paymentService.getTransactionHistory(user.id, {
        page: 1,
        limit: 2,
      });

      const page2 = await paymentService.getTransactionHistory(user.id, {
        page: 2,
        limit: 2,
      });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
    });
  });

  describe('Payment Statistics', () => {
    it('should calculate user payment statistics', async () => {
      const user = testUsers[0];

      // Create transactions
      await paymentService.processDeposit({
        userId: user.id,
        amount: 100,
        method: 'ton',
        fromAddress: 'EQSenderAddress',
      });

      await paymentService.processWithdrawal({
        userId: user.id,
        amount: 30,
        method: 'ton',
        toAddress: 'EQReceiverAddress',
      });

      await paymentService.processReward({
        userId: user.id,
        amount: 10,
        reason: 'Bonus',
      });

      const stats = await paymentService.getUserPaymentStats(user.id);

      expect(stats.totalDeposits).toBe(100);
      expect(stats.totalWithdrawals).toBe(30);
      expect(stats.totalRewards).toBe(10);
      expect(stats.currentBalance).toBe(80); // 100 - 30 + 10
      expect(stats.netEarnings).toBe(10);
    });

    it('should calculate platform payment statistics', async () => {
      // Create transactions for multiple users
      for (const user of testUsers) {
        await paymentService.processDeposit({
          userId: user.id,
          amount: 100,
          method: 'ton',
          fromAddress: 'EQSenderAddress',
        });
      }

      const stats = await paymentService.getPlatformPaymentStats();

      expect(stats.totalDeposits).toBe(200);
      expect(stats.activeUsers).toBe(2);
      expect(stats.totalVolume).toBe(200);
    });

    it('should calculate payment method distribution', async () => {
      // Create deposits with different methods
      await paymentService.processDeposit({
        userId: testUsers[0].id,
        amount: 100,
        method: 'ton',
        fromAddress: 'EQSenderAddress',
      });

      await paymentService.processDeposit({
        userId: testUsers[1].id,
        amount: 200,
        method: 'usdt',
        fromAddress: '0xSenderAddress',
      });

      const distribution = await paymentService.getPaymentMethodDistribution();

      expect(distribution.ton).toBe(100);
      expect(distribution.usdt).toBe(200);
      expect(distribution.internal).toBe(0);
    });
  });

  describe('Fee Calculation', () => {
    it('should calculate withdrawal fees correctly', async () => {
      const amount = 100;
      const fee = await paymentService.calculateWithdrawalFee({
        amount,
        method: 'ton',
      });

      expect(fee).toBeGreaterThan(0);
      expect(fee).toBeLessThan(amount);
    });

    it('should apply fee discounts for high volume users', async () => {
      const amount = 1000;
      const user = testUsers[0];

      // Create high volume history
      for (let i = 0; i < 10; i++) {
        await paymentService.processDeposit({
          userId: user.id,
          amount: 100,
          method: 'ton',
          fromAddress: 'EQSenderAddress',
        });
      }

      const fee = await paymentService.calculateWithdrawalFee({
        amount,
        method: 'ton',
        userId: user.id,
      });

      // Should have discount applied
      expect(fee).toBeLessThan(await paymentService.calculateWithdrawalFee({
        amount,
        method: 'ton',
      }));
    });

    it('should have no fees for internal transfers', async () => {
      const fee = await paymentService.calculateWithdrawalFee({
        amount: 100,
        method: 'internal',
      });

      expect(fee).toBe(0);
    });
  });

  describe('Security', () => {
    it('should validate withdrawal addresses', async () => {
      expect(await paymentService.validateAddress('EQValidAddress123', 'ton')).toBe(true);
      expect(await paymentService.validateAddress('0xValidAddress123', 'usdt')).toBe(true);
      expect(await paymentService.validateAddress('invalid', 'ton')).toBe(false);
    });

    it('should detect suspicious transaction patterns', async () => {
      const user = testUsers[0];

      // Create many small transactions (potential structuring)
      for (let i = 0; i < 10; i++) {
        await paymentService.processDeposit({
          userId: user.id,
          amount: 10,
          method: 'ton',
          fromAddress: `EQSender${i}`,
        });
      }

      const isSuspicious = await paymentService.checkSuspiciousActivity(user.id);
      expect(isSuspicious).toBe(true);
    });

    it('should block transactions from sanctioned addresses', async () => {
      const sanctionedAddress = 'EQSanctionedAddress';

      await expect(paymentService.processDeposit({
        userId: testUsers[0].id,
        amount: 100,
        method: 'ton',
        fromAddress: sanctionedAddress,
      })).rejects.toThrow('Address is sanctioned');
    });
  });
});