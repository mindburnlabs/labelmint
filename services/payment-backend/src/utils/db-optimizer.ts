import { PrismaClient } from '@prisma/client';
import { Logger } from './logger';
import { MetricsCollector } from './metrics';

interface QueryOptimization {
  queryName: string;
  estimatedCost: number;
  actualCost?: number;
  executionTime: number;
  indexes: string[];
  suggestions: string[];
}

interface IndexAnalysis {
  tableName: string;
  existingIndexes: Array<{
    name: string;
    columns: string[];
    unique: boolean;
    partial?: string;
  }>;
  recommendedIndexes: Array<{
    name: string;
    columns: string[];
    reason: string;
    priority: 'high' | 'medium' | 'low';
    type: 'btree' | 'hash' | 'gin' | 'gist';
  }>;
  unusedIndexes: string[];
}

interface SlowQueryAnalysis {
  query: string;
  executionCount: number;
  totalExecutionTime: number;
  avgExecutionTime: number;
  maxExecutionTime: number;
  recommendations: string[];
}

export class DatabaseOptimizer {
  private prisma: PrismaClient;
  private logger: Logger;
  private metrics: MetricsCollector;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.logger = new Logger('DatabaseOptimizer');
    this.metrics = new MetricsCollector('db_optimizer');
  }

  /**
   * Analyze and optimize slow queries
   */
  async analyzeSlowQueries(): Promise<SlowQueryAnalysis[]> {
    try {
      // This would typically query pg_stat_statements
      const slowQueries = await this.prisma.$queryRaw`
        SELECT
          query,
          calls as execution_count,
          total_exec_time as total_execution_time,
          mean_exec_time as avg_execution_time,
          max_exec_time as max_execution_time,
          rows
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
        ORDER BY mean_exec_time DESC
        LIMIT 20
      ` as any[];

      const analyses: SlowQueryAnalysis[] = [];

      for (const query of slowQueries) {
        const recommendations = await this.generateQueryRecommendations(query.query);

        analyses.push({
          query: query.query,
          executionCount: parseInt(query.execution_count),
          totalExecutionTime: parseFloat(query.total_execution_time),
          avgExecutionTime: parseFloat(query.avg_execution_time),
          maxExecutionTime: parseFloat(query.max_execution_time),
          recommendations
        });
      }

      return analyses;
    } catch (error) {
      this.logger.error('Failed to analyze slow queries', error);
      return [];
    }
  }

  /**
   * Analyze table indexes and provide recommendations
   */
  async analyzeIndexes(tableNames: string[]): Promise<IndexAnalysis[]> {
    const analyses: IndexAnalysis[] = [];

    for (const tableName of tableNames) {
      try {
        const existingIndexes = await this.getExistingIndexes(tableName);
        const recommendedIndexes = await this.generateIndexRecommendations(tableName);
        const unusedIndexes = await this.findUnusedIndexes(tableName);

        analyses.push({
          tableName,
          existingIndexes,
          recommendedIndexes,
          unusedIndexes
        });
      } catch (error) {
        this.logger.error(`Failed to analyze indexes for table ${tableName}`, error);
      }
    }

    return analyses;
  }

  /**
   * Get existing indexes for a table
   */
  private async getExistingIndexes(tableName: string): Promise<any[]> {
    const indexes = await this.prisma.$queryRaw`
      SELECT
        indexname as name,
        indexdef as definition,
        schemaname as schema
      FROM pg_indexes
      WHERE tablename = ${tableName}
      AND schemaname = 'public'
    ` as any[];

    return indexes.map(index => ({
      name: index.name,
      columns: this.extractIndexColumns(index.definition),
      unique: index.definition.includes('CREATE UNIQUE INDEX')
    }));
  }

  /**
   * Generate index recommendations based on query patterns
   */
  private async generateIndexRecommendations(tableName: string): Promise<any[]> {
    const recommendations: any[] = [];

    // Analyze common query patterns
    switch (tableName) {
      case 'User':
        recommendations.push(
          {
            name: 'idx_user_email',
            columns: ['email'],
            reason: 'Frequent lookups by email for authentication',
            priority: 'high' as const,
            type: 'btree' as const
          },
          {
            name: 'idx_user_role_status',
            columns: ['role', 'status'],
            reason: 'Admin queries filtering by role and status',
            priority: 'medium' as const,
            type: 'btree' as const
          },
          {
            name: 'idx_user_created_at',
            columns: ['createdAt'],
            reason: 'Time-based user analytics queries',
            priority: 'low' as const,
            type: 'btree' as const
          }
        );
        break;

      case 'Task':
        recommendations.push(
          {
            name: 'idx_task_assignee_status',
            columns: ['assigneeId', 'status'],
            reason: 'User dashboard queries for assigned tasks',
            priority: 'high' as const,
            type: 'btree' as const
          },
          {
            name: 'idx_task_project_priority',
            columns: ['projectId', 'priority'],
            reason: 'Project task views sorted by priority',
            priority: 'medium' as const,
            type: 'btree' as const
          },
          {
            name: 'idx_task_due_date',
            columns: ['dueDate'],
            reason: 'Task deadline reminders and filtering',
            priority: 'high' as const,
            type: 'btree' as const
          },
          {
            name: 'idx_task_tags',
            columns: ['tags'],
            reason: 'Tag-based task filtering',
            priority: 'medium' as const,
            type: 'gin' as const
          },
          {
            name: 'idx_task_created_at',
            columns: ['createdAt'],
            reason: 'Recent tasks sorting and analytics',
            priority: 'low' as const,
            type: 'btree' as const
          }
        );
        break;

      case 'Delegation':
        recommendations.push(
          {
            name: 'idx_delegation_delegator_status',
            columns: ['delegatorId', 'status'],
            reason: 'User delegation views',
            priority: 'high' as const,
            type: 'btree' as const
          },
          {
            name: 'idx_delegation_delegatee_active',
            columns: ['delegateeId', 'status'],
            reason: 'Active delegations for delegatee',
            priority: 'high' as const,
            type: 'btree' as const
          },
          {
            name: 'idx_delegation_task',
            columns: ['taskId'],
            reason: 'Task delegation lookups',
            priority: 'medium' as const,
            type: 'btree' as const
          }
        );
        break;

      case 'Comment':
        recommendations.push(
          {
            name: 'idx_comment_task_created',
            columns: ['taskId', 'createdAt'],
            reason: 'Threaded comment ordering',
            priority: 'high' as const,
            type: 'btree' as const
          },
          {
            name: 'idx_comment_parent',
            columns: ['parentId'],
            reason: 'Reply comment lookups',
            priority: 'medium' as const,
            type: 'btree' as const
          },
          {
            name: 'idx_comment_author',
            columns: ['authorId'],
            reason: 'User comment history',
            priority: 'low' as const,
            type: 'btree' as const
          }
        );
        break;
    }

    return recommendations;
  }

  /**
   * Find unused indexes
   */
  private async findUnusedIndexes(tableName: string): Promise<string[]> {
    try {
      const unusedIndexes = await this.prisma.$queryRaw`
        SELECT
          schemaname || '.' || tablename || '.' || indexname as index_name
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND tablename = ${tableName}
        AND idx_scan = 0
        AND idx_tup_read = 0
        AND idx_tup_fetch = 0
      ` as any[];

      return unusedIndexes.map((index: any) => index.index_name);
    } catch (error) {
      this.logger.error('Failed to find unused indexes', error);
      return [];
    }
  }

  /**
   * Generate query recommendations
   */
  private async generateQueryRecommendations(query: string): Promise<string[]> {
    const recommendations: string[] = [];

    // Check for full table scans
    if (query.includes('SELECT') && !query.includes('WHERE')) {
      recommendations.push('Consider adding WHERE clause to limit result set');
    }

    // Check for SELECT *
    if (query.includes('SELECT *')) {
      recommendations.push('Replace SELECT * with specific columns to reduce data transfer');
    }

    // Check for missing indexes
    if (query.includes('ORDER BY') && !query.includes('INDEX')) {
      recommendations.push('Consider adding index on ORDER BY columns');
    }

    // Check for LIKE operations
    if (query.includes('LIKE') && !query.includes('LIKE \'%') && !query.includes('ILIKE')) {
      recommendations.push('Consider using trigram indexes for text search operations');
    }

    // Check for JOIN operations
    if (query.includes('JOIN')) {
      recommendations.push('Ensure foreign key columns are indexed');
      recommendations.push('Consider using explicit JOIN types instead of implicit joins');
    }

    // Check for subqueries
    if (query.includes('(SELECT')) {
      recommendations.push('Consider converting subqueries to JOINs for better performance');
    }

    return recommendations;
  }

  /**
   * Extract column names from index definition
   */
  private extractIndexColumns(definition: string): string[] {
    const match = definition.match(/\(([^)]+)\)/);
    if (!match) return [];

    return match[1].split(',').map(col => col.trim().replace(/"/g, ''));
  }

  /**
   * Create recommended indexes
   */
  async createIndexes(recommendations: any[]): Promise<void> {
    for (const recommendation of recommendations) {
      try {
        const uniqueClause = recommendation.unique ? 'UNIQUE' : '';
        const columns = recommendation.columns.join(', ');

        const createIndexSQL = `
          CREATE ${uniqueClause} INDEX CONCURRENTLY
          IF NOT EXISTS ${recommendation.name}
          ON "${recommendation.tableName}"
          USING ${recommendation.type} (${columns})
        `;

        await this.prisma.$executeRawUnsafe(createIndexSQL);

        this.logger.info(`Created index: ${recommendation.name}`);
        this.metrics.increment('indexes_created', { table: recommendation.tableName });

      } catch (error) {
        this.logger.error(`Failed to create index ${recommendation.name}`, error);
      }
    }
  }

  /**
   * Drop unused indexes
   */
  async dropUnusedIndexes(indexes: string[]): Promise<void> {
    for (const indexName of indexes) {
      try {
        const dropIndexSQL = `DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`;
        await this.prisma.$executeRawUnsafe(dropIndexSQL);

        this.logger.info(`Dropped unused index: ${indexName}`);
        this.metrics.increment('indexes_dropped');

      } catch (error) {
        this.logger.error(`Failed to drop index ${indexName}`, error);
      }
    }
  }

  /**
   * Analyze table statistics
   */
  async analyzeTableStatistics(): Promise<any> {
    try {
      const tableStats = await this.prisma.$queryRaw`
        SELECT
          schemaname,
          tablename,
          attname as column_name,
          n_distinct as distinct_values,
          correlation as correlation_with_index
        FROM pg_stats
        WHERE schemaname = 'public'
        ORDER BY tablename, attname
      ` as any[];

      return tableStats;
    } catch (error) {
      this.logger.error('Failed to analyze table statistics', error);
      return [];
    }
  }

  /**
   * Update table statistics
   */
  async updateStatistics(): Promise<void> {
    try {
      const tables = ['User', 'Task', 'Project', 'Delegation', 'Comment'];

      for (const table of tables) {
        await this.prisma.$executeRawUnsafe(`ANALYZE "${table}"`);
        this.logger.debug(`Updated statistics for table: ${table}`);
      }

      this.logger.info('Table statistics updated successfully');

    } catch (error) {
      this.logger.error('Failed to update table statistics', error);
    }
  }

  /**
   * Optimize database configuration
   */
  async optimizeConfiguration(): Promise<any> {
    try {
      const currentConfig = await this.prisma.$queryRaw`
        SELECT name, setting, unit, short_desc
        FROM pg_settings
        WHERE name IN (
          'shared_buffers',
          'effective_cache_size',
          'work_mem',
          'maintenance_work_mem',
          'checkpoint_completion_target',
          'wal_buffers',
          'default_statistics_target',
          'random_page_cost',
          'effective_io_concurrency',
          'max_parallel_workers_per_gather'
        )
      ` as any[];

      const recommendations = this.generateConfigRecommendations(currentConfig);

      return {
        currentConfig,
        recommendations
      };

    } catch (error) {
      this.logger.error('Failed to optimize configuration', error);
      return null;
    }
  }

  /**
   * Generate configuration recommendations
   */
  private generateConfigRecommendations(config: any[]): string[] {
    const recommendations: string[] = [];
    const configMap = new Map(config.map(c => [c.name, parseFloat(c.setting)]));

    // Shared buffers recommendation
    const sharedBuffers = configMap.get('shared_buffers') || 0;
    if (sharedBuffers < 1024) { // Less than 1GB
      recommendations.push('Consider increasing shared_buffers to 25% of RAM');
    }

    // Work memory recommendation
    const workMem = configMap.get('work_mem') || 0;
    if (workMem < 4096) { // Less than 4MB
      recommendations.push('Consider increasing work_mem for complex queries');
    }

    // Checkpoint completion target
    const checkpointTarget = configMap.get('checkpoint_completion_target') || 0;
    if (checkpointTarget < 0.7) {
      recommendations.push('Consider increasing checkpoint_completion_target to 0.9 for better write performance');
    }

    return recommendations;
  }

  /**
   * Monitor query performance in real-time
   */
  async monitorQueries(duration: number = 60000): Promise<QueryOptimization[]> {
    const startTime = Date.now();
    const optimizations: QueryOptimization[] = [];

    try {
      // Enable query statistics if not already enabled
      await this.prisma.$executeRawUnsafe(`
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
      `);

      // Reset statistics for clean monitoring
      await this.prisma.$executeRawUnsafe(`
        SELECT pg_stat_statements_reset();
      `);

      // Monitor for specified duration
      const monitorInterval = setInterval(async () => {
        const queries = await this.prisma.$queryRaw`
          SELECT
            query,
            calls,
            total_exec_time,
            mean_exec_time,
            rows
          FROM pg_stat_statements
          WHERE mean_exec_time > 50
          ORDER BY mean_exec_time DESC
          LIMIT 10
        ` as any[];

        for (const query of queries) {
          const optimization: QueryOptimization = {
            queryName: query.query.substring(0, 100),
            estimatedCost: parseFloat(query.total_exec_time),
            executionTime: parseFloat(query.mean_exec_time),
            indexes: [],
            suggestions: await this.generateQueryRecommendations(query.query)
          };

          optimizations.push(optimization);
        }
      }, duration / 10);

      setTimeout(() => {
        clearInterval(monitorInterval);
      }, duration);

    } catch (error) {
      this.logger.error('Query monitoring failed', error);
    }

    return optimizations;
  }

  /**
   * Get database performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    try {
      const metrics = await this.prisma.$queryRaw`
        SELECT
          datname as database_name,
          numbackends as active_connections,
          xact_commit as transactions_committed,
          xact_rollback as transactions_rolled_back,
          blks_read as blocks_read,
          blks_hit as blocks_hit,
          tup_returned as tuples_returned,
          tup_fetched as tuples_fetched,
          tup_inserted as tuples_inserted,
          tup_updated as tuples_updated,
          tup_deleted as tuples_deleted
        FROM pg_stat_database
        WHERE datname = current_database()
      ` as any[];

      const [dbMetrics] = metrics;

      if (dbMetrics) {
        const cacheHitRatio = dbMetrics.blocks_hit / (dbMetrics.blocks_read + dbMetrics.blocks_hit) * 100;

        return {
          ...dbMetrics,
          cacheHitRatio: Math.round(cacheHitRatio * 100) / 100,
          databaseSize: await this.getDatabaseSize()
        };
      }

      return null;

    } catch (error) {
      this.logger.error('Failed to get performance metrics', error);
      return null;
    }
  }

  /**
   * Get database size
   */
  private async getDatabaseSize(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      ` as any[];

      return result[0]?.size || 'Unknown';

    } catch (error) {
      return 'Unknown';
    }
  }
}

export default DatabaseOptimizer;