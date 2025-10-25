// Database Performance Optimization Utilities
import { PrismaClient } from '@prisma/client';

interface QueryOptimization {
  queryName: string;
  optimizedQuery: string;
  indexes: string[];
  estimatedImprovement: string;
}

interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

class DatabaseOptimizer {
  private prisma: PrismaClient;
  private queryStats: Map<string, QueryStats> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.setupQueryLogging();
  }

  private setupQueryLogging(): void {
    // Enable query logging in development
    if (process.env.NODE_ENV === 'development') {
      this.prisma.$on('query', (event) => {
        this.recordQueryStats(event.query, event.duration);
      });
    }
  }

  private recordQueryStats(query: string, duration: number): void {
    const queryName = this.extractQueryName(query);
    const stats = this.queryStats.get(queryName) || {
      count: 0,
      totalDuration: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: Infinity
    };

    stats.count++;
    stats.totalDuration += duration;
    stats.averageDuration = stats.totalDuration / stats.count;
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    stats.minDuration = Math.min(stats.minDuration, duration);

    this.queryStats.set(queryName, stats);

    // Alert on slow queries
    if (duration > 100) {
      console.warn(`Slow query detected: ${queryName} (${duration}ms)`);
    }
  }

  private extractQueryStats(query: string): string {
    // Extract query type and main table
    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery.startsWith('select')) {
      const fromMatch = normalizedQuery.match(/from\s+(\w+)/);
      return fromMatch ? `SELECT_${fromMatch[1].toUpperCase()}` : 'SELECT_UNKNOWN';
    }

    if (normalizedQuery.startsWith('insert')) {
      const intoMatch = normalizedQuery.match(/into\s+(\w+)/);
      return intoMatch ? `INSERT_${intoMatch[1].toUpperCase()}` : 'INSERT_UNKNOWN';
    }

    if (normalizedQuery.startsWith('update')) {
      const updateMatch = normalizedQuery.match(/update\s+(\w+)/);
      return updateMatch ? `UPDATE_${updateMatch[1].toUpperCase()}` : 'UPDATE_UNKNOWN';
    }

    if (normalizedQuery.startsWith('delete')) {
      const fromMatch = normalizedQuery.match(/from\s+(\w+)/);
      return fromMatch ? `DELETE_${fromMatch[1].toUpperCase()}` : 'DELETE_UNKNOWN';
    }

    return 'OTHER';
  }

  // Get optimized queries for common patterns
  getOptimizedQueries(): QueryOptimization[] {
    return [
      {
        queryName: 'GET_AVAILABLE_TASKS_FOR_WORKER',
        optimizedQuery: `
          SELECT t.*, r.response_count
          FROM tasks t
          LEFT JOIN (
            SELECT task_id, COUNT(*) as response_count
            FROM responses
            GROUP BY task_id
          ) r ON t.id = r.task_id
          WHERE t.completion_status = 'pending'
          AND NOT EXISTS (
            SELECT 1 FROM task_seen ts
            WHERE ts.task_id = t.id AND ts.worker_id = $1
          )
          ORDER BY t.consensus_count < 3, RANDOM()
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `,
        indexes: [
          'CREATE INDEX CONCURRENTLY idx_tasks_status_consensus ON tasks(completion_status, consensus_count)',
          'CREATE INDEX CONCURRENTLY idx_task_seen_worker_task ON task_seen(worker_id, task_id)',
          'CREATE INDEX CONCURRENTLY idx_responses_task_id ON responses(task_id)'
        ],
        estimatedImprovement: '70-80% faster task assignment'
      },
      {
        queryName: 'GET_USER_WITH_STATS',
        optimizedQuery: `
          SELECT
            u.*,
            w.balance,
            w.total_earned,
            COALESCE(stats.tasks_completed, 0) as tasks_completed,
            COALESCE(stats.accuracy_rate, 0) as accuracy_rate
          FROM users u
          LEFT JOIN wallets w ON w.user_id = u.id
          LEFT JOIN (
            SELECT
              worker_id,
              COUNT(*) as tasks_completed,
              AVG(CASE WHEN is_correct THEN 1 ELSE 0 END)::DECIMAL(5,2) as accuracy_rate
            FROM task_assignments ta
            JOIN responses r ON r.task_id = ta.task_id AND r.user_id = ta.worker_id
            WHERE ta.completed_at >= NOW() - INTERVAL '30 days'
            GROUP BY worker_id
          ) stats ON stats.worker_id = u.id
          WHERE u.id = $1
        `,
        indexes: [
          'CREATE INDEX CONCURRENTLY idx_wallets_user_id ON wallets(user_id)',
          'CREATE INDEX CONCURRENTLY idx_task_assignments_worker_completed ON task_assignments(worker_id, completed_at)',
          'CREATE INDEX CONCURRENTLY idx_responses_user_task ON responses(user_id, task_id)'
        ],
        estimatedImprovement: '60-70% faster profile loading'
      },
      {
        queryName: 'GET_PROJECT_ANALYTICS',
        optimizedQuery: `
          SELECT
            p.*,
            COUNT(DISTINCT t.id) as total_tasks,
            COUNT(DISTINCT CASE WHEN t.completion_status = 'completed' THEN t.id END) as completed_tasks,
            AVG(t.base_price) as avg_task_price,
            SUM(CASE WHEN t.completion_status = 'completed' THEN t.base_price ELSE 0 END) as total_spent,
            COUNT(DISTINCT ta.worker_id) as unique_workers
          FROM projects p
          LEFT JOIN tasks t ON t.project_id = p.id
          LEFT JOIN task_assignments ta ON ta.task_id = t.id
          WHERE p.id = $1
          GROUP BY p.id
        `,
        indexes: [
          'CREATE INDEX CONCURRENTLY idx_tasks_project_status ON tasks(project_id, completion_status)',
          'CREATE INDEX CONCURRENTLY idx_task_assignments_task_id ON task_assignments(task_id)'
        ],
        estimatedImprovement: '50-60% faster analytics queries'
      }
    ];
  }

  // Optimized connection pool configuration
  getConnectionPoolConfig(): ConnectionPoolConfig {
    const maxConnections = parseInt(process.env.DATABASE_POOL_SIZE || '20');
    const minConnections = Math.max(2, Math.floor(maxConnections * 0.2));

    return {
      maxConnections,
      minConnections,
      idleTimeoutMillis: 30000, // 30 seconds
      connectionTimeoutMillis: 10000 // 10 seconds
    };
  }

  // Generate optimized database URL
  getOptimizedDatabaseUrl(baseUrl: string): string {
    const config = this.getConnectionPoolConfig();
    const url = new URL(baseUrl);

    // Add connection pool parameters
    url.searchParams.set('connection_limit', config.maxConnections.toString());
    url.searchParams.set('pool_timeout', '20');
    url.searchParams.set('connect_timeout', '10');
    url.searchParams.set('statement_timeout', '30000'); // 30 seconds
    url.searchParams.set('query_timeout', '30000'); // 30 seconds

    return url.toString();
  }

  // Create performance indexes
  async createPerformanceIndexes(): Promise<void> {
    const optimizedQueries = this.getOptimizedQueries();

    for (const query of optimizedQueries) {
      for (const indexSql of query.indexes) {
        try {
          await this.prisma.$executeRawUnsafe(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexSql.split('INDEX')[1].split('ON')[0].trim()}`);
          console.log(`Created index: ${indexSql.split('INDEX')[1].split('ON')[0].trim()}`);
        } catch (error) {
          console.error(`Failed to create index: ${indexSql}`, error);
        }
      }
    }
  }

  // Analyze table statistics
  async analyzeTableStatistics(): Promise<void> {
    const tables = [
      'users',
      'tasks',
      'responses',
      'projects',
      'wallets',
      'transactions',
      'task_assignments'
    ];

    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(`ANALYZE ${table}`);
        console.log(`Analyzed table: ${table}`);
      } catch (error) {
        console.error(`Failed to analyze table: ${table}`, error);
      }
    }
  }

  // Get query performance statistics
  getQueryStatistics(): Array<{ queryName: string; stats: QueryStats }> {
    return Array.from(this.queryStats.entries()).map(([queryName, stats]) => ({
      queryName,
      stats
    }));
  }

  // Identify slow queries
  getSlowQueries(thresholdMs: number = 100): Array<{ queryName: string; stats: QueryStats }> {
    return this.getQueryStatistics().filter(({ stats }) =>
      stats.averageDuration > thresholdMs || stats.maxDuration > thresholdMs * 2
    );
  }

  // Optimized batch operations
  async batchInsert<T>(
    tableName: string,
    records: T[],
    batchSize: number = 1000
  ): Promise<void> {
    const batches = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const columns = Object.keys(batch[0] as any);
      const values = batch.map(record =>
        `(${columns.map(col => this.formatValue((record as any)[col])).join(', ')})`
      ).join(', ');

      const query = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES ${values}
        ON CONFLICT DO NOTHING
      `;

      try {
        await this.prisma.$executeRawUnsafe(query);
      } catch (error) {
        console.error(`Batch insert failed for ${tableName}:`, error);
        throw error;
      }
    }
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value instanceof Date) return `'${value.toISOString()}'`;
    return String(value);
  }

  // Connection health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; connections: number }> {
    const start = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      // Get connection count (PostgreSQL specific)
      const connectionResult = await this.prisma.$queryRawUnsafe(`
        SELECT count(*) as connections
        FROM pg_stat_activity
        WHERE state = 'active'
      `);

      const connections = parseInt((connectionResult as any)[0]?.connections || '0');

      return {
        status: latency < 1000 ? 'healthy' : 'unhealthy',
        latency,
        connections
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        connections: -1
      };
    }
  }
}

interface QueryStats {
  count: number;
  totalDuration: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
}

export { DatabaseOptimizer, type QueryOptimization, type ConnectionPoolConfig };