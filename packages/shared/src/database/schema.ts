// ============================================================================
// DATABASE SCHEMA TYPES
// ============================================================================

/**
 * Database table schema definition
 */
export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: ForeignKeySchema[];
  indexes: IndexSchema[];
  constraints: ConstraintSchema[];
}

/**
 * Database column schema definition
 */
export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  default?: any;
  autoIncrement?: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  comment?: string;
}

/**
 * Foreign key schema definition
 */
export interface ForeignKeySchema {
  name: string;
  column: string;
  referencesTable: string;
  referencesColumn: string;
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

/**
 * Index schema definition
 */
export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
  type?: 'btree' | 'hash' | 'gist' | 'spgist' | 'gin';
  where?: string;
  comment?: string;
}

/**
 * Constraint schema definition
 */
export interface ConstraintSchema {
  name: string;
  type: 'primary' | 'unique' | 'check' | 'foreign';
  columns: string[];
  expression?: string;
  references?: {
    table: string;
    columns: string[];
    onUpdate?: string;
    onDelete?: string;
  };
  comment?: string;
}

/**
 * Database view schema definition
 */
export interface ViewSchema {
  name: string;
  definition: string;
  columns: ColumnSchema[];
  comment?: string;
}

/**
 * Database function schema definition
 */
export interface FunctionSchema {
  name: string;
  parameters: ColumnSchema[];
  returnType: string;
  language: 'sql' | 'plpgsql' | 'plv8';
  definition: string;
  volatility?: 'immutable' | 'stable' | 'volatile';
  comment?: string;
}