import { Pool } from 'pg';
import { BaseRepository, QueryOptions, PaginationResult } from './BaseRepository';
import { Transaction, TransactionStatus, TokenType } from '../types/payment';

// ============================================================================
// TRANSACTION TYPES EXTENSIONS
// ============================================================================

export interface TransactionFindOptions extends QueryOptions {
  fromAddress?: string;
  toAddress?: string;
  userId?: string;
  projectId?: string;
  tokenType?: TokenType;
  status?: TransactionStatus;
  createdAfter?: Date;
  createdBefore?: Date;
  amountMin?: number;
  amountMax?: number;
}

export interface TransactionCreateData {
  hash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenType: TokenType;
  fee?: string;
  message?: string;
  userId?: string;
  projectId?: string;
}

export interface TransactionStats {
  totalTransactions: number;
  totalVolume: number;
  totalFees: number;
  averageAmount: number;
  statusCounts: Record<TransactionStatus, number>;
  tokenTypeCounts: Record<TokenType, number>;
  dailyVolume: Array<{
    date: string;
    volume: number;
    count: number;
  }>;
}

// ============================================================================
// TRANSACTION REPOSITORY
// ============================================================================

export class TransactionRepository extends BaseRepository<Transaction> {
  constructor(db: Pool) {
    super(db, 'transactions');
    this.primaryKey = 'id';
  }

  // ============================================================================
  // FIND METHODS
  // ============================================================================

