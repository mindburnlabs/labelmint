import { Request, Response } from 'express';
import { postgresDb } from '../database';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { Logger } from '../utils/logger';

const logger = new Logger('AdminAPI');

// Validation schemas
const updateUserSchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  email_verified: z.boolean().optional()
});

const bulkUserActionSchema = z.object({
  userIds: z.array(z.string()),
  action: z.enum(['activate', 'suspend', 'delete', 'verify_email']),
  reason: z.string().optional()
});

const projectModerationSchema = z.object({
  projectId: z.string(),
  action: z.enum(['approve', 'reject', 'suspend', 'feature']),
  reason: z.string().optional(),
  featured_priority: z.number().min(1).max(10).optional()
});

/**
 * Get admin dashboard statistics
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const statsQuery = `
      WITH user_stats AS (
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_users,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_week,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_month
        FROM users
      ),
      payment_stats AS (
        SELECT
          COUNT(*) as total_transactions,
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(SUM(gas_fee + service_fee), 0) as total_fees,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions
        FROM payments
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      ),
      project_stats AS (
        SELECT
          COUNT(*) as total_projects,
          COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_projects,
          COUNT(CASE WHEN status = 'PENDING_REVIEW' THEN 1 END) as pending_projects
        FROM projects
      ),
      delegate_stats AS (
        SELECT
          COUNT(*) as total_delegates,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_delegates,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_delegates_month
        FROM delegates
      )
      SELECT
        us.*,
        ps.*,
        pr.*,
        ds.*
      FROM user_stats us, payment_stats ps, project_stats pr, delegate_stats ds
    `;

    const result = await postgresDb.query(statsQuery);

    // Get recent activity
    const recentActivityQuery = `
      SELECT
        id,
        type,
        description,
        user_id,
        created_at,
        metadata
      FROM admin_activity_log
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const activityResult = await postgresDb.query(recentActivityQuery);

    // Get system health
    const healthQuery = `
      SELECT
        (SELECT COUNT(*) FROM users WHERE last_login > CURRENT_DATE - INTERVAL '1 day') as daily_active_users),
        (SELECT COUNT(*) FROM payments WHERE status = 'pending') as pending_payments,
        (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress') as active_tasks,
        (SELECT pg_database_size()) as database_size_mb
    `;

    const healthResult = await postgresDb.query(healthQuery);

    res.json({
      success: true,
      stats: {
        users: result.rows[0],
        payments: result.rows[0],
        projects: result.rows[0],
        delegates: result.rows[0],
        recentActivity: activityResult.rows,
        systemHealth: {
          dailyActiveUsers: parseInt(healthResult.rows[0].daily_active_users),
          pendingPayments: parseInt(healthResult.rows[0].pending_payments),
          activeTasks: parseInt(healthResult.rows[0].active_tasks),
          databaseSizeMB: parseFloat(healthResult.rows[0].database_size_mb)
        }
      }
    });

  } catch (error) {
    logger.error('Get dashboard stats error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    });
  }
};

/**
 * Get all users with pagination and filtering
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      role,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const whereConditions = [];
    const params = [];

    // Build WHERE clause
    if (status) {
      whereConditions.push(`u.status = $${params.length + 1}`);
      params.push(status);
    }

    if (role) {
      whereConditions.push(`u.role = $${params.length + 1}`);
      params.push(role);
    }

    if (search) {
      whereConditions.push(`(
        u.first_name ILIKE $${params.length + 1} OR
        u.last_name ILIKE $${params.length + 1} OR
        u.email ILIKE $${params.length + 1}
      )`);
      params.push(`%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.status,
        u.email_verified,
        u.created_at,
        u.last_login,
        u.telegram_id,
        COALESCE(wallet.balance_ton, 0) as ton_balance,
        COALESCE(wallet.balance_usdt, 0) as usdt_balance,
        COALESCE(stats.tasks_completed, 0) as tasks_completed,
        COALESCE(stats.total_earned, 0) as total_earned
      FROM users u
      LEFT JOIN user_ton_wallets wallet ON u.id = wallet.user_id AND wallet.is_active = true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as tasks_completed,
          COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.payment_amount END), 0) as total_earned
        FROM tasks t
        WHERE t.assigned_to = u.id
      ) stats ON true
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(parseInt(limit as string), offset);

    const result = await postgresDb.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      ${whereClause}
    `;

    const countResult = await postgresDb.query(countQuery, params.slice(0, -2));

    res.json({
      success: true,
      users: result.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit as string))
      }
    });

  } catch (error) {
    logger.error('Get users error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
};

/**
 * Update user details
 */
