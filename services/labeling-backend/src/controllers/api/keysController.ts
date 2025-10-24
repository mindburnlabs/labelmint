import { Request, Response } from 'express';
import { query } from '../../database/connection.js';
import { AuthenticatedRequest } from '../../middleware/apiAuth.js';
import { generateApiKey } from '../../middleware/apiAuth.js';

interface CreateKeyRequest {
  name: string;
  permissions?: string[];
  rateLimit?: {
    requests?: number;
    window?: number; // minutes
  };
  description?: string;
}

interface UpdateKeyRequest {
  name?: string;
  permissions?: string[];
  rateLimit?: {
    requests?: number;
    window?: number;
  };
  isActive?: boolean;
  description?: string;
}

export class KeysController {
  // POST /api/v1/keys
  static async createKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, permissions = ['projects:read', 'projects:write'], rateLimit = { requests: 1000, window: 60 }, description }: CreateKeyRequest = req.body;

      if (!name) {
        res.status(400).json({
          error: 'Name is required',
          code: 'NAME_REQUIRED'
        });
        return;
      }

      // Generate API key
      const { key, keyHash } = generateApiKey();

      // Create key in database
      const result = await query(
        `INSERT INTO api_keys (user_id, name, key_hash, permissions, rate_limit, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, created_at`,
        [req.client!.id, name, keyHash, permissions, rateLimit, description]
      );

      const createdKey = result.rows[0];

      res.status(201).json({
        success: true,
        api_key: {
          id: createdKey.id,
          name: name,
          key: key,
          permissions: permissions,
          rate_limit: rateLimit,
          description: description,
          created_at: createdKey.created_at
        },
        message: 'API key created successfully. Keep it secure!'
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'KEY_CREATION_FAILED'
      });
    }
  }

  // GET /api/v1/keys
  static async listKeys(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const keysResult = await query(
        `SELECT id, name, permissions, rate_limit, description, is_active, created_at, last_used, request_count
         FROM api_keys
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.client!.id]
      );

      const keys = keysResult.rows.map(key => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions,
        rate_limit: key.rate_limit,
        description: key.description,
        is_active: key.is_active,
        created_at: key.created_at,
        last_used: key.last_used,
        request_count: key.request_count
      }));

      res.json({
        success: true,
        api_keys: keys,
        total: keys.length
      });
    } catch (error) {
      console.error('Error listing API keys:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'KEYS_LIST_FAILED'
      });
    }
  }

  // PUT /api/v1/keys/:id
  static async updateKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const keyId = parseInt(req.params.id);
      const { name, permissions, rateLimit, isActive, description }: UpdateKeyRequest = req.body;

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }

      if (permissions !== undefined) {
        updates.push(`permissions = $${paramIndex++}`);
        values.push(permissions);
      }

      if (rateLimit !== undefined) {
        updates.push(`rate_limit = $${paramIndex++}`);
        values.push(JSON.stringify(rateLimit));
      }

      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(isActive);
      }

      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }

      if (updates.length === 0) {
        res.status(400).json({
          error: 'No fields to update',
          code: 'NO_FIELDS'
        });
        return;
      }

      updates.push('updated_at = NOW()');
      values.push(keyId);

      const setClause = updates.join(', ');
      const updateQuery = `
        UPDATE api_keys
        SET ${setClause}
        WHERE id = $${values.length}
        RETURNING *
      `;

      const result = await query(updateQuery, values);

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'API key not found',
          code: 'KEY_NOT_FOUND'
        });
        return;
      }

      const updatedKey = result.rows[0];

      res.json({
        success: true,
        api_key: {
          id: updatedKey.id,
          name: updatedKey.name,
          permissions: updatedKey.permissions,
          rate_limit: updatedKey.rate_limit,
          description: updatedKey.description,
          is_active: updatedKey.is_active,
          created_at: updatedKey.created_at,
          updated_at: updatedKey.updated_at
        },
        message: 'API key updated successfully'
      });
    } catch (error) {
      console.error('Error updating API key:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'KEY_UPDATE_FAILED'
      });
    }
  }

  // DELETE /api/v1/keys/:id
  static async deleteKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const keyId = parseInt(req.params.id);

      // Check ownership
      const result = await query(
        'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
        [keyId, req.client!.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'API key not found',
          code: 'KEY_NOT_FOUND'
        });
        return;
      }

      // Deactivate key instead of deleting (maintain audit trail)
      await query(
        'UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1',
        [keyId]
      );

      res.json({
        success: true,
        message: 'API key deactivated successfully'
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'KEY_DELETION_FAILED'
      });
    }
  }

  // GET /api/v1/keys/:id/usage
  static async getKeyUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const keyId = parseInt(req.params.id);

      const usageResult = await query(
        `SELECT ak.*,
                (SELECT COUNT(*) FROM api_usage WHERE api_key_id = $1 AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)) as requests_this_month,
                (SELECT COUNT(*) FROM api_usage WHERE api_key_id = $1 AND date_trunc('day', created_at) = date_trunc('day', CURRENT_DATE)) as requests_today
         FROM api_keys ak
         WHERE ak.id = $1 AND ak.user_id = $2`,
        [keyId, req.client!.id]
      );

      if (usageResult.rows.length === 0) {
        res.status(404).json({
          error: 'API key not found',
          code: 'KEY_NOT_FOUND'
        });
        return;
      }

      const key = usageResult.rows[0];

      // Get recent usage
      const recentUsageResult = await query(
        `SELECT DATE_TRUNC('hour', created_at) as hour,
                COUNT(*) as requests,
                COUNT(DISTINCT endpoint) as unique_endpoints
         FROM api_usage
         WHERE api_key_id = $1
           AND created_at >= NOW() - INTERVAL '24 hours'
         GROUP BY DATE_TRUNC('hour', created_at)
         ORDER BY hour DESC
         LIMIT 24`,
        [keyId]
      );

      res.json({
        success: true,
        api_key: {
          id: key.id,
          name: key.name,
          last_used: key.last_used,
          request_count: key.request_count,
          rate_limit: key.rate_limit
        },
        usage: {
          requests_today: parseInt(recentUsageResult.rows[0]?.requests_today || 0),
          requests_this_month: parseInt(recentUsageResult.rows[0]?.requests_this_month || 0),
          recent_activity: recentUsageResult.rows
        }
      });
    } catch (error) {
      console.error('Error fetching key usage:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'USAGE_FETCH_FAILED'
      });
    }
  }
}
