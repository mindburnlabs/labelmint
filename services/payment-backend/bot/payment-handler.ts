import { Bot, GrammyError, HttpError } from 'grammy';
import { InlineKeyboard } from 'grammy/inline-keyboards';
import { TonClient, Address } from '@ton/ton';
import { fromNano, toNano } from '@ton/core';
import { postgresDb } from '../services/database';

// Payment processor contract interfaces
interface PaymentChannel {
  id: number;
  participant: string;
  capacity: number;
  expiry: number;
  spent: number;
  isActive: boolean;
}

interface PaymentTask {
  id: number;
  complexity: 'simple' | 'medium' | 'complex' | 'expert';
  baseRate: number;
  multiplier: number;
}

interface WorkerBalance {
  workerId: number;
  balance: number;
  channelBalance: number;
  lastUpdate: Date;
}

// Task complexity rates (in USDT)
const TASK_RATES: Record<string, number> = {
  simple: 0.02,
  medium: 0.05,
  complex: 0.15,
  expert: 0.75
};

// Turnaround multipliers
const TURNAROUND_MULTIPLIERS = {
  standard: 1,
  priority: 1.5,
  urgent: 2.5
};

export class PaymentHandler {
  private bot: Bot;
  private tonClient: TonClient;
  private paymentProcessorAddress: Address;
  private paymentChannels: Map<string, PaymentChannel> = new Map();
  private workerBalances: Map<number, WorkerBalance> = new Map();

  constructor(bot: Bot, tonClient: TonClient, contractAddress: string) {
    this.bot = bot;
    this.tonClient = tonClient;
    this.paymentProcessorAddress = Address.parse(contractAddress);
  }

  /**
   * Initialize payment handler
   */
  async initialize() {
    // Load existing payment channels from database
    await this.loadPaymentChannels();

    // Load worker balances
    await this.loadWorkerBalances();

    // Setup payment commands
    this.setupCommands();

    console.log('Payment handler initialized');
  }

