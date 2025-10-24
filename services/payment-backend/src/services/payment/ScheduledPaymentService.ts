import { postgresDb } from '../database';
import { TonWalletService } from '../ton/TonWalletService';
import cron from 'node-cron';
import { STAKING_CONFIG } from '../../config/payment-chains';

export interface ScheduledPayment {
  id: number;
  userId: number;
  recipientId: number;
  amount: number;
  currency: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextPaymentAt: Date;
  endDate?: Date;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  totalPayments: number;
  completedPayments: number;
  metadata?: any;
}

export interface CreateScheduledPaymentInput {
  userId: number;
  recipientId: number;
  amount: number;
  currency?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  startDate?: Date;
  endDate?: Date;
  metadata?: any;
}

export class ScheduledPaymentService {
  private tonService: TonWalletService;
  private isRunning: boolean = false;

  constructor() {
    this.tonService = new TonWalletService();
    this.startScheduler();
  }

  /**
   * Start the scheduled payment processor
   */
  private startScheduler() {
    // Run every hour to process scheduled payments
    cron.schedule('0 * * * *', async () => {
      if (!this.isRunning) {
        this.isRunning = true;
        try {
          await this.processPendingPayments();
        } catch (error) {
          console.error('Error processing scheduled payments:', error);
        } finally {
          this.isRunning = false;
        }
      }
    });
  }

  /**
   * Create a new scheduled payment
   */
  async createScheduledPayment(input: CreateScheduledPaymentInput): Promise<ScheduledPayment> {
    const {
      userId,
      recipientId,
      amount,
      currency = 'USDT',
      frequency,
      startDate = new Date(),
      endDate,
      metadata
    } = input;

    // Validate minimum amount
    if (amount < STAKING_CONFIG.MIN_SCHEDULED_PAYMENT) {
      throw new Error(`Minimum scheduled payment amount is ${STAKING_CONFIG.MIN_SCHEDULED_PAYMENT} ${currency}`);
    }

    // Calculate next payment date
    const nextPaymentAt = this.calculateNextPaymentDate(startDate, frequency);

    const query = `
      INSERT INTO scheduled_payments (
        user_id, recipient_id, amount, currency, frequency,
        next_payment_at, end_date, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await postgresDb.query(query, [
      userId, recipientId, amount, currency, frequency,
      nextPaymentAt, endDate, JSON.stringify(metadata || {})
    ]);

    return result.rows[0];
  }

  /**
   * Get all scheduled payments for a user
   */
  async getUserScheduledPayments(
    userId: number,
    status?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ payments: ScheduledPayment[]; total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE user_id = $1';
    const params = [userId];

    if (status) {
      whereClause += ' AND status = $2';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) FROM scheduled_payments ${whereClause}`;
    const countResult = await postgresDb.query(countQuery, params);

    const paymentsQuery = `
      SELECT * FROM scheduled_payments ${whereClause}
      ORDER BY next_payment_at ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const paymentsResult = await postgresDb.query(paymentsQuery, params);

    // Parse metadata
    const payments = paymentsResult.rows.map(payment => ({
      ...payment,
      metadata: payment.metadata ? JSON.parse(payment.metadata) : null
    }));

    return {
      payments,
      total: parseInt(countResult.rows[0].count)
    };
  }

  /**
   * Update scheduled payment
   */
  async updateScheduledPayment(
    id: number,
    userId: number,
    updates: Partial<ScheduledPayment>
  ): Promise<ScheduledPayment> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id') {
        setClause.push(`${this.camelToSnake(key)} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id, userId);

