import { TonWalletService } from './ton/TonWalletService';
import { TransactionMonitor, TransactionMonitorConfig } from './ton/TransactionMonitor';
import { postgresDb } from '../database';
import { EventEmitter } from 'events';

export interface PaymentRequest {
  userId: number;
  amount: number;
  currency: 'TON' | 'USDT';
  toAddress?: string;
  description?: string;
  isInternal?: boolean;
  toUserId?: number;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  txHash?: string;
  error?: string;
  estimatedFee?: number;
  estimatedTime?: number;
}

export class PaymentProcessor extends EventEmitter {
  private walletService: TonWalletService;
  private monitor: TransactionMonitor;
  private network: 'mainnet' | 'testnet';
  private processing: Map<string, Promise<PaymentResult>> = new Map();

  constructor(network: 'mainnet' | 'testnet' = 'testnet') {
    super();
    this.network = network;
    this.walletService = new TonWalletService();

    const monitorConfig: TransactionMonitorConfig = {
      network,
      pollingInterval: 15000, // 15 seconds
      maxRetries: 10,
      batchSize: 50
    };

    this.monitor = new TransactionMonitor(monitorConfig);
    this.startMonitoring();
  }

  /**
   * Start transaction monitoring
   */
  private startMonitoring() {
    this.monitor.start();
    console.log('Payment processor started');
  }

  /**
   * Stop payment processor
   */
  stop() {
    this.monitor.stop();
    console.log('Payment processor stopped');
  }