  /**
   * Setup payment-related bot commands
   */
  private setupCommands() {
    // Balance command
    this.bot.command('balance', async (ctx) => {
      const workerId = ctx.from?.id;
      if (!workerId) return;

      const balance = await this.getWorkerBalance(workerId);

      const message = `💰 Your Balance:

💵 USDT: ${balance.balance.toFixed(6)}
⚡ Channel Balance: ${balance.channelBalance.toFixed(6)}
📊 Total: ${(balance.balance + balance.channelBalance).toFixed(6)}

Last updated: ${balance.lastUpdate.toLocaleString()}`;

      await ctx.reply(message, {
        reply_markup: this.createPaymentKeyboard()
      });
    });

    // Withdraw command
    this.bot.command('withdraw', async (ctx) => {
      const workerId = ctx.from?.id;
      if (!workerId) return;

      // Parse amount
      const match = ctx.message?.text?.match(/\/withdraw\s+(\d+\.?\d*)/);
      if (!match) {
        await ctx.reply('Usage: /withdraw <amount in USDT>\nExample: /withdraw 10.5');
        return;
      }

      const amount = parseFloat(match[1]);

      try {
        const result = await this.withdrawFunds(workerId, amount);

        if (result.success) {
          await ctx.reply(`✅ Withdrawal successful!\nAmount: ${amount} USDT\nFee: ${result.fee} USDT\nTX: ${result.txHash}`);
        } else {
          await ctx.reply(`❌ Withdrawal failed: ${result.error}`);
        }
      } catch (error) {
        await ctx.reply('❌ Withdrawal failed. Please try again.');
      }
    });

    // Payment channel status
    this.bot.command('channel', async (ctx) => {
      const workerId = ctx.from?.id;
      if (!workerId) return;

      const channel = await this.getPaymentChannel(workerId);

      if (channel) {
        const remaining = channel.capacity - channel.spent;
        await ctx.reply(`📡 Payment Channel Status:

Channel ID: ${channel.id}
Capacity: ${channel.capacity.toFixed(6)} USDT
Spent: ${channel.spent.toFixed(6)} USDT
Remaining: ${remaining.toFixed(6)} USDT
Expires: ${new Date(channel.expiry * 1000).toLocaleString()}`);
      } else {
        await ctx.reply('No active payment channel. Start completing tasks to open one!');
      }
    });

    // Handle callback queries
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const workerId = ctx.from?.id;

      if (!workerId) return;

      if (data === 'request_payout') {
        await this.handlePayoutRequest(ctx, workerId);
      } else if (data === 'create_channel') {
        await this.createPaymentChannel(workerId);
        await ctx.answer('Payment channel created!');
      } else if (data.startsWith('withdraw_')) {
        const amount = parseFloat(data.split('_')[1]);
        await this.withdrawFunds(workerId, amount);
      }
    });
  }

  /**
   * Pay worker instantly after task completion
   */
  async payWorker(workerId: number, taskId: number, complexity: string, turnaround: string = 'standard') {
    try {
      // Calculate payment amount
      const baseRate = TASK_RATES[complexity] || 0.02;
      const multiplier = TURNAROUND_MULTIPLIERS[turnaround as keyof typeof TURNAROUND_MULTIPLIERS] || 1;
      const amount = baseRate * multiplier;

      // Check if worker has active payment channel
      const channel = await this.getPaymentChannel(workerId);

      if (channel && channel.capacity - channel.spent >= amount) {
        // Use payment channel (zero fee)
        const result = await this.channelPayment(workerId, amount, taskId);

        if (result.success) {
          // Send notification
          await this.bot.api.sendMessage(workerId, `🎉 Task completed!\n\n💰 Earned: ${amount.toFixed(6)} USDT\n⚡ Transfer type: Instant (no fee)\n📋 Task ID: ${taskId}`, {
            reply_markup: this.createPaymentKeyboard()
          });
        }
      } else {
        // Update internal balance
        await this.updateWorkerBalance(workerId, amount);

        // Send notification
        await this.bot.api.sendMessage(workerId, `🎉 Task completed!\n\n💰 Earned: ${amount.toFixed(6)} USDT\n💳 Added to balance\n📋 Task ID: ${taskId}`, {
          reply_markup: this.createPaymentKeyboard()
        });

        // Check if balance exceeds threshold for auto-withdrawal
        const balance = await this.getWorkerBalance(workerId);
        if (balance.balance >= 10) { // 10 USDT threshold
          await this.suggestWithdrawal(workerId);
        }
      }

      // Record payment in database
      await this.recordPayment(workerId, taskId, amount, complexity, turnaround);

      return { success: true, amount };

    } catch (error) {
      console.error('Payment error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Zero-fee internal transfer through payment channel
   */
  private async channelPayment(workerId: number, amount: number, taskId: number) {
    const channel = await this.getPaymentChannel(workerId);

    if (!channel) {
      return { success: false, error: 'No payment channel' };
    }

    if (channel.capacity - channel.spent < amount) {
      return { success: false, error: 'Insufficient channel capacity' };
    }

    // Update channel spent amount
    channel.spent += amount;
    this.paymentChannels.set(workerId.toString(), channel);

    // Update in database
    await postgresDb.query(`
      UPDATE payment_channels
      SET spent = $1, last_used = NOW()
      WHERE worker_id = $2
    `, [channel.spent, workerId]);

    // Record internal transaction
    await postgresDb.query(`
      INSERT INTO internal_transactions
      (from_user_id, to_user_id, amount, task_id, type, fee)
      VALUES (1, $1, $2, $3, 'channel_payment', 0)
    `, [workerId, amount, taskId]);

    return { success: true, fee: 0, txHash: 'channel_payment' };
  }

  /**
   * External withdrawal with batching
   */
  async withdrawFunds(workerId: number, amount: number) {
    try {
      const balance = await this.getWorkerBalance(workerId);

      if (balance.balance < amount) {
        return { success: false, error: 'Insufficient balance' };
      }

      // Calculate fee (0.1 USDT for withdrawals)
      const fee = 0.1;
      const total = amount + fee;

      // Add to withdrawal batch
      const batchId = await this.addToWithdrawalBatch(workerId, amount, fee);

      // Update balance
      await this.updateWorkerBalance(workerId, -total);

      return {
        success: true,
        fee,
        batchId,
        message: 'Withdrawal added to batch queue'
      };

    } catch (error) {
      console.error('Withdrawal error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create payment channel for worker
   */
  async createPaymentChannel(workerId: number, capacity: number = 50) {
    try {
      // Check if channel already exists
      const existing = await this.getPaymentChannel(workerId);
      if (existing && existing.expiry > Date.now() / 1000) {
        return existing;
      }

      // Create new channel (valid for 7 days)
      const channel: PaymentChannel = {
        id: Date.now(),
        participant: workerId.toString(),
        capacity,
        expiry: (Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
        spent: 0,
        isActive: true
      };

      // Save to database
      await postgresDb.query(`
        INSERT INTO payment_channels
        (worker_id, channel_id, capacity, expiry, spent, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (worker_id) DO UPDATE SET
        capacity = EXCLUDED.capacity,
        expiry = EXCLUDED.expiry,
        spent = 0,
        is_active = true
      `, [workerId, channel.id, capacity, channel.expiry, channel.spent, true]);

      this.paymentChannels.set(workerId.toString(), channel);

      return channel;

    } catch (error) {
      console.error('Create channel error:', error);
      throw error;
    }
  }

  /**
   * Batch withdrawal processing
   */
  async processWithdrawalBatch() {
    try {
      // Get pending withdrawals
      const query = `
        SELECT * FROM withdrawal_batch
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 50
      `;

      const result = await postgresDb.query(query);

      if (result.rows.length === 0) {
        return { processed: 0 };
      }

      // Group by token (USDT in this case)
      const batches: { [key: string]: any[] } = {};

      result.rows.forEach(withdrawal => {
        const key = withdrawal.token_type || 'USDT';
        if (!batches[key]) {
          batches[key] = [];
        }
        batches[key].push(withdrawal);
      });

      let totalProcessed = 0;

      // Process each batch
      for (const [token, withdrawals] of Object.entries(batches)) {
        const totalAmount = withdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0);

        // Create batch transaction
        const txHash = await this.sendBatchWithdrawal(withdrawals, totalAmount, token);

        if (txHash) {
          // Update status
          await postgresDb.query(`
            UPDATE withdrawal_batch
            SET status = 'sent', tx_hash = $1, sent_at = NOW()
            WHERE id = ANY($2)
          `, [txHash, withdrawals.map(w => w.id)]);

          totalProcessed += withdrawals.length;

          // Notify workers
          for (const withdrawal of withdrawals) {
            await this.bot.api.sendMessage(withdrawal.worker_id,
              `✅ Withdrawal sent!\nAmount: ${withdrawal.amount} ${token}\nTX: ${txHash}`
            );
          }
        }
      }

      return { processed: totalProcessed };

    } catch (error) {
      console.error('Batch withdrawal error:', error);
      return { processed: 0, error: error.message };
    }
  }

  /**
   * Send batch withdrawal to blockchain
   */
  private async sendBatchWithdrawal(withdrawals: any[], totalAmount: number, token: string) {
    // Implementation depends on your TON integration
    // This is a simplified version

    if (token === 'USDT') {
      // Use USDT Jetton transfer
      // In production, this would create a batch transfer message

      console.log(`Sending ${totalAmount} USDT to ${withdrawals.length} recipients`);

      // Return mock transaction hash
      return 'batch_' + Date.now();
    }

    return null;
  }

  /**
   * Get worker balance from database
   */
  private async getWorkerBalance(workerId: number): Promise<WorkerBalance> {
    const cached = this.workerBalances.get(workerId);
    if (cached && Date.now() - cached.lastUpdate.getTime() < 60000) { // 1 minute cache
      return cached;
    }

    const query = `
      SELECT
        COALESCE(balance_usdt, 0) as balance,
        COALESCE(channel_balance, 0) as channel_balance
      FROM worker_balances
      WHERE worker_id = $1
    `;

    const result = await postgresDb.query(query, [workerId]);

    const balance: WorkerBalance = {
      workerId,
      balance: parseFloat(result.rows[0]?.balance || 0),
      channelBalance: parseFloat(result.rows[0]?.channel_balance || 0),
      lastUpdate: new Date()
    };

    this.workerBalances.set(workerId, balance);
    return balance;
  }

  /**
   * Update worker balance
   */
  private async updateWorkerBalance(workerId: number, amount: number) {
    await postgresDb.query(`
      INSERT INTO worker_balances (worker_id, balance_usdt, last_updated)
      VALUES ($1, $2, NOW())
      ON CONFLICT (worker_id) DO UPDATE SET
      balance_usdt = worker_balances.balance_usdt + EXCLUDED.balance_usdt,
      last_updated = NOW()
    `, [workerId, amount]);

    // Update cache
    const cached = this.workerBalances.get(workerId);
    if (cached) {
      cached.balance += amount;
      cached.lastUpdate = new Date();
    }
  }

  /**
   * Get payment channel for worker
   */
  private async getPaymentChannel(workerId: number): Promise<PaymentChannel | null> {
    const cached = this.paymentChannels.get(workerId.toString());
    if (cached && cached.expiry > Date.now() / 1000) {
      return cached;
    }

    const query = `
      SELECT * FROM payment_channels
      WHERE worker_id = $1 AND is_active = true
    `;

    const result = await postgresDb.query(query, [workerId]);

    if (result.rows.length > 0) {
      const channel: PaymentChannel = {
        id: result.rows[0].channel_id,
        participant: result.rows[0].worker_id.toString(),
        capacity: parseFloat(result.rows[0].capacity),
        expiry: Math.floor(new Date(result.rows[0].expiry).getTime() / 1000),
        spent: parseFloat(result.rows[0].spent),
        isActive: result.rows[0].is_active
      };

      this.paymentChannels.set(workerId.toString(), channel);
      return channel;
    }

    return null;
  }

  /**
   * Add withdrawal to batch
   */
  private async addToWithdrawalBatch(workerId: number, amount: number, fee: number) {
    const query = `
      INSERT INTO withdrawal_batch
      (worker_id, amount, fee, token_type, status)
      VALUES ($1, $2, $3, 'USDT', 'pending')
      RETURNING id
    `;

    const result = await postgresDb.query(query, [workerId, amount, fee]);
    return result.rows[0].id;
  }

  /**
   * Record payment in database
   */
  private async recordPayment(workerId: number, taskId: number, amount: number, complexity: string, turnaround: string) {
    await postgresDb.query(`
      INSERT INTO worker_payments
      (worker_id, task_id, amount, complexity, turnaround_multiplier, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [workerId, taskId, amount, complexity, TURNAROUND_MULTIPLIERS[turnaround as keyof typeof TURNAROUND_MULTIPLIERS] || 1]);
  }

  /**
   * Suggest withdrawal to worker
   */
  private async suggestWithdrawal(workerId: number) {
    const keyboard = new InlineKeyboard()
      .text(`Withdraw 10 USDT`, `withdraw_10`).row()
      .text(`Withdraw 25 USDT`, `withdraw_25`).row()
      .text(`Withdraw 50 USDT`, `withdraw_50`).row()
      .text(`Withdraw All`, `withdraw_all`);

    await this.bot.api.sendMessage(workerId,
      `💰 You have accumulated enough balance for withdrawal!\n\nChoose amount:`,
      { reply_markup: keyboard }
    );
  }

  /**
   * Handle payout request
   */
  private async handlePayoutRequest(ctx: any, workerId: number) {
    const balance = await this.getWorkerBalance(workerId);
    const total = balance.balance + balance.channelBalance;

    if (total < 1) {
      await ctx.answer('Insufficient balance for withdrawal', { show_alert: true });
      return;
    }

    await ctx.editMessageText(`Select withdrawal amount:`, {
      reply_markup: new InlineKeyboard()
        .text(`Withdraw ${Math.min(5, total).toFixed(2)} USDT`, `withdraw_${Math.min(5, total)}`).row()
        .text(`Withdraw ${Math.min(10, total).toFixed(2)} USDT`, `withdraw_${Math.min(10, total)}`).row()
        .text(`Withdraw ${Math.min(25, total).toFixed(2)} USDT`, `withdraw_${Math.min(25, total)}`).row()
        .text(`Withdraw All (${total.toFixed(2)} USDT)`, `withdraw_${total}`)
    });
  }

  /**
   * Create payment keyboard
   */
  private createPaymentKeyboard() {
    return new InlineKeyboard()
      .text('💰 Balance', '/balance').row()
      .text('📡 Channel Status', '/channel').row()
      .text('💳 Withdraw', '/withdraw')
      .text('💸 Request Payout', 'request_payout');
  }

  /**
   * Load payment channels from database
   */
  private async loadPaymentChannels() {
    const query = `
      SELECT * FROM payment_channels
      WHERE is_active = true AND expiry > NOW()
    `;

    const result = await postgresDb.query(query);

    result.rows.forEach(row => {
      const channel: PaymentChannel = {
        id: row.channel_id,
        participant: row.worker_id.toString(),
        capacity: parseFloat(row.capacity),
        expiry: Math.floor(new Date(row.expiry).getTime() / 1000),
        spent: parseFloat(row.spent),
        isActive: row.is_active
      };

      this.paymentChannels.set(channel.participant, channel);
    });
  }

  /**
   * Load worker balances from database
   */
  private async loadWorkerBalances() {
    const query = `
      SELECT worker_id, balance_usdt, channel_balance, last_updated
      FROM worker_balances
    `;

    const result = await postgresDb.query(query);

    result.rows.forEach(row => {
      this.workerBalances.set(row.worker_id, {
        workerId: row.worker_id,
        balance: parseFloat(row.balance_usdt),
        channelBalance: parseFloat(row.channel_balance),
        lastUpdate: row.last_updated
      });
    });
  }

  /**
   * Auto-convert payment based on task complexity
   */
  async calculateTaskPayment(taskId: number, complexity: string, turnaround: string, quality: number = 1.0) {
    const baseRate = TASK_RATES[complexity] || 0.02;
    const multiplier = TURNAROUND_MULTIPLIERS[turnaround as keyof typeof TURNAROUND_MULTIPLIERS] || 1;

    // Quality bonus (up to 20% for perfect quality)
    const qualityBonus = Math.min(0.2, (quality - 0.95) * 4);

    const amount = baseRate * multiplier * (1 + qualityBonus);

    return {
      amount,
      baseRate,
      multiplier,
      qualityBonus,
      complexity,
      turnaround
    };
  }
}