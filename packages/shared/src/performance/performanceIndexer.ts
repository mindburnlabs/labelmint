// Database Performance Indexing and Optimization
import { PrismaClient } from '@prisma/client';

interface PerformanceIndex {
  name: string;
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  unique?: boolean;
  where?: string;
  concurrent?: boolean;
  description: string;
  estimatedImprovement: string;
}

class PerformanceIndexer {
  private prisma: PrismaClient;
  private indexes: PerformanceIndex[] = [];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.initializeIndexes();
  }

  private initializeIndexes(): void {
    this.indexes = [
      // Task performance indexes
      {
        name: 'idx_tasks_status_consensus_priority',
        table: 'tasks',
        columns: ['completion_status', 'consensus_count', 'priority'],
        type: 'btree',
        description: 'Optimize task assignment queries',
        estimatedImprovement: '70-80% faster task assignment'
      },
      {
        name: 'idx_tasks_project_created',
        table: 'tasks',
        columns: ['project_id', 'created_at'],
        type: 'btree',
        description: 'Optimize project task listings',
        estimatedImprovement: '60-70% faster project queries'
      },
      {
        name: 'idx_tasks_available_workers',
        table: 'tasks',
        columns: ['completion_status', 'reserved_at'],
        type: 'btree',
        where: 'completion_status = \'pending\' AND reserved_at IS NULL',
        description: 'Optimize available task queries',
        estimatedImprovement: '50-60% faster available task lookup'
      },

      // Response and assignment indexes
      {
        name: 'idx_responses_task_user',
        table: 'responses',
        columns: ['task_id', 'user_id'],
        type: 'btree',
        unique: true,
        description: 'Optimize response lookups and prevent duplicates',
        estimatedImprovement: '80-90% faster response queries'
      },
      {
        name: 'idx_task_assignments_worker_time',
        table: 'task_assignments',
        columns: ['worker_id', 'assigned_at'],
        type: 'btree',
        description: 'Optimize worker task history',
        estimatedImprovement: '60-70% faster worker stats'
      },
      {
        name: 'idx_task_seen_worker_task',
        table: 'task_seen',
        columns: ['worker_id', 'task_id'],
        type: 'btree',
        unique: true,
        description: 'Optimize task visibility tracking',
        estimatedImprovement: '90% faster seen task checks'
      },

      // User and wallet indexes
      {
        name: 'idx_users_telegram',
        table: 'users',
        columns: ['telegram_id'],
        type: 'btree',
        unique: true,
        description: 'Optimize user lookup by Telegram ID',
        estimatedImprovement: '95% faster Telegram authentication'
      },
      {
        name: 'idx_wallets_user_balance',
        table: 'wallets',
        columns: ['user_id', 'balance'],
        type: 'btree',
        description: 'Optimize wallet balance queries',
        estimatedImprovement: '50-60% faster balance lookups'
      },

      // Transaction indexes
      {
        name: 'idx_transactions_user_status_time',
        table: 'transactions',
        columns: ['user_id', 'status', 'created_at'],
        type: 'btree',
        description: 'Optimize transaction history queries',
        estimatedImprovement: '70-80% faster transaction history'
      },
      {
        name: 'idx_transactions_blockchain_status',
        table: 'transactions',
        columns: ['blockchain_tx_id', 'status'],
        type: 'btree',
        description: 'Optimize blockchain transaction lookups',
        estimatedImprovement: '85% faster blockchain status checks'
      },

      // Project indexes
      {
        name: 'idx_projects_client_status',
        table: 'projects',
        columns: ['client_id', 'status'],
        type: 'btree',
        description: 'Optimize client project listings',
        estimatedImprovement: '60-70% faster client project queries'
      },
      {
        name: 'idx_projects_created_status',
        table: 'projects',
        columns: ['created_at', 'status'],
        type: 'btree',
        description: 'Optimize project discovery',
        estimatedImprovement: '40-50% faster project browsing'
      },

      // Full-text search indexes
      {
        name: 'idx_projects_search',
        table: 'projects',
        columns: ['name', 'description'],
        type: 'gin',
        description: 'Optimize project full-text search',
        estimatedImprovement: '90% faster project search'
      },
      {
        name: 'idx_tasks_search',
        table: 'tasks',
        columns: ['title', 'description'],
        type: 'gin',
        description: 'Optimize task full-text search',
        estimatedImprovement: '85% faster task search'
      },

      // API usage indexes
      {
        name: 'idx_api_usage_key_time',
        table: 'api_usage',
        columns: ['api_key_id', 'timestamp'],
        type: 'btree',
        description: 'Optimize API usage analytics',
        estimatedImprovement: '75% faster API analytics queries'
      },
      {
        name: 'idx_api_usage_endpoint_time',
        table: 'api_usage',
        columns: ['endpoint', 'timestamp'],
        type: 'btree',
        description: 'Optimize endpoint usage tracking',
        estimatedImprovement: '70% faster endpoint analytics'
      }
    ];
  }

  async createAllIndexes(): Promise<void> {
    console.log('🔧 Creating performance indexes...');

    for (const index of this.indexes) {
      try {
        await this.createIndex(index);
        console.log(`✅ Created index: ${index.name}`);
      } catch (error) {
        console.error(`❌ Failed to create index ${index.name}:`, error.message);
      }
    }

    console.log('🎯 Performance index creation completed');
  }

  async createIndex(index: PerformanceIndex): Promise<void> {
    const method = index.concurrent ? 'CREATE INDEX CONCURRENTLY' : 'CREATE INDEX';
    const unique = index.unique ? 'UNIQUE ' : '';
    const where = index.where ? ` WHERE ${index.where}` : '';

    let columnsDef: string;
    if (index.type === 'gin') {
      const coalesceCols = index.columns.map(col => `COALESCE(${col}, '')`).join(" || ' ' || ");
      columnsDef = `USING gin (to_tsvector('english', ${coalesceCols}))`;
    } else {
      columnsDef = `(${index.columns.join(', ')})`;
    }

    const sql = `
      ${method} ${unique} ${index.name}
      ON ${index.table}
      ${columnsDef}
      ${where}
    `;

    await this.prisma.$executeRawUnsafe(sql);
  }

  async analyzeTableStatistics(): Promise<void> {
    console.log('📊 Analyzing table statistics...');

    const tables = [
      'users', 'tasks', 'responses', 'projects', 'wallets',
      'transactions', 'task_assignments', 'task_seen', 'api_usage'
    ];

    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(`ANALYZE ${table}`);
        console.log(`✅ Analyzed table: ${table}`);
      } catch (error) {
        console.error(`❌ Failed to analyze table ${table}:`, error.message);
      }
    }
  }

  async dropAllIndexes(): Promise<void> {
    console.log('🗑️  Dropping performance indexes...');

    for (const index of this.indexes) {
      try {
        await this.prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${index.name}`);
        console.log(`✅ Dropped index: ${index.name}`);
      } catch (error) {
        console.error(`❌ Failed to drop index ${index.name}:`, error.message);
      }
    }
  }

  async verifyIndexes(): Promise<Array<{ name: string; exists: boolean; size?: string }>> {
    console.log('🔍 Verifying index existence...');

    const results = [];

    for (const index of this.indexes) {
      try {
        const result = await this.prisma.$queryRawUnsafe(`
          SELECT
            indexname as name,
            pg_size_pretty(pg_relation_size(indexrelid)) as size
          FROM pg_indexes
          WHERE indexname = $1
          UNION
          SELECT
            indexname as name,
            pg_size_pretty(pg_relation_size(indexrelid)) as size
          FROM pg_stat_user_indexes
          WHERE indexrelname = $1
        `, index.name);

        results.push({
          name: index.name,
          exists: Array.isArray(result) && result.length > 0,
          size: Array.isArray(result) && result.length > 0 ? result[0].size : undefined
        });

        if (Array.isArray(result) && result.length > 0) {
          console.log(`✅ Index ${index.name} exists (${result[0].size})`);
        } else {
          console.log(`❌ Index ${index.name} not found`);
        }
      } catch (error) {
        results.push({
          name: index.name,
          exists: false
        });
        console.error(`❌ Error checking index ${index.name}:`, error.message);
      }
    }

    return results;
  }

  async getIndexUsageStats(): Promise<Array<{ indexName: string; usageCount: number; lastUsed?: string }>> {
    console.log('📈 Getting index usage statistics...');

    try {
      const result = await this.prisma.$queryRawUnsafe(`
        SELECT
          schemaname || '.' || tablename || '.' || indexname as index_name,
          idx_scan as usage_count,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `);

      return (result as any[]).map(row => ({
        indexName: row.index_name,
        usageCount: parseInt(row.usage_count),
        tuplesRead: parseInt(row.tuples_read),
        tuplesFetched: parseInt(row.tuples_fetched)
      }));
    } catch (error) {
      console.error('❌ Failed to get index usage stats:', error.message);
      return [];
    }
  }

  async getSlowQueries(limit: number = 10): Promise<Array<{ query: string; calls: number; totalTime: string; avgTime: string }>> {
    console.log('🐌 Getting slow query statistics...');

    try {
      const result = await this.prisma.$queryRawUnsafe(`
        SELECT
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements
        WHERE mean_time > 100
        ORDER BY mean_time DESC
        LIMIT $1
      `, limit);

      return (result as any[]).map(row => ({
        query: row.query.substring(0, 100) + (row.query.length > 100 ? '...' : ''),
        calls: parseInt(row.calls),
        totalTime: parseFloat(row.total_time).toFixed(2),
        avgTime: parseFloat(row.mean_time).toFixed(2),
        rows: parseInt(row.rows)
      }));
    } catch (error) {
      console.error('❌ Failed to get slow queries (pg_stat_statements may not be enabled):', error.message);
      return [];
    }
  }

  getIndexes(): PerformanceIndex[] {
    return this.indexes;
  }

  async generateOptimizationReport(): Promise<string> {
    console.log('📋 Generating optimization report...');

    const indexVerification = await this.verifyIndexes();
    const indexUsage = await this.getIndexUsageStats();
    const slowQueries = await this.getSlowQueries();

    const existingIndexes = indexVerification.filter(idx => idx.exists).length;
    const totalIndexes = indexVerification.length;
    const unusedIndexes = indexUsage.filter(idx => idx.usageCount === 0).length;

    let report = `# LabelMint Performance Optimization Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Index Status
    report += `## Index Status\n`;
    report += `- Total Indexes: ${totalIndexes}\n`;
    report += `- Existing Indexes: ${existingIndexes}\n`;
    report += `- Missing Indexes: ${totalIndexes - existingIndexes}\n`;
    report += `- Unused Indexes: ${unusedIndexes}\n\n`;

    // Index Details
    report += `## Index Details\n\n`;
    for (const verification of indexVerification) {
      const index = this.indexes.find(idx => idx.name === verification.name);
      if (index) {
        report += `### ${index.name}\n`;
        report += `- Table: ${index.table}\n`;
        report += `- Columns: ${index.columns.join(', ')}\n`;
        report += `- Type: ${index.type}\n`;
        report += `- Status: ${verification.exists ? '✅ Created' : '❌ Missing'}\n`;
        if (verification.size) {
          report += `- Size: ${verification.size}\n`;
        }
        report += `- Description: ${index.description}\n`;
        report += `- Expected Improvement: ${index.estimatedImprovement}\n\n`;
      }
    }

    // Slow Queries
    if (slowQueries.length > 0) {
      report += `## Slow Queries\n\n`;
      report += `| Query | Calls | Total Time | Avg Time |\n`;
      report += `|-------|-------|------------|----------|\n`;
      for (const query of slowQueries) {
        report += `| \`${query.query}\` | ${query.calls} | ${query.totalTime}ms | ${query.avgTime}ms |\n`;
      }
      report += `\n`;
    }

    // Recommendations
    report += `## Recommendations\n\n`;

    if (totalIndexes - existingIndexes > 0) {
      report += `### Missing Indexes\n`;
      report += `Create the following missing indexes for optimal performance:\n\n`;
      for (const verification of indexVerification.filter(idx => !idx.exists)) {
        const index = this.indexes.find(idx => idx.name === verification.name);
        if (index) {
          report += `- \`${index.name}\` on \`${index.table}\` (${index.columns.join(', ')})\n`;
          report += `  - ${index.description}\n`;
          report += `  - Expected improvement: ${index.estimatedImprovement}\n\n`;
        }
      }
    }

    if (unusedIndexes > 0) {
      report += `### Unused Indexes\n`;
      report += `Consider dropping ${unusedIndexes} unused indexes to save storage and improve write performance.\n\n`;
    }

    if (slowQueries.length > 0) {
      report += `### Query Optimization\n`;
      report += `Found ${slowQueries.length} slow queries that should be optimized:\n\n`;
      for (const query of slowQueries.slice(0, 3)) {
        report += `- Query avg time: ${query.avgTime}ms (calls: ${query.calls})\n`;
      }
      report += `\n`;
    }

    return report;
  }
}

export { PerformanceIndexer, type PerformanceIndex };