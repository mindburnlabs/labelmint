import { Request, Response } from 'express';
import { postgresDb } from '../database';
import { validateRequest } from './middleware/validation';
import { z } from 'zod';
import { Logger } from '../utils/logger';

const logger = new Logger('DelegatesAPI');

// Validation schemas
const createDelegateSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  daily_limit: z.number().min(0).max(10000).optional().default(100),
  monthly_limit: z.number().min(0).max(100000).optional().default(3000),
  allowed_actions: z.array(z.string()).optional().default(['view_tasks'])
});

const updateDelegateSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  daily_limit: z.number().min(0).max(10000).optional(),
  monthly_limit: z.number().min(0).max(100000).optional(),
  allowed_actions: z.array(z.string()).optional()
});

const spendingLimitsSchema = z.object({
  daily: z.number().min(0).optional(),
  weekly: z.number().min(0).optional(),
  monthly: z.number().min(0).optional(),
  per_task: z.number().min(0).optional()
});

/**
 * Get all delegates for the current user/organization
 */
export const getDelegates = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { limit = 50, offset = 0, status } = req.query;

    let query = `
      SELECT d.*, u.first_name, u.last_name, u.email, u.telegram_username,
             COALESCE(stats.completed_tasks, 0) as completed_tasks,
             COALESCE(stats.success_rate, 0) as success_rate,
             COALESCE(stats.earnings_today, 0) as earnings_today,
             COALESCE(stats.earnings_month, 0) as earnings_month
      FROM delegates d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
          CASE
            WHEN COUNT(CASE WHEN t.status = 'completed' THEN 1 END) > 0 THEN
              ROUND(COUNT(CASE WHEN t.status = 'completed' AND t.quality_score >= 0.8 THEN 1 END) * 100.0 /
                    COUNT(CASE WHEN t.status = 'completed' THEN 1 END), 2)
            ELSE 0
          END as success_rate,
          COALESCE(SUM(CASE WHEN t.completed_at >= CURRENT_DATE THEN t.payment_amount END), 0) as earnings_today,
          COALESCE(SUM(CASE WHEN t.completed_at >= DATE_TRUNC('month', CURRENT_DATE) THEN t.payment_amount END), 0) as earnings_month
        FROM tasks t
        WHERE t.assigned_to = d.user_id
      ) stats ON true
      WHERE d.owner_id = $1
    `;

    const params = [userId];

    if (status) {
      query += ' AND d.status = $2';
      params.push(status as string);
    }

    query += ' ORDER BY d.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit as number, offset as number);

    const result = await postgresDb.query(query, params);

    res.json({
      success: true,
      delegates: result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        status: row.status,
        daily_limit: row.daily_limit,
        monthly_limit: row.monthly_limit,
        total_spent: row.total_spent,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_active_at: row.last_active_at,
        allowed_actions: row.allowed_actions,
        user: {
          id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          telegram_username: row.telegram_username
        },
        stats: {
          completed_tasks: row.completed_tasks,
          success_rate: row.success_rate,
          earnings_today: row.earnings_today,
          earnings_month: row.earnings_month
        }
      }))
    });

  } catch (error) {
    logger.error('Get delegates error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch delegates'
    });
  }
};

/**
 * Get a specific delegate
 */
export const getDelegate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.user!.id;

    const query = `
      SELECT d.*, u.first_name, u.last_name, u.email, u.telegram_username
      FROM delegates d
      JOIN users u ON d.user_id = u.id
      WHERE d.id = $1 AND d.owner_id = $2
    `;

    const result = await postgresDb.query(query, [id, ownerId]);

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Delegate not found'
      });
    }

    res.json({
      success: true,
      delegate: result.rows[0]
    });

  } catch (error) {
    logger.error('Get delegate error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch delegate'
    });
  }
};

/**
 * Create a new delegate
 */
export const createDelegate = [
  validateRequest(createDelegateSchema),
  async (req: Request, res: Response) => {
    try {
      const ownerId = req.user!.id;
      const { email, first_name, last_name, daily_limit, monthly_limit, allowed_actions } = req.body;

      // Start transaction
      await postgresDb.query('BEGIN');

      try {
        // Check if user exists with this email
        const userResult = await postgresDb.query(
          'SELECT id FROM users WHERE email = $1',
          [email]
        );

        let userId;
        if (userResult.rows.length === 0) {
          // Create new user if doesn't exist
          const newUserResult = await postgresDb.query(
            `INSERT INTO users (email, first_name, last_name, status, created_at)
             VALUES ($1, $2, $3, 'pending', NOW())
             RETURNING id`,
            [email, first_name, last_name]
          );
          userId = newUserResult.rows[0].id;
        } else {
          userId = userResult.rows[0].id;
        }

        // Check if delegate already exists
        const existingDelegate = await postgresDb.query(
          'SELECT id FROM delegates WHERE user_id = $1 AND owner_id = $2',
          [userId, ownerId]
        );

        if (existingDelegate.rows.length > 0) {
          await postgresDb.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'Delegate already exists for this user'
          });
        }

        // Create delegate
        const delegateResult = await postgresDb.query(
          `INSERT INTO delegates
           (user_id, owner_id, daily_limit, monthly_limit, allowed_actions, status, created_at)
           VALUES ($1, $2, $3, $4, $5, 'active', NOW())
           RETURNING *`,
          [userId, ownerId, daily_limit, monthly_limit, allowed_actions]
        );

        await postgresDb.query('COMMIT');

        res.status(201).json({
          success: true,
          message: 'Delegate created successfully',
          delegate: delegateResult.rows[0]
        });

      } catch (error) {
        await postgresDb.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      logger.error('Create delegate error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create delegate'
      });
    }
  }
];

