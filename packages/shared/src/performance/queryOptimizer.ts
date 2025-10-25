// Advanced Query Optimizer for LabelMint
import { PrismaClient } from '@prisma/client';

interface QueryPattern {
  name: string;
  pattern: string;
  optimizedQuery: string;
  parameters: string[];
  indexes: string[];
  estimatedImprovement: string;
  description: string;
}

interface QueryAnalysis {
  originalQuery: string;
  optimizedQuery: string;
  issues: string[];
  recommendations: string[];
  estimatedImprovement: string;
}

interface QueryStats {
  query: string;
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  timestamp: Date;
}

class QueryOptimizer {
  private prisma: PrismaClient;
  private queryStats: Map<string, QueryStats> = new Map();
  private patterns: QueryPattern[] = [];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.initializePatterns();
  }

  private initializePatterns(): void {
    this.patterns = [
      {
        name: 'GET_AVAILABLE_TASKS',
        pattern: 'SELECT.*FROM tasks WHERE completion_status = .* ORDER BY .* LIMIT',
        optimizedQuery: `
          SELECT t.*, r.response_count
          FROM tasks t
          LEFT JOIN (
            SELECT task_id, COUNT(*) as response_count
            FROM responses
            GROUP BY task_id
          ) r ON t.id = r.task_id
          WHERE t.completion_status = $1
          AND NOT EXISTS (
            SELECT 1 FROM task_seen ts
            WHERE ts.task_id = t.id AND ts.worker_id = $2
          )
          AND (t.reserved_at IS NULL OR t.reserved_at < NOW() - INTERVAL '5 minutes')
          ORDER BY t.priority DESC, t.created_at ASC
          LIMIT $3
          FOR UPDATE SKIP LOCKED
        `,
        parameters: ['status', 'worker_id', 'limit'],
        indexes: [
          'idx_tasks_status_consensus_priority',
          'idx_task_seen_worker_task',
          'idx_responses_task_id'
        ],
        estimatedImprovement: '70-80% faster task assignment',
        description: 'Optimized available tasks query with proper indexing and locking'
      },
      {
        name: 'GET_USER_WITH_STATS',
        pattern: 'SELECT.*FROM users WHERE id = .*',
        optimizedQuery: `
          SELECT
            u.*,
            w.balance,
            w.total_earned,
            COALESCE(stats.tasks_completed, 0) as tasks_completed,
            COALESCE(stats.accuracy_rate, 0) as accuracy_rate,
            COALESCE(stats.recent_tasks, 0) as recent_tasks
          FROM users u
          LEFT JOIN wallets w ON w.user_id = u.id
          LEFT JOIN (
            SELECT
              worker_id,
              COUNT(*) as tasks_completed,
              AVG(CASE WHEN is_correct THEN 1 ELSE 0 END)::DECIMAL(5,2) as accuracy_rate,
              COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_tasks
            FROM task_assignments ta
            WHERE ta.completed_at IS NOT NULL
            GROUP BY worker_id
          ) stats ON stats.worker_id = u.id
          WHERE u.id = $1
        `,
        parameters: ['user_id'],
        indexes: [
          'idx_wallets_user_id',
          'idx_task_assignments_worker_completed'
        ],
        estimatedImprovement: '60-70% faster profile loading',
        description: 'Optimized user profile with pre-calculated statistics'
      },
      {
        name: 'GET_PROJECT_ANALYTICS',
        pattern: 'SELECT.*FROM projects WHERE id = .*',
        optimizedQuery: `
          SELECT
            p.*,
            COUNT(DISTINCT t.id) as total_tasks,
            COUNT(DISTINCT CASE WHEN t.completion_status = 'completed' THEN t.id END) as completed_tasks,
            AVG(t.base_price) as avg_task_price,
            SUM(CASE WHEN t.completion_status = 'completed' THEN t.base_price ELSE 0 END) as total_spent,
            COUNT(DISTINCT ta.worker_id) as unique_workers,
            COUNT(DISTINCT CASE WHEN t.created_at >= NOW() - INTERVAL '24 hours' THEN t.id END) as tasks_24h,
            AVG(CASE WHEN t.completion_status = 'completed' THEN ta.completed_at - ta.assigned_at END) as avg_completion_time
          FROM projects p
          LEFT JOIN tasks t ON t.project_id = p.id
          LEFT JOIN task_assignments ta ON ta.task_id = t.id AND ta.completed_at IS NOT NULL
          WHERE p.id = $1
          GROUP BY p.id
        `,
        parameters: ['project_id'],
        indexes: [
          'idx_tasks_project_status',
          'idx_task_assignments_task_id'
        ],
        estimatedImprovement: '50-60% faster analytics queries',
        description: 'Optimized project analytics with aggregated metrics'
      },
      {
        name: 'GET_WORKER_LEADERBOARD',
        pattern: 'SELECT.*FROM users.*JOIN.*ORDER BY.*LIMIT',
        optimizedQuery: `
          SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.username,
            COALESCE(stats.tasks_completed, 0) as tasks_completed,
            COALESCE(stats.accuracy_rate, 0) as accuracy_rate,
            COALESCE(stats.total_earned, 0) as total_earned,
            COALESCE(stats.streak_days, 0) as streak_days
          FROM users u
          INNER JOIN (
            SELECT
              worker_id,
              COUNT(*) as tasks_completed,
              AVG(CASE WHEN is_correct THEN 1 ELSE 0 END)::DECIMAL(5,2) as accuracy_rate,
              SUM(points_earned) as total_earned,
              COUNT(DISTINCT DATE(completed_at)) as streak_days
            FROM task_assignments ta
            WHERE ta.completed_at >= NOW() - INTERVAL '30 days'
            AND ta.completed_at IS NOT NULL
            GROUP BY worker_id
            HAVING COUNT(*) >= 10
          ) stats ON stats.worker_id = u.id
          ORDER BY stats.tasks_completed DESC, stats.accuracy_rate DESC
          LIMIT $1
        `,
        parameters: ['limit'],
        indexes: [
          'idx_task_assignments_worker_completed_points',
          'idx_users_id'
        ],
        estimatedImprovement: '65-75% faster leaderboard queries',
        description: 'Optimized leaderboard with pre-filtered active workers'
      },
      {
        name: 'SEARCH_PROJECTS',
        pattern: 'SELECT.*FROM projects WHERE.*LIKE',
        optimizedQuery: `
          SELECT
            p.*,
            ts_rank(search_vector, plainto_tsquery('english', $2)) as relevance_score,
            COUNT(DISTINCT t.id) as task_count
          FROM projects p
          LEFT JOIN tasks t ON t.project_id = p.id
          WHERE
            p.search_vector @@ plainto_tsquery('english', $2)
            AND p.status = 'active'
          GROUP BY p.id, p.search_vector
          ORDER BY relevance_score DESC, p.created_at DESC
          LIMIT $1
        `,
        parameters: ['limit', 'search_query'],
        indexes: [
          'idx_projects_search',
          'idx_projects_created_status'
        ],
        estimatedImprovement: '85-95% faster search queries',
        description: 'Full-text search with proper ranking and indexing'
      }
    ];
  }

  async optimizeQuery(originalQuery: string, parameters: any[] = []): Promise<QueryAnalysis> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let optimizedQuery = originalQuery;

    // Check for common performance issues
    const queryLower = originalQuery.toLowerCase();

    // Issue 1: Missing WHERE clause on large tables
    if (queryLower.includes('from tasks') && !queryLower.includes('where')) {
      issues.push('Missing WHERE clause on tasks table - may scan all records');
      recommendations.push('Add appropriate WHERE clause to limit result set');
    }

    // Issue 2: SELECT * instead of specific columns
    if (queryLower.includes('select *')) {
      issues.push('Using SELECT * instead of specific columns');
      recommendations.push('Select only required columns to reduce data transfer');
    }

    // Issue 3: Missing LIMIT clause
    if (queryLower.includes('from') && !queryLower.includes('limit') && !queryLower.includes('count(')) {
      issues.push('Missing LIMIT clause - potential for large result sets');
      recommendations.push('Add appropriate LIMIT clause');
    }

    // Issue 4: ORDER BY without index
    if (queryLower.includes('order by') && !this.hasOrderByIndex(originalQuery)) {
      issues.push('ORDER BY without proper index may cause performance issues');
      recommendations.push('Create index on ORDER BY columns');
    }

    // Issue 5: N+1 query pattern
    if (this.detectNPlusOnePattern(originalQuery)) {
      issues.push('Potential N+1 query pattern detected');
      recommendations.push('Use JOIN or batch loading to reduce query count');
    }

    // Apply known optimizations
    for (const pattern of this.patterns) {
      if (this.matchesPattern(originalQuery, pattern.pattern)) {
        optimizedQuery = pattern.optimizedQuery;
        recommendations.push(`Applied optimization: ${pattern.description}`);
        recommendations.push(`Expected improvement: ${pattern.estimatedImprovement}`);
        break;
      }
    }

    // Generic optimizations if no pattern matched
    if (optimizedQuery === originalQuery) {
      optimizedQuery = this.applyGenericOptimizations(originalQuery);
    }

    return {
      originalQuery,
      optimizedQuery,
      issues,
      recommendations,
      estimatedImprovement: this.estimateImprovement(originalQuery, optimizedQuery)
    };
  }

  private hasOrderByIndex(query: string): boolean {
    // Simplified check - in practice would query schema
    const orderByMatch = query.match(/order by\s+([^,\s]+)/i);
    if (orderByMatch) {
      const column = orderByMatch[1].replace(/["`']/g, '');
      const indexedColumns = ['id', 'created_at', 'priority', 'status', 'completion_status'];
      return indexedColumns.includes(column);
    }
    return false;
  }

  private detectNPlusOnePattern(query: string): boolean {
    // Simple heuristic for N+1 detection
    const selectCount = (query.match(/select/gi) || []).length;
    const joinCount = (query.match(/join/gi) || []).length;

    return selectCount > 1 && joinCount === 0;
  }

  private matchesPattern(query: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(query);
    } catch (error) {
      return false;
    }
  }

  private applyGenericOptimizations(query: string): string {
    let optimized = query;

    // Add LIMIT if missing and not a COUNT query
    if (!optimized.toLowerCase().includes('limit') && !optimized.toLowerCase().includes('count(')) {
      optimized += ' LIMIT 100';
    }

    // Replace SELECT * with specific columns for known tables
    if (optimized.includes('SELECT *') && optimized.includes('FROM tasks')) {
      optimized = optimized.replace(
        'SELECT *',
        'SELECT id, title, description, type, base_price, priority, created_at, completion_status'
      );
    }

    if (optimized.includes('SELECT *') && optimized.includes('FROM users')) {
      optimized = optimized.replace(
        'SELECT *',
        'SELECT id, first_name, last_name, username, email, telegram_id, created_at'
      );
    }

    return optimized;
  }

  private estimateImprovement(original: string, optimized: string): string {
    if (original === optimized) {
      return 'No optimization applied';
    }

    // Simple heuristic based on changes made
    let improvement = 0;

    if (original.includes('SELECT *') && !optimized.includes('SELECT *')) {
      improvement += 20;
    }

    if (!original.includes('LIMIT') && optimized.includes('LIMIT')) {
      improvement += 30;
    }

    if (original.toLowerCase().includes('order by') && optimized.includes('JOIN')) {
      improvement += 40;
    }

    if (optimized.includes('FOR UPDATE SKIP LOCKED')) {
      improvement += 25;
    }

    if (optimized.includes('search_vector')) {
      improvement += 50;
    }

    if (improvement === 0) {
      return 'Minor improvements expected';
    } else if (improvement < 30) {
      return `${improvement}% improvement expected`;
    } else {
      return `${improvement}%+ improvement expected`;
    }
  }

  async executeOptimizedQuery(optimizedQuery: string, parameters: any[] = []): Promise<any> {
    const startTime = Date.now();

    try {
      const result = await this.prisma.$queryRawUnsafe(optimizedQuery, ...parameters);
      const duration = Date.now() - startTime;

      this.recordQueryStats(optimizedQuery, duration, true);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryStats(optimizedQuery, duration, false);
      throw error;
    }
  }

  private recordQueryStats(query: string, duration: number, success: boolean): void {
    const queryHash = this.hashQuery(query);
    const existing = this.queryStats.get(queryHash);

    if (existing) {
      existing.count++;
      existing.totalTime += duration;
      existing.avgTime = existing.totalTime / existing.count;
      existing.minTime = Math.min(existing.minTime, duration);
      existing.maxTime = Math.max(existing.maxTime, duration);
    } else {
      this.queryStats.set(queryHash, {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        count: 1,
        totalTime: duration,
        avgTime: duration,
        minTime: duration,
        maxTime: duration,
        timestamp: new Date()
      });
    }

    // Alert on slow queries
    if (duration > 1000) {
      console.warn(`🐌 Slow query detected (${duration}ms):`, query.substring(0, 100));
    }
  }

  private hashQuery(query: string): string {
    // Simple hash function for query identification
    let hash = 0;
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();

    for (let i = 0; i < normalizedQuery.length; i++) {
      const char = normalizedQuery.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  // Batch operations
  async batchQuery<T>(
    queries: Array<{ query: string; parameters?: any[] }>
  ): Promise<T[]> {
    const promises = queries.map(({ query, parameters = [] }) =>
      this.executeOptimizedQuery(query, parameters)
    );

    return Promise.all(promises);
  }

  async executePaginatedQuery<T>(
    baseQuery: string,
    parameters: any[] = [],
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: T[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;

    // Get paginated data
    const dataQuery = `${baseQuery} LIMIT ${limit} OFFSET ${offset}`;
    const data = await this.executeOptimizedQuery(dataQuery, parameters);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as subquery`;
    const countResult = await this.executeOptimizedQuery(countQuery, parameters);
    const total = parseInt(countResult[0]?.total || '0');

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Analytics and monitoring
  getSlowQueries(thresholdMs: number = 500): Array<{ query: string; stats: QueryStats }> {
    return Array.from(this.queryStats.entries())
      .filter(([, stats]) => stats.avgTime > thresholdMs)
      .map(([hash, stats]) => ({ query: stats.query, stats }));
  }

  getMostFrequentQueries(limit: number = 10): Array<{ query: string; stats: QueryStats }> {
    return Array.from(this.queryStats.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, limit)
      .map(([hash, stats]) => ({ query: stats.query, stats }));
  }

  getQueryStatistics(): Array<{ query: string; stats: QueryStats }> {
    return Array.from(this.queryStats.entries())
      .map(([hash, stats]) => ({ query: stats.query, stats }));
  }

  async analyzeTablePerformance(tableName: string): Promise<any> {
    try {
      const result = await this.prisma.$queryRawUnsafe(`
        SELECT
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_tup_ins,
          n_tup_upd,
          n_tup_del,
          n_live_tup,
          n_dead_tup
        FROM pg_stat_user_tables
        WHERE tablename = $1
      `, tableName);

      return result[0] || null;
    } catch (error) {
      console.error(`Failed to analyze table ${tableName}:`, error.message);
      return null;
    }
  }

  getOptimizationPatterns(): QueryPattern[] {
    return this.patterns;
  }

  async generateOptimizationReport(): Promise<string> {
    const slowQueries = this.getSlowQueries();
    const frequentQueries = this.getMostFrequentQueries();
    const queryStats = this.getQueryStatistics();

    let report = `# Query Optimization Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary
    report += `## Query Performance Summary\n`;
    report += `- Total unique queries: ${queryStats.length}\n`;
    report += `- Slow queries (>500ms): ${slowQueries.length}\n`;
    report += `- Most executed queries: ${frequentQueries.length}\n\n`;

    // Slow queries
    if (slowQueries.length > 0) {
      report += `## Slow Queries Requiring Optimization\n\n`;
      for (const { query, stats } of slowQueries) {
        report += `### Query: ${query}\n`;
        report += `- Executions: ${stats.count}\n`;
        report += `- Average time: ${stats.avgTime.toFixed(2)}ms\n`;
        report += `- Max time: ${stats.maxTime.toFixed(2)}ms\n`;
        report += `- Total time: ${stats.totalTime.toFixed(2)}ms\n\n`;
      }
    }

    // Frequent queries
    if (frequentQueries.length > 0) {
      report += `## Most Frequent Queries\n\n`;
      for (const { query, stats } of frequentQueries.slice(0, 5)) {
        report += `### Query: ${query}\n`;
        report += `- Executions: ${stats.count}\n`;
        report += `- Average time: ${stats.avgTime.toFixed(2)}ms\n`;
        report += `- Total time: ${stats.totalTime.toFixed(2)}ms\n\n`;
      }
    }

    // Recommendations
    report += `## Optimization Recommendations\n\n`;

    if (slowQueries.length > 0) {
      report += `### High Priority - Slow Queries\n`;
      report += `1. Analyze and optimize ${slowQueries.length} slow queries\n`;
      report += `2. Add appropriate indexes for WHERE and ORDER BY clauses\n`;
      report += `3. Consider query rewriting or denormalization\n\n`;
    }

    report += `### General Optimizations\n`;
    report += `1. Use prepared statements for repeated queries\n`;
    report += `2. Implement query result caching where appropriate\n`;
    report += `3. Add LIMIT clauses to prevent large result sets\n`;
    report += `4. Monitor and optimize frequently executed queries\n\n`;

    return report;
  }
}

export { QueryOptimizer, type QueryPattern, type QueryAnalysis, type QueryStats };