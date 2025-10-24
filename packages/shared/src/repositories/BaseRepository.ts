import { Pool, PoolClient } from 'pg';
import { Logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface QueryOptions {
  select?: string[];
  where?: Record<string, any>;
  orderBy?: Record<string, 'ASC' | 'DESC'>;
  limit?: number;
  offset?: number;
  joins?: JoinOption[];
  lock?: 'FOR UPDATE' | 'FOR SHARE';
}

export interface JoinOption {
  table: string;
  on: string;
  type?: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  alias?: string;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TransactionCallback<T> {
  (client: PoolClient): Promise<T>;
}

// ============================================================================
// BASE REPOSITORY
// ============================================================================

export abstract class BaseRepository<T> {
  protected db: Pool;
  protected tableName: string;
  protected logger: Logger;
  protected primaryKey: string = 'id';

  constructor(db: Pool, tableName: string) {
    this.db = db;
    this.tableName = tableName;
    this.logger = new Logger(`${this.constructor.name}`);
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Find record by ID
   */
  async findById(id: string | number, options: QueryOptions = {}): Promise<T | null> {
    const query = this.buildQuery({ where: { [this.primaryKey]: id }, ...options });
    const result = await this.db.query(query.sql, query.params);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find one record by criteria
   */
  async findOne(criteria: Partial<T>, options: QueryOptions = {}): Promise<T | null> {
    const query = this.buildQuery({ where: criteria, limit: 1, ...options });
    const result = await this.db.query(query.sql, query.params);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find multiple records by criteria
   */
  async findMany(
    criteria: Partial<T> = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    const query = this.buildQuery({ where: criteria, ...options });
    const result = await this.db.query(query.sql, query.params);

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find records with pagination
   */
  async findWithPagination(
    criteria: Partial<T> = {},
    page: number = 1,
    limit: number = 20,
    options: QueryOptions = {}
  ): Promise<PaginationResult<T>> {
    // Get total count
    const countQuery = this.buildCountQuery(criteria);
    const countResult = await this.db.query(countQuery.sql, countQuery.params);
    const total = parseInt(countResult.rows[0].count);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Get data
    const dataQuery = this.buildQuery({
      where: criteria,
      limit,
      offset,
      ...options
    });
    const dataResult = await this.db.query(dataQuery.sql, dataQuery.params);
    const data = dataResult.rows.map(row => this.mapRowToEntity(row));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Create new record
   */
  async create(data: Partial<T>): Promise<T> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `
      INSERT INTO ${this.tableName} (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.db.query(sql, values);

    if (result.rows.length === 0) {
      throw new Error(`Failed to create record in ${this.tableName}`);
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create multiple records
   */
  async createMany(dataArray: Partial<T>[]): Promise<T[]> {
    if (dataArray.length === 0) {
      return [];
    }

    const fields = Object.keys(dataArray[0]);
    const values = dataArray.flatMap(data => fields.map(field => data[field]));

    const placeholders = dataArray.map((_, i) =>
      `(${fields.map((_, j) => `$${i * fields.length + j + 1}`).join(', ')})`
    ).join(', ');

    const sql = `
      INSERT INTO ${this.tableName} (${fields.join(', ')})
      VALUES ${placeholders}
      RETURNING *
    `;

    const result = await this.db.query(sql, values);

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update record by ID
   */
  async update(id: string | number, data: Partial<T>): Promise<T> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE ${this.primaryKey} = $${fields.length + 1}
      RETURNING *
    `;

    const result = await this.db.query(sql, [...values, id]);

    if (result.rows.length === 0) {
      throw new Error(`Record not found in ${this.tableName} with ${this.primaryKey}: ${id}`);
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update multiple records by criteria
   */
  async updateMany(
    criteria: Partial<T>,
    data: Partial<T>
  ): Promise<{ affectedRows: number }> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

    const { where: whereClause, params: whereParams } = this.buildWhereClause(criteria, fields.length + 1);

    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      ${whereClause}
    `;

    const result = await this.db.query(sql, [...values, ...whereParams]);

    return { affectedRows: result.rowCount };
  }

  /**
   * Delete record by ID
   */
  async delete(id: string | number): Promise<boolean> {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE ${this.primaryKey} = $1
    `;

    const result = await this.db.query(sql, [id]);

    return result.rowCount > 0;
  }

  /**
   * Delete records by criteria
   */
  async deleteMany(criteria: Partial<T>): Promise<{ affectedRows: number }> {
    const { where: whereClause, params } = this.buildWhereClause(criteria);

    const sql = `
      DELETE FROM ${this.tableName}
      ${whereClause}
    `;

    const result = await this.db.query(sql, params);

    return { affectedRows: result.rowCount };
  }

  /**
   * Soft delete record by ID
   */
  async softDelete(id: string | number): Promise<T | null> {
    return this.update(id, { is_deleted: true, deleted_at: new Date() } as any);
  }

  /**
   * Restore soft deleted record
   */
  async restore(id: string | number): Promise<T | null> {
    return this.update(id, { is_deleted: false, deleted_at: null } as any);
  }

  // ============================================================================
  // AGGREGATE OPERATIONS
  // ============================================================================

  /**
   * Count records by criteria
   */
  async count(criteria: Partial<T> = {}): Promise<number> {
    const query = this.buildCountQuery(criteria);
    const result = await this.db.query(query.sql, query.params);
    return parseInt(result.rows[0].count);
  }

  /**
   * Check if record exists
   */
  async exists(criteria: Partial<T>): Promise<boolean> {
    const count = await this.count(criteria);
    return count > 0;
  }

  /**
   * Find maximum value of a field
   */
  async max(field: keyof T, criteria: Partial<T> = {}): Promise<number | null> {
    const { where: whereClause, params } = this.buildWhereClause(criteria);

    const sql = `
      SELECT MAX(${field as string}) as max_value
      FROM ${this.tableName}
      ${whereClause}
    `;

    const result = await this.db.query(sql, params);
    const maxValue = result.rows[0].max_value;

    return maxValue !== null ? parseFloat(maxValue) : null;
  }

  /**
   * Find minimum value of a field
   */
  async min(field: keyof T, criteria: Partial<T> = {}): Promise<number | null> {
    const { where: whereClause, params } = this.buildWhereClause(criteria);

    const sql = `
      SELECT MIN(${field as string}) as min_value
      FROM ${this.tableName}
      ${whereClause}
    `;

    const result = await this.db.query(sql, params);
    const minValue = result.rows[0].min_value;

    return minValue !== null ? parseFloat(minValue) : null;
  }

  /**
   * Calculate sum of a field
   */
  async sum(field: keyof T, criteria: Partial<T> = {}): Promise<number> {
    const { where: whereClause, params } = this.buildWhereClause(criteria);

    const sql = `
      SELECT SUM(${field as string}) as total
      FROM ${this.tableName}
      ${whereClause}
    `;

    const result = await this.db.query(sql, params);
    const total = result.rows[0].total;

    return total !== null ? parseFloat(total) : 0;
  }

  /**
   * Calculate average of a field
   */
  async avg(field: keyof T, criteria: Partial<T> = {}): Promise<number | null> {
    const { where: whereClause, params } = this.buildWhereClause(criteria);

    const sql = `
      SELECT AVG(${field as string}) as average
      FROM ${this.tableName}
      ${whereClause}
    `;

    const result = await this.db.query(sql, params);
    const average = result.rows[0].average;

    return average !== null ? parseFloat(average) : null;
  }

  // ============================================================================
  // TRANSACTION SUPPORT
  // ============================================================================

  /**
   * Execute operation within a transaction
   */
  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction failed, rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // QUERY BUILDERS
  // ============================================================================

  /**
   * Build complete SELECT query
   */
  protected buildQuery(options: QueryOptions = {}): { sql: string; params: any[] } {
    const {
      select,
      where,
      orderBy,
      limit,
      offset,
      joins,
      lock
    } = options;

    let params: any[] = [];
    let paramIndex = 1;

    // Build SELECT clause
    const selectClause = select ? select.join(', ') : '*';

    // Build FROM clause with joins
    let fromClause = this.tableName;
    if (joins) {
      fromClause += ' ' + joins.map(join => {
        const joinType = join.type || 'INNER';
        const alias = join.alias ? `AS ${join.alias} ` : '';
        return `${joinType} JOIN ${join.table} ${alias}ON ${join.on}`;
      }).join(' ');
    }

    // Build WHERE clause
    const { where: whereClause, params: whereParams } = this.buildWhereClause(where, paramIndex);
    params.push(...whereParams);
    paramIndex += whereParams.length;

    // Build ORDER BY clause
    let orderClause = '';
    if (orderBy) {
      const orderFields = Object.entries(orderBy).map(([field, direction]) =>
        `${field} ${direction}`
      );
      orderClause = `ORDER BY ${orderFields.join(', ')}`;
    }

    // Build LIMIT and OFFSET
    let limitClause = '';
    if (limit) {
      limitClause = `LIMIT $${paramIndex++}`;
      params.push(limit);
    }
    if (offset) {
      limitClause += ` OFFSET $${paramIndex++}`;
      params.push(offset);
    }

    // Build LOCK clause
    const lockClause = lock ? ` ${lock}` : '';

    const sql = `
      SELECT ${selectClause}
      FROM ${fromClause}
      ${whereClause}
      ${orderClause}
      ${limitClause}
      ${lockClause}
    `.trim();

    return { sql, params };
  }

  /**
   * Build WHERE clause
   */
  protected buildWhereClause(
    criteria?: Partial<T>,
    startParamIndex: number = 1
  ): { where: string; params: any[] } {
    if (!criteria || Object.keys(criteria).length === 0) {
      return { where: '', params: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startParamIndex;

    for (const [field, value] of Object.entries(criteria)) {
      if (value === undefined || value === null) {
        conditions.push(`${field} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`${field} IN (${placeholders})`);
        params.push(...value);
      } else if (typeof value === 'object') {
        // Handle operators like { gt: 100, lt: 200 }
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case 'gt':
              conditions.push(`${field} > $${paramIndex++}`);
              params.push(operatorValue);
              break;
            case 'gte':
              conditions.push(`${field} >= $${paramIndex++}`);
              params.push(operatorValue);
              break;
            case 'lt':
              conditions.push(`${field} < $${paramIndex++}`);
              params.push(operatorValue);
              break;
            case 'lte':
              conditions.push(`${field} <= $${paramIndex++}`);
              params.push(operatorValue);
              break;
            case 'ne':
              conditions.push(`${field} != $${paramIndex++}`);
              params.push(operatorValue);
              break;
            case 'like':
              conditions.push(`${field} LIKE $${paramIndex++}`);
              params.push(operatorValue);
              break;
            case 'ilike':
              conditions.push(`${field} ILIKE $${paramIndex++}`);
              params.push(operatorValue);
              break;
            default:
              conditions.push(`${field} = $${paramIndex++}`);
              params.push(operatorValue);
          }
        }
      } else {
        conditions.push(`${field} = $${paramIndex++}`);
        params.push(value);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { where: whereClause, params };
  }

  /**
   * Build COUNT query
   */
  protected buildCountQuery(criteria?: Partial<T>): { sql: string; params: any[] } {
    const { where, params } = this.buildWhereClause(criteria);

    return {
      sql: `SELECT COUNT(*) as count FROM ${this.tableName} ${where}`,
      params
    };
  }

  // ============================================================================
  // ABSTRACT METHODS
  // ============================================================================

  /**
   * Map database row to entity
   * Must be implemented by concrete repositories
   */
  protected abstract mapRowToEntity(row: any): T;

  /**
   * Map entity to database row
   * Optional: implement if custom mapping is needed
   */
  protected mapEntityToRow(entity: Partial<T>): any {
    return entity;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Get primary key
   */
  getPrimaryKey(): string {
    return this.primaryKey;
  }

  /**
   * Build raw SQL with parameter binding
   */
  protected buildRawSQL(sql: string, params: any[] = []): { sql: string; params: any[] } {
    return { sql, params };
  }

  /**
   * Execute raw SQL query
   */
  async query(sql: string, params: any[] = []): Promise<any> {
    const result = await this.db.query(sql, params);
    return result.rows;
  }
}