  /**
   * Process payment request
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const paymentId = this.generatePaymentId();
    const processingKey = `${request.userId}-${paymentId}`;

    // Check if already processing
    if (this.processing.has(processingKey)) {
      return this.processing.get(processingKey)!;
    }

    const paymentPromise = this.executePayment(request, paymentId);
    this.processing.set(processingKey, paymentPromise);

    try {
      const result = await paymentPromise;
      return result;
    } finally {
      this.processing.delete(processingKey);
    }
  }

  /**
   * Execute payment
   */
  private async executePayment(request: PaymentRequest, paymentId: string): Promise<PaymentResult> {
    await postgresDb.query('BEGIN');

    try {
      // Validate request
      const validation = await this.validatePaymentRequest(request);
      if (!validation.valid) {
        await postgresDb.query('ROLLBACK');
        return { success: false, error: validation.error };
      }

      // Check for duplicate payment
      const duplicateCheck = await this.checkDuplicatePayment(request);
      if (duplicateCheck) {
        await postgresDb.query('ROLLBACK');
        return { success: false, error: 'Duplicate payment request' };
      }

      // Calculate fees
      const fees = await this.calculateFees(request);

      // Create payment record
      const paymentRecord = await this.createPaymentRecord(request, paymentId, fees);

      // Execute transaction
      let result: PaymentResult;

      if (request.isInternal && request.toUserId) {
        result = await this.processInternalPayment(request, paymentRecord.id);
      } else {
        result = await this.processBlockchainPayment(request, paymentRecord.id);
      }

      if (result.success) {
        await postgresDb.query('COMMIT');
        this.emit('payment.completed', { paymentId, result });
      } else {
        await postgresDb.query('ROLLBACK');
        this.emit('payment.failed', { paymentId, error: result.error });
      }

      return result;

    } catch (error) {
      await postgresDb.query('ROLLBACK');
      console.error('Payment processing error:', error);
      this.emit('payment.error', { paymentId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate payment request
   */
  private async validatePaymentRequest(request: PaymentRequest): Promise<{ valid: boolean; error?: string }> {
    // Basic validation
    if (!request.userId || !request.amount || request.amount <= 0) {
      return { valid: false, error: 'Invalid payment parameters' };
    }

    if (!request.isInternal && !request.toAddress) {
      return { valid: false, error: 'Recipient address required for external payments' };
    }

    if (request.isInternal && !request.toUserId) {
      return { valid: false, error: 'Recipient user ID required for internal payments' };
    }

    // Check user wallet
    try {
      const wallet = await this.walletService.getUserWallet(request.userId, this.network);
      if (!wallet) {
        return { valid: false, error: 'User wallet not found' };
      }

      // Check balance
      const balances = await this.walletService.getWalletBalance(wallet.wallet_address, this.network);
      const requiredBalance = request.currency === 'TON' ? request.amount : 0;

      if (parseFloat(balances.ton) < requiredBalance) {
        return { valid: false, error: 'Insufficient TON balance for gas fees' };
      }

      if (request.currency === 'USDT' && parseFloat(balances.usdt) < request.amount) {
        return { valid: false, error: 'Insufficient USDT balance' };
      }

      // Check spending limits
      const limitCheck = await this.checkSpendingLimits(request.userId, request.amount, request.currency);
      if (!limitCheck.allowed) {
        return { valid: false, error: limitCheck.reason };
      }

      return { valid: true };

    } catch (error) {
      return { valid: false, error: 'Wallet validation failed' };
    }
  }

  /**
   * Check for duplicate payment
   */
  private async checkDuplicatePayment(request: PaymentRequest): Promise<boolean> {
    const query = `
      SELECT id FROM payments
      WHERE user_id = $1
      AND amount = $2
      AND currency = $3
      AND (to_address = $4 OR to_user_id = $5)
      AND status = 'pending'
      AND created_at > NOW() - INTERVAL '5 minutes'
    `;

    const result = await postgresDb.query(query, [
      request.userId,
      request.amount,
      request.currency,
      request.toAddress || null,
      request.toUserId || null
    ]);

    return result.rows.length > 0;
  }

  /**
   * Calculate transaction fees
   */
  private async calculateFees(request: PaymentRequest): Promise<{ gas: number; service: number; total: number }> {
    const gasFee = request.currency === 'TON' ? 0.01 : 0.02; // TON gas fee
    const serviceFee = request.amount * 0.005; // 0.5% service fee
    const total = gasFee + serviceFee;

    return {
      gas: gasFee,
      service: serviceFee,
      total
    };
  }

  /**
   * Create payment record
   */
  private async createPaymentRecord(
    request: PaymentRequest,
    paymentId: string,
    fees: any
  ): Promise<any> {
    const query = `
      INSERT INTO payments
      (payment_id, user_id, amount, currency, to_address, to_user_id,
       description, is_internal, gas_fee, service_fee, total_fee, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12)
      RETURNING *
    `;

    const result = await postgresDb.query(query, [
      paymentId,
      request.userId,
      request.amount,
      request.currency,
      request.toAddress || null,
      request.toUserId || null,
      request.description || null,
      request.isInternal || false,
      fees.gas,
      fees.service,
      fees.total,
      JSON.stringify(request.metadata || {})
    ]);

    return result.rows[0];
  }

  /**
   * Process internal payment
   */
  private async processInternalPayment(request: PaymentRequest, paymentId: number): Promise<PaymentResult> {
    try {
      const transferResult = await this.walletService.internalTransfer(
        request.userId,
        request.toUserId!,
        request.amount,
        request.description
      );

      // Update payment status
      await postgresDb.query(`
        UPDATE payments
        SET status = 'completed', completed_at = NOW(), transaction_id = $1
        WHERE id = $2
      `, [transferResult.id, paymentId]);

      return {
        success: true,
        transactionId: transferResult.id.toString(),
        txHash: 'internal'
      };

    } catch (error) {
      await postgresDb.query(`
        UPDATE payments
        SET status = 'failed', error_message = $1
        WHERE id = $2
      `, [error.message, paymentId]);

      return { success: false, error: error.message };
    }
  }

  /**
   * Process blockchain payment
   */
  private async processBlockchainPayment(request: PaymentRequest, paymentId: number): Promise<PaymentResult> {
    try {
      const txHash = await this.walletService.sendTransaction(
        request.userId,
        {
          toAddress: request.toAddress!,
          amount: request.amount.toString(),
          tokenType: request.currency,
          message: request.description
        },
        this.network
      );

      // Add to monitoring
      await this.monitor.addTransaction(txHash, request.userId, this.network);

      // Update payment status
      await postgresDb.query(`
        UPDATE payments
        SET status = 'pending', tx_hash = $1
        WHERE id = $2
      `, [txHash, paymentId]);

      return {
        success: true,
        txHash,
        transactionId: paymentId.toString(),
        estimatedFee: 0.02,
        estimatedTime: 60 // seconds
      };

    } catch (error) {
      await postgresDb.query(`
        UPDATE payments
        SET status = 'failed', error_message = $1
        WHERE id = $2
      `, [error.message, paymentId]);

      return { success: false, error: error.message };
    }
  }

  /**
   * Check spending limits
   */
  private async checkSpendingLimits(
    userId: number,
    amount: number,
    currency: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check daily limit
    const dailyLimitQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE user_id = $1
      AND currency = $2
      AND status = 'completed'
      AND created_at > NOW() - INTERVAL '24 hours'
    `;

    const dailyResult = await postgresDb.query(dailyLimitQuery, [userId, currency]);
    const dailyTotal = parseFloat(dailyResult.rows[0].total);
    const dailyLimit = currency === 'TON' ? 1000 : 50000; // Example limits

    if (dailyTotal + amount > dailyLimit) {
      return {
        allowed: false,
        reason: `Daily limit of ${dailyLimit} ${currency} exceeded`
      };
    }

    // Check hourly limit
    const hourlyLimitQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE user_id = $1
      AND currency = $2
      AND status = 'completed'
      AND created_at > NOW() - INTERVAL '1 hour'
    `;

    const hourlyResult = await postgresDb.query(hourlyLimitQuery, [userId, currency]);
    const hourlyTotal = parseFloat(hourlyResult.rows[0].total);
    const hourlyLimit = currency === 'TON' ? 100 : 5000;

    if (hourlyTotal + amount > hourlyLimit) {
      return {
        allowed: false,
        reason: `Hourly limit of ${hourlyLimit} ${currency} exceeded`
      };
    }

    return { allowed: true };
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<any> {
    const query = `
      SELECT p.*, u.email as user_email,
             CASE WHEN p.to_user_id IS NOT NULL THEN
               (SELECT email FROM users WHERE id = p.to_user_id)
               ELSE NULL END as recipient_email
      FROM payments p
      JOIN users u ON p.user_id = u.id
      WHERE p.payment_id = $1
    `;

    const result = await postgresDb.query(query, [paymentId]);

    if (!result.rows.length) {
      return null;
    }

    const payment = result.rows[0];

    // Check blockchain status if pending
    if (payment.status === 'pending' && payment.tx_hash) {
      const txStatus = await this.monitor.getTransactionStatus(payment.tx_hash);
      if (txStatus && txStatus.status === 'confirmed') {
        payment.status = 'completed';
        payment.completed_at = new Date();
      }
    }

    return payment;
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const query = `
      SELECT p.*,
             CASE WHEN p.to_user_id IS NOT NULL THEN
               (SELECT email FROM users WHERE id = p.to_user_id)
               ELSE p.to_address END as recipient
      FROM payments p
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await postgresDb.query(query, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * Generate unique payment ID
   */
  private generatePaymentId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Batch process payments
   */
  async batchProcessPayments(requests: PaymentRequest[]): Promise<PaymentResult[]> {
    const results: PaymentResult[] = [];

    for (const request of requests) {
      const result = await this.processPayment(request);
      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}