// ============================================================================
// BASE REPOSITORY
// ============================================================================

import { Repository, QueryOptions, PaginationResult } from '../types/database';

export abstract class BaseRepository<T> implements Repository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  abstract find(options?: QueryOptions): Promise<T[]>;
  abstract findOne(options: QueryOptions): Promise<T | null>;
  abstract findById(id: string): Promise<T | null>;
  abstract create(data: Partial<T>): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T>;
  abstract delete(id: string): Promise<boolean>;
  abstract count(options?: QueryOptions): Promise<number>;
  abstract exists(options: QueryOptions): Promise<boolean>;

  async query(sql: string, params?: any[]): Promise<any> {
    // Implementation would use actual database connection
    console.log('BaseRepository query:', sql, params);
    return { rows: [], rowCount: 0 };
  }

  async transaction<R>(callback: (trx: any) => Promise<R>): Promise<R> {
    // Implementation would use actual database transaction
    console.log('BaseRepository transaction');
    return callback(null);
  }

  protected buildQuery(options: QueryOptions = {}): { sql: string; params: any[] } {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (options.where) {
      const conditions = Object.keys(options.where).map(key => {
        params.push(options.where![key]);
        return `${key} = $${params.length}`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (options.orderBy) {
      const orderClauses = options.orderBy.map(order => `${order.field} ${order.direction}`);
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    if (options.pagination?.limit) {
      sql += ` LIMIT ${options.pagination.limit}`;
      if (options.pagination.offset) {
        sql += ` OFFSET ${options.pagination.offset}`;
      }
    }

    return { sql, params };
  }

  protected paginateResults(results: T[], total: number, options: QueryOptions): PaginationResult<T> {
    const page = options.pagination?.page || 1;
    const limit = options.pagination?.limit || 10;
    const totalPages = Math.ceil(total / limit);

    return {
      data: results,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }
}