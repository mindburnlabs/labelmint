import { Pool } from 'pg';
import { BaseRepository, QueryOptions, PaginationResult } from './BaseRepository';
import { Task, TaskStatus, TaskType, ConsensusLevel, TaskResponse } from '../types/task';

// ============================================================================
// TASK TYPES EXTENSIONS
// ============================================================================

export interface TaskFindOptions extends QueryOptions {
  projectId?: string;
  assignedTo?: string;
  status?: TaskStatus | TaskStatus[];
  type?: TaskType | TaskType[];
  priority?: number;
  dueBefore?: Date;
  dueAfter?: Date;
  createdAfter?: Date;
  createdBefore?: Date;
  consensusLevel?: ConsensusLevel;
  includeResponses?: boolean;
  includeConsensus?: boolean;
}

export interface TaskCreateData {
  projectId: string;
  title: string;
  description?: string;
  type: TaskType;
  subType?: string;
  data: any;
  options?: string[];
  priority?: number;
  dueAt?: Date;
  aiPrelabel?: string;
  aiConfidence?: number;
  consensusTarget?: number;
  basePrice?: number;
  points?: number;
  multiplier?: number;
}

export interface TaskUpdateData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  assignedTo?: string;
  assignedAt?: Date;
  completedAt?: Date;
  dueAt?: Date;
  finalLabel?: string;
  qualityScore?: number;
  consensusLevel?: ConsensusLevel;
}

// ============================================================================
// TASK REPOSITORY
// ============================================================================

export class TaskRepository extends BaseRepository<Task> {
  constructor(db: Pool) {
    super(db, 'tasks');
    this.primaryKey = 'id';
  }

  // ============================================================================
  // FIND METHODS
  // ============================================================================

