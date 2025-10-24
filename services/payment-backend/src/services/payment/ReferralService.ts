import { postgresDb } from '../database';
import { TonWalletService } from '../ton/TonWalletService';
import { STAKING_CONFIG } from '../../config/payment-chains';
import crypto from 'crypto';

export interface Referral {
  id: number;
  referrerId: number;
  referredId: number;
  referralCode: string;
  bonusRate: number;
  status: 'active' | 'inactive';
  totalEarned: number;
  createdAt: Date;
}

export interface PaymentSplit {
  id: number;
  sourcePaymentId?: number;
  sourceType: string;
  totalAmount: number;
  currency: string;
  splits: Array<{
    userId: number;
    amount: number;
    percentage: number;
    type: 'referral' | 'bonus' | 'payment';
  }>;
  status: string;
  processedAt?: Date;
  createdAt: Date;
}

export class ReferralService {
  private tonService: TonWalletService;

  constructor() {
    this.tonService = new TonWalletService();
  }

  /**
   * Generate a unique referral code
   */
  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create a referral relationship
   */
  async createReferral(referrerId: number, referredId: number): Promise<Referral> {
    // Check if user already has a referrer
    const existingReferral = await postgresDb.query(
      'SELECT id FROM referrals WHERE referred_id = $1',
      [referredId]
    );

    if (existingReferral.rows.length > 0) {
      throw new Error('User already has a referrer');
    }

    // Generate unique referral code
    let referralCode = this.generateReferralCode();
    let codeExists = true;

    // Ensure code is unique
    while (codeExists) {
      const checkResult = await postgresDb.query(
        'SELECT id FROM referrals WHERE referral_code = $1',
        [referralCode]
      );
      if (checkResult.rows.length === 0) {
        codeExists = false;
      } else {
        referralCode = this.generateReferralCode();
      }
    }

    const query = `
      INSERT INTO referrals (referrer_id, referred_id, referral_code, bonus_rate)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await postgresDb.query(query, [
      referrerId,
      referredId,
      referralCode,
      STAKING_CONFIG.REFERRAL_BONUS_RATE
    ]);

    return result.rows[0];
  }

  /**
   * Get referral by code
   */
  async getReferralByCode(code: string): Promise<Referral | null> {
    const result = await postgresDb.query(
      'SELECT * FROM referrals WHERE referral_code = $1 AND status = $2',
      [code, 'active']
    );

    return result.rows[0] || null;
  }

  /**
   * Get user's referral statistics
   */
  async getReferralStats(userId: number): Promise<any> {
    const query = `
      SELECT
        r.referral_code,
        COUNT(DISTINCT r.id) as total_referrals,
        COUNT(DISTINCT r.id) FILTER (WHERE r.created_at >= NOW() - INTERVAL '30 days') as referrals_this_month,
        COALESCE(SUM(r.total_earned), 0) as total_earned,
        COALESCE(SUM(r.total_earned) FILTER (WHERE r.created_at >= NOW() - INTERVAL '30 days'), 0) as earned_this_month,
        COUNT(DISTINCT ps.id) as bonus_payments
      FROM referrals r
      LEFT JOIN payment_splits ps ON ps.splits::jsonb @> '[{"type": "referral"}]'
      WHERE r.referrer_id = $1 AND r.status = 'active'
      GROUP BY r.referral_code
    `;

    const result = await postgresDb.query(query, [userId]);
    return result.rows[0] || {};
  }

  /**
   * Get user's referred users
   */
  async getReferredUsers(userId: number, page: number = 1, limit: number = 20): Promise<any> {
    const offset = (page - 1) * limit;

    const query = `
      SELECT
        r.*,
        u.email,
        u.created_at as user_created_at,
        COALESCE(SUM(t.amount_usdt), 0) as total_spent
      FROM referrals r
      JOIN users u ON r.referred_id = u.id
      LEFT JOIN ton_transactions t ON t.user_id = u.id AND t.status = 'confirmed'
      WHERE r.referrer_id = $1
      GROUP BY r.id, u.email, u.created_at
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await postgresDb.query(query, [userId, limit, offset]);

    const countQuery = 'SELECT COUNT(*) FROM referrals WHERE referrer_id = $1';
    const countResult = await postgresDb.query(countQuery, [userId]);

    return {
      referrals: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }

  /**
   * Process referral bonus for a payment
   */
  async processReferralBonus(
    paymentId: number,
    payerId: number,
    amount: number,
    paymentType: string = 'task_payment'
  ): Promise<void> {
    // Check if payer has an active referrer
    const referralQuery = `
      SELECT r.*, u.email as referrer_email
      FROM referrals r
      JOIN users u ON r.referrer_id = u.id
      WHERE r.referred_id = $1 AND r.status = 'active'
    `;

    const referralResult = await postgresDb.query(referralQuery, [payerId]);

    if (!referralResult.rows[0]) {
      return; // No referrer, no bonus
    }

    const referral = referralResult.rows[0];
    const bonusAmount = amount * referral.bonus_rate;

    // Create payment split
    const splits = [
      {
        userId: referral.referrer_id,
        amount: bonusAmount,
        percentage: referral.bonus_rate * 100,
        type: 'referral'
      }
    ];

    await this.createPaymentSplit({
      sourcePaymentId: paymentId,
      sourceType: paymentType,
      totalAmount: amount,
      currency: 'USDT',
      splits
    });

    // Update referral total earned
    await postgresDb.query(
      'UPDATE referrals SET total_earned = total_earned + $1 WHERE id = $2',
      [bonusAmount, referral.id]
    );

    console.log(`Referral bonus of ${bonusAmount} USDT processed for referrer ${referral.referrer_id}`);
  }

  /**
   * Create a payment split
   */
  async createPaymentSplit(split: {
    sourcePaymentId?: number;
    sourceType: string;
    totalAmount: number;
    currency: string;
    splits: Array<{
      userId: number;
      amount: number;
      percentage: number;
      type: string;
    }>;
  }): Promise<PaymentSplit> {
    const { sourcePaymentId, sourceType, totalAmount, currency, splits } = split;

    // Validate split amounts
    const totalSplitAmount = splits.reduce((sum, s) => sum + s.amount, 0);
    if (totalSplitAmount > totalAmount) {
      throw new Error('Split amounts exceed total amount');
    }

    const query = `
      INSERT INTO payment_splits (
        source_payment_id, source_type, total_amount, currency, splits, status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `;

    const result = await postgresDb.query(query, [
      sourcePaymentId,
      sourceType,
      totalAmount,
      currency,
      JSON.stringify(splits)
    ]);

    // Process the splits
    await this.processPaymentSplit(result.rows[0].id);

    return {
      ...result.rows[0],
      splits: JSON.parse(result.rows[0].splits)
    };
  }

  /**
   * Process a payment split
   */
  private async processPaymentSplit(splitId: number): Promise<void> {
    const splitQuery = 'SELECT * FROM payment_splits WHERE id = $1';
    const splitResult = await postgresDb.query(splitQuery, [splitId]);

    if (!splitResult.rows[0]) {
      throw new Error('Payment split not found');
    }

    const split = {
      ...splitResult.rows[0],
      splits: JSON.parse(splitResult.rows[0].splits)
    };

    // Process each split
    for (const splitItem of split.splits) {
      try {
        await this.distributeSplitPayment(
          splitItem.userId,
          splitItem.amount,
          `Split payment from ${split.sourceType} #${split.sourcePaymentId}`
        );
      } catch (error) {
        console.error(`Failed to distribute split payment to user ${splitItem.userId}:`, error);
      }
    }

    // Mark split as processed
    await postgresDb.query(
      'UPDATE payment_splits SET status = $1, processed_at = NOW() WHERE id = $2',
      ['processed', splitId]
    );
  }

  /**
   * Distribute split payment to user
   */
  private async distributeSplitPayment(userId: number, amount: number, message: string): Promise<void> {
    // Get user's wallet
    const walletQuery = `
      SELECT * FROM user_ton_wallets
      WHERE user_id = $1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const walletResult = await postgresDb.query(walletQuery, [userId]);

    if (!walletResult.rows[0]) {
      throw new Error('User wallet not found');
    }

    // For demo purposes, we'll update balance directly
    // In production, this would send actual blockchain transaction
    await postgresDb.query(`
      UPDATE user_ton_wallets
      SET balance_usdt = balance_usdt + $1, updated_at = NOW()
      WHERE id = $2
    `, [amount, walletResult.rows[0].id]);

    // Record the transaction
    await postgresDb.query(`
      INSERT INTO ton_transactions (
        user_id, from_address, to_address, amount_usdt,
        token_type, network_name, status, created_at
      )
      VALUES (
        $1, 'system', $2, $3, 'USDT', 'mainnet', 'confirmed', NOW()
      )
    `, [
      userId,
      walletResult.rows[0].wallet_address,
      amount
    ]);
  }

  /**
   * Get payment splits for a user
   */
  async getUserPaymentSplits(userId: number, page: number = 1, limit: number = 20): Promise<any> {
    const offset = (page - 1) * limit;

    const query = `
      SELECT DISTINCT ps.*
      FROM payment_splits ps
      WHERE ps.splits::jsonb @> '[{"userId": ${userId}}]'
      ORDER BY ps.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await postgresDb.query(query, [limit, offset]);

    const splits = result.rows.map(row => {
      const splits = JSON.parse(row.splits);
      const userSplit = splits.find((s: any) => s.userId === userId);

      return {
        ...row,
        userSplit,
        splits
      };
    });

    const countQuery = `
      SELECT COUNT(DISTINCT id) FROM payment_splits
      WHERE splits::jsonb @> '[{"userId": $1}]'
    `;
    const countResult = await postgresDb.query(countQuery, [userId]);

    return {
      splits,
      total: parseInt(countResult.rows[0].count),
      page,
      limit
    };
  }

  /**
   * Process batch referral bonuses (e.g., for payroll)
   */
  async processBatchReferralBonus(payments: Array<{
    paymentId: number;
    payerId: number;
    amount: number;
  }>): Promise<void> {
    for (const payment of payments) {
      await this.processReferralBonus(
        payment.paymentId,
        payment.payerId,
        payment.amount
      );
    }
  }

  /**
   * Update referral status
   */
  async updateReferralStatus(referralId: number, status: 'active' | 'inactive'): Promise<void> {
    await postgresDb.query(
      'UPDATE referrals SET status = $1 WHERE id = $2',
      [status, referralId]
    );
  }

  /**
   * Create custom bonus payment split
   */
  async createBonusPayment(
    sourceType: string,
    userId: number,
    amount: number,
    reason: string
  ): Promise<PaymentSplit> {
    const splits = [
      {
        userId,
        amount,
        percentage: 100,
        type: 'bonus'
      }
    ];

    const split = await this.createPaymentSplit({
      sourceType,
      totalAmount: amount,
      currency: 'USDT',
      splits
    });

    // Record bonus reason
    await postgresDb.query(`
      UPDATE payment_splits
      SET metadata = metadata || $1
      WHERE id = $2
    `, [JSON.stringify({ reason })]);

    return split;
  }
}