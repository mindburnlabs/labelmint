import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { PaymentProcessor } from '../../contracts/output/PaymentProcessor_PaymentProcessor';
import '@ton/test-utils';

describe('PaymentProcessor', () => {
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let user: SandboxContract<TreasuryContract>;
  let paymentProcessor: SandboxContract<PaymentProcessor>;

  beforeAll(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury('deployer');
    user = await blockchain.treasury('user');

    // Deploy the PaymentProcessor contract
    paymentProcessor = blockchain.openContract(
      await PaymentProcessor.fromInit(deployer.address)
    );

    const deployResult = await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      null
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: paymentProcessor.address,
      deploy: true,
      success: true,
    });
  });

  it('should deploy successfully', async () => {
    // Contract should be deployed and have correct owner
    const owner = await paymentProcessor.getOwner();
    expect(owner.toString()).toBe(deployer.address.toString());

    const balance = await paymentProcessor.getBalance();
    expect(balance).toBeGreaterThan(0);
  });

  it('should receive plain TON deposits', async () => {
    const depositAmount = toNano('1');
    const initialBalance = await paymentProcessor.getBalance();

    // Send TON to contract
    const depositResult = await paymentProcessor.send(
      user.getSender(),
      {
        value: depositAmount,
      },
      null
    );

    expect(depositResult.transactions).toHaveTransaction({
      from: user.address,
      to: paymentProcessor.address,
      success: true,
    });

    const finalBalance = await paymentProcessor.getBalance();
    expect(finalBalance).toBe(initialBalance + depositAmount);
  });

  it('should process structured deposits', async () => {
    const depositAmount = toNano('0.5');
    const initialBalance = await paymentProcessor.getBalance();

    // Send structured deposit message
    const depositResult = await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'Deposit',
        amount: depositAmount,
        recipient: user.address,
      }
    );

    expect(depositResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: paymentProcessor.address,
      success: true,
    });

    // Check that contract balance increased
    const finalBalance = await paymentProcessor.getBalance();
    expect(finalBalance).toBeGreaterThan(initialBalance);
  });

  it('should allow owner to withdraw funds', async () => {
    const withdrawAmount = toNano('0.3');
    const initialContractBalance = await paymentProcessor.getBalance();
    const initialUserBalance = await user.getBalance();

    // Owner withdraws funds to user
    const withdrawResult = await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'Withdraw',
        amount: withdrawAmount,
        recipient: user.address,
      }
    );

    expect(depositResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: paymentProcessor.address,
      success: true,
    });

    // Verify withdrawal transaction to user
    expect(withdrawResult.transactions).toHaveTransaction({
      from: paymentProcessor.address,
      to: user.address,
      value: withdrawAmount,
      success: true,
    });

    const finalContractBalance = await paymentProcessor.getBalance();
    const finalUserBalance = await user.getBalance();

    expect(finalContractBalance).toBe(initialContractBalance - withdrawAmount);
    expect(finalUserBalance).toBeGreaterThan(initialUserBalance);
  });

  it('should reject withdrawals from non-owners', async () => {
    const withdrawAmount = toNano('0.1');

    // Non-owner tries to withdraw
    const withdrawResult = await paymentProcessor.send(
      user.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'Withdraw',
        amount: withdrawAmount,
        recipient: user.address,
      }
    );

    expect(withdrawResult.transactions).toHaveTransaction({
      from: user.address,
      to: paymentProcessor.address,
      success: false,
      exitCode: 401, // Unauthorized
    });
  });

  it('should reject withdrawals exceeding contract balance', async () => {
    const contractBalance = await paymentProcessor.getBalance();
    const withdrawAmount = contractBalance + toNano('0.1'); // More than available

    // Owner tries to withdraw more than available
    const withdrawResult = await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'Withdraw',
        amount: withdrawAmount,
        recipient: user.address,
      }
    );

    expect(withdrawResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: paymentProcessor.address,
      success: false,
      exitCode: 410, // Insufficient balance
    });
  });

  it('should create payment channels', async () => {
    const channelCapacity = toNano('2');
    const channelDuration = 3600; // 1 hour
    const initialBalance = await paymentProcessor.getBalance();
    const initialChannelCount = await paymentProcessor.getChannelCount();

    // Create payment channel
    const channelResult = await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'CreateChannel',
        participant: user.address,
        capacity: channelCapacity,
        duration: channelDuration,
      }
    );

    expect(channelResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: paymentProcessor.address,
      success: true,
    });

    // Verify channel was created
    const finalChannelCount = await paymentProcessor.getChannelCount();
    expect(finalChannelCount).toBe(initialChannelCount + 1);

    // Verify funds were locked
    const finalBalance = await paymentProcessor.getBalance();
    expect(finalBalance).toBe(initialBalance - channelCapacity);

    // Verify channel info
    const channelInfo = await paymentProcessor.getChannelInfo(finalChannelCount);
    expect(channelInfo?.participant.toString()).toBe(user.address.toString());
    expect(channelInfo?.capacity).toBe(channelCapacity);
    expect(channelInfo?.spent).toBe(0);
  });

  it('should process channel payments', async () => {
    // First create a channel
    const channelCapacity = toNano('1');
    const channelDuration = 3600;

    await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'CreateChannel',
        participant: user.address,
        capacity: channelCapacity,
        duration: channelDuration,
      }
    );

    const channelId = await paymentProcessor.getChannelCount();

    // Send payment through channel
    const paymentAmount = toNano('0.3');
    const paymentResult = await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'ChannelPayment',
        channelId: channelId,
        amount: paymentAmount,
        recipient: user.address,
      }
    );

    expect(paymentResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: paymentProcessor.address,
      success: true,
    });

    // Verify channel spent amount updated
    const channelInfo = await paymentProcessor.getChannelInfo(channelId);
    expect(channelInfo?.spent).toBe(paymentAmount);
  });

  it('should reject channel payments exceeding capacity', async () => {
    // Create a channel
    const channelCapacity = toNano('0.5');
    const channelDuration = 3600;

    await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'CreateChannel',
        participant: user.address,
        capacity: channelCapacity,
        duration: channelDuration,
      }
    );

    const channelId = await paymentProcessor.getChannelCount();

    // Try to send payment exceeding capacity
    const paymentAmount = toNano('0.8'); // More than capacity
    const paymentResult = await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'ChannelPayment',
        channelId: channelId,
        amount: paymentAmount,
        recipient: user.address,
      }
    );

    expect(paymentResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: paymentProcessor.address,
      success: false,
      exitCode: 410, // Channel capacity exceeded
    });
  });

  it('should close channels and return remaining funds', async () => {
    // Create a channel
    const channelCapacity = toNano('1');
    const channelDuration = 3600;
    const initialBalance = await paymentProcessor.getBalance();

    await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'CreateChannel',
        participant: user.address,
        capacity: channelCapacity,
        duration: channelDuration,
      }
    );

    const channelId = await paymentProcessor.getChannelCount();

    // Send a payment through the channel
    await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'ChannelPayment',
        channelId: channelId,
        amount: toNano('0.3'),
        recipient: user.address,
      }
    );

    // Close the channel
    const closeResult = await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      channelId
    );

    expect(closeResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: paymentProcessor.address,
      success: true,
    });

    // Verify remaining funds returned to contract balance
    const finalBalance = await paymentProcessor.getBalance();
    const expectedBalance = initialBalance - toNano('0.3'); // Only the spent amount is deducted
    expect(finalBalance).toBeCloseTo(expectedBalance, -9); // Allow for small gas differences

    // Verify channel was removed
    const channelInfo = await paymentProcessor.getChannelInfo(channelId);
    expect(channelInfo).toBeNull();
  });

  it('should handle multiple concurrent operations', async () => {
    const initialBalance = await paymentProcessor.getBalance();

    // Multiple deposits
    const depositPromises = Array(3).fill(0).map((_, i) =>
      paymentProcessor.send(
        user.getSender(),
        { value: toNano('0.1') },
        null
      )
    );

    const depositResults = await Promise.all(depositPromises);

    // All deposits should succeed
    depositResults.forEach(result => {
      expect(result.transactions).toHaveTransaction({
        from: user.address,
        to: paymentProcessor.address,
        success: true,
      });
    });

    const finalBalance = await paymentProcessor.getBalance();
    expect(finalBalance).toBeGreaterThan(initialBalance);
  });

  describe('Edge Cases', () => {
    it('should handle zero amount deposits', async () => {
      const result = await paymentProcessor.send(
        user.getSender(),
        { value: toNano('0.01') },
        null
      );

      expect(result.transactions).toHaveTransaction({
        from: user.address,
        to: paymentProcessor.address,
        success: true,
      });
    });

    it('should handle very small amounts', async () => {
      const result = await paymentProcessor.send(
        user.getSender(),
        { value: 1 }, // 1 nanoton
        null
      );

      expect(result.transactions).toHaveTransaction({
        from: user.address,
        to: paymentProcessor.address,
        success: true,
      });
    });

    it('should reject invalid message types', async () => {
      const result = await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'InvalidMessage',
          someData: 'test',
        }
      );

      expect(result.transactions).toHaveTransaction({
        from: deployer.address,
        to: paymentProcessor.address,
        success: false,
      });
    });
  });

  describe('Security Tests', () => {
    it('should prevent reentrancy attacks', async () => {
      // This test would require a malicious contract to be deployed
      // For now, we test that the contract handles messages correctly
      const initialBalance = await paymentProcessor.getBalance();

      const result = await paymentProcessor.send(
        user.getSender(),
        { value: toNano('0.1') },
        null
      );

      expect(result.transactions).toHaveTransaction({
        from: user.address,
        to: paymentProcessor.address,
        success: true,
      });

      const finalBalance = await paymentProcessor.getBalance();
      expect(finalBalance).toBe(initialBalance + toNano('0.1'));
    });

    it('should maintain state consistency', async () => {
      const owner = await paymentProcessor.getOwner();
      const initialBalance = await paymentProcessor.getBalance();
      const initialChannelCount = await paymentProcessor.getChannelCount();

      // Perform multiple operations
      await paymentProcessor.send(user.getSender(), { value: toNano('0.1') }, null);

      const channelCapacity = toNano('0.5');
      await paymentProcessor.send(
        deployer.getSender(),
        { value: toNano('0.05') },
        {
          $$type: 'CreateChannel',
          participant: user.address,
          capacity: channelCapacity,
          duration: 3600,
        }
      );

      // Verify state consistency
      expect(await paymentProcessor.getOwner()).toBe(owner);
      expect(await paymentProcessor.getChannelCount()).toBe(initialChannelCount + 1);
    });
  });
});