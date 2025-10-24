import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { PaymentProcessor } from '../../contracts/output/PaymentProcessor_PaymentProcessor';
import { beginCell } from '@ton/core';
import '@ton/test-utils';

describe('PaymentProcessor Deployment', () => {
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let paymentProcessor: SandboxContract<PaymentProcessor>;

  beforeAll(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury('deployer');
  });

  it('should calculate correct deployment fee', async () => {
    const paymentProcessorCode = PaymentProcessor.fromInit(deployer.address).init;

    const deployFee = await blockchain.estimateMessageFee(
      deployer.address,
      paymentProcessorCode
    );

    console.log('Estimated deployment fee:', deployFee);
    expect(deployFee).toBeGreaterThan(0);
    expect(deployFee).toBeLessThan(toNano('1')); // Should be less than 1 TON
  });

  it('should deploy with initial state', async () => {
    paymentProcessor = blockchain.openContract(
      await PaymentProcessor.fromInit(deployer.address)
    );

    const deployResult = await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.1'),
      },
      null
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: paymentProcessor.address,
      deploy: true,
      success: true,
    });

    // Verify initial state
    const owner = await paymentProcessor.getOwner();
    const balance = await paymentProcessor.getBalance();
    const channelCount = await paymentProcessor.getChannelCount();

    expect(owner.toString()).toBe(deployer.address.toString());
    expect(balance).toBeGreaterThanOrEqual(0);
    expect(channelCount).toBe(0);
  });

  it('should handle deployment with custom owner', async () => {
    const customOwner = await blockchain.treasury('customOwner');

    const customProcessor = blockchain.openContract(
      await PaymentProcessor.fromInit(customOwner.address)
    );

    const deployResult = await customProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.1'),
      },
      null
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: customProcessor.address,
      deploy: true,
      success: true,
    });

    const owner = await customProcessor.getOwner();
    expect(owner.toString()).toBe(customOwner.address.toString());
  });

  it('should reject deployment with insufficient funds', async () => {
    const processor = blockchain.openContract(
      await PaymentProcessor.fromInit(deployer.address)
    );

    // Try to deploy with insufficient funds
    const deployResult = await processor.send(
      deployer.getSender(),
      {
        value: toNano('0.001'), // Too low
      },
      null
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: processor.address,
      deploy: true,
      success: false,
    });
  });
});

describe('Contract State Verification', () => {
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let paymentProcessor: SandboxContract<PaymentProcessor>;

  beforeAll(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury('deployer');
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

  it('should maintain correct contract state after operations', async () => {
    const initialOwner = await paymentProcessor.getOwner();
    const initialChannelCount = await paymentProcessor.getChannelCount();

    // Create a channel
    await paymentProcessor.send(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      },
      {
        $$type: 'CreateChannel',
        participant: deployer.address,
        capacity: toNano('1'),
        duration: 3600,
      }
    );

    // Verify state consistency
    const finalOwner = await paymentProcessor.getOwner();
    const finalChannelCount = await paymentProcessor.getChannelCount();

    expect(finalOwner.toString()).toBe(initialOwner.toString());
    expect(finalChannelCount).toBe(initialChannelCount + 1);
  });

  it('should handle get methods correctly', async () => {
    const owner = await paymentProcessor.getOwner();
    const balance = await paymentProcessor.getBalance();
    const channelCount = await paymentProcessor.getChannelCount();

    expect(typeof owner.toString()).toBe('string');
    expect(typeof balance).toBe('bigint');
    expect(typeof channelCount).toBe('number');

    expect(balance).toBeGreaterThanOrEqual(0);
    expect(channelCount).toBeGreaterThanOrEqual(0);
  });

  it('should return null for non-existent channel', async () => {
    const channelInfo = await paymentProcessor.getChannelInfo(999);
    expect(channelInfo).toBeNull();
  });
});