    const query = `
      UPDATE scheduled_payments
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await postgresDb.query(query, values);

    if (!result.rows[0]) {
      throw new Error('Scheduled payment not found');
    }

    return {
      ...result.rows[0],
      metadata: result.rows[0].metadata ? JSON.parse(result.rows[0].metadata) : null
    };
  }

  /**
   * Pause scheduled payment
   */
  async pauseScheduledPayment(id: number, userId: number): Promise<void> {
    await postgresDb.query(
      'UPDATE scheduled_payments SET status = $1 WHERE id = $2 AND user_id = $3',
      ['paused', id, userId]
    );
  }

  /**
   * Resume scheduled payment
   */
  async resumeScheduledPayment(id: number, userId: number): Promise<void> {
    const payment = await postgresDb.query(
      'SELECT * FROM scheduled_payments WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (!payment.rows[0]) {
      throw new Error('Scheduled payment not found');
    }

    // Calculate new next payment date
    const nextPaymentAt = this.calculateNextPaymentDate(new Date(), payment.rows[0].frequency);

    await postgresDb.query(`
      UPDATE scheduled_payments
      SET status = 'active', next_payment_at = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
    `, [nextPaymentAt, id, userId]);
  }

  /**
   * Cancel scheduled payment
   */
  async cancelScheduledPayment(id: number, userId: number): Promise<void> {
    await postgresDb.query(
      'UPDATE scheduled_payments SET status = $1 WHERE id = $2 AND user_id = $3',
      ['cancelled', id, userId]
    );
  }

  /**
   * Process all pending scheduled payments
   */
  async processPendingPayments(): Promise<void> {
    const query = `
      SELECT * FROM scheduled_payments
      WHERE status = 'active'
      AND next_payment_at <= NOW()
      AND (end_date IS NULL OR end_date > NOW())
      ORDER BY next_payment_at ASC
    `;

    const result = await postgresDb.query(query);
    const payments = result.rows;

    for (const payment of payments) {
      try {
        await this.executeScheduledPayment(payment);
      } catch (error) {
        console.error(`Failed to execute scheduled payment ${payment.id}:`, error);
        // Update status to failed
        await postgresDb.query(
          'UPDATE scheduled_payments SET status = $2 WHERE id = $1',
          [payment.id, 'failed']
        );
      }
    }
  }

  /**
   * Execute a single scheduled payment
   */
  private async executeScheduledPayment(payment: ScheduledPayment): Promise<void> {
    const { id, userId, recipientId, amount, currency, frequency } = payment;

    // Check user balance
    const wallet = await this.tonService.getUserWallet(userId, 'mainnet');
    const balance = currency === 'USDT' ? wallet.balance_usdt : wallet.balance_ton;

    if (balance < amount) {
      throw new Error('Insufficient balance for scheduled payment');
    }

    // Get recipient's wallet address
    const recipientWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = $1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const recipientResult = await postgresDb.query(recipientWalletQuery, [recipientId]);

    if (!recipientResult.rows[0]) {
      throw new Error('Recipient wallet not found');
    }

    // Execute payment
    const txHash = await this.tonService.sendTransaction(userId, {
      toAddress: recipientResult.rows[0].wallet_address,
      amount: amount.toString(),
      tokenType: currency === 'USDT' ? 'USDT' : 'TON',
      message: `Scheduled payment #${id}`
    }, 'mainnet');

    // Update payment record
    const nextPaymentAt = this.calculateNextPaymentDate(new Date(), frequency);
    const isCompleted = payment.endDate && nextPaymentAt > payment.endDate;

    await postgresDb.query(`
      UPDATE scheduled_payments
      SET
        next_payment_at = $1,
        completed_payments = completed_payments + 1,
        total_payments = total_payments + 1,
        status = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [isCompleted ? payment.endDate : nextPaymentAt, isCompleted ? 'completed' : 'active', id]);

    // Record the payment transaction
    await postgresDb.query(`
      INSERT INTO ton_transactions (
        tx_hash, user_id, from_address, to_address,
        amount_usdt, token_type, network_name, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'mainnet', 'confirmed')
    `, [
      txHash,
      userId,
      wallet.wallet_address,
      recipientResult.rows[0].wallet_address,
      currency === 'USDT' ? amount : 0,
      currency
    ]);

    console.log(`Scheduled payment ${id} executed successfully. Tx: ${txHash}`);
  }

  /**
   * Calculate next payment date based on frequency
   */
  private calculateNextPaymentDate(startDate: Date, frequency: string): Date {
    const nextDate = new Date(startDate);

    switch (frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }

    return nextDate;
  }

  /**
   * Get scheduled payment statistics
   */
  async getPaymentStats(userId: number): Promise<any> {
    const query = `
      SELECT
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE status = 'active') as active_payments,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_payments,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_payments,
        SUM(amount) FILTER (WHERE status = 'active') as scheduled_amount,
        SUM(amount) FILTER (WHERE status = 'completed') as completed_amount,
        AVG(completed_payments::float / total_payments) as completion_rate
      FROM scheduled_payments
      WHERE user_id = $1
    `;

    const result = await postgresDb.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Bulk create scheduled payments (e.g., for payroll)
   */
  async bulkCreateScheduledPayments(
    userId: number,
    payments: CreateScheduledPaymentInput[]
  ): Promise<ScheduledPayment[]> {
    const createdPayments = [];

    for (const payment of payments) {
      try {
        const created = await this.createScheduledPayment({ ...payment, userId });
        createdPayments.push(created);
      } catch (error) {
        console.error(`Failed to create scheduled payment:`, error);
      }
    }

    return createdPayments;
  }

  /**
   * Get upcoming payments for the next 7 days
   */
  async getUpcomingPayments(userId: number): Promise<ScheduledPayment[]> {
    const query = `
      SELECT * FROM scheduled_payments
      WHERE user_id = $1
      AND status = 'active'
      AND next_payment_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      ORDER BY next_payment_at ASC
    `;

    const result = await postgresDb.query(query, [userId]);
    return result.rows.map(payment => ({
      ...payment,
      metadata: payment.metadata ? JSON.parse(payment.metadata) : null
    }));
  }

  /**
   * Helper method to convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}