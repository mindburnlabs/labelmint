import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TonWalletStrategy } from '../../../../../services/payment-backend/src/services/payment/strategies/TonWalletStrategy';
import { TonClient, WalletContractV4, internal, Address, fromNano, toNano } from '@ton/ton';
import type { Transaction } from '../../../services/payment-backend/src/services/payment/interfaces/PaymentStrategy';
import { createMockTonClient, createMockPaymentConfig } from '../../test-utils/mocks/tonWallet.mock';

describe('TonWalletStrategy', () => {
  let strategy: TonWalletStrategy;
  let mockTonClient: any;

  beforeEach(async () => {
    mockTonClient = createMockTonClient();

    strategy = new TonWalletStrategy(createMockPaymentConfig());
    await strategy.initialize(); // Initialize the strategy
  });

  describe('Deposit', () => {
    it('should process deposit successfully', async () => {
      const amount = 100; // In TON
      const result = await strategy.deposit(amount);

      expect(result).toMatchObject({
        type: 'deposit',
        status: 'completed',
        amount: amount * 1e9, // Convert to nanotons
        currency: 'TON',
        txHash: expect.any(String),
        blockNumber: expect.any(Number),
      });
    });

    it('should generate unique transaction hash', async () => {
      const result1 = await strategy.deposit(100);
      const result2 = await strategy.deposit(100);

      expect(result1.txHash).not.toBe(result2.txHash);
    });

    it('should handle zero amount deposit', async () => {
      await expect(strategy.deposit(0))
        .rejects.toThrow('Amount must be greater than 0');
    });

    it('should handle negative amount deposit', async () => {
      await expect(strategy.deposit(-10))
        .rejects.toThrow('Amount must be greater than 0');
    });

    it('should handle very large deposit', async () => {
      const largeAmount = 1000000; // 1M TON

      const result = await strategy.deposit(largeAmount);

      expect(result.status).toBe('completed');
      expect(result.amount).toBe(largeAmount * 1e9);
    });
  });

  describe('Withdrawal', () => {
    it('should process withdrawal successfully', async () => {
      const amount = 50;
      const toAddress = 'EQRecipientAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      const result = await strategy.withdraw(amount, toAddress);

      expect(result).toMatchObject({
        type: 'withdraw',
        status: 'pending',
        amount: amount * 1e9,
        fromAddress: expect.any(String),
        toAddress,
        currency: 'TON',
        txHash: expect.any(String),
      });
    });

    it('should validate recipient address', async () => {
      await expect(strategy.withdraw(50, 'invalid_address'))
        .rejects.toThrow('Invalid TON address');
    });

    it('should check wallet balance before withdrawal', async () => {
      mockWallet.balance.mockResolvedValue('1000000000'); // 1 TON in nanotons

      await expect(strategy.withdraw(2, 'EQValidAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'))
        .rejects.toThrow('Insufficient balance');
    });

    it('should calculate withdrawal fee', async () => {
      const amount = 50;
      const result = await strategy.withdraw(amount, 'EQValidAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ');

      expect(result.fee).toBeGreaterThan(0);
      expect(result.fee).toBeLessThan(amount * 1e9 * 0.1); // Fee should be less than 10%
    });
  });

  describe('Balance', () => {
    it('should get wallet balance', async () => {
      mockWallet.balance.mockResolvedValue('5000000000'); // 5 TON in nanotons

      const balance = await strategy.getBalance('EQTestAddress1234567890');

      expect(balance).toBe(5); // Return in TON
    });

    it('should handle zero balance', async () => {
      mockWallet.balance.mockResolvedValue('0');

      const balance = await strategy.getBalance('EQTestAddress1234567890');

      expect(balance).toBe(0);
    });

    it('should convert nanotons to TON', async () => {
      mockWallet.balance.mockResolvedValue('1234567890'); // 1.23456789 TON

      const balance = await strategy.getBalance('EQTestAddress1234567890');

      expect(balance).toBeCloseTo(1.23456789, 8);
    });
  });

  describe('Transaction History', () => {
    it('should get transaction history', async () => {
      const mockTransactions = [
        {
          hash: 'tx1',
          lt: '1',
          transaction: {
            id: { hash: 'tx1' },
            now: 1640995200,
            out_msgs: [],
            in_msg: { source: 'EQSender1' },
          },
        },
        {
          hash: 'tx2',
          lt: '2',
          transaction: {
            id: { hash: 'tx2' },
            now: 1640995300,
            out_msgs: [],
            in_msg: { source: 'EQSender2' },
          },
        },
      ];

      mockWallet.getTransactions.mockResolvedValue(mockTransactions);

      const history = await strategy.getTransactionHistory('EQTestAddress1234567890', 10);

      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        hash: 'tx1',
        type: 'deposit',
        amount: expect.any(Number),
        timestamp: new Date('2024-01-01T00:00:00Z'),
      });
    });

    it('should limit transaction history', async () => {
      const mockTransactions = Array.from({ length: 20 }, (_, i) => ({
        hash: `tx${i}`,
        lt: `${i}`,
        transaction: {
          id: { hash: `tx${i}` },
          now: 1640995200 + i * 60,
        },
      }));

      mockWallet.getTransactions.mockResolvedValue(mockTransactions);

      const history = await strategy.getTransactionHistory('EQTestAddress1234567890', 5);

      expect(history).toHaveLength(5);
    });

    it('should handle empty transaction history', async () => {
      mockWallet.getTransactions.mockResolvedValue([]);

      const history = await strategy.getTransactionHistory('EQTestAddress1234567890');

      expect(history).toHaveLength(0);
    });
  });

  describe('Address Validation', () => {
    it('should validate correct TON address', () => {
      const validAddress = 'EQTestAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      expect(strategy.validateAddress(validAddress)).toBe(true);
    });

    it('should reject invalid TON address', () => {
      const invalidAddresses = [
        'invalid',
        '0x1234567890',
        'EQShort',
        'EQVeryLongAddress1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
        '',
      ];

      invalidAddresses.forEach(address => {
        expect(strategy.validateAddress(address)).toBe(false);
      });
    });

    it('should validate hex format addresses', () => {
      const hexAddress = '0:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      expect(strategy.validateAddress(hexAddress)).toBe(true);
    });
  });

  describe('Fee Estimation', () => {
    it('should estimate transfer fee', async () => {
      const fromAddress = 'EQSender1234567890';
      const toAddress = 'EQRecipient1234567890';
      const amount = 100;

      mockWallet.estimateGasFee.mockResolvedValue(50000000); // 0.05 TON in nanotons

      const fee = await strategy.estimateFee(fromAddress, toAddress, amount);

      expect(fee).toBeCloseTo(0.05, 8);
    });

    it('should estimate different fees for different amounts', async () => {
      const fromAddress = 'EQSender1234567890';
      const toAddress = 'EQRecipient1234567890';

      mockWallet.estimateGasFee
        .mockResolvedValueOnce(50000000)
        .mockResolvedValueOnce(60000000);

      const fee1 = await strategy.estimateFee(fromAddress, toAddress, 100);
      const fee2 = await strategy.estimateFee(fromAddress, toAddress, 1000);

      expect(fee2).toBeGreaterThan(fee1);
    });

    it('should handle fee estimation errors', async () => {
      mockWallet.estimateGasFee.mockRejectedValue(new Error('Network error'));

      await expect(strategy.estimateFee('EQFrom', 'EQTo', 100))
        .rejects.toThrow('Failed to estimate fee');
    });
  });

  describe('Transaction Status', () => {
    it('should check transaction status', async () => {
      const txHash = '0x1234567890abcdef';
      const mockTx = {
        hash: txHash,
        lt: '123',
        transaction: {
          id: { hash: txHash },
          now: Date.now() / 1000,
          out_msgs: [],
          in_msg: { source: 'EQSender' },
        },
      };

      // Mock findTransaction
      mockWallet.findTransaction = vi.fn().mockResolvedValue(mockTx);

      const status = await strategy.checkTransactionStatus(txHash);

      expect(status).toMatchObject({
        hash: txHash,
        status: 'completed',
        blockNumber: expect.any(Number),
        confirmations: expect.any(Number),
      });
    });

    it('should handle pending transaction', async () => {
      const txHash = '0x1234567890abcdef';

      mockWallet.findTransaction = vi.fn().mockResolvedValue(null);

      const status = await strategy.checkTransactionStatus(txHash);

      expect(status).toMatchObject({
        hash: txHash,
        status: 'pending',
        confirmations: 0,
      });
    });

    it('should handle failed transaction', async () => {
      const txHash = '0x1234567890abcdef';
      const mockTx = {
        hash: txHash,
        lt: '123',
        transaction: {
          id: { hash: txHash },
          now: Date.now() / 1000,
          out_msgs: [],
          in_msg: { source: 'EQSender' },
          exitCode: 4, // Error code
          description: 'Transaction failed',
        },
      };

      mockWallet.findTransaction = vi.fn().mockResolvedValue(mockTx);

      const status = await strategy.checkTransactionStatus(txHash);

      expect(status.status).toBe('failed');
      expect(status.error).toBeDefined();
    });
  });

  describe('Payment Type', () => {
    it('should return correct payment type', () => {
      expect(strategy.getPaymentType()).toBe('ton');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      mockWallet.send.mockRejectedValue(new Error('Network timeout'));

      await expect(strategy.withdraw(100, 'EQValidAddress'))
        .rejects.toThrow('Network timeout');
    });

    it('should handle insufficient gas', async () => {
      mockWallet.send.mockRejectedValue(new Error('Insufficient gas'));

      await expect(strategy.withdraw(100, 'EQValidAddress'))
        .rejects.toThrow('Insufficient gas');
    });

    it('should handle invalid seqno', async () => {
      mockWallet.send.mockRejectedValue(new Error('Invalid seqno'));

      await expect(strategy.withdraw(100, 'EQValidAddress'))
        .rejects.toThrow('Invalid seqno');
    });

    it('should handle contract execution error', async () => {
      mockWallet.send.mockRejectedValue(new Error('Contract execution error'));

      await expect(strategy.withdraw(100, 'EQValidAddress'))
        .rejects.toThrow('Contract execution error');
    });
  });

  describe('Batch Operations', () => {
    it('should process batch withdrawals', async () => {
      const withdrawals = [
        { address: 'EQRecipient1', amount: 10 },
        { address: 'EQRecipient2', amount: 20 },
        { address: 'EQRecipient3', amount: 15 },
      ];

      const results = await strategy.batchWithdraw(withdrawals);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.status).toBe('pending');
        expect(result.amount).toBe(withdrawals[index].amount * 1e9);
        expect(result.toAddress).toBe(withdrawals[index].address);
      });
    });

    it('should handle partial batch failures', async () => {
      const withdrawals = [
        { address: 'EQValidAddress1', amount: 10 },
        { address: 'InvalidAddress', amount: 20 },
        { address: 'EQValidAddress3', amount: 15 },
      ];

      mockWallet.send
        .mockResolvedValueOnce({ hash: 'tx1' })
        .mockRejectedValueOnce(new Error('Invalid address'))
        .mockResolvedValueOnce({ hash: 'tx3' });

      const results = await strategy.batchWithdraw(withdrawals);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('pending');
      expect(results[1].status).toBe('failed');
      expect(results[2].status).toBe('pending');
    });

    it('should calculate batch discount', async () => {
      const withdrawals = Array.from({ length: 10 }, (_, i) => ({
        address: `EQRecipient${i}`,
        amount: 10,
      }));

      const totalFee = await strategy.estimateBatchFee(withdrawals);

      // Batch should have discount
      const individualFees = await Promise.all(
        withdrawals.map(w => strategy.estimateFee('EQFrom', w.address, w.amount))
      );
      const sumIndividualFees = individualFees.reduce((a, b) => a + b, 0);

      expect(totalFee).toBeLessThan(sumIndividualFees);
    });
  });

  describe('Multi-signature Support', () => {
    it('should support multi-signature wallets', async () => {
      const multiSigStrategy = new TonWalletStrategy({
        tonClient: mockTonClient,
        config: {
          workchain: 0,
          isMultisig: true,
          requiredSignatures: 2,
          totalSignatures: 3,
        },
      });

      const result = await multiSigStrategy.withdraw(100, 'EQRecipient');

      expect(result.status).toBe('pending_multisig');
      expect(result.requiredSignatures).toBe(2);
    });

    it('should track signature collection', async () => {
      const multiSigStrategy = new TonWalletStrategy({
        tonClient: mockTonClient,
        config: {
          isMultisig: true,
          requiredSignatures: 2,
          totalSignatures: 3,
        },
      });

      const txHash = 'multisig-tx-123';

      // Add first signature
      await multiSigStrategy.addSignature(txHash, 'EQSigner1');
      let status = await multiSigStrategy.getMultisigStatus(txHash);
      expect(status.signaturesCollected).toBe(1);
      expect(status.ready).toBe(false);

      // Add second signature
      await multiSigStrategy.addSignature(txHash, 'EQSigner2');
      status = await multiSigStrategy.getMultisigStatus(txHash);
      expect(status.signaturesCollected).toBe(2);
      expect(status.ready).toBe(true);
    });
  });

  describe('Security', () => {
    it('should check for blacklisted addresses', async () => {
      const blacklistedAddress = 'EQBlacklistedAddress';

      await expect(strategy.withdraw(100, blacklistedAddress))
        .rejects.toThrow('Recipient address is blacklisted');
    });

    it('should implement spending limits', async () => {
      const hourlyLimit = 1000;
      strategy['dailyLimit'] = 10000;

      // Mock previous spending
      strategy['getSpentAmount'] = vi.fn().mockResolvedValue(950);

      await expect(strategy.withdraw(100, 'EQValidAddress'))
        .rejects.toThrow('Hourly spending limit exceeded');
    });

    it('should require 2FA for large amounts', async () => {
      const largeAmount = 10000; // 10k TON

      await expect(strategy.withdraw(largeAmount, 'EQValidAddress'))
        .rejects.toThrow('2FA required for large withdrawals');
    });
  });
});