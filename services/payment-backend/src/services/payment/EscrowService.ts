import { postgresDb } from '../database';
import { TonWalletService } from '../ton/TonWalletService';
import { ESCROW_STATUS, STAKING_CONFIG } from '../../config/payment-chains';
import cron from 'node-cron';

export interface EscrowAccount {
  id: number;
  taskId: number;
  payerId: number;
  payeeId: number;
  amount: number;
  currency: string;
  status: string;
  releaseConditions?: any;
  disputeReason?: string;
  disputeResolvedBy?: number;
  disputeResolution?: string;
  fundedTxHash?: string;
  releasedTxHash?: string;
  refundedTxHash?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEscrowInput {
  taskId: number;
  payerId: number;
  payeeId: number;
  amount: number;
  currency?: string;
  releaseConditions?: any;
  expiresInDays?: number;
}

export class EscrowService {
  private tonService: TonWalletService;

  constructor() {
    this.tonService = new TonWalletService();
    this.startExpirationChecker();
  }

  /**
   * Start the escrow expiration checker
   */
  private startExpirationChecker() {
    // Check for expired escrow accounts daily
    cron.schedule('0 0 * * *', async () => {
      await this.processExpiredEscrows();
    });
  }

  /**
   * Create a new escrow account
   */
  async createEscrow(input: CreateEscrowInput): Promise<EscrowAccount> {
    const {
      taskId,
      payerId,
      payeeId,
      amount,
      currency = 'USDT',
      releaseConditions,
      expiresInDays = STAKING_CONFIG.ESCROW_TIMEOUT_DAYS
    } = input;

    // Check if escrow already exists for this task
    const existingEscrow = await postgresDb.query(
      'SELECT id FROM escrow_accounts WHERE task_id = $1',
      [taskId]
    );

    if (existingEscrow.rows.length > 0) {
      throw new Error('Escrow already exists for this task');
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const query = `
      INSERT INTO escrow_accounts (
        task_id, payer_id, payee_id, amount, currency,
        release_conditions, expires_at, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *
    `;

    const result = await postgresDb.query(query, [
      taskId,
      payerId,
      payeeId,
      amount,
      currency,
      JSON.stringify(releaseConditions || {}),
      expiresAt
    ]);

    return result.rows[0];
  }

  /**
   * Fund an escrow account
   */
  async fundEscrow(escrowId: number, userId: number): Promise<string> {
    const escrowQuery = 'SELECT * FROM escrow_accounts WHERE id = $1 AND payer_id = $2';
    const escrowResult = await postgresDb.query(escrowQuery, [escrowId, userId]);

    if (!escrowResult.rows[0]) {
      throw new Error('Escrow not found or unauthorized');
    }

    const escrow = escrowResult.rows[0];

    if (escrow.status !== 'pending') {
      throw new Error('Escrow is not in pending state');
    }

    // Get system wallet for holding escrow
    const systemWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = 1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const systemWalletResult = await postgresDb.query(systemWalletQuery);

    if (!systemWalletResult.rows[0]) {
      throw new Error('System escrow wallet not configured');
    }

    // Transfer funds to escrow
    const txHash = await this.tonService.sendTransaction(userId, {
      toAddress: systemWalletResult.rows[0].wallet_address,
      amount: escrow.amount.toString(),
      tokenType: escrow.currency === 'USDT' ? 'USDT' : 'TON',
      message: `Escrow funding for task #${escrow.taskId}`
    }, 'mainnet');

    // Update escrow status
    await postgresDb.query(`
      UPDATE escrow_accounts
      SET status = 'funded', funded_tx_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [txHash, escrowId]);

    // Create a ledger entry for the escrow funds
    await postgresDb.query(`
      INSERT INTO escrow_ledger (escrow_id, transaction_type, amount, tx_hash, created_at)
      VALUES ($1, 'fund', $2, $3, NOW())
    `, [escrowId, escrow.amount, txHash]);

    return txHash;
  }

  /**
   * Release funds from escrow to payee
   */
  async releaseEscrow(escrowId: number, userId: number, reason?: string): Promise<string> {
    const escrowQuery = 'SELECT * FROM escrow_accounts WHERE id = $1';
    const escrowResult = await postgresDb.query(escrowQuery, [escrowId]);

    if (!escrowResult.rows[0]) {
      throw new Error('Escrow not found');
    }

    const escrow = escrowResult.rows[0];

    // Check authorization (payer, payee, or admin)
    if (userId !== escrow.payerId && userId !== escrow.payeeId) {
      // Check if user is admin
      const adminCheck = await postgresDb.query(
        'SELECT id FROM users WHERE id = $1 AND role = $2',
        [userId, 'admin']
      );

      if (!adminCheck.rows.length) {
        throw new Error('Unauthorized to release escrow');
      }
    }

    if (escrow.status !== 'funded') {
      throw new Error('Escrow is not funded');
    }

    // Check release conditions if specified
    if (escrow.release_conditions) {
      const conditionsMet = await this.checkReleaseConditions(
        escrow.taskId,
        JSON.parse(escrow.releaseConditions)
      );

      if (!conditionsMet) {
        throw new Error('Release conditions not met');
      }
    }

    // Get system wallet
    const systemWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = 1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const systemWalletResult = await postgresDb.query(systemWalletQuery);

    if (!systemWalletResult.rows[0]) {
      throw new Error('System escrow wallet not configured');
    }

    // Get payee wallet
    const payeeWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = $1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const payeeWalletResult = await postgresDb.query(payeeWalletQuery, [escrow.payeeId]);

    if (!payeeWalletResult.rows[0]) {
      throw new Error('Payee wallet not found');
    }

    // Release funds to payee
    const txHash = await this.tonService.sendTransaction(1, {
      toAddress: payeeWalletResult.rows[0].wallet_address,
      amount: escrow.amount.toString(),
      tokenType: escrow.currency === 'USDT' ? 'USDT' : 'TON',
      message: `Escrow release for task #${escrow.taskId}${reason ? ': ' + reason : ''}`
    }, 'mainnet');

    // Update escrow status
    await postgresDb.query(`
      UPDATE escrow_accounts
      SET
        status = 'released',
        released_tx_hash = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [txHash, escrowId]);

    // Create ledger entry
    await postgresDb.query(`
      INSERT INTO escrow_ledger (escrow_id, transaction_type, amount, tx_hash, created_at)
      VALUES ($1, 'release', $2, $3, NOW())
    `, [escrowId, escrow.amount, txHash]);

    // Notify the release
    await this.notifyEscrowRelease(escrowId, txHash, reason);

    return txHash;
  }

  /**
   * Refund escrow to payer
   */
  async refundEscrow(escrowId: number, userId: number, reason?: string): Promise<string> {
    const escrowQuery = 'SELECT * FROM escrow_accounts WHERE id = $1';
    const escrowResult = await postgresDb.query(escrowQuery, [escrowId]);

    if (!escrowResult.rows[0]) {
      throw new Error('Escrow not found');
    }

    const escrow = escrowResult.rows[0];

    // Only payer or admin can refund
    if (userId !== escrow.payerId) {
      const adminCheck = await postgresDb.query(
        'SELECT id FROM users WHERE id = $1 AND role = $2',
        [userId, 'admin']
      );

      if (!adminCheck.rows.length) {
        throw new Error('Unauthorized to refund escrow');
      }
    }

    if (escrow.status !== 'funded') {
      throw new Error('Escrow cannot be refunded in current state');
    }

    // Get system wallet
    const systemWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = 1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const systemWalletResult = await postgresDb.query(systemWalletQuery);

    if (!systemWalletResult.rows[0]) {
      throw new Error('System escrow wallet not configured');
    }

    // Get payer wallet
    const payerWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = $1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const payerWalletResult = await postgresDb.query(payerWalletQuery, [escrow.payerId]);

    if (!payerWalletResult.rows[0]) {
      throw new Error('Payer wallet not found');
    }

    // Refund to payer
    const txHash = await this.tonService.sendTransaction(1, {
      toAddress: payerWalletResult.rows[0].wallet_address,
      amount: escrow.amount.toString(),
      tokenType: escrow.currency === 'USDT' ? 'USDT' : 'TON',
      message: `Escrow refund for task #${escrow.taskId}${reason ? ': ' + reason : ''}`
    }, 'mainnet');

