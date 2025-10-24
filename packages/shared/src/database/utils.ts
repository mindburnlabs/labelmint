// ============================================================================
// DATABASE UTILITIES
// ============================================================================

/**
 * Generate UUID for database records
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Build WHERE clause from filters
 */
export function buildWhereClause(filters: Record<string, any>): { clause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        const placeholders = value.map((_, index) => `$${params.length + index + 1}`).join(', ');
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...value);
      } else {
        conditions.push(`${key} = $${params.length + 1}`);
        params.push(value);
      }
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

/**
 * Build ORDER BY clause
 */
export function buildOrderByClause(orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>): string {
  if (orderBy.length === 0) return '';

  const clauses = orderBy.map(order => `${order.field} ${order.direction.toUpperCase()}`);
  return `ORDER BY ${clauses.join(', ')}`;
}

/**
 * Build LIMIT and OFFSET clause
 */
export function buildPaginationClause(page?: number, limit?: number): { clause: string; offset: number } {
  if (!limit) return { clause: '', offset: 0 };

  const offset = page ? (page - 1) * limit : 0;
  const clause = `LIMIT ${limit}${offset > 0 ? ` OFFSET ${offset}` : ''}`;

  return { clause, offset };
}

/**
 * Escape SQL identifier
 */
export function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Escape SQL literal
 */
export function escapeLiteral(literal: string): string {
  return `'${literal.replace(/'/g, "''")}'`;
}

/**
 * Transform snake_case to camelCase
 */
export function snakeToCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform camelCase to snake_case
 */
export function camelToSnake(camel: string): string {
  return camel.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Transform database row to camelCase object
 */
export function transformRow<T = any>(row: Record<string, any>): T {
  const transformed: any = {};

  for (const [key, value] of Object.entries(row)) {
    const camelKey = snakeToCamel(key);
    transformed[camelKey] = value;
  }

  return transformed as T;
}

/**
 * Transform camelCase object to database row
 */
export function transformToRow<T = any>(obj: Record<string, any>): T {
  const transformed: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    transformed[snakeKey] = value;
  }

  return transformed as T;
}

/**
 * Generate table name from model name
 */
export function generateTableName(modelName: string): string {
  return camelToSnake(modelName).toLowerCase() + 's';
}