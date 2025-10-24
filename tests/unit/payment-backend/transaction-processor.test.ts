import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TransactionProcessor } from '../../../services/payment-backend/src/services/transactionProcessor';
import { createTestUser, createTestWallet, createTestTransaction } from '../../test/fixtures/factories';
import { testDb, testRedis } from '../../test/setup';
import { PaymentStatus, TransactionType } from '@prisma/client';

// Mock TON client
vi.mock('@ton/ton', () => ({
  TonClient: {
    mainnet: () => ({
      sendExternalMessage: vi.fn(),
      getTransactions: vi.fn(),
      openContract: vi.fn()
    })
  }
}));

// Mock TON contract
vi.mock('@ton/core', () => ({
  fromNano: vi.fn((amount: string) => (Number(amount) / 1000000000).toString()),
  toNano: vi.fn((amount: string) => (Number(amount) * 1000000000).toString()),
  Address: {
    parse: vi.fn((addr: string) => ({ toString: () => addr }))
  },
  beginCell: vi.fn(() => ({
    storeUint: vi.fn().mockReturnThis(),
    storeCoins: vi.fn().mockReturnThis(),
    storeAddress: vi.fn().mockReturnThis(),
    endCell: vi.fn(() => ({ toBoc: () => Buffer.alloc(0) }))
  })),
  externalIn: vi.fn()
}));

