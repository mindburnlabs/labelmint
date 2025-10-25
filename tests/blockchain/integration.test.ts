import { Blockchain, SandboxContract, TreasuryContract } from './mocks/ton-sandbox-mock';
import { toNano, Address } from '@ton/core';
import { PaymentProcessor } from '../../contracts/output/PaymentProcessor_PaymentProcessor';

describe('PaymentProcessor Integration Tests', () => {
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let user1: SandboxContract<TreasuryContract>;
  let user2: SandboxContract<TreasuryContract>;
  let paymentProcessor: SandboxContract<PaymentProcessor>;

  beforeAll(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury('deployer');
    user1 = await blockchain.treasury('user1');
    user2 = await blockchain.treasury('user2');

    paymentProcessor = blockchain.openContract(
      await PaymentProcessor.fromInit(deployer.address)
    );

    await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.1'),
      },
      null
    );
  });

  describe('Multi-User Payment Flow', () => {
    it('should handle deposits from multiple users', async () => {
      const initialBalance = await paymentProcessor.getBalance();

      // Multiple users deposit funds
      const depositAmount = toNano('0.5');

      await paymentProcessor.send(
        user1.getSender(),
        { value: depositAmount },
        null
      );

      await paymentProcessor.send(
        user2.getSender(),
        { value: depositAmount },
        null
      );

      const finalBalance = await paymentProcessor.getBalance();
      const expectedBalance = initialBalance + depositAmount * 2n;
      expect(finalBalance).toBe(expectedBalance);
    });

    it('should handle withdrawals to multiple recipients', async () => {
      // First deposit some funds
      await paymentProcessor.send(
        user1.getSender(),
        { value: toNano('2') },
        null
      );

      const initialUser1Balance = await user1.getBalance();
      const initialUser2Balance = await user2.getBalance();

      // Withdraw to multiple users
      await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'Withdraw',
          amount: toNano('0.5'),
          recipient: user1.address,
        }
      );

      await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'Withdraw',
          amount: toNano('0.3'),
          recipient: user2.address,
        }
      );

      const finalUser1Balance = await user1.getBalance();
      const finalUser2Balance = await user2.getBalance();

      expect(finalUser1Balance).toBeGreaterThan(initialUser1Balance);
      expect(finalUser2Balance).toBeGreaterThan(initialUser2Balance);
    });
  });

  describe('Payment Channel Lifecycle', () => {
    it('should handle complete payment channel lifecycle', async () => {
      const channelCapacity = toNano('2');
      const channelDuration = 3600;

      // Create channel
      await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'CreateChannel',
          participant: user1.address,
          capacity: channelCapacity,
          duration: channelDuration,
        }
      );

      const channelId = await paymentProcessor.getChannelCount();

      // Verify channel created
      const channelInfo = await paymentProcessor.getChannelInfo(channelId);
      expect(channelInfo?.participant.toString()).toBe(user1.address.toString());
      expect(channelInfo?.capacity).toBe(channelCapacity);

      // Make multiple payments through channel
      const payment1 = toNano('0.5');
      const payment2 = toNano('0.3');

      await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'ChannelPayment',
          channelId: channelId,
          amount: payment1,
          recipient: user2.address,
        }
      );

      await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'ChannelPayment',
          channelId: channelId,
          amount: payment2,
          recipient: user2.address,
        }
      );

      // Verify payments tracked correctly
      const updatedChannelInfo = await paymentProcessor.getChannelInfo(channelId);
      expect(updatedChannelInfo?.spent).toBe(payment1 + payment2);

      // Close channel
      await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        channelId
      );

      // Verify channel closed
      const finalChannelInfo = await paymentProcessor.getChannelInfo(channelId);
      expect(finalChannelInfo).toBeNull();
    });

    it('should handle multiple concurrent channels', async () => {
      const channelCapacity = toNano('1');
      const channelDuration = 3600;

      // Create channels for multiple users
      await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'CreateChannel',
          participant: user1.address,
          capacity: channelCapacity,
          duration: channelDuration,
        }
      );

      await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'CreateChannel',
          participant: user2.address,
          capacity: channelCapacity,
          duration: channelDuration,
        }
      );

      const finalChannelCount = await paymentProcessor.getChannelCount();
      expect(finalChannelCount).toBeGreaterThan(1);

      // Verify both channels exist
      const channel1Info = await paymentProcessor.getChannelInfo(finalChannelCount - 1);
      const channel2Info = await paymentProcessor.getChannelInfo(finalChannelCount);

      expect(channel1Info?.participant.toString()).toBe(user1.address.toString());
      expect(channel2Info?.participant.toString()).toBe(user2.address.toString());
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle insufficient balance gracefully', async () => {
      const contractBalance = await paymentProcessor.getBalance();
      const withdrawAmount = contractBalance + toNano('1'); // More than available

      const result = await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'Withdraw',
          amount: withdrawAmount,
          recipient: user1.address,
        }
      );

      expect(result.transactions).toHaveTransaction({
        from: deployer.address,
        to: paymentProcessor.address,
        success: false,
        exitCode: 410, // Insufficient balance
      });
    });

    it('should handle channel operations on non-existent channels', async () => {
      const result = await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'ChannelPayment',
          channelId: 9999,
          amount: toNano('0.1'),
          recipient: user1.address,
        }
      );

      expect(result.transactions).toHaveTransaction({
        from: deployer.address,
        to: paymentProcessor.address,
        success: false,
        exitCode: 404, // Channel not found
      });
    });

    it('should handle expired channels', async () => {
      // Create channel with very short duration
      await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'CreateChannel',
          participant: user1.address,
          capacity: toNano('1'),
          duration: 1, // 1 second
        }
      );

      const channelId = await paymentProcessor.getChannelCount();

      // Wait for channel to expire (simulate with blockchain time advance)
      await blockchain.now.plus(2);

      // Try to use expired channel
      const result = await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'ChannelPayment',
          channelId: channelId,
          amount: toNano('0.1'),
          recipient: user1.address,
        }
      );

      expect(result.transactions).toHaveTransaction({
        from: deployer.address,
        to: paymentProcessor.address,
        success: false,
        exitCode: 410, // Channel expired
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle high volume of small transactions', async () => {
      const initialBalance = await paymentProcessor.getBalance();
      const transactionCount = 10;
      const amount = toNano('0.01');

      // Send multiple small transactions
      const transactions = Array(transactionCount).fill(0).map(() =>
        paymentProcessor.send(
          user1.getSender(),
          { value: amount },
          null
        )
      );

      const results = await Promise.all(transactions);

      // All transactions should succeed
      results.forEach(result => {
        expect(result.transactions).toHaveTransaction({
          from: user1.address,
          to: paymentProcessor.address,
          success: true,
        });
      });

      const finalBalance = await paymentProcessor.getBalance();
      const expectedIncrease = amount * BigInt(transactionCount);
      expect(finalBalance).toBe(initialBalance + expectedIncrease);
    });

    it('should handle concurrent channel operations', async () => {
      const channelCapacity = toNano('0.5');
      const channelDuration = 3600;

      // Create multiple channels concurrently
      const channelPromises = Array(3).fill(0).map((_, i) =>
        paymentProcessor.send(
          deployer.getSender(),
          { value: toNano('0.05') },
          {
            $$type: 'CreateChannel',
            participant: i === 0 ? user1.address : user2.address,
            capacity: channelCapacity,
            duration: channelDuration,
          }
        )
      );

      const results = await Promise.all(channelPromises);

      // All channels should be created successfully
      results.forEach(result => {
        expect(result.transactions).toHaveTransaction({
          from: deployer.address,
          to: paymentProcessor.address,
          success: true,
        });
      });
    });
  });
});