export const updateUser = [
  validateRequest(updateUserSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const adminId = req.user!.id;

      // Start transaction
      await postgresDb.query('BEGIN');

      try {
        // Log admin action
        await postgresDb.query(
          `INSERT INTO admin_activity_log
           (admin_id, user_id, action, description, metadata, created_at)
           VALUES ($1, $2, 'update_user', 'Updated user details', $3, NOW())`,
          [adminId, id, JSON.stringify(updates)]
        );

        // Update user
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }

        if (updateFields.length === 0) {
          await postgresDb.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'No fields to update'
          });
        }

        updateFields.push(`updated_at = NOW()`);
        updateValues.push(id);

        const updateQuery = `
          UPDATE users
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;

        const result = await postgresDb.query(updateQuery, updateValues);

        if (!result.rows.length) {
          await postgresDb.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }

        await postgresDb.query('COMMIT');

        res.json({
          success: true,
          message: 'User updated successfully',
          user: result.rows[0]
        });

      } catch (error) {
        await postgresDb.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      logger.error('Update user error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user'
      });
    }
  }
];

/**
 * Perform bulk user actions
 */
export const bulkUserAction = [
  validateRequest(bulkUserActionSchema),
  async (req: Request, res: Response) => {
    try {
      const { userIds, action, reason } = req.body;
      const adminId = req.user!.id;

      await postgresDb.query('BEGIN');

      try {
        for (const userId of userIds) {
          switch (action) {
            case 'activate':
              await postgresDb.query(
                'UPDATE users SET status = $1 WHERE id = $2',
                ['ACTIVE', userId]
              );
              break;

            case 'suspend':
              await postgresDb.query(
                `UPDATE users
                 SET status = 'SUSPENDED', suspension_reason = $1, updated_at = NOW()
                 WHERE id = $2`,
                [reason || 'Admin suspension', userId]
              );
              break;

            case 'delete':
              await postgresDb.query(
                'DELETE FROM users WHERE id = $1',
                [userId]
              );
              break;

            case 'verify_email':
              await postgresDb.query(
                'UPDATE users SET email_verified = true WHERE id = $1',
                [userId]
              );
              break;
          }

          // Log each action
          await postgresDb.query(
            `INSERT INTO admin_activity_log
             (admin_id, user_id, action, description, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [
              adminId,
              userId,
              `bulk_${action}`,
              `Bulk ${action} performed`,
              JSON.stringify({ reason })
            ]
          );
        }

        await postgresDb.query('COMMIT');

        res.json({
          success: true,
          message: `Bulk ${action} completed successfully`,
          affectedUsers: userIds.length
        });

      } catch (error) {
        await postgresDb.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      logger.error('Bulk user action error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk action'
      });
    }
  }
];

/**
 * Get projects pending review
 */
