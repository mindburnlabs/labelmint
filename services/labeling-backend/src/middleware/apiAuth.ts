import { Request, Response, NextFunction } from 'express';
import { createHmac } from 'crypto';
import { query } from '../database/connection.js';

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  permissions: string[];
  rateLimit: {
    requests: number;
    window: number; // in minutes
  };
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  requestCount: number;
}

export interface AuthenticatedRequest extends Request {
  apiKey?: ApiKey;
  client?: {
    id: number;
    name: string;
    email?: string;
  };
}

// HMAC-SHA256 authentication
export const authenticateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.header('X-API-Key');
    const timestamp = req.header('X-Timestamp');
    const signature = req.header('X-Signature');

    if (!apiKey || !timestamp || !signature) {
      res.status(401).json({
        error: 'Missing authentication headers',
        required: ['X-API-Key', 'X-Timestamp', 'X-Signature']
      });
      return;
    }

    // Check timestamp (prevent replay attacks - 5 minute window)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp);
    if (Math.abs(now - requestTime) > 300) {
      res.status(401).json({
        error: 'Request timestamp too old',
        code: 'TIMESTAMP_EXPIRED'
      });
      return;
    }

    // Get API key from database
    const result = await query(
      `SELECT ak.*, u.id as user_id, u.first_name, u.last_name, u.email
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_hash = $1 AND ak.is_active = true`,
      [hashApiKey(apiKey)]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
      return;
    }

    const keyData: ApiKey = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      keyHash: result.rows[0].key_hash,
      permissions: result.rows[0].permissions || [],
      rateLimit: result.rows[0].rate_limit || { requests: 1000, window: 60 },
      isActive: result.rows[0].is_active,
      createdAt: result.rows[0].created_at,
      lastUsed: result.rows[0].last_used,
      requestCount: result.rows[0].request_count || 0
    };

    // Verify signature
    const payload = `${req.method}${req.path}${timestamp}${req.body ? JSON.stringify(req.body) : ''}`;
    const expectedSignature = createHmac('sha256', process.env.API_SECRET!).update(payload).digest('hex');

    if (signature !== expectedSignature) {
      res.status(401).json({
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE'
      });
      return;
    }

    // Check rate limiting
    const rateLimitWindow = keyData.rateLimit.window * 60 * 1000; // Convert to milliseconds
    const timeSinceLastReset = Date.now() - (keyData.lastUsed?.getTime() || 0);

    if (timeSinceLastReset > rateLimitWindow) {
      // Reset counter
      await query(
        `UPDATE api_keys
         SET request_count = 1, last_used = NOW()
         WHERE id = $1`,
        [keyData.id]
      );
    } else if (keyData.requestCount >= keyData.rateLimit.requests) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        limit: keyData.rateLimit.requests,
        window: keyData.rateLimit.window
      });
      return;
    } else {
      // Increment counter
      await query(
        `UPDATE api_keys
         SET request_count = request_count + 1, last_used = NOW()
         WHERE id = $1`,
        [keyData.id]
      );
    }

    // Check permissions if endpoint requires specific permissions
    if (req.path.includes('/projects/') && req.method === 'POST') {
      if (!keyData.permissions.includes('projects:write')) {
        res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: 'projects:write'
        });
        return;
      }
    }

    // Attach API key and client info to request
    req.apiKey = keyData;
    req.client = {
      id: result.rows[0].user_id,
      name: `${result.rows[0].first_name} ${result.rows[0].last_name || ''}`.trim(),
      email: result.rows[0].email
    };

    // Log API usage
    console.log(`API Request: ${req.method} ${req.path} by ${req.client.name} (API Key: ${keyData.name})`);

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Generate API key
export const generateApiKey = (): { key: string; keyHash: string } => {
  const key = `tl_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = hashApiKey(key);
  return { key, keyHash };
};

// Helper function to hash API key
function hashApiKey(apiKey: string): string {
  return createHmac('sha256', process.env.API_SECRET!).update(apiKey).digest('hex');
}

// Rate limiting middleware
export const rateLimit = (requests: number, window: number) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // This is handled in authenticateApiKey, but can be used for specific endpoints
    next();
  };
};

// Require specific permission
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey?.permissions.includes(permission)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission
      });
      return;
    }
    next();
  };
};