    // Update escrow status
    await postgresDb.query(`
      UPDATE escrow_accounts
      SET
        status = 'refunded',
        refunded_tx_hash = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [txHash, escrowId]);

    // Create ledger entry
    await postgresDb.query(`
      INSERT INTO escrow_ledger (escrow_id, transaction_type, amount, tx_hash, created_at)
      VALUES ($1, 'refund', $2, $3, NOW())
    `, [escrowId, escrow.amount, txHash]);

    return txHash;
  }

  /**
   * Create dispute for escrow
   */
  async createDispute(escrowId: number, userId: number, reason: string): Promise<void> {
    const escrowQuery = 'SELECT * FROM escrow_accounts WHERE id = $1';
    const escrowResult = await postgresDb.query(escrowQuery, [escrowId]);

    if (!escrowResult.rows[0]) {
      throw new Error('Escrow not found');
    }

    const escrow = escrowResult.rows[0];

    // Only payer or payee can create dispute
    if (userId !== escrow.payerId && userId !== escrow.payeeId) {
      throw new Error('Unauthorized to create dispute');
    }

    if (escrow.status !== 'funded') {
      throw new Error('Cannot dispute escrow in current state');
    }

    // Update escrow with dispute
    await postgresDb.query(`
      UPDATE escrow_accounts
      SET
        status = 'disputed',
        dispute_reason = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [reason, escrowId]);

