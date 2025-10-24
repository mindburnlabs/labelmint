// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
  };
  acquireTimeoutMillis?: number;
  createTimeoutMillis?: number;
  destroyTimeoutMillis?: number;
  reapIntervalMillis?: number;
  createRetryIntervalMillis?: number;
}

export interface DatabaseConfig {
  connection: DatabaseConnection;
  migrations: {
    directory: string;
    tableName: string;
    disableTransactions?: boolean;
  };
  seeds: {
    directory: string;
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    sql?: boolean;
  };
}

export interface QueryBuilder {
  select(columns?: string[]): this;
  from(table: string): this;
  where(condition: string, ...args: any[]): this;
  whereIn(column: string, values: any[]): this;
  whereNotIn(column: string, values: any[]): this;
  whereNull(column: string): this;
  whereNotNull(column: string): this;
  whereBetween(column: string, range: [any, any]): this;
  whereExists(subquery: any): this;
  whereNotExists(subquery: any): this;
  join(table: string, first: string, operator?: string, second?: string): this;
  leftJoin(table: string, first: string, operator?: string, second?: string): this;
  rightJoin(table: string, first: string, operator?: string, second?: string): this;
  innerJoin(table: string, first: string, operator?: string, second?: string): this;
  groupBy(columns: string | string[]): this;
  orderBy(column: string, direction?: 'asc' | 'desc'): this;
  having(condition: string, ...args: any[]): this;
  limit(count: number): this;
  offset(count: number): this;
  first(): Promise<any>;
  get(): Promise<any[]>;
  count(): Promise<number>;
  sum(column: string): Promise<number>;
  avg(column: string): Promise<number>;
  min(column: string): Promise<any>;
  max(column: string): Promise<any>;
  insert(data: any): Promise<any>;
  update(data: any): Promise<number>;
  delete(): Promise<number>;
  toSql(): string;
}

export interface Repository<T> {
  find(options?: any): Promise<T[]>;
  findOne(options: any): Promise<T | null>;
  findById(id: string): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  count(options?: any): Promise<number>;
  exists(options: any): Promise<boolean>;
  query(sql: string, params?: any[]): Promise<any>;
  transaction<R>(callback: (trx: any) => Promise<R>): Promise<R>;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterOptions {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'notIn' | 'between' | 'exists' | 'null' | 'notNull';
  value: any;
}

export interface QueryOptions {
  where?: Record<string, any>;
  select?: string[];
  orderBy?: SortOptions[];
  joins?: JoinOption[];
  pagination?: PaginationOptions;
  filters?: FilterOptions[];
  search?: {
    fields: string[];
    query: string;
  };
}

export interface JoinOption {
  table: string;
  on: string;
  type: 'LEFT' | 'RIGHT' | 'INNER' | 'FULL';
  alias?: string;
}

export interface Transaction {
  query(sql: string, params?: any[]): Promise<any>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  savepoint(name?: string): Promise<void>;
  rollbackToSavepoint(name: string): Promise<void>;
  releaseSavepoint(name: string): Promise<void>;
}

export interface Migration {
  up(trx: Transaction): Promise<void>;
  down(trx: Transaction): Promise<void>;
}

export interface Seed {
  run(trx: Transaction): Promise<void>;
}

export interface DatabaseSchema {
  name: string;
  tables: TableSchema[];
  indexes: IndexSchema[];
  constraints: ConstraintSchema[];
  views?: ViewSchema[];
  functions?: FunctionSchema[];
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: ForeignKeySchema[];
  indexes: IndexSchema[];
  constraints: ConstraintSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  default?: any;
  autoIncrement?: boolean;
  length?: number;
  precision?: number;
  scale?: number;
}

export interface IndexSchema {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  type?: 'btree' | 'hash' | 'gist' | 'spgist' | 'gin';
  where?: string;
}

export interface ConstraintSchema {
  name: string;
  type: 'primary' | 'unique' | 'check' | 'foreign';
  table: string;
  columns: string[];
  expression?: string;
  references?: {
    table: string;
    columns: string[];
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  };
}

export interface ForeignKeySchema {
  name: string;
  column: string;
  referencesTable: string;
  referencesColumn: string;
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface ViewSchema {
  name: string;
  definition: string;
  columns: ColumnSchema[];
}

export interface FunctionSchema {
  name: string;
  parameters: ColumnSchema[];
  returnType: string;
  language: 'sql' | 'plpgsql' | 'plv8';
  definition: string;
  volatility?: 'immutable' | 'stable' | 'volatile';
}

export interface DatabaseStats {
  connections: {
    active: number;
    idle: number;
    total: number;
    max: number;
  };
  queries: {
    total: number;
    successful: number;
    failed: number;
    averageExecutionTime: number;
  };
  tables: Array<{
    name: string;
    rowCount: number;
    size: string;
    indexSize: string;
  }>;
  indexes: Array<{
    name: string;
    table: string;
    size: string;
    usage: number;
  }>;
}

export interface PoolConfig {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
  propagateCreateError: boolean;
}

export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
    pfx?: string;
    passphrase?: string;
  };
  encoding?: string;
  timezone?: string;
  application_name?: string;
  connectionTimeoutMillis?: number;
  query_timeout?: number;
  statement_timeout?: number;
  idle_in_transaction_session_timeout?: number;
}