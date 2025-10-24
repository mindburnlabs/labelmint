import { Pool } from 'pg';
import { BaseRepository, QueryOptions, PaginationResult } from './BaseRepository';
import { User, UserRole, WorkerStats } from '../types/user';

// ============================================================================
// USER TYPES EXTENSIONS
// ============================================================================

export interface UserFindOptions extends QueryOptions {
  includeInactive?: boolean;
  includeDeleted?: boolean;
  role?: UserRole;
  telegramId?: bigint;
  email?: string;
  username?: string;
}

export interface UserCreateData {
  telegramId?: bigint;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  role: UserRole;
  passwordHash?: string;
  tonWalletAddress?: string;
}

export interface UserUpdateData {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  isActive?: boolean;
  role?: UserRole;
  passwordHash?: string;
  twoFactorSecret?: string;
  twoFactorEnabled?: boolean;
  tonWalletAddress?: string;
  tonWalletVersion?: string;
  tonWalletTestnet?: boolean;
  trustScore?: number;
  suspicionScore?: number;
  level?: number;
  experiencePoints?: number;
}

// ============================================================================
// USER REPOSITORY
// ============================================================================

export class UserRepository extends BaseRepository<User> {
  constructor(db: Pool) {
    super(db, 'users');
    this.primaryKey = 'id';
  }

  // ============================================================================
  // FIND METHODS
  // ============================================================================

  /**
   * Find user by Telegram ID
   */
  async findByTelegramId(telegramId: bigint): Promise<User | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE telegram_id = $1
      AND is_deleted = false
    `;

    const result = await this.db.query(sql, [telegramId.toString()]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE email = $1
      AND is_deleted = false
    `;

