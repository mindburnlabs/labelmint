import { query, getClient } from '../database/connection.js';
import crypto from 'crypto';
import { Address, beginCell, toNano } from '@ton/ton';
import { cryptoService } from '../../bot/src/services/cryptoService.js';

interface ClientPaymentRequest {
  projectId: string;
  amountUSDT: number;
  description?: string;
  clientTelegramId: number;
}

interface WorkerPaymentRequest {
  workerId: number;
  taskId: string;
  amount: number;
  bonusAmount?: number;
}

interface WithdrawalRequest {
  workerId: number;
  amount: number;
  address: string;
  method: 'ton' | 'telegram' | 'usdt';
}

interface BatchWithdrawal {
  id: string;
  recipients: Array<{
    address: string;
    amount: number;
    workerId: number;
  }>;
  totalAmount: number;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export class MicropaymentSystem {
  private readonly PLATFORM_WALLET: string;
  private readonly PLATFORM_FEE_PERCENTAGE = 0.05; // 5% platform fee
  private readonly MIN_WITHDRAWAL = 1.0; // 1 USDT minimum
  private readonly MAX_BATCH_SIZE = 100; // Max transactions per batch

  constructor() {
    this.PLATFORM_WALLET = process.env.PLATFORM_TON_WALLET || '';
  }

  /**
   * Generate payment link for clients
   */
  async generateClientPaymentLink(request: ClientPaymentRequest): Promise<{
    paymentLink: string;
    invoiceLink?: string;
    paymentId: string;
  }> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Create payment record
      const paymentResult = await client.query(
        `INSERT INTO client_payments
         (project_id, client_telegram_id, amount_usdt, status, description, created_at)
         VALUES ($1, $2, $3, 'pending', $4, NOW())
         RETURNING id`,
        [request.projectId, request.clientTelegramId, request.amountUSDT, request.description]
      );

      const paymentId = paymentResult.rows[0].id;

      // Calculate platform fee
      const platformFee = request.amountUSDT * this.PLATFORM_FEE_PERCENTAGE;
      const totalAmount = request.amountUSDT + platformFee;

      // Generate TON payment link
      const paymentLink = `https://app.tonkeeper.com/transfer/${this.PLATFORM_WALLET}?` +
        `amount=${toNano(totalAmount).toString()}&` +
        `text=payment_${paymentId}&` +
        `bin=${this.encodePaymentData(paymentId)}`;

      // Generate Telegram invoice (optional)
      let invoiceLink;
      if (process.env.TELEGRAM_BOT_TOKEN) {
        invoiceLink = await this.createTelegramInvoice(request, paymentId, totalAmount);
      }

      await client.query('COMMIT');

      return {
        paymentLink,
        invoiceLink,
        paymentId: paymentId.toString()
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to generate payment link:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process worker payment for completed task
   */
  async processWorkerPayment(request: WorkerPaymentRequest): Promise<{
    success: boolean;
    newBalance: number;
    transactionId?: string;
  }> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get task details
      const taskResult = await client.query(
        'SELECT reward, bonus_reward FROM tasks WHERE id = $1',
        [request.taskId]
      );

      if (taskResult.rows.length === 0) {
        throw new Error('Task not found');
      }

      const task = taskResult.rows[0];
      const totalReward = request.amount + (request.bonusAmount || 0);

      // Update worker balance
      const balanceResult = await client.query(
        `UPDATE workers
         SET balance = balance + $1,
             total_earned = total_earned + $1,
             tasks_completed = tasks_completed + 1,
             last_active = NOW()
         WHERE telegram_id = $2
         RETURNING balance, total_earned`,
        [totalReward, request.workerId]
      );

      // Create transaction record
      const transactionResult = await client.query(
        `INSERT INTO worker_transactions
         (worker_id, type, amount, reference, status, created_at)
         VALUES ($1, 'earning', $2, $3, 'completed', NOW())
         RETURNING id`,
        [request.workerId, totalReward, request.taskId]
      );

      // Update task status
      await client.query(
        `UPDATE tasks
         SET status = 'paid',
             paid_at = NOW()
         WHERE id = $1`,
        [request.taskId]
      );

      await client.query('COMMIT');

      return {
        success: true,
        newBalance: balanceResult.rows[0].balance,
        transactionId: transactionResult.rows[0].id.toString()
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to process worker payment:', error);
      return {
        success: false,
        newBalance: 0
      };
    } finally {
      client.release();
    }
  }

  /**
   * Process USDT withdrawal
   */
  async processUSDTWithdrawal(request: WithdrawalRequest): Promise<{
    success: boolean;
    transactionHash?: string;
    paymentUrl?: string;
    error?: string;
  }> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check worker balance
      const balanceResult = await client.query(
        'SELECT balance FROM workers WHERE telegram_id = $1',
        [request.workerId]
      );

      if (balanceResult.rows.length === 0) {
        throw new Error('Worker not found');
      }

      const currentBalance = parseFloat(balanceResult.rows[0].balance);

      if (currentBalance < request.amount) {
        throw new Error('Insufficient balance');
      }

      if (request.amount < this.MIN_WITHDRAWAL) {
        throw new Error(`Minimum withdrawal is ${this.MIN_WITHDRAWAL} USDT`);
      }

      // Create withdrawal record
      const withdrawalResult = await client.query(
        `INSERT INTO withdrawals
         (worker_id, amount, method, status, address, fee, created_at)
         VALUES ($1, $2, $3, 'pending', $4, 0, NOW())
         RETURNING id`,
        [request.workerId, request.amount, request.method, request.address]
      );

      const withdrawalId = withdrawalResult.rows[0].id;

      // Deduct from balance (temporarily)
      await client.query(
        'UPDATE workers SET balance = balance - $1 WHERE telegram_id = $2',
        [request.amount, request.workerId]
      );

      if (request.method === 'telegram') {
        // Generate Telegram payment link
        const paymentUrl = `https://t.me/wallet?startapp=withdraw_${withdrawalId}`;

        await client.query('COMMIT');

        return {
          success: true,
          paymentUrl
        };
      } else {
        // Process crypto withdrawal
        const result = await cryptoService.sendUsdt({
          amount: request.amount,
          currency: 'USDT',
          recipientAddress: request.address
        }, process.env.USDT_PRIVATE_KEY!);

        if (result.success) {
          await client.query(
            `UPDATE withdrawals
             SET status = 'completed',
                 transaction_hash = $1,
                 completed_at = NOW()
             WHERE id = $2`,
            [result.transactionHash, withdrawalId]
          );
          await client.query('COMMIT');

          return {
            success: true,
            transactionHash: result.transactionHash
          };
        } else {
          // Refund balance on failure
          await client.query(
            'UPDATE workers SET balance = balance + $1 WHERE telegram_id = $2',
            [request.amount, request.workerId]
          );
          await client.query('ROLLBACK');

          return {
            success: false,
            error: result.error
          };
        }
      }
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Withdrawal failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      client.release();
    }
  }

  /**
   * Process batch withdrawals for efficiency
   */
  async processBatchWithdrawals(): Promise<{
    processed: number;
    totalAmount: number;
    errors: string[];
  }> {
    const client = await getClient();
    let processed = 0;
    let totalAmount = 0;
    const errors: string[] = [];

    try {
      // Get pending withdrawals
      const pendingResult = await client.query(
        `SELECT w.*, t.username
         FROM withdrawals w
         LEFT JOIN workers t ON w.worker_id = t.telegram_id
         WHERE w.status = 'pending'
           AND w.method IN ('ton', 'usdt')
         ORDER BY w.created_at ASC
         LIMIT $1`,
        [this.MAX_BATCH_SIZE]
      );

      if (pendingResult.rows.length === 0) {
        return { processed: 0, totalAmount: 0, errors };
      }

      // Group by amount for efficiency
      const amountGroups = new Map<number, any[]>();
      pendingResult.rows.forEach(withdrawal => {
        const amount = parseFloat(withdrawal.amount);
        if (!amountGroups.has(amount)) {
          amountGroups.set(amount, []);
        }
        amountGroups.get(amount)!.push(withdrawal);
      });

      await client.query('BEGIN');

      for (const [amount, withdrawals] of amountGroups) {
        try {
          // Create batch record
          const batchResult = await client.query(
            `INSERT INTO withdrawal_batches
             (total_amount, status, created_at)
             VALUES ($1, 'processing', NOW())
             RETURNING id`,
            [amount * withdrawals.length]
          );

          const batchId = batchResult.rows[0].id;

          // Process each withdrawal in the batch
          for (const withdrawal of withdrawals) {
            const result = await this.processIndividualWithdrawal(withdrawal);

            if (result.success) {
              processed++;
              totalAmount += amount;

              await client.query(
                `UPDATE withdrawals
                 SET batch_id = $1,
                     status = 'completed',
                     transaction_hash = $2,
                     completed_at = NOW()
                 WHERE id = $3`,
                [batchId, result.transactionHash, withdrawal.id]
              );
            } else {
              errors.push(`Failed withdrawal ${withdrawal.id}: ${result.error}`);

              // Refund balance
              await client.query(
                'UPDATE workers SET balance = balance + $1 WHERE telegram_id = $2',
                [amount, withdrawal.worker_id]
              );
            }
          }

          // Update batch status
          await client.query(
            `UPDATE withdrawal_batches
             SET status = 'completed',
                 completed_at = NOW()
             WHERE id = $1`,
            [batchId]
          );
        } catch (error: any) {
          errors.push(`Batch processing failed for amount ${amount}: ${error.message}`);
        }
      }

      await client.query('COMMIT');

      return { processed, totalAmount, errors };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Batch withdrawal failed:', error);
      return { processed: 0, totalAmount: 0, errors: ['Batch processing failed'] };
    } finally {
      client.release();
    }
  }

  /**
   * Create Telegram Stars invoice
   */
  private async createTelegramInvoice(
    request: ClientPaymentRequest,
    paymentId: string,
    amount: number
  ): Promise<string> {
    // This would use the Telegram Bot API to create an invoice
    // For now, return a placeholder
    return `https://t.me/${process.env.BOT_USERNAME}?start=payment_${paymentId}`;
  }

  /**
   * Encode payment data for TON transaction
   */
  private encodePaymentData(paymentId: string): string {
    const cell = beginCell()
      .storeUint(0, 32) // opcode
      .storeUint(parseInt(paymentId), 64)
      .storeUint(Date.now(), 64)
      .endCell();

    return cell.toBoc().toString('base64');
  }

  /**
   * Process individual withdrawal
   */
  private async processIndividualWithdrawal(withdrawal: any): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      const result = await cryptoService.sendUsdt({
        amount: parseFloat(withdrawal.amount),
        currency: 'USDT',
        recipientAddress: withdrawal.address
      }, process.env.USDT_PRIVATE_KEY!);

      return {
        success: result.success,
        transactionHash: result.transactionHash,
        error: result.error
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get worker wallet data
   */
  async getWorkerWalletData(workerId: number): Promise<{
    balance: number;
    totalEarnings: number;
    todayEarnings: number;
    labelsCount: number;
    telegramWallet?: string;
  }> {
    const result = await query(
      `SELECT
         w.balance,
         w.total_earned,
         w.telegram_wallet,
         COALESCE(today.earned, 0) as today_earned,
         COALESCE(today.labels, 0) as labels_count
       FROM workers w
       LEFT JOIN (
         SELECT
           worker_id,
           SUM(amount) as earned,
           COUNT(*) as labels
         FROM worker_transactions
         WHERE type = 'earning'
           AND DATE(created_at) = CURRENT_DATE
         GROUP BY worker_id
       ) today ON w.telegram_id = today.worker_id
       WHERE w.telegram_id = $1`,
      [workerId]
    );

    if (result.rows.length === 0) {
      throw new Error('Worker not found');
    }

    const row = result.rows[0];
    return {
      balance: parseFloat(row.balance) || 0,
      totalEarnings: parseFloat(row.total_earned) || 0,
      todayEarnings: parseFloat(row.today_earned) || 0,
      labelsCount: parseInt(row.labels_count) || 0,
      telegramWallet: row.telegram_wallet
    };
  }

  /**
   * Get worker transaction history
   */
  async getWorkerTransactions(workerId: number, limit: number = 50): Promise<any[]> {
    const result = await query(
      `SELECT *
       FROM worker_transactions
       WHERE worker_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [workerId, limit]
    );

    return result.rows;
  }

  /**
   * Verify payment completion
   */
  async verifyPayment(paymentId: string, transactionHash: string): Promise<boolean> {
    try {
      // Update payment status
      const result = await query(
        `UPDATE client_payments
         SET status = 'completed',
             transaction_hash = $1,
             completed_at = NOW()
         WHERE id = $2
         RETURNING project_id`,
        [transactionHash, paymentId]
      );

      if (result.rows.length > 0) {
        const projectId = result.rows[0].project_id;

        // Update project status
        await query(
          `UPDATE projects
           SET status = 'active',
               funded_at = NOW()
           WHERE id = $1`,
          [projectId]
        );

        return true;
      }

      return false;
    } catch (error) {
      console.error('Payment verification failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const micropaymentSystem = new MicropaymentSystem();