    // Notify admins
    await this.notifyDisputeCreated(escrowId, reason);
  }

  /**
   * Resolve dispute
   */
  async resolveDispute(
    escrowId: number,
    adminId: number,
    resolution: string,
    action: 'release' | 'refund' | 'split'
  ): Promise<string> {
    const escrowQuery = 'SELECT * FROM escrow_accounts WHERE id = $1';
    const escrowResult = await postgresDb.query(escrowQuery, [escrowId]);

    if (!escrowResult.rows[0]) {
      throw new Error('Escrow not found');
    }

    const escrow = escrowResult.rows[0];

    if (escrow.status !== 'disputed') {
      throw new Error('Escrow is not in disputed state');
    }

    let txHash: string;

    switch (action) {
      case 'release':
        txHash = await this.releaseEscrow(escrowId, adminId, `Dispute resolved: ${resolution}`);
        break;
      case 'refund':
        txHash = await this.refundEscrow(escrowId, adminId, `Dispute resolved: ${resolution}`);
        break;
      case 'split':
        txHash = await this.splitEscrow(escrowId, adminId, resolution);
        break;
      default:
        throw new Error('Invalid dispute resolution action');
    }

    // Update dispute resolution
    await postgresDb.query(`
      UPDATE escrow_accounts
      SET
        dispute_resolved_by = $1,
        dispute_resolution = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [adminId, resolution, escrowId]);

    return txHash;
  }

  /**
   * Split escrow between payer and payee (for dispute resolution)
   */
  private async splitEscrow(escrowId: number, adminId: number, reason: string): Promise<string> {
    const escrowQuery = 'SELECT * FROM escrow_accounts WHERE id = $1';
    const escrowResult = await postgresDb.query(escrowQuery, [escrowId]);

    const escrow = escrowResult.rows[0];
    const splitAmount = escrow.amount / 2;

    // Get system wallet
    const systemWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = 1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const systemWalletResult = await postgresDb.query(systemWalletQuery);

    // Get payer wallet
    const payerWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = $1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const payerWalletResult = await postgresDb.query(payerWalletQuery, [escrow.payerId]);

    // Get payee wallet
    const payeeWalletQuery = `
      SELECT wallet_address FROM user_ton_wallets
      WHERE user_id = $1 AND network_name = 'mainnet' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const payeeWalletResult = await postgresDb.query(payeeWalletQuery, [escrow.payeeId]);

    // Refund half to payer
    const refundTx = await this.tonService.sendTransaction(1, {
      toAddress: payerWalletResult.rows[0].wallet_address,
      amount: splitAmount.toString(),
      tokenType: escrow.currency === 'USDT' ? 'USDT' : 'TON',
      message: `Escrow split refund for task #${escrow.taskId}: ${reason}`
    }, 'mainnet');

    // Release half to payee
    const releaseTx = await this.tonService.sendTransaction(1, {
      toAddress: payeeWalletResult.rows[0].wallet_address,
      amount: splitAmount.toString(),
      tokenType: escrow.currency === 'USDT' ? 'USDT' : 'TON',
      message: `Escrow split release for task #${escrow.taskId}: ${reason}`
    }, 'mainnet');

    // Update escrow status
    await postgresDb.query(`
      UPDATE escrow_accounts
      SET
        status = 'released',
        released_tx_hash = $1,
        refunded_tx_hash = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [releaseTx, refundTx, escrowId]);

    return releaseTx;
  }

  /**
   * Get escrow details
   */
  async getEscrow(escrowId: number, userId?: number): Promise<EscrowAccount | null> {
    let query = 'SELECT * FROM escrow_accounts WHERE id = $1';
    const params = [escrowId];

    if (userId) {
      query += ' AND (payer_id = $2 OR payee_id = $2)';
      params.push(userId);
    }

    const result = await postgresDb.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Get user's escrow accounts
   */
  async getUserEscrows(
    userId: number,
    role: 'payer' | 'payee' | 'both',
    status?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ escrows: EscrowAccount[]; total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params: any[] = [userId];

    if (role === 'payer') {
      whereClause = 'WHERE payer_id = $1';
    } else if (role === 'payee') {
      whereClause = 'WHERE payee_id = $1';
    } else {
      whereClause = 'WHERE (payer_id = $1 OR payee_id = $1)';
    }

    if (status) {
      whereClause += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) FROM escrow_accounts ${whereClause}`;
    const countResult = await postgresDb.query(countQuery, params);

    params.push(limit, offset);

    const escrowsQuery = `
      SELECT * FROM escrow_accounts ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const escrowsResult = await postgresDb.query(escrowsQuery, params);

    return {
      escrows: escrowsResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  /**
   * Process expired escrows
   */
  private async processExpiredEscrows(): Promise<void> {
    const query = `
      SELECT * FROM escrow_accounts
      WHERE status = 'funded'
      AND expires_at <= NOW()
    `;

    const result = await postgresDb.query(query);

    for (const escrow of result.rows) {
      try {
        await this.refundEscrow(escrow.id, escrow.payerId, 'Escrow expired');
        console.log(`Escrow ${escrow.id} expired and refunded to payer`);
      } catch (error) {
        console.error(`Failed to process expired escrow ${escrow.id}:`, error);
      }
    }
  }

  /**
   * Check if release conditions are met
   */
  private async checkReleaseConditions(taskId: number, conditions: any): Promise<boolean> {
    // This would check various conditions like:
    // - Task completion status
    // - Quality metrics met
    // - Time requirements
    // - Other custom conditions

    // Simplified for demonstration
    if (conditions.taskCompleted) {
      const taskQuery = 'SELECT status FROM tasks WHERE id = $1';
      const taskResult = await postgresDb.query(taskQuery, [taskId]);
      return taskResult.rows[0]?.status === 'completed';
    }

    return true;
  }

  /**
   * Notify parties of escrow release
   */
  private async notifyEscrowRelease(escrowId: number, txHash: string, reason?: string): Promise<void> {
    // Send notifications via email, websocket, etc.
    console.log(`Escrow ${escrowId} released. TX: ${txHash}. Reason: ${reason || 'Not specified'}`);
  }

  /**
   * Notify admins of dispute
   */
  private async notifyDisputeCreated(escrowId: number, reason: string): Promise<void> {
    // Send notifications to admins
    console.log(`Dispute created for escrow ${escrowId}. Reason: ${reason}`);
  }

  /**
   * Create escrow ledger table if not exists
   */
  async createEscrowLedgerTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS escrow_ledger (
        id SERIAL PRIMARY KEY,
        escrow_id INTEGER REFERENCES escrow_accounts(id),
        transaction_type VARCHAR(20) NOT NULL, -- 'fund', 'release', 'refund'
        amount DECIMAL(20, 6) NOT NULL,
        tx_hash VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_escrow_ledger_escrow_id ON escrow_ledger(escrow_id);
    `;

    await postgresDb.query(query);
  }
}