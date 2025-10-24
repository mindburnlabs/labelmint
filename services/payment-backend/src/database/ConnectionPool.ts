import { Pool, PoolConfig, PoolClient } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('ConnectionPool');

interface PoolMetrics {
  totalQueries: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalAcquires: number;
  totalReleases: number;
  averageAcquireTime: number;
  errors: number;
}

export class ProductionConnectionPool {
  private pool: Pool;
  private metrics: PoolMetrics = {
    totalQueries: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    totalAcquires: 0,
    totalReleases: 0,
    averageAcquireTime: 0,
    errors: 0
  };

  constructor() {
    const config: PoolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'labelmint',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false,

      // Connection pool settings
      max: parseInt(process.env.DB_POOL_MAX || '50'), // Maximum number of connections
      min: parseInt(process.env.DB_POOL_MIN || '5'), // Minimum number of connections
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 30 seconds
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'), // 5 seconds

      // Advanced settings
      application_name: 'labelmint_payment_backend',
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'), // 30 seconds
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'), // 30 seconds

      // Connection retry settings
      maxUses: parseInt(process.env.DB_MAX_USES || '7500'), // Reuse connections 7500 times
      keepAlive: true,
      allowExitOnIdle: false
    };

    this.pool = new Pool(config);

    // Handle pool events
    this.pool.on('connect', (client) => {
      logger.info('New database connection established', {
        processId: client.processID,
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingConnections: this.pool.waitingCount
      });
    });

    this.pool.on('acquire', (client) => {
      const start = Date.now();
      this.metrics.totalAcquires++;
      this.metrics.activeConnections++;

      client.on('query', () => {
        this.metrics.totalQueries++;
      });

      return Promise.resolve(client).then(c => {
        const acquireTime = Date.now() - start;
        this.updateAverageAcquireTime(acquireTime);
        return c;
      });
    });

    this.pool.on('release', (client, err) => {
      this.metrics.totalReleases++;
      this.metrics.activeConnections--;

      if (err) {
        this.metrics.errors++;
        logger.error('Database connection released with error', err);
      }
    });

    this.pool.on('error', (err, client) => {
      this.metrics.errors++;
      logger.error('Database connection error', {
        error: err.message,
        client: client?.processID
      });
    });

    this.pool.on('remove', (client) => {
      logger.warn('Database connection removed', {
        processId: client.processID
      });
    });

    // Periodic metrics logging
    setInterval(() => {
      this.logMetrics();
    }, 60000); // Every minute

    logger.info('Database connection pool initialized', config);
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    const start = Date.now();

    try {
      const client = await this.pool.connect();
      const acquireTime = Date.now() - start;

      // Add query execution tracking
      const originalQuery = client.query.bind(client);
      client.query = (...args: any[]) => {
        const queryStart = Date.now();
        return originalQuery(...args).then(result => {
          const queryTime = Date.now() - queryStart;
          this.trackQuery(args[0]?.text || args[0], queryTime, result.rowCount);
          return result;
        });
      };

      return client;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Failed to acquire database connection', error);
      throw error;
    }
  }

  /**
   * Execute a query with automatic client management
   */
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    let client: PoolClient | null = null;

    try {
      client = await this.getClient();
      const result = await client.query<T>(text, params);
      return result.rows;
    } catch (error) {
      logger.error('Database query error', {
        query: text,
        params,
        error: error.message
      });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T = any>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    let client: PoolClient | null = null;

    try {
      client = await this.getClient();
      await client.query('BEGIN');

      const result = await callback(client);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error('Failed to rollback transaction', rollbackError);
        }
      }

      logger.error('Transaction error', error);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Track query performance
   */
  private trackQuery(query: string, duration: number, rowCount: number) {
    // Log slow queries
    if (duration > 1000) { // Queries taking more than 1 second
      logger.warn('Slow query detected', {
        query: query.substring(0, 200),
        duration,
        rowCount
      });
    }

    // Store in metrics table for analysis
    if (process.env.NODE_ENV === 'production') {
      // This would be stored in a time-series database in production
      // For now, just log it
      logger.info('Query metrics', {
        queryType: this.getQueryType(query),
        duration,
        rowCount
      });
    }
  }

  /**
   * Update average acquire time
   */
  private updateAverageAcquireTime(acquireTime: number) {
    const totalAcquires = this.metrics.totalAcquires;
    const currentAverage = this.metrics.averageAcquireTime;

    this.metrics.averageAcquireTime = (
      (currentAverage * (totalAcquires - 1) + acquireTime) / totalAcquires
    );
  }

  /**
   * Get query type from SQL
   */
  private getQueryType(query: string): string {
    const trimmed = query.trim().toLowerCase();

    if (trimmed.startsWith('select')) return 'SELECT';
    if (trimmed.startsWith('insert')) return 'INSERT';
    if (trimmed.startsWith('update')) return 'UPDATE';
    if (trimmed.startsWith('delete')) return 'DELETE';
    if (trimmed.startsWith('create')) return 'CREATE';
    if (trimmed.startsWith('alter')) return 'ALTER';
    if (trimmed.startsWith('drop')) return 'DROP';

    return 'OTHER';
  }

  /**
   * Log current metrics
   */
  private logMetrics() {
    const pool = this.pool;
    this.metrics = {
      ...this.metrics,
      activeConnections: pool.totalCount - pool.idleCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount
    };

    logger.info('Database pool metrics', this.metrics);

    // Alert on potential issues
    if (this.metrics.errors > 0) {
      logger.warn('Database errors detected', { errors: this.metrics.errors });
    }

    if (this.metrics.averageAcquireTime > 100) {
      logger.warn('High database connection acquire time', {
        averageMs: this.metrics.averageAcquireTime
      });
    }

    if (this.metrics.waitingClients > 0) {
      logger.warn('Clients waiting for database connections', {
        waiting: this.metrics.waitingClients
      });
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const pool = this.pool;
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      metrics: this.metrics
    };
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    logger.info('Closing database connection pool...');
    await this.pool.end();
    logger.info('Database connection pool closed');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.length === 1;
    } catch (error) {
      logger.error('Database health check failed', error);
      return false;
    }
  }
}

// Create singleton instance
export const connectionPool = new ProductionConnectionPool();