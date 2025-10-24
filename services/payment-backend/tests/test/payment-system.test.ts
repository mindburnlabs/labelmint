import { TonClient, Address } from '@ton/ton';
import { PaymentHandler } from '../bot/payment-handler';
import { postgresDb } from '../services/database';

// Mock bot for testing
class MockBot {
  commands: Map<string, Function> = new Map();
  api = {
    sendMessage: jest.fn(),
    editMessageText: jest.fn()
  };

  command(command: string, handler: Function) {
    this.commands.set(command, handler);
  }

  async simulateCommand(command: string, ctx: any) {
    const handler = this.commands.get(command);
    if (handler) {
      await handler(ctx);
    }
  }
}

describe('Payment System Tests', () => {
  let paymentHandler: PaymentHandler;
  let mockBot: MockBot;
  let tonClient: TonClient;

  beforeAll(async () => {
    // Initialize test environment
    mockBot = new MockBot();
    tonClient = new TonClient({
      endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TONCENTER_TESTNET_API_KEY
    });

    paymentHandler = new PaymentHandler(
      mockBot as any,
      tonClient,
      'EQD___vdB-35R-5aC_5Pq0rh0L2A_sO8U_9nZb7QJ1k0QfE' // Test contract address
    );

    await paymentHandler.initialize();
  });

  beforeEach(async () => {
    // Clean up test data
    await postgresDb.query('DELETE FROM worker_payments WHERE worker_id IN (SELECT id FROM users WHERE email LIKE \'test_%\')');
    await postgresDb.query('DELETE FROM payment_channels WHERE worker_id IN (SELECT id FROM users WHERE email LIKE \'test_%\')');
    await postgresDb.query('DELETE FROM worker_balances WHERE worker_id IN (SELECT id FROM users WHERE email LIKE \'test_%\')');
  });

  describe('Payment Processing', () => {
    test('should calculate payment for simple task', async () => {
      const payment = await paymentHandler.calculateTaskPayment(
        1,
        'simple',
        'standard',
        1.0
      );

      expect(payment.amount).toBe(0.02);
      expect(payment.baseRate).toBe(0.02);
      expect(payment.multiplier).toBe(1);
      expect(payment.qualityBonus).toBe(0);
    });

    test('should calculate payment with complexity and turnaround', async () => {
      const payment = await paymentHandler.calculateTaskPayment(
        1,
        'complex',
        'priority',
        1.0
      );

      expect(payment.amount).toBe(0.225); // 0.15 * 1.5
      expect(payment.baseRate).toBe(0.15);
      expect(payment.multiplier).toBe(1.5);
    });

    test('should apply quality bonus', async () => {
      const payment = await paymentHandler.calculateTaskPayment(
        1,
        'medium',
        'standard',
        0.99 // 99% quality
      );

      expect(payment.qualityBonus).toBe(0.16); // (0.99 - 0.95) * 4
      expect(payment.amount).toBeCloseTo(0.058, 3); // 0.05 * 1.16
    });

    test('should pay worker using payment channel', async () => {
      // Create test worker
      const workerId = 999999;

      // Create payment channel
      await paymentHandler.createPaymentChannel(workerId, 10);

      // Simulate task completion
      const result = await paymentHandler.payWorker(
        workerId,
        1,
        'simple',
        'standard'
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe(0.02);

      // Check balance
      const balance = await paymentHandler.getWorkerBalance(workerId);
      expect(balance.channelBalance).toBe(0.02);
    });

    test('should add to balance when no channel available', async () => {
      // Create test worker without channel
      const workerId = 999998;

      const result = await paymentHandler.payWorker(
        workerId,
        1,
        'medium',
        'standard'
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe(0.05);

      // Check balance
      const balance = await paymentHandler.getWorkerBalance(workerId);
      expect(balance.balance).toBe(0.05);
    });
  });

  describe('Payment Channels', () => {
    test('should create payment channel', async () => {
      const workerId = 999997;
      const channel = await paymentHandler.createPaymentChannel(workerId, 50);

      expect(channel).toBeDefined();
      expect(channel.capacity).toBe(50);
      expect(channel.spent).toBe(0);
      expect(channel.isActive).toBe(true);
    });

    test('should handle channel payments', async () => {
      const workerId = 999996;
      await paymentHandler.createPaymentChannel(workerId, 10);

      const result = await paymentHandler.payWorker(
        workerId,
        1,
        'simple',
        'standard'
      );

      expect(result.success).toBe(true);
      expect(result.fee).toBe(0); // No fee for channel payments
    });

    test('should reject channel payment with insufficient capacity', async () => {
      const workerId = 999995;
      await paymentHandler.createPaymentChannel(workerId, 1); // Only 1 USDT capacity

      const result = await paymentHandler.payWorker(
        workerId,
        1,
        'complex', // 0.15 USDT
        'standard'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient channel capacity');
    });
  });

  describe('Withdrawals', () => {
    test('should create withdrawal batch', async () => {
      const workerId = 999994;

      // Add balance
      await paymentHandler.updateWorkerBalance(workerId, 15);

      const result = await paymentHandler.withdrawFunds(workerId, 10);

      expect(result.success).toBe(true);
      expect(result.fee).toBe(0.1);
      expect(result.batchId).toBeDefined();
    });

    test('should reject withdrawal with insufficient balance', async () => {
      const workerId = 999993;

      const result = await paymentHandler.withdrawFunds(workerId, 10);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });
  });

  describe('Batch Processing', () => {
    test('should process withdrawal batch', async () => {
      // Add multiple withdrawals
      const withdrawals = [
        { worker_id: 999992, amount: 5, fee: 0.1 },
        { worker_id: 999991, amount: 10, fee: 0.1 },
        { worker_id: 999990, amount: 15, fee: 0.1 }
      ];

      // Insert into database
      for (const w of withdrawals) {
        await postgresDb.query(`
          INSERT INTO withdrawal_batch
          (worker_id, amount, fee, status)
          VALUES ($1, $2, $3, 'pending')
        `, [w.worker_id, w.amount, w.fee]);
      }

      const result = await paymentHandler.processWithdrawalBatch();

      expect(result.processed).toBe(3);
    });
  });

  describe('Telegram Integration', () => {
    test('should handle balance command', async () => {
      const ctx = {
        from: { id: 999989 },
        message: { text: '/balance' },
        reply: jest.fn(),
        replyWith: jest.fn()
      };

      await mockBot.simulateCommand('balance', ctx);

      expect(ctx.replyWith).toHaveBeenCalled();
      expect(ctx.replyWith).toHaveBeenCalledWith(
        expect.stringContaining('💰 Your Balance')
      );
    });

    test('should handle withdraw command', async () => {
      const ctx = {
        from: { id: 999988 },
        message: { text: '/withdraw 5' },
        reply: jest.fn(),
        replyWith: jest.fn()
      };

      // Add balance first
      await paymentHandler.updateWorkerBalance(999988, 10);

      await mockBot.simulateCommand('withdraw', ctx);

      expect(ctx.replyWith).toHaveBeenCalled();
    });
  });

  describe('Database Operations', () => {
    test('should record payment correctly', async () => {
      const paymentData = {
        workerId: 999987,
        taskId: 12345,
        amount: 0.05,
        complexity: 'medium',
        turnaround: 'priority'
      };

      await paymentHandler.recordPayment(
        paymentData.workerId,
        paymentData.taskId,
        paymentData.amount,
        paymentData.complexity,
        paymentData.turnaround
      );

      // Verify in database
      const result = await postgresDb.query(`
        SELECT * FROM worker_payments
        WHERE worker_id = $1 AND task_id = $2
      `, [paymentData.workerId, paymentData.taskId]);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].amount).toBe('0.050000');
      expect(result.rows[0].complexity).toBe('medium');
    });

    test('should update worker balance', async () => {
      const workerId = 999986;
      const amount = 2.5;

      await paymentHandler.updateWorkerBalance(workerId, amount);

      const balance = await paymentHandler.getWorkerBalance(workerId);
      expect(balance.balance).toBe(2.5);
    });
  });

  describe('Rate Calculations', () => {
    test('should calculate urgent expert task', async () => {
      const payment = await paymentHandler.calculateTaskPayment(
        1,
        'expert',
        'urgent',
        1.0
      );

      expect(payment.amount).toBe(1.875); // 0.75 * 2.5
      expect(payment.baseRate).toBe(0.75);
      expect(payment.multiplier).toBe(2.5);
    });

    test('should cap quality bonus at 20%', async () => {
      const payment = await paymentHandler.calculateTaskPayment(
        1,
        'simple',
        'standard',
        1.0 // Perfect quality
      );

      expect(payment.qualityBonus).toBe(0.2); // Max 20%
      expect(payment.amount).toBe(0.024); // 0.02 * 1.2
    });

    test('should handle negative quality bonus', async () => {
      const payment = await paymentHandler.calculateTaskPayment(
        1,
        'simple',
        'standard',
        0.9 // 90% quality
      );

      expect(payment.qualityBonus).toBe(0);
      expect(payment.amount).toBe(0.02); // No bonus
    });
  });
});

// Integration test
describe('Payment System Integration', () => {
  test('should process complete payment flow', async () => {
    const workerId = 999985;

    // 1. Create payment channel
    const channel = await paymentHandler.createPaymentChannel(workerId, 10);
    expect(channel).toBeDefined();

    // 2. Complete multiple tasks
    const tasks = [
      { id: 1001, complexity: 'simple', turnaround: 'standard' },
      { id: 1002, complexity: 'medium', turnaround: 'priority' },
      { id: 1003, complexity: 'complex', turnaround: 'standard' }
    ];

    for (const task of tasks) {
      const result = await paymentHandler.payWorker(
        workerId,
        task.id,
        task.complexity,
        task.turnaround
      );
      expect(result.success).toBe(true);
    }

    // 3. Check total earned
    const balance = await paymentHandler.getWorkerBalance(workerId);
    expect(balance.channelBalance).toBeGreaterThan(0);

    // 4. Process withdrawal
    const withdrawResult = await paymentHandler.withdrawFunds(
      workerId,
      Math.floor(balance.channelBalance)
    );
    expect(withdrawResult.success).toBe(true);

    // 5. Process batch
    const batchResult = await paymentHandler.processWithdrawalBatch();
    expect(batchResult.processed).toBeGreaterThan(0);
  });
});

// Performance test
describe('Payment System Performance', () => {
  test('should handle 100 concurrent payments', async () => {
    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < 100; i++) {
      const workerId = 900000 + i;

      // Create channel
      await paymentHandler.createPaymentChannel(workerId, 10);

      // Process payment
      promises.push(
        paymentHandler.payWorker(workerId, i, 'simple', 'standard')
      );
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    expect(results.every(r => r.success)).toBe(true);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds
  });
});

// Run tests
if (require.main === module) {
  // Run specific test
  console.log('Running payment system tests...');
}

export {};