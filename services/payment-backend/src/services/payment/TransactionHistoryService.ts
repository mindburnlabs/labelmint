import { Transaction } from './interfaces/PaymentStrategy';
import { postgresDb } from '../../database';
import { Logger } from '../../utils/logger';

const logger = new Logger('TransactionHistoryService');

export interface TransactionFilter {
  fromAddress?: string;
  toAddress?: string;
  tokenType?: 'TON' | 'USDT';
  status?: 'pending' | 'confirmed' | 'failed';
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface TransactionQuery {
  filter?: TransactionFilter;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'amount' | 'fee';
  orderDirection?: 'ASC' | 'DESC';
}

export class TransactionHistoryService {
  /**
   * Get transactions with optional filtering and pagination
   */
  async getTransactions(query: TransactionQuery = {}): Promise<{
    transactions: Transaction[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const {
      filter = {},
      limit = 50,
      offset = 0,
      orderBy = 'timestamp',
      orderDirection = 'DESC'
    } = query;

    try {
      // Build WHERE clause
      const whereConditions = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.fromAddress) {
        whereConditions.push(`from_address = $${paramIndex++}`);
        params.push(filter.fromAddress);
      }

      if (filter.toAddress) {
        whereConditions.push(`to_address = $${paramIndex++}`);
        params.push(filter.toAddress);
      }

      if (filter.tokenType) {
        whereConditions.push(`token_type = $${paramIndex++}`);
        params.push(filter.tokenType);
      }

      if (filter.status) {
        whereConditions.push(`status = $${paramIndex++}`);
        params.push(filter.status);
      }

      if (filter.startDate) {
        whereConditions.push(`created_at >= $${paramIndex++}`);
        params.push(filter.startDate);
      }

      if (filter.endDate) {
        whereConditions.push(`created_at <= $${paramIndex++}`);
        params.push(filter.endDate);
      }

      if (filter.minAmount) {
        whereConditions.push(`amount >= $${paramIndex++}`);
        params.push(filter.minAmount);
      }

      if (filter.maxAmount) {
        whereConditions.push(`amount <= $${paramIndex++}`);
        params.push(filter.maxAmount);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM transactions
        ${whereClause}
      `;

      const countResult = await postgresDb.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get transactions
      const dataQuery = `
        SELECT *
        FROM transactions
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT $${paramIndex++}
        OFFSET $${paramIndex++}
      `;

      params.push(limit, offset);

      const dataResult = await postgresDb.query(dataQuery, params);

      const transactions = dataResult.rows.map(row => this.mapRowToTransaction(row));

      return {
        transactions,
        total,
        limit,
        offset
      };
    } catch (error) {
      logger.error('Failed to get transactions:', error);
      return {
        transactions: [],
        total: 0,
        limit,
        offset
      };
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransactionByHash(hash: string): Promise<Transaction | null> {
    try {
      const query = `
        SELECT * FROM transactions
        WHERE hash = $1
      `;

      const result = await postgresDb.query(query, [hash]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTransaction(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get transaction by hash:', error);
      return null;
    }
  }

  /**
   * Get transactions for a specific user
   */
  async getUserTransactions(
    userId: number,
    query: Omit<TransactionQuery, 'filter'> & { filter?: Omit<TransactionFilter, 'fromAddress' | 'toAddress'> }
  ): Promise<{
    transactions: Transaction[];
    total: number;
  }> {
    try {
      // Get user's wallet addresses
      const walletQuery = `
        SELECT wallet_address FROM user_ton_wallets
        WHERE user_id = $1 AND is_active = true
      `;

      const walletResult = await postgresDb.query(walletQuery, [userId]);
      const addresses = walletResult.rows.map(row => row.wallet_address);

      if (addresses.length === 0) {
        return { transactions: [], total: 0 };
      }

      // Get transactions for all user addresses
      const filter: TransactionFilter = {
        ...query.filter,
        // Will be updated to match any of the user's addresses
      };

      const addressConditions = addresses.map((_, i) => `(from_address = $${i + 1} OR to_address = $${i + 1})`).join(' OR ');
      const whereClause = `WHERE (${addressConditions})`;

      // Update query with address filter
      const fullQuery: TransactionQuery = {
        ...query,
        filter: filter
      };

      // For simplicity, directly query with addresses
      const { limit = 50, offset = 0, orderBy = 'timestamp', orderDirection = 'DESC' } = fullQuery;

      const dataQuery = `
        SELECT *
        FROM transactions
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT $${addresses.length + 1}
        OFFSET $${addresses.length + 2}
      `;

      const params = [...addresses, limit, offset];
      const dataResult = await postgresDb.query(dataQuery, params);

      // Apply additional filters in memory (simplified)
      let transactions = dataResult.rows.map(row => this.mapRowToTransaction(row));

      if (filter.tokenType) {
        transactions = transactions.filter(tx => tx.tokenType === filter.tokenType);
      }

      if (filter.status) {
        transactions = transactions.filter(tx => tx.status === filter.status);
      }

      if (filter.minAmount) {
        transactions = transactions.filter(tx => parseFloat(tx.amount) >= filter.minAmount);
      }

      if (filter.maxAmount) {
        transactions = transactions.filter(tx => parseFloat(tx.amount) <= filter.maxAmount);
      }

      if (filter.startDate) {
        transactions = transactions.filter(tx => tx.timestamp >= filter.startDate);
      }

      if (filter.endDate) {
        transactions = transactions.filter(tx => tx.timestamp <= filter.endDate);
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM transactions
        ${whereClause}
      `;

      const countResult = await postgresDb.query(countQuery, addresses);
      const total = parseInt(countResult.rows[0].total);

      return {
        transactions,
        total
      };
    } catch (error) {
      logger.error('Failed to get user transactions:', error);
      return { transactions: [], total: 0 };
    }
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    hash: string,
    status: Transaction['status'],
    blockNumber?: number
  ): Promise<boolean> {
    try {
      const query = `
        UPDATE transactions
        SET status = $1, block_number = $2, updated_at = NOW()
        WHERE hash = $3
      `;

      const result = await postgresDb.query(query, [status, blockNumber, hash]);

      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to update transaction status:', error);
      return false;
    }
  }

  /**
   * Batch update transaction statuses
   */
  async batchUpdateTransactionStatus(updates: Array<{
    hash: string;
    status: Transaction['status'];
    blockNumber?: number;
  }>): Promise<number> {
    if (updates.length === 0) return 0;

    try {
      const values = updates.map(u => `('${u.hash}', '${u.status}', ${u.blockNumber || 'NULL'})`).join(', ');
      const query = `
        UPDATE transactions
        SET status = updates.status,
            block_number = updates.block_number,
            updated_at = NOW()
        FROM (VALUES ${values}) AS updates(hash, status, block_number)
        WHERE transactions.hash = updates.hash
      `;

      const result = await postgresDb.query(query);
      return result.rowCount;
    } catch (error) {
      logger.error('Failed to batch update transaction statuses:', error);
      return 0;
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(filter?: TransactionFilter): Promise<{
    totalTransactions: number;
    totalVolume: number;
    averageAmount: number;
    statusCounts: Record<Transaction['status'], number>;
    tokenTypeCounts: Record<'TON' | 'USDT', number>;
  }> {
    try {
      const whereConditions = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filter?.fromAddress) {
        whereConditions.push(`from_address = $${paramIndex++}`);
        params.push(filter.fromAddress);
      }

      if (filter?.toAddress) {
        whereConditions.push(`to_address = $${paramIndex++}`);
        params.push(filter.toAddress);
      }

      if (filter?.tokenType) {
        whereConditions.push(`token_type = $${paramIndex++}`);
        params.push(filter.tokenType);
      }

      if (filter?.startDate) {
        whereConditions.push(`created_at >= $${paramIndex++}`);
        params.push(filter.startDate);
      }

      if (filter?.endDate) {
        whereConditions.push(`created_at <= $${paramIndex++}`);
        params.push(filter.endDate);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const query = `
        SELECT
          COUNT(*) as total_transactions,
          SUM(amount) as total_volume,
          AVG(amount) as average_amount,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
          COUNT(CASE WHEN token_type = 'TON' THEN 1 END) as ton_count,
          COUNT(CASE WHEN token_type = 'USDT' THEN 1 END) as usdt_count
        FROM transactions
        ${whereClause}
      `;

      const result = await postgresDb.query(query, params);
      const row = result.rows[0];

      return {
        totalTransactions: parseInt(row.total_transactions),
        totalVolume: parseFloat(row.total_volume || 0),
        averageAmount: parseFloat(row.average_amount || 0),
        statusCounts: {
          pending: parseInt(row.pending_count),
          confirmed: parseInt(row.confirmed_count),
          failed: parseInt(row.failed_count)
        },
        tokenTypeCounts: {
          TON: parseInt(row.ton_count),
          USDT: parseInt(row.usdt_count)
        }
      };
    } catch (error) {
      logger.error('Failed to get transaction stats:', error);
      return {
        totalTransactions: 0,
        totalVolume: 0,
        averageAmount: 0,
        statusCounts: { pending: 0, confirmed: 0, failed: 0 },
        tokenTypeCounts: { TON: 0, USDT: 0 }
      };
    }
  }

  /**
   * Cache frequently accessed transactions
   */
  async cacheTransactions(addresses: string[]): Promise<void> {
    // Implementation would use Redis for caching
    // For now, just log
    logger.info(`Caching transactions for ${addresses.length} addresses`);
  }

  /**
   * Get cached transactions
   */
  async getCachedTransactions(address: string, limit: number = 10): Promise<Transaction[]> {
    // Implementation would retrieve from Redis
    // For now, return empty
    return [];
  }

  /**
   * Map database row to Transaction object
   */
  private mapRowToTransaction(row: any): Transaction {
    return {
      hash: row.hash,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      amount: row.amount,
      tokenType: row.token_type,
      fee: row.fee || 0,
      timestamp: row.created_at,
      status: row.status,
      blockNumber: row.block_number,
      message: row.message
    };
  }
}