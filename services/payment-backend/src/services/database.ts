import { Pool, PoolClient, QueryResult } from 'pg';
import config from '../config';

let pool: Pool;

export const postgresDb = {
  async connect(): Promise<Pool> {
    if (!pool) {
      pool = new Pool({
        connectionString: config.database.url,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await pool.connect();
      client.release();
    }

    return pool;
  },

  async query(text: string, params?: any[]): Promise<QueryResult> {
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  },

  async getClient(): Promise<PoolClient> {
    return pool.connect();
  },

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async close(): Promise<void> {
    if (pool) {
      await pool.end();
    }
  }
};

// Initialize connection on module load
postgresDb.connect().catch(console.error);