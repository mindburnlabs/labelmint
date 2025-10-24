import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../database/connection';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    telegram_id: number;
    username: string | null;
    first_name: string;
    last_name: string | null;
    role: string;
    trust_score: number;
    tasks_completed: number;
    total_earned: number;
  };
}

export interface TelegramInitData {
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
  };
  auth_date: number;
  hash: string;
}

function parseTelegramInitData(initData: string): TelegramInitData {
  const params = new URLSearchParams(initData);
  const result: any = {};

  for (const [key, value] of params.entries()) {
    if (key === 'user') {
      result.user = JSON.parse(decodeURIComponent(value));
    } else {
      result[key] = value;
    }
  }

  return result;
}

function validateTelegramAuth(telegramInitData: string): TelegramInitData | null {
  try {
    const data = parseTelegramInitData(telegramInitData);

    // Extract hash and remove it from data
    const hash = data.hash;
    const dataToCheck = { ...data };
    delete dataToCheck.hash;

    // Create data-check-string
    const dataCheckString = Object.keys(dataToCheck)
      .sort()
      .map(key => `${key}=${dataToCheck[key]}`)
      .join('\n');

    // Verify hash
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(process.env.TELEGRAM_BOT_TOKEN || '')
      .digest();

    const computedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) {
      return null;
    }

    // Check if auth_date is within 24 hours
    const authDate = new Date(data.auth_date * 1000);
    const now = new Date();
    const diffHours = (now.getTime() - authDate.getTime()) / (1000 * 60 * 60);

    if (diffHours > 24) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error validating Telegram auth:', error);
    return null;
  }
}

export const authenticateWorker = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['x-telegram-init-data'] as string;

    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Telegram auth data' });
    }

    const telegramData = validateTelegramAuth(authHeader);
    if (!telegramData || !telegramData.user) {
      return res.status(401).json({ error: 'Invalid Telegram auth' });
    }

    // Get or create user in database
    const telegramUser = telegramData.user;
    let user = await query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramUser.id]
    );

    if (user.rows.length === 0) {
      // Create new user
      user = await query(`
        INSERT INTO users (telegram_id, username, first_name, last_name, role, is_premium)
        VALUES ($1, $2, $3, $4, 'worker', $5)
        RETURNING *
      `,
      [
        telegramUser.id,
        telegramUser.username || null,
        telegramUser.first_name,
        telegramUser.last_name || null,
        telegramUser.is_premium || false
      ]);

      // Create wallet for new user
      await query(
        'INSERT INTO wallets (user_id) VALUES ($1)',
        [user.rows[0].id]
      );
    } else {
      // Update user info if needed
      await query(`
        UPDATE users
        SET username = $1, first_name = $2, last_name = $3, is_premium = $4, updated_at = NOW()
        WHERE id = $5
      `,
      [
        telegramUser.username || null,
        telegramUser.first_name,
        telegramUser.last_name || null,
        telegramUser.is_premium || false,
        user.rows[0].id
      ]);
    }

    // Check if user is a worker
    const userData = user.rows[0];
    if (userData.role !== 'worker' && userData.role !== 'client') {
      return res.status(403).json({ error: 'User not authorized as worker' });
    }

    // Attach user to request
    req.user = {
      id: userData.id,
      telegram_id: userData.telegram_id,
      username: userData.username,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: userData.role,
      trust_score: parseFloat(userData.trust_score) || 1.0,
      tasks_completed: userData.tasks_completed || 0,
      total_earned: parseFloat(userData.total_earned) || 0
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};