export const getPendingProjects = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const query = `
      SELECT
        p.*,
        u.first_name || ' ' || u.last_name as owner_name,
        u.email as owner_email,
        COALESCE(COUNT(t.id), 0) as total_tasks,
        COALESCE(SUM(CASE WHEN t.status = 'completed' THEN 1 END), 0) as completed_tasks
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      LEFT JOIN tasks t ON p.id = t.project_id
      WHERE p.status = 'PENDING_REVIEW'
      GROUP BY p.id, u.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await postgresDb.query(query, [parseInt(limit as string), offset]);

    res.json({
      success: true,
      projects: result.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      }
    });

  } catch (error) {
    logger.error('Get pending projects error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending projects'
    });
  }
};

/**
 * Moderate project
 */
export const moderateProject = [
  validateRequest(projectModerationSchema),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { action, reason, featured_priority } = req.body;
      const adminId = req.user!.id;

      await postgresDb.query('BEGIN');

      try {
        let status;
        switch (action) {
          case 'approve':
            status = 'ACTIVE';
            break;
          case 'reject':
            status = 'REJECTED';
            break;
          case 'suspend':
            status = 'SUSPENDED';
            break;
          case 'feature':
            status = 'FEATURED';
            break;
          default:
            throw new Error('Invalid action');
        }

        // Update project
        const updateQuery = `
          UPDATE projects
          SET status = $1, updated_at = NOW()
          ${featured_priority ? ', featured_priority = $2' : ''}
          WHERE id = $3
          RETURNING *
        `;

        const params = [status];
        if (featured_priority) {
          params.push(featured_priority);
        }
        params.push(projectId);

        const result = await postgresDb.query(updateQuery, params);

        if (!result.rows.length) {
          await postgresDb.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            error: 'Project not found'
          });
        }

        // Log moderation action
        await postgresDb.query(
          `INSERT INTO admin_activity_log
           (admin_id, project_id, action, description, metadata, created_at)
           VALUES ($1, $2, 'moderate_project', $3, $4, NOW())`,
          [
            adminId,
            projectId,
            action,
            `Project ${action}ed${reason ? ': ' + reason : ''}`,
            JSON.stringify({ reason, featured_priority })
          ]
        );

        await postgresDb.query('COMMIT');

        res.json({
          success: true,
          message: `Project ${action}d successfully`,
          project: result.rows[0]
        });

      } catch (error) {
        await postgresDb.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      logger.error('Moderate project error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to moderate project'
      });
    }
  }
];

/**
 * Get admin activity log
 */
export const getActivityLog = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      adminId,
      action,
      startDate,
      endDate
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const whereConditions = [];
    const params = [];

    if (adminId) {
      whereConditions.push(`admin_id = $${params.length + 1}`);
      params.push(adminId);
    }

    if (action) {
      whereConditions.push(`action = $${params.length + 1}`);
      params.push(action);
    }

    if (startDate) {
      whereConditions.push(`created_at >= $${params.length + 1}`);
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`created_at <= $${params.length + 1}`);
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        al.*,
        admin.first_name || ' ' || admin.last_name as admin_name
      FROM admin_activity_log al
      JOIN users admin ON al.admin_id = admin.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(parseInt(limit as string), offset);

    const result = await postgresDb.query(query, params);

    res.json({
      success: true,
      activities: result.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      }
    });

  } catch (error) {
    logger.error('Get activity log error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity log'
    });
  }
};

/**
 * Get system health and metrics
 */
export const getSystemHealth = async (req: Request, res: Response) => {
  try {
    // Database health
    const dbHealth = await postgresDb.query('SELECT 1');

    // Redis health (if available)
    let redisHealth = { status: 'unknown' };
    try {
      // This would be implemented based on your Redis setup
      redisHealth = { status: 'connected' };
    } catch (error) {
      redisHealth = { status: 'disconnected' };
    }

    // Payment system health
    const paymentHealth = await postgresDb.query(
      `SELECT
        COUNT(CASE WHEN status = 'pending' AND created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as stuck_payments,
        COUNT(CASE WHEN created_at > CURRENT_DATE THEN 1 END) as payments_today
      FROM payments`
    );

    // Task system health
    const taskHealth = await postgresDb.query(
      `SELECT
        COUNT(CASE WHEN status = 'in_progress' AND assigned_at < NOW() - INTERVAL '2 hours' THEN 1 END) as overdue_tasks,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks
      FROM tasks`
    );

    // WebSocket connections
    const wsStats = (global as any).wsService?.getStats() || {
      connectedUsers: 0,
      totalConnections: 0
    };

    res.json({
      success: true,
      health: {
        timestamp: new Date().toISOString(),
        database: {
          status: dbHealth.rows.length > 0 ? 'healthy' : 'unhealthy',
          latency: Date.now() // In production, measure actual query time
        },
        redis: redisHealth,
        payments: {
          stuckPayments: parseInt(paymentHealth.rows[0].stuck_payments),
          paymentsToday: parseInt(paymentHealth.rows[0].payments_today),
          status: parseInt(paymentHealth.rows[0].stuck_payments) === 0 ? 'healthy' : 'warning'
        },
        tasks: {
          overdueTasks: parseInt(taskHealth.rows[0].overdue_tasks),
          pendingTasks: parseInt(taskHealth.rows[0].pending_tasks),
          status: parseInt(taskHealth.rows[0].overdue_tasks) === 0 ? 'healthy' : 'warning'
        },
        websocket: {
          ...wsStats,
          status: wsStats.connectedUsers > 0 ? 'healthy' : 'warning'
        }
      }
    });

  } catch (error) {
    logger.error('Get system health error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system health'
    });
  }
};

/**
 * Export user data
 */
export const exportUsers = async (req: Request, res: Response) => {
  try {
    const { format = 'csv', status, role } = req.query;

    const whereConditions = [];
    const params = [];

    if (status) {
      whereConditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (role) {
      whereConditions.push(`role = $${params.length + 1}`);
      params.push(role);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        id,
        first_name,
        last_name,
        email,
        role,
        status,
        email_verified,
        created_at,
        last_login
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await postgresDb.query(query, params);

    if (format === 'csv') {
      // Convert to CSV
      const csv = [
        'ID,First Name,Last Name,Email,Role,Status,Email Verified,Created At,Last Login'
      ];

      result.rows.forEach(row => {
        csv.push([
          row.id,
          row.first_name,
          row.last_name,
          row.email,
          row.role,
          row.status,
          row.email_verified,
          row.created_at,
          row.last_login
        ].join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
      res.send(csv.join('\n'));
    } else {
      // Return JSON
      res.json({
        success: true,
        users: result.rows
      });
    }

  } catch (error) {
    logger.error('Export users error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export users'
    });
  }
};