    const result = await this.db.query(sql, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE username = $1
      AND is_deleted = false
    `;

    const result = await this.db.query(sql, [username]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find users by role
   */
  async findByRole(
    role: UserRole,
    options: UserFindOptions = {}
  ): Promise<User[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE role = $1
      AND ${options.includeInactive ? 'true' : 'is_active = true'}
      AND ${options.includeDeleted ? 'true' : 'is_deleted = false'}
      ${options.orderBy ? `ORDER BY ${Object.entries(options.orderBy).map(([f, d]) => `${f} ${d}`).join(', ')}` : ''}
      ${options.limit ? `LIMIT ${options.limit}` : ''}
      ${options.offset ? `OFFSET ${options.offset}` : ''}
    `;

    const result = await this.db.query(sql, [role]);

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find active workers
   */
  async findActiveWorkers(limit: number = 50): Promise<User[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE role = 'WORKER'
      AND is_active = true
      AND is_deleted = false
      ORDER BY trust_score DESC, last_login_at DESC NULLS LAST
      LIMIT $1
    `;

    const result = await this.db.query(sql, [limit]);

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Search users by name or username
   */
  async search(query: string, limit: number = 20): Promise<User[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE (
        ILIKE(username, $1) OR
        ILIKE(first_name, $1) OR
        ILIKE(last_name, $1) OR
        ILIKE(email, $1)
      )
      AND is_active = true
      AND is_deleted = false
      ORDER BY
        CASE
          WHEN username ILIKE $2 THEN 1
          WHEN first_name ILIKE $2 THEN 2
          ELSE 3
        END
      LIMIT $3
    `;

    const searchPattern = `%${query}%`;
    const exactPattern = `${query}%`;

    const result = await this.db.query(sql, [searchPattern, exactPattern, limit]);

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // ============================================================================
  // CREATE METHODS
  // ============================================================================

  /**
   * Create new user
   */
  async create(userData: UserCreateData): Promise<User> {
    const fields = [
      'telegram_id',
      'email',
      'username',
      'first_name',
      'last_name',
      'language_code',
      'role',
      'password_hash',
      'ton_wallet_address',
      'wallet_balance',
      'total_earned',
      'total_withdrawn',
      'frozen_balance',
      'tasks_completed',
      'trust_score',
      'suspicion_score',
      'level',
      'experience_points',
      'current_streak',
      'max_streak',
      'is_active',
      'created_at',
      'updated_at'
    ];

    const values = [
      userData.telegramId?.toString() || null,
      userData.email || null,
      userData.username || null,
      userData.firstName || null,
      userData.lastName || null,
      userData.languageCode || null,
      userData.role,
      userData.passwordHash || null,
      userData.tonWalletAddress || null,
      0, // wallet_balance
      0, // total_earned
      0, // total_withdrawn
      0, // frozen_balance
      0, // tasks_completed
      100, // trust_score (default)
      0, // suspicion_score
      1, // level
      0, // experience_points
      0, // current_streak
      0, // max_streak
      true, // is_active
      new Date(), // created_at
      new Date() // updated_at
    ];

    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `
      INSERT INTO ${this.tableName} (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.db.query(sql, values);

    if (result.rows.length === 0) {
      throw new Error('Failed to create user');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create user from Telegram auth data
   */
  async createFromTelegram(authData: {
    id: bigint;
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
  }): Promise<User> {
    return this.create({
      telegramId: authData.id,
      firstName: authData.firstName,
      lastName: authData.lastName,
      username: authData.username,
      languageCode: authData.languageCode,
      role: 'WORKER'
    });
  }

  // ============================================================================
  // UPDATE METHODS
  // ============================================================================

  /**
   * Update user last login
   */
  async updateLastLogin(userId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET last_login_at = NOW()
      WHERE id = $1
    `;

    await this.db.query(sql, [userId]);
  }

  /**
   * Update user wallet
   */
  async updateWallet(userId: string, walletData: {
    address: string;
    version?: string;
    testnet?: boolean;
  }): Promise<User> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        ton_wallet_address = $1,
        ton_wallet_version = $2,
        ton_wallet_testnet = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const result = await this.db.query(sql, [
      walletData.address,
      walletData.version || 'v4R2',
      walletData.testnet ?? false,
      userId
    ]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update user balance
   */
  async updateBalance(userId: string, updates: {
    walletBalance?: number;
    totalEarned?: number;
    totalWithdrawn?: number;
    frozenBalance?: number;
  }): Promise<User> {
    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.walletBalance !== undefined) {
      setFields.push(`wallet_balance = $${paramIndex++}`);
      values.push(updates.walletBalance);
    }
    if (updates.totalEarned !== undefined) {
      setFields.push(`total_earned = $${paramIndex++}`);
      values.push(updates.totalEarned);
    }
    if (updates.totalWithdrawn !== undefined) {
      setFields.push(`total_withdrawn = $${paramIndex++}`);
      values.push(updates.totalWithdrawn);
    }
    if (updates.frozenBalance !== undefined) {
      setFields.push(`frozen_balance = $${paramIndex++}`);
      values.push(updates.frozenBalance);
    }

    setFields.push(`updated_at = NOW()`);
    values.push(userId);

    const sql = `
      UPDATE ${this.tableName}
      SET ${setFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(sql, values);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update user stats after task completion
   */
  async updateTaskStats(userId: string, stats: {
    tasksCompleted: number;
    accuracyRate?: number;
    experiencePoints: number;
    trustScore?: number;
    level?: number;
  }): Promise<User> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        tasks_completed = tasks_completed + $1,
        accuracy_rate = $2,
        experience_points = experience_points + $3,
        trust_score = COALESCE($4, trust_score),
        level = COALESCE($5, level),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

    const result = await this.db.query(sql, [
      stats.tasksCompleted,
      stats.accuracyRate,
      stats.experiencePoints,
      stats.trustScore,
      stats.level,
      userId
    ]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  // ============================================================================
  // WORKER SPECIFIC METHODS
  // ============================================================================

  /**
   * Get worker statistics
   */
  async getWorkerStats(userId: string): Promise<WorkerStats | null> {
    const sql = `
      SELECT
        u.id as user_id,
        u.tasks_completed,
        u.accuracy_rate,
        u.trust_score,
        u.level,
        u.current_streak as streak_current,
        u.max_streak as streak_best,
        u.wallet_balance,
        u.total_earned,
        COALESCE(weekly.total, 0) as weekly_earnings,
        COALESCE(daily.total, 0) as daily_earnings,
        COALESCE(avg_time.average_time, 0) as average_time_per_task,
        (
          SELECT COUNT(*)
          FROM user_warnings
          WHERE user_id = u.id
          AND expires_at > NOW()
        ) as warning_count,
        u.last_login_at as last_active_at
      FROM ${this.tableName} u
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = u.id
        AND created_at >= NOW() - INTERVAL '7 days'
        AND status = 'confirmed'
      ) weekly ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = u.id
        AND created_at >= NOW() - INTERVAL '1 day'
        AND status = 'confirmed'
      ) daily ON true
      LEFT JOIN LATERAL (
        SELECT AVG(time_spent) as average_time
        FROM task_responses
        WHERE user_id = u.id
        AND created_at >= NOW() - INTERVAL '30 days'
      ) avg_time ON true
      WHERE u.id = $1
      AND u.role = 'WORKER'
    `;

    const result = await this.db.query(sql, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Calculate rank based on trust score
    const rankQuery = `
      SELECT COUNT(*) + 1 as rank
      FROM ${this.tableName}
      WHERE role = 'WORKER'
      AND trust_score > $1
      AND is_active = true
      AND is_deleted = false
    `;

    const rankResult = await this.db.query(rankQuery, [row.trust_score]);
    const rank = parseInt(rankResult.rows[0].rank);

    return {
      userId: row.user_id,
      tasksCompleted: row.tasks_completed,
      accuracyRate: row.accuracy_rate,
      averageTimePerTask: Math.round(row.average_time_per_task || 0),
      earnings: {
        total: row.total_earned,
        weekly: row.weekly_earnings,
        daily: row.daily_earnings
      },
      rank,
      level: row.level,
      streak: {
        current: row.streak_current,
        best: row.streak_best
      },
      warningCount: row.warning_count,
      lastActiveAt: row.last_active_at
    };
  }

  /**
   * Get top workers by criteria
   */
  async getTopWorkers(
    criteria: 'trust_score' | 'tasks_completed' | 'total_earned',
    limit: number = 10,
    timeframe?: 'day' | 'week' | 'month'
  ): Promise<User[]> {
    let whereClause = `WHERE role = 'WORKER' AND is_active = true AND is_deleted = false`;
    let orderByClause = `ORDER BY ${criteria} DESC`;

    if (timeframe) {
      switch (timeframe) {
        case 'day':
          whereClause += ` AND last_login_at >= NOW() - INTERVAL '1 day'`;
          break;
        case 'week':
          whereClause += ` AND last_login_at >= NOW() - INTERVAL '1 week'`;
          break;
        case 'month':
          whereClause += ` AND last_login_at >= NOW() - INTERVAL '1 month'`;
          break;
      }
    }

    const sql = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ${orderByClause}
      LIMIT $1
    `;

    const result = await this.db.query(sql, [limit]);

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // ============================================================================
  // AUTHENTICATION METHODS
  // ============================================================================

  /**
   * Verify user credentials
   */
  async verifyCredentials(email: string, passwordHash: string): Promise<User | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE email = $1
      AND password_hash = $2
      AND is_active = true
      AND is_deleted = false
    `;

    const result = await this.db.query(sql, [email, passwordHash]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Enable/disable 2FA for user
   */
  async updateTwoFactor(userId: string, secret: string, enabled: boolean): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET two_factor_secret = $1, two_factor_enabled = $2
      WHERE id = $3
    `;

    await this.db.query(sql, [secret, enabled, userId]);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Map database row to User entity
   */
  protected mapRowToEntity(row: any): User {
    return {
      id: row.id.toString(),
      telegramId: row.telegram_id ? BigInt(row.telegram_id) : undefined,
      email: row.email,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      languageCode: row.language_code,
      isActive: row.is_active,
      role: row.role as UserRole,
      createdAt: row.created_at,
      updatedAt: row.updated_at,

      // Payment fields
      walletBalance: parseFloat(row.wallet_balance || 0),
      totalEarned: parseFloat(row.total_earned || 0),
      totalWithdrawn: parseFloat(row.total_withdrawn || 0),
      frozenBalance: parseFloat(row.frozen_balance || 0),

      // Performance fields
      tasksCompleted: row.tasks_completed || 0,
      accuracyRate: row.accuracy_rate ? parseFloat(row.accuracy_rate) : undefined,
      trustScore: row.trust_score || 0,
      suspicionScore: row.suspicion_score || 0,

      // Authentication fields
      passwordHash: row.password_hash,
      twoFactorSecret: row.two_factor_secret,
      twoFactorEnabled: row.two_factor_enabled || false,
      lastLoginAt: row.last_login_at,

      // TON Blockchain fields
      tonWalletAddress: row.ton_wallet_address,
      tonWalletVersion: row.ton_wallet_version,
      tonWalletTestnet: row.ton_wallet_testnet || false,

      // Gamification fields
      level: row.level || 1,
      experiencePoints: row.experience_points || 0,
      currentStreak: row.current_streak || 0,
      maxStreak: row.max_streak || 0
    };
  }
}