/**
 * Update a delegate
 */
export const updateDelegate = [
  validateRequest(updateDelegateSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ownerId = req.user!.id;
      const updates = req.body;

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id, ownerId);

      const query = `
        UPDATE delegates
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND owner_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await postgresDb.query(query, updateValues);

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: 'Delegate not found'
        });
      }

      res.json({
        success: true,
        message: 'Delegate updated successfully',
        delegate: result.rows[0]
      });

    } catch (error) {
      logger.error('Update delegate error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update delegate'
      });
    }
  }
];

/**
 * Delete a delegate
 */
export const deleteDelegate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.user!.id;

    const result = await postgresDb.query(
      'DELETE FROM delegates WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, ownerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Delegate not found'
      });
    }

    res.json({
      success: true,
      message: 'Delegate deleted successfully'
    });

  } catch (error) {
    logger.error('Delete delegate error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete delegate'
    });
  }
};

/**
 * Get delegate statistics
 */
export const getDelegateStats = async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;

    const statsQuery = `
      SELECT
        COUNT(*) as total_delegates,
        COUNT(CASE WHEN d.status = 'active' THEN 1 END) as active_delegates,
        COALESCE(SUM(d.total_spent), 0) as total_spent_month,
        COALESCE(AVG(stats.success_rate), 0) as avg_success_rate,
        COALESCE(SUM(stats.completed_tasks), 0) as total_tasks_completed
      FROM delegates d
      LEFT JOIN LATERAL (
        SELECT
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
          CASE
            WHEN COUNT(CASE WHEN t.status = 'completed' THEN 1 END) > 0 THEN
              COUNT(CASE WHEN t.status = 'completed' AND t.quality_score >= 0.8 THEN 1 END) * 100.0 /
              COUNT(CASE WHEN t.status = 'completed' THEN 1 END)
            ELSE 0
          END as success_rate
        FROM tasks t
        WHERE t.assigned_to = d.user_id
        AND t.completed_at >= DATE_TRUNC('month', CURRENT_DATE)
      ) stats ON true
      WHERE d.owner_id = $1
    `;

    const result = await postgresDb.query(statsQuery, [ownerId]);

    // Get top performers
    const topPerformersQuery = `
      SELECT
        d.id as delegate_id,
        u.first_name || ' ' || u.last_name as delegate_name,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as tasks_completed,
        CASE
          WHEN COUNT(CASE WHEN t.status = 'completed' THEN 1 END) > 0 THEN
            COUNT(CASE WHEN t.status = 'completed' AND t.quality_score >= 0.8 THEN 1 END) * 100.0 /
            COUNT(CASE WHEN t.status = 'completed' THEN 1 END)
          ELSE 0
        END as success_rate,
        COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.payment_amount END), 0) as earnings
      FROM delegates d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN tasks t ON t.assigned_to = d.user_id
      WHERE d.owner_id = $1
      AND t.completed_at >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY d.id, u.first_name, u.last_name
      ORDER BY tasks_completed DESC
      LIMIT 5
    `;

    const topPerformersResult = await postgresDb.query(topPerformersQuery, [ownerId]);

    res.json({
      success: true,
      stats: {
        ...result.rows[0],
        top_performers: topPerformersResult.rows
      }
    });

  } catch (error) {
    logger.error('Get delegate stats error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch delegate statistics'
    });
  }
};

/**
 * Set spending limits for a delegate
 */
export const setSpendingLimits = [
  validateRequest(spendingLimitsSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ownerId = req.user!.id;
      const limits = req.body;

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(limits)) {
        if (value !== undefined) {
          updateFields.push(`${key}_limit = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No limits to update'
        });
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id, ownerId);

      const query = `
        UPDATE delegates
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND owner_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await postgresDb.query(query, updateValues);

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: 'Delegate not found'
        });
      }

      res.json({
        success: true,
        message: 'Spending limits updated successfully',
        delegate: result.rows[0]
      });

    } catch (error) {
      logger.error('Set spending limits error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update spending limits'
      });
    }
  }
];

/**
 * Suspend a delegate
 */
export const suspendDelegate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.user!.id;
    const { reason } = req.body;

    const result = await postgresDb.query(
      `UPDATE delegates
       SET status = 'suspended', suspension_reason = $1, updated_at = NOW()
       WHERE id = $2 AND owner_id = $3
       RETURNING *`,
      [reason || 'No reason provided', id, ownerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Delegate not found'
      });
    }

    res.json({
      success: true,
      message: 'Delegate suspended successfully',
      delegate: result.rows[0]
    });

  } catch (error) {
    logger.error('Suspend delegate error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to suspend delegate'
    });
  }
};

/**
 * Reactivate a suspended delegate
 */
export const reactivateDelegate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ownerId = req.user!.id;

    const result = await postgresDb.query(
      `UPDATE delegates
       SET status = 'active', suspension_reason = NULL, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2 AND status = 'suspended'
       RETURNING *`,
      [id, ownerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Delegate not found or not suspended'
      });
    }

    res.json({
      success: true,
      message: 'Delegate reactivated successfully',
      delegate: result.rows[0]
    });

  } catch (error) {
    logger.error('Reactivate delegate error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate delegate'
    });
  }
};