  /**
   * Find transactions by address (from or to)
   */
  async findByAddress(
    address: string,
    options: TransactionFindOptions = {}
  ): Promise<Transaction[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE (from_address = $1 OR to_address = $1)
      ${options.tokenType ? `AND token_type = $2` : ''}
      ${options.status ? `AND status = $${options.tokenType ? 3 : 2}` : ''}
      ORDER BY created_at DESC
      ${options.limit ? `LIMIT $${[options.tokenType, options.status].filter(Boolean).length + 1}` : ''}
    `;

    const params: any[] = [address];
    if (options.tokenType) params.push(options.tokenType);
    if (options.status) params.push(options.status);
    if (options.limit) params.push(options.limit);

    const result = await this.db.query(sql, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find transactions by user
   */
  async findByUser(
    userId: string,
    options: TransactionFindOptions = {}
  ): Promise<Transaction[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
      ${options.tokenType ? `AND token_type = $2` : ''}
      ${options.status ? `AND status = $${options.tokenType ? 3 : 2}` : ''}
      ORDER BY created_at DESC
      ${options.limit ? `LIMIT $${[options.tokenType, options.status].filter(Boolean).length + 1}` : ''}
    `;

    const params: any[] = [userId];
    if (options.tokenType) params.push(options.tokenType);
    if (options.status) params.push(options.status);
    if (options.limit) params.push(options.limit);

    const result = await this.db.query(sql, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find transactions by hash
   */
  async findByHash(hash: string): Promise<Transaction | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE hash = $1
    `;

    const result = await this.db.query(sql, [hash]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find pending transactions
   */
  async findPending(limit: number = 50): Promise<Transaction[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT $1
    `;

    const result = await this.db.query(sql, [limit]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find failed transactions
   */
  async findFailed(hours: number = 24): Promise<Transaction[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'failed'
      AND created_at >= NOW() - INTERVAL '${hours} hours'
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(sql);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // ============================================================================
  // CREATE METHODS
  // ============================================================================

  /**
   * Create new transaction
   */
  async create(transactionData: TransactionCreateData): Promise<Transaction> {
    const sql = `
      INSERT INTO ${this.tableName} (
        hash, from_address, to_address, amount, token_type, fee,
        status, message, user_id, project_id, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;

    const values = [
      transactionData.hash,
      transactionData.fromAddress,
      transactionData.toAddress,
      transactionData.amount,
      transactionData.tokenType,
      transactionData.fee || '0',
      'pending',
      transactionData.message || null,
      transactionData.userId || null,
      transactionData.projectId || null
    ];

    const result = await this.db.query(sql, values);

    if (result.rows.length === 0) {
      throw new Error('Failed to create transaction');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create multiple transactions
   */
  async createBatch(transactionDataArray: TransactionCreateData[]): Promise<Transaction[]> {
    if (transactionDataArray.length === 0) {
      return [];
    }

    const values = transactionDataArray.flatMap(tx => [
      tx.hash,
      tx.fromAddress,
      tx.toAddress,
      tx.amount,
      tx.tokenType,
      tx.fee || '0',
      'pending',
      tx.message || null,
      tx.userId || null,
      tx.projectId || null
    ]);

    const placeholders = transactionDataArray.map((_, i) => {
      const offset = i * 10;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, NOW())`;
    }).join(', ');

    const sql = `
      INSERT INTO ${this.tableName} (
        hash, from_address, to_address, amount, token_type, fee,
        status, message, user_id, project_id, created_at
      )
      VALUES ${placeholders}
      RETURNING *
    `;

    const result = await this.db.query(sql, values);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // ============================================================================
  // UPDATE METHODS
  // ============================================================================

  /**
   * Update transaction status
   */
  async updateStatus(
    hash: string,
    status: TransactionStatus,
    blockNumber?: number
  ): Promise<Transaction> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        status = $1,
        block_number = $2,
        updated_at = NOW()
      WHERE hash = $3
      RETURNING *
    `;

    const result = await this.db.query(sql, [status, blockNumber || null, hash]);

    if (result.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Confirm transaction
   */
  async confirm(hash: string, blockNumber: number): Promise<Transaction> {
    return this.updateStatus(hash, 'confirmed', blockNumber);
  }

  /**
   * Fail transaction
   */
  async fail(hash: string, reason?: string): Promise<Transaction> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        status = 'failed',
        message = COALESCE(message, '') || $1,
        updated_at = NOW()
      WHERE hash = $2
      RETURNING *
    `;

    const result = await this.db.query(sql, [reason || 'Transaction failed', hash]);

    if (result.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Batch update transaction status
   */
  async batchUpdateStatus(updates: Array<{
    hash: string;
    status: TransactionStatus;
    blockNumber?: number;
  }>): Promise<{ updated: number }> {
    if (updates.length === 0) {
      return { updated: 0 };
    }

    const values = updates.map(u => `('${u.hash}', '${u.status}', ${u.blockNumber || 'NULL'})`).join(', ');
    const sql = `
      UPDATE ${this.tableName}
      SET
        status = updates.status,
        block_number = updates.block_number,
        updated_at = NOW()
      FROM (VALUES ${values}) AS updates(hash, status, block_number)
      WHERE ${this.tableName}.hash = updates.hash
    `;

    const result = await this.db.query(sql);
    return { updated: result.rowCount };
  }

  // ============================================================================
  // BALANCE METHODS
  // ============================================================================

  /**
   * Get balance for address
   */
  async getBalance(address: string, tokenType: TokenType): Promise<number> {
    const sql = `
      SELECT
        COALESCE(
          SUM(CASE WHEN to_address = $1 THEN amount::numeric ELSE 0 END) -
          SUM(CASE WHEN from_address = $1 THEN amount::numeric ELSE 0 END),
          0
        ) as balance
      FROM ${this.tableName}
      WHERE (from_address = $1 OR to_address = $1)
      AND token_type = $2
      AND status = 'confirmed'
    `;

    const result = await this.db.query(sql, [address, tokenType]);
    return parseFloat(result.rows[0].balance);
  }

  /**
   * Get balances for all token types
   */
  async getBalances(address: string): Promise<Record<TokenType, number>> {
    const sql = `
      SELECT
        token_type,
        COALESCE(
          SUM(CASE WHEN to_address = $1 THEN amount::numeric ELSE 0 END) -
          SUM(CASE WHEN from_address = $1 THEN amount::numeric ELSE 0 END),
          0
        ) as balance
      FROM ${this.tableName}
      WHERE (from_address = $1 OR to_address = $1)
      AND status = 'confirmed'
      GROUP BY token_type
    `;

    const result = await this.db.query(sql, [address]);
    const balances: Record<string, number> = {
      TON: 0,
      USDT: 0,
      PAYMENT_CHANNEL: 0
    };

    result.rows.forEach(row => {
      balances[row.token_type] = parseFloat(row.balance);
    });

    return balances as Record<TokenType, number>;
  }

  // ============================================================================
  // STATISTICS METHODS
  // ============================================================================

  /**
   * Get transaction statistics
   */
  async getStatistics(
    filters: {
      userId?: string;
      projectId?: string;
      tokenType?: TokenType;
      days?: number;
    } = {}
  ): Promise<TransactionStats> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      whereClause += ` AND user_id = $${paramIndex++}`;
      params.push(filters.userId);
    }

    if (filters.projectId) {
      whereClause += ` AND project_id = $${paramIndex++}`;
      params.push(filters.projectId);
    }

    if (filters.tokenType) {
      whereClause += ` AND token_type = $${paramIndex++}`;
      params.push(filters.tokenType);
    }

    if (filters.days) {
      whereClause += ` AND created_at >= NOW() - INTERVAL '${filters.days} days'`;
    }

    const sql = `
      WITH base_stats AS (
        SELECT
          COUNT(*) as total_transactions,
          COALESCE(SUM(amount::numeric), 0) as total_volume,
          COALESCE(SUM(fee::numeric), 0) as total_fees,
          COALESCE(AVG(amount::numeric), 0) as average_amount,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
          COUNT(CASE WHEN token_type = 'TON' THEN 1 END) as ton_count,
          COUNT(CASE WHEN token_type = 'USDT' THEN 1 END) as usdt_count,
          COUNT(CASE WHEN token_type = 'PAYMENT_CHANNEL' THEN 1 END) as channel_count
        FROM ${this.tableName}
        ${whereClause}
      ),
      daily_volumes AS (
        SELECT
          DATE(created_at) as date,
          COALESCE(SUM(amount::numeric), 0) as volume,
          COUNT(*) as count
        FROM ${this.tableName}
        ${whereClause.replace('WHERE 1=1', 'WHERE')}
        AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      )
      SELECT * FROM base_stats, (
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'date', date,
            'volume', volume,
            'count', count
          ) ORDER BY date
        ) as daily_volume
        FROM daily_volumes
      )
    `;

    const result = await this.db.query(sql, params);
    const row = result.rows[0];

    return {
      totalTransactions: parseInt(row.total_transactions),
      totalVolume: parseFloat(row.total_volume),
      totalFees: parseFloat(row.total_fees),
      averageAmount: parseFloat(row.average_amount),
      statusCounts: {
        pending: parseInt(row.pending_count),
        confirmed: parseInt(row.confirmed_count),
        failed: parseInt(row.failed_count)
      },
      tokenTypeCounts: {
        TON: parseInt(row.ton_count),
        USDT: parseInt(row.usdt_count),
        PAYMENT_CHANNEL: parseInt(row.channel_count)
      },
      dailyVolume: row.daily_volume || []
    };
  }

  /**
   * Get volume history
   */
  async getVolumeHistory(days: number = 30): Promise<Array<{
    date: string;
    volume: number;
    count: number;
    tokenType: TokenType;
  }>> {
    const sql = `
      SELECT
        DATE(created_at) as date,
        token_type,
        COALESCE(SUM(amount::numeric), 0) as volume,
        COUNT(*) as count
      FROM ${this.tableName}
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      AND status = 'confirmed'
      GROUP BY DATE(created_at), token_type
      ORDER BY date DESC, token_type
    `;

    const result = await this.db.query(sql);
    return result.rows.map(row => ({
      date: row.date,
      volume: parseFloat(row.volume),
      count: parseInt(row.count),
      tokenType: row.token_type as TokenType
    }));
  }

  /**
   * Get top transactions by volume
   */
  async getTopTransactions(limit: number = 10): Promise<Transaction[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'confirmed'
      ORDER BY amount::numeric DESC
      LIMIT $1
    `;

    const result = await this.db.query(sql, [limit]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if transaction exists
   */
  async existsByHash(hash: string): Promise<boolean> {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE hash = $1 LIMIT 1`;
    const result = await this.db.query(sql, [hash]);
    return result.rows.length > 0;
  }

  /**
   * Get total count by status
   */
  async getCountByStatus(): Promise<Record<TransactionStatus, number>> {
    const sql = `
      SELECT status, COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY status
    `;

    const result = await this.db.query(sql);
    const counts: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      failed: 0
    };

    result.rows.forEach(row => {
      counts[row.status] = parseInt(row.count);
    });

    return counts as Record<TransactionStatus, number>;
  }

  /**
   * Map database row to Transaction entity
   */
  protected mapRowToEntity(row: any): Transaction {
    return {
      hash: row.hash,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      amount: row.amount,
      tokenType: row.token_type as TokenType,
      fee: row.fee || '0',
      timestamp: row.created_at,
      status: row.status as TransactionStatus,
      blockNumber: row.block_number,
      message: row.message
    };
  }
}