describe('Transaction Processor', () => {
  let processor: TransactionProcessor;
  let testUser: any;
  let testWallet: any;

  beforeEach(async () => {
    processor = new TransactionProcessor(testDb, testRedis);

    // Clean up test data
    await testDb.transaction.deleteMany();
    await testDb.wallet.deleteMany();
    await testDb.user.deleteMany();

    // Create test user and wallet
    testUser = await createTestUser({ role: 'WORKER' });
    testWallet = await createTestWallet(testUser.id, {
      currency: 'TON',
      balance: 100.5,
      isMain: true
    });
  });

  afterEach(async () => {
    await testDb.transaction.deleteMany();
    await testDb.wallet.deleteMany();
    await testDb.user.deleteMany();
    await testRedis.flushdb();
  });

  describe('Transaction Validation', () => {
    it('should validate a valid deposit transaction', async () => {
      const transactionData = {
        type: TransactionType.DEPOSIT,
        amount: 50.0,
        currency: 'TON',
        fromAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        toAddress: testWallet.address,
        blockchainTxHash: 'test_tx_hash_123'
      };

      const validation = await processor.validateTransaction(transactionData);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject transaction with insufficient funds', async () => {
      const transactionData = {
        type: TransactionType.WITHDRAWAL,
        amount: 200.0, // More than wallet balance
        currency: 'TON',
        fromAddress: testWallet.address,
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        blockchainTxHash: 'test_tx_hash_124'
      };

      const validation = await processor.validateTransaction(transactionData);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Insufficient funds');
    });

    it('should reject invalid address format', async () => {
      const transactionData = {
        type: TransactionType.WITHDRAWAL,
        amount: 10.0,
        currency: 'TON',
        fromAddress: testWallet.address,
        toAddress: 'invalid_address',
        blockchainTxHash: 'test_tx_hash_125'
      };

      const validation = await processor.validateTransaction(transactionData);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid recipient address');
    });

    it('should detect duplicate transactions', async () => {
      // Create initial transaction
      await createTestTransaction(testUser.id, {
        type: TransactionType.DEPOSIT,
        amount: 50.0,
        blockchainTxHash: 'duplicate_hash'
      });

      // Try to create duplicate
      const transactionData = {
        type: TransactionType.DEPOSIT,
        amount: 50.0,
        currency: 'TON',
        fromAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        toAddress: testWallet.address,
        blockchainTxHash: 'duplicate_hash' // Same hash
      };

      const validation = await processor.validateTransaction(transactionData);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Transaction already processed');
    });
  });

  describe('Transaction Processing', () => {
    it('should process a deposit transaction', async () => {
      const initialBalance = testWallet.balance;

      const transaction = await processor.processTransaction({
        userId: testUser.id,
        type: TransactionType.DEPOSIT,
        amount: 25.5,
        currency: 'TON',
        fromAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        toAddress: testWallet.address,
        blockchainTxHash: 'deposit_tx_hash'
      });

      expect(transaction.status).toBe(PaymentStatus.COMPLETED);

      // Check wallet balance updated
      const updatedWallet = await testDb.wallet.findUnique({
        where: { id: testWallet.id }
      });
      expect(updatedWallet?.balance).toBe(initialBalance + 25.5);

      // Check transaction record
      const dbTransaction = await testDb.transaction.findUnique({
        where: { id: transaction.id }
      });
      expect(dbTransaction?.status).toBe(PaymentStatus.COMPLETED);
      expect(dbTransaction?.amount).toBe(25.5);
    });

    it('should process a withdrawal transaction', async () => {
      const initialBalance = testWallet.balance;

      const transaction = await processor.processTransaction({
        userId: testUser.id,
        type: TransactionType.WITHDRAWAL,
        amount: 30.0,
        currency: 'TON',
        fromAddress: testWallet.address,
        toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
        blockchainTxHash: 'withdrawal_tx_hash'
      });

      expect(transaction.status).toBe(PaymentStatus.PENDING); // Withdrawals start as pending

      // Check wallet balance is held
      const updatedWallet = await testDb.wallet.findUnique({
        where: { id: testWallet.id }
      });
      expect(updatedWallet?.balance).toBe(initialBalance - 30.0);
    });

    it('should process task payment transaction', async () => {
      const client = await createTestUser({ role: 'CLIENT' });
      const clientWallet = await createTestWallet(client.id, {
        currency: 'TON',
        balance: 1000.0,
        isMain: true
      });

      const transaction = await processor.processTransaction({
        userId: testUser.id,
        type: TransactionType.TASK_PAYMENT,
        amount: 5.0,
        currency: 'TON',
        fromAddress: clientWallet.address,
        toAddress: testWallet.address,
        blockchainTxHash: 'task_payment_hash',
        metadata: {
          taskId: 123,
          projectId: 456
        }
      });

      expect(transaction.status).toBe(PaymentStatus.COMPLETED);

      // Check worker wallet updated
      const workerWallet = await testDb.wallet.findUnique({
        where: { id: testWallet.id }
      });
      expect(workerWallet?.balance).toBe(testWallet.balance + 5.0);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple transactions in a batch', async () => {
      const transactions = [
        {
          userId: testUser.id,
          type: TransactionType.DEPOSIT,
          amount: 10.0,
          currency: 'TON',
          blockchainTxHash: 'batch_tx_1'
        },
        {
          userId: testUser.id,
          type: TransactionType.DEPOSIT,
          amount: 15.0,
          currency: 'TON',
          blockchainTxHash: 'batch_tx_2'
        },
        {
          userId: testUser.id,
          type: TransactionType.WITHDRAWAL,
          amount: 5.0,
          currency: 'TON',
          toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
          blockchainTxHash: 'batch_tx_3'
        }
      ];

      const results = await processor.processBatchTransactions(transactions);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);

      // Check final balance: 100.5 + 10 + 15 - 5 = 120.5
      const finalWallet = await testDb.wallet.findUnique({
        where: { id: testWallet.id }
      });
      expect(finalWallet?.balance).toBe(120.5);
    });

    it('should handle batch failures gracefully', async () => {
      const transactions = [
        {
          userId: testUser.id,
          type: TransactionType.DEPOSIT,
          amount: 10.0,
          currency: 'TON',
          blockchainTxHash: 'batch_fail_1'
        },
        {
          userId: testUser.id,
          type: TransactionType.WITHDRAWAL,
          amount: 500.0, // Insufficient funds
          currency: 'TON',
          toAddress: 'EQDk2VTvn04SUKJb4PJat9cNjA58z4GbnTZAfpbWQggUWWP',
          blockchainTxHash: 'batch_fail_2'
        },
        {
          userId: testUser.id,
          type: TransactionType.DEPOSIT,
          amount: 20.0,
          currency: 'TON',
          blockchainTxHash: 'batch_fail_3'
        }
      ];

      const results = await processor.processBatchTransactions(transactions);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);

      // Check balance: 100.5 + 10 + 20 = 130.5 (withdrawal failed)
      const finalWallet = await testDb.wallet.findUnique({
        where: { id: testWallet.id }
      });
      expect(finalWallet?.balance).toBe(130.5);
    });
  });

  describe('Transaction Confirmation', () => {
    it('should confirm pending withdrawal transaction', async () => {
      // Create pending withdrawal
      const withdrawal = await createTestTransaction(testUser.id, {
        type: TransactionType.WITHDRAWAL,
        amount: 25.0,
        currency: 'TON',
        status: PaymentStatus.PENDING,
        blockchainTxHash: 'pending_withdrawal'
      });

      // Confirm the transaction
      const confirmed = await processor.confirmTransaction(withdrawal.id, {
        blockNumber: 123456,
        blockHash: 'block_hash_123',
        gasUsed: 1000000
      });

      expect(confirmed.status).toBe(PaymentStatus.COMPLETED);

      // Check transaction record
      const dbTransaction = await testDb.transaction.findUnique({
        where: { id: withdrawal.id }
      });
      expect(dbTransaction?.status).toBe(PaymentStatus.COMPLETED);
      expect(dbTransaction?.metadata).toMatchObject({
        blockNumber: 123456,
        blockHash: 'block_hash_123',
        gasUsed: 1000000
      });
    });

    it('should handle failed transaction confirmation', async () => {
      const withdrawal = await createTestTransaction(testUser.id, {
        type: TransactionType.WITHDRAWAL,
        amount: 25.0,
        currency: 'TON',
        status: PaymentStatus.PENDING,
        blockchainTxHash: 'failed_withdrawal'
      });

      // Mark as failed
      const failed = await processor.failTransaction(withdrawal.id, {
        reason: 'Insufficient gas',
        errorCode: 'GAS_LIMIT_EXCEEDED'
      });

      expect(failed.status).toBe(PaymentStatus.FAILED);

      // Refund should be processed
      const refundTx = await testDb.transaction.findFirst({
        where: {
          userId: testUser.id,
          type: TransactionType.REFUND,
          metadata: {
            path: ['originalTransactionId']
          }
        }
      });
      expect(refundTx).toBeDefined();
      expect(refundTx?.amount).toBe(25.0);
    });
  });

  describe('Transaction History', () => {
    it('should retrieve transaction history', async () => {
      // Create multiple transactions
      await createTestTransaction(testUser.id, {
        type: TransactionType.DEPOSIT,
        amount: 50.0,
        status: PaymentStatus.COMPLETED
      });
      await createTestTransaction(testUser.id, {
        type: TransactionType.WITHDRAWAL,
        amount: 20.0,
        status: PaymentStatus.COMPLETED
      });
      await createTestTransaction(testUser.id, {
        type: TransactionType.TASK_PAYMENT,
        amount: 10.0,
        status: PaymentStatus.PENDING
      });

      const history = await processor.getTransactionHistory(testUser.id, {
        page: 1,
        limit: 10
      });

      expect(history.transactions).toHaveLength(3);
      expect(history.total).toBe(3);
      expect(history.page).toBe(1);
      expect(history.totalPages).toBe(1);
    });

    it('should paginate transaction history', async () => {
      // Create 25 transactions
      for (let i = 0; i < 25; i++) {
        await createTestTransaction(testUser.id, {
          type: TransactionType.DEPOSIT,
          amount: 1.0,
          status: PaymentStatus.COMPLETED
        });
      }

      const page1 = await processor.getTransactionHistory(testUser.id, {
        page: 1,
        limit: 10
      });

      const page2 = await processor.getTransactionHistory(testUser.id, {
        page: 2,
        limit: 10
      });

      expect(page1.transactions).toHaveLength(10);
      expect(page2.transactions).toHaveLength(10);
      expect(page1.total).toBe(25);
      expect(page1.totalPages).toBe(3);
    });
  });
});