  /**
   * Find tasks for a project
   */
  async findByProject(
    projectId: string,
    options: TaskFindOptions = {}
  ): Promise<Task[]> {
    const { sql, params } = this.buildQuery({
      where: { project_id: projectId, ...options },
      joins: options.includeResponses ? [
        {
          table: 'task_responses',
          on: 'tasks.id = task_responses.task_id',
          type: 'LEFT',
          alias: 'responses'
        }
      ] : undefined
    });

    const result = await this.db.query(sql, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find tasks assigned to user
   */
  async findByAssignee(
    userId: string,
    options: TaskFindOptions = {}
  ): Promise<Task[]> {
    const { sql, params } = this.buildQuery({
      where: { assigned_to: userId, ...options },
      orderBy: { priority: 'DESC', created_at: 'ASC' }
    });

    const result = await this.db.query(sql, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find available tasks (not assigned)
   */
  async findAvailable(options: TaskFindOptions = {}): Promise<Task[]> {
    const { sql, params } = this.buildQuery({
      where: {
        status: 'PENDING',
        assigned_to: null,
        ...options
      },
      orderBy: { priority: 'DESC', created_at: 'ASC' }
    });

    const result = await this.db.query(sql, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find overdue tasks
   */
  async findOverdue(): Promise<Task[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE due_at < NOW()
      AND status NOT IN ('COMPLETED', 'CANCELLED', 'EXPIRED')
      ORDER BY due_at ASC
    `;

    const result = await this.db.query(sql);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find tasks needing consensus
   */
  async findTasksNeedingConsensus(): Promise<Task[]> {
    const sql = `
      SELECT t.*, COUNT(tr.id) as response_count
      FROM ${this.tableName} t
      LEFT JOIN task_responses tr ON t.id = tr.task_id
      WHERE t.status = 'COMPLETED'
      AND t.consensus_target > 1
      GROUP BY t.id
      HAVING COUNT(tr.id) < t.consensus_target
      OR (
        COUNT(tr.id) >= t.consensus_target
        AND t.consensus_level IN ('PENDING', 'CONFLICTING')
      )
    `;

    const result = await this.db.query(sql);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Search tasks by title or description
   */
  async search(query: string, limit: number = 50): Promise<Task[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE (
        ILIKE(title, $1) OR
        ILIKE(description, $1)
      )
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.db.query(sql, [`%${query}%`, limit]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // ============================================================================
  // CREATE METHODS
  // ============================================================================

  /**
   * Create new task
   */
  async create(taskData: TaskCreateData): Promise<Task> {
    const sql = `
      INSERT INTO ${this.tableName} (
        project_id, title, description, type, sub_type, data, options,
        status, priority, due_at, ai_prelabel, ai_confidence,
        consensus_target, base_price, points, multiplier,
        consensus_level, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'PENDING', NOW(), NOW())
      RETURNING *
    `;

    const values = [
      taskData.projectId,
      taskData.title,
      taskData.description || null,
      taskData.type,
      taskData.subType || null,
      JSON.stringify(taskData.data),
      taskData.options ? JSON.stringify(taskData.options) : null,
      'PENDING',
      taskData.priority || 1,
      taskData.dueAt || null,
      taskData.aiPrelabel || null,
      taskData.aiConfidence || null,
      taskData.consensusTarget || 1,
      taskData.basePrice || 0,
      taskData.points || 0,
      taskData.multiplier || 1
    ];

    const result = await this.db.query(sql, values);

    if (result.rows.length === 0) {
      throw new Error('Failed to create task');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create multiple tasks
   */
  async createBatch(taskDataArray: TaskCreateData[]): Promise<Task[]> {
    if (taskDataArray.length === 0) {
      return [];
    }

    const sql = `
      INSERT INTO ${this.tableName} (
        project_id, title, description, type, sub_type, data, options,
        status, priority, due_at, ai_prelabel, ai_confidence,
        consensus_target, base_price, points, multiplier,
        consensus_level, created_at, updated_at
      )
      VALUES ${taskDataArray.map((_, i) => {
        const offset = i * 18;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, 'PENDING', NOW(), NOW())`;
      }).join(', ')}
      RETURNING *
    `;

    const values = taskDataArray.flatMap(task => [
      task.projectId,
      task.title,
      task.description || null,
      task.type,
      task.subType || null,
      JSON.stringify(task.data),
      task.options ? JSON.stringify(task.options) : null,
      'PENDING',
      task.priority || 1,
      task.dueAt || null,
      task.aiPrelabel || null,
      task.aiConfidence || null,
      task.consensusTarget || 1,
      task.basePrice || 0,
      task.points || 0,
      task.multiplier || 1
    ]);

    const result = await this.db.query(sql, values);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // ============================================================================
  // ASSIGNMENT METHODS
  // ============================================================================

  /**
   * Assign task to user
   */
  async assignTo(taskId: string, userId: string): Promise<Task> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        assigned_to = $1,
        assigned_at = NOW(),
        status = 'ASSIGNED',
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.db.query(sql, [userId, taskId]);

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Unassign task
   */
  async unassign(taskId: string): Promise<Task> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        assigned_to = NULL,
        assigned_at = NULL,
        status = 'PENDING',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(sql, [taskId]);

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Auto-assign available tasks to user
   */
  async autoAssignToUser(
    userId: string,
    limit: number = 5,
    filters: {
      type?: TaskType;
      priority?: number;
      maxPriority?: number;
    } = {}
  ): Promise<Task[]> {
    let whereClause = `
      WHERE status = 'PENDING'
      AND assigned_to IS NULL
      AND due_at > NOW()
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.type) {
      whereClause += ` AND type = $${paramIndex++}`;
      params.push(filters.type);
    }

    if (filters.priority) {
      whereClause += ` AND priority >= $${paramIndex++}`;
      params.push(filters.priority);
    }

    if (filters.maxPriority) {
      whereClause += ` AND priority <= $${paramIndex++}`;
      params.push(filters.maxPriority);
    }

    params.push(userId);

    const sql = `
      WITH tasks_to_assign AS (
        SELECT id
        FROM ${this.tableName}
        ${whereClause}
        ORDER BY priority DESC, created_at ASC
        LIMIT $${paramIndex}
      )
      UPDATE ${this.tableName}
      SET
        assigned_to = $${paramIndex},
        assigned_at = NOW(),
        status = 'ASSIGNED',
        updated_at = NOW()
      FROM tasks_to_assign
      WHERE ${this.tableName}.id = tasks_to_assign.id
      RETURNING *
    `;

    const result = await this.db.query(sql, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // ============================================================================
  // COMPLETION METHODS
  // ============================================================================

  /**
   * Mark task as completed
   */
  async complete(taskId: string, finalLabel?: string): Promise<Task> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        status = 'COMPLETED',
        completed_at = NOW(),
        final_label = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.db.query(sql, [finalLabel || null, taskId]);

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Skip task
   */
  async skip(taskId: string, reason?: string): Promise<Task> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        status = 'SKIPPED',
        assigned_to = NULL,
        assigned_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(sql, [taskId]);

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Expire task
   */
  async expire(taskId: string): Promise<Task> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        status = 'EXPIRED',
        assigned_to = NULL,
        assigned_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(sql, [taskId]);

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  // ============================================================================
  // CONSENSUS METHODS
  // ============================================================================

  /**
   * Update task consensus
   */
  async updateConsensus(
    taskId: string,
    consensusLevel: ConsensusLevel,
    finalLabel?: string,
    confidenceScore?: number
  ): Promise<Task> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        consensus_level = $1,
        final_label = $2,
        quality_score = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const result = await this.db.query(sql, [
      consensusLevel,
      finalLabel || null,
      confidenceScore || null,
      taskId
    ]);

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Get task responses for consensus
   */
  async getTaskResponses(taskId: string): Promise<TaskResponse[]> {
    const sql = `
      SELECT tr.*, u.username, u.first_name, u.last_name
      FROM task_responses tr
      JOIN users u ON tr.user_id = u.id
      WHERE tr.task_id = $1
      ORDER BY tr.created_at ASC
    `;

    const result = await this.db.query(sql, [taskId]);

    return result.rows.map(row => ({
      id: row.id.toString(),
      taskId: row.task_id.toString(),
      userId: row.user_id.toString(),
      response: row.response,
      confidence: row.confidence,
      timeSpent: row.time_spent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: {
        username: row.username,
        firstName: row.first_name,
        lastName: row.last_name
      }
    }));
  }

  // ============================================================================
  // STATISTICS METHODS
  // ============================================================================

  /**
   * Get task statistics for project
   */
  async getProjectStats(projectId: string): Promise<{
    total: number;
    pending: number;
    assigned: number;
    inProgress: number;
    completed: number;
    skipped: number;
    expired: number;
    consensusPending: number;
    averageTime: number;
  }> {
    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'ASSIGNED' THEN 1 END) as assigned,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'SKIPPED' THEN 1 END) as skipped,
        COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired,
        COUNT(CASE WHEN consensus_level = 'PENDING' THEN 1 END) as consensus_pending,
        COALESCE(AVG(time_spent), 0) as average_time
      FROM ${this.tableName}
      LEFT JOIN task_responses ON ${this.tableName}.id = task_responses.task_id
      WHERE project_id = $1
    `;

    const result = await this.db.query(sql, [projectId]);
    const row = result.rows[0];

    return {
      total: parseInt(row.total),
      pending: parseInt(row.pending),
      assigned: parseInt(row.assigned),
      inProgress: parseInt(row.in_progress),
      completed: parseInt(row.completed),
      skipped: parseInt(row.skipped),
      expired: parseInt(row.expired),
      consensusPending: parseInt(row.consensus_pending),
      averageTime: Math.round(parseFloat(row.average_time || 0))
    };
  }

  /**
   * Get user task statistics
   */
  async getUserStats(userId: string, days: number = 30): Promise<{
    completed: number;
    skipped: number;
    accuracy: number;
    averageTime: number;
    earnings: number;
    rank: number;
  }> {
    const sql = `
      WITH user_stats AS (
        SELECT
          COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END) as completed,
          COUNT(CASE WHEN t.status = 'SKIPPED' THEN 1 END) as skipped,
          COALESCE(AVG(tr.time_spent), 0) as average_time,
          COALESCE(AVG(t.quality_score), 0) as accuracy,
          COALESCE(SUM(t.points * t.multiplier), 0) as earnings
        FROM ${this.tableName} t
        LEFT JOIN task_responses tr ON t.id = tr.task_id
        WHERE t.assigned_to = $1
        AND t.updated_at >= NOW() - INTERVAL '${days} days'
      ),
      rank_data AS (
        SELECT
          COUNT(*) + 1 as rank
        FROM ${this.tableName}
        WHERE assigned_to IN (
          SELECT assigned_to
          FROM ${this.tableName}
          WHERE updated_at >= NOW() - INTERVAL '${days} days'
          AND status = 'COMPLETED'
        )
        GROUP BY assigned_to
        HAVING COALESCE(SUM(points * multiplier), 0) > (
          SELECT COALESCE(SUM(points * multiplier), 0)
          FROM ${this.tableName}
          WHERE assigned_to = $1
          AND updated_at >= NOW() - INTERVAL '${days} days'
          AND status = 'COMPLETED'
        )
      )
      SELECT * FROM user_stats, rank_data
    `;

    const result = await this.db.query(sql, [userId]);
    const row = result.rows[0];

    return {
      completed: parseInt(row.completed || 0),
      skipped: parseInt(row.skipped || 0),
      accuracy: parseFloat(row.accuracy || 0),
      averageTime: Math.round(parseFloat(row.average_time || 0)),
      earnings: parseFloat(row.earnings || 0),
      rank: parseInt(row.rank || 0)
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Map database row to Task entity
   */
  protected mapRowToEntity(row: any): Task {
    return {
      id: row.id.toString(),
      projectId: row.project_id.toString(),
      title: row.title,
      description: row.description,
      type: row.type as TaskType,
      subType: row.sub_type,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      options: row.options ? (typeof row.options === 'string' ? JSON.parse(row.options) : row.options) : undefined,
      status: row.status as TaskStatus,
      priority: row.priority,
      assignedTo: row.assigned_to?.toString(),
      assignedAt: row.assigned_at,
      completedAt: row.completed_at,
      dueAt: row.due_at,

      // AI and Quality fields
      aiPrelabel: row.ai_prelabel,
      aiConfidence: row.ai_confidence,
      consensusTarget: row.consensus_target || 1,
      consensusLevel: row.consensus_level as ConsensusLevel,
      finalLabel: row.final_label,
      qualityScore: row.quality_score,

      // Pricing
      basePrice: parseFloat(row.base_price || 0),
      points: row.points || 0,
      multiplier: parseFloat(row.multiplier || 1),

      createdAt: row.created_at,
      updatedAt: row.updated_at,

      // Response count (if joined)
      response_count: row.response_count ? parseInt(row.response_count) : 0
    };
  }
}