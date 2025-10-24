import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../services/auth/TokenService';
import { SessionService } from '../services/auth/SessionService';
import { SecurityService } from '../services/auth/SecurityService';
import config from '../config';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    two_factor_enabled?: boolean;
  };
  session?: any;
  sessionId?: string;
  db?: any; // PostgreSQL client
}

interface JwtPayload {
  userId: number;
  sessionId: string;
  deviceId: string;
  type: 'access';
}

// Initialize services
const tokenService = new TokenService();
const sessionService = new SessionService();
const securityService = new SecurityService();

/**
 * Enhanced authentication middleware
 */
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    // Verify token and get payload
    const payload = await tokenService.verifyAccessToken(token);

    // Check if account is locked
    const accountLock = await securityService.isAccountLocked(payload.userId);
    if (accountLock.locked) {
      res.status(423).json({
        error: 'Account locked',
        code: 'ACCOUNT_LOCKED',
        reason: accountLock.reason,
        lockedUntil: accountLock.lockedUntil
      });
      return;
    }

    // Get session
    const session = await sessionService.getSession(payload.sessionId);
    if (!session) {
      res.status(401).json({
        error: 'Invalid session',
        code: 'SESSION_INVALID'
      });
      return;
    }

    // Check session security
    const isSessionSecure = await sessionService.checkSessionSecurity(
      payload.sessionId,
      req.ip
    );

    if (!isSessionSecure) {
      res.status(401).json({
        error: 'Session security check failed',
        code: 'SESSION_INSECURE'
      });
      return;
    }

    // Get user info
    const userResult = await req.db?.query(
      'SELECT id, email, role, two_factor_enabled FROM users WHERE id = $1',
      [payload.userId]
    );

    if (!userResult?.rows[0]) {
      res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const user = userResult.rows[0];

    // Attach user and session to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      two_factor_enabled: user.two_factor_enabled
    };
    req.session = session;
    req.sessionId = payload.sessionId;

    // Log successful authentication
    await securityService.logSecurityEvent({
      userId: user.id,
      action: 'api_access',
      result: 'success',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: payload.sessionId,
      details: {
        endpoint: req.path,
        method: req.method
      }
    });

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    // Log failed authentication attempt
    await securityService.logSecurityEvent({
      action: 'api_access',
      result: 'failure',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        endpoint: req.path,
        error: error.message
      }
    });

    res.status(401).json({
      error: 'Invalid or expired token',
      code: 'TOKEN_INVALID'
    });
  }
};

/**
 * Require 2FA if enabled
 */
export const requireTwoFactor = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.two_factor_enabled) {
    const twoFactorVerified = req.headers['x-2fa-verified'];

    if (!twoFactorVerified || twoFactorVerified !== 'true') {
      res.status(403).json({
        error: '2FA verification required',
        code: 'TWO_FACTOR_REQUIRED'
      });
      return;
    }
  }

  next();
};

/**
 * Require admin role
 */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      error: 'Admin access required',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
    return;
  }

  next();
};

/**
 * Check if user has specific role
 */
export const requireRole = (role: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({
        error: `${role} access required`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
      return;
    }

    next();
  };
};

/**
 * Optional authentication (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const payload = await tokenService.verifyAccessToken(token);
    const session = await sessionService.getSession(payload.sessionId);

    if (session) {
      const userResult = await req.db?.query(
        'SELECT id, email, role FROM users WHERE id = $1',
        [payload.userId]
      );

      if (userResult?.rows[0]) {
        req.user = userResult.rows[0];
        req.session = session;
        req.sessionId = payload.sessionId;
      }
    }
  } catch (error) {
    // Silently ignore errors for optional auth
  }

  next();
};

/**
 * Rate limiting middleware
 */
export const rateLimit = (
  maxRequests: number,
  windowMs: number,
  identifier: string = 'ip'
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const key = identifier === 'ip'
      ? req.ip
      : req.user?.id?.toString() || req.ip;

    const allowed = await securityService.checkIPRateLimit(
      key,
      req.path,
      maxRequests,
      windowMs
    );

    if (!allowed) {
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED'
      });
      return;
    }

    next();
  };
};

/**
 * CSRF protection middleware
 */
export const requireCSRF = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const csrfToken = req.headers['x-csrf-token'] as string;
  const sessionId = req.sessionId;

  if (!csrfToken || !sessionId) {
    res.status(403).json({
      error: 'CSRF token required',
      code: 'CSRF_MISSING'
    });
    return;
  }

  if (!securityService.verifyCSRFToken(csrfToken, sessionId)) {
    res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_INVALID'
    });
    return;
  }

  next();
};

/**
 * Check if device is trusted (skip 2FA)
 */
export const requireTrustedDevice = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.session) {
    res.status(401).json({ error: 'No session found' });
    return;
  }

  if (!req.session.isTrusted) {
    res.status(403).json({
      error: 'Device not trusted',
      code: 'DEVICE_NOT_TRUSTED'
    });
    return;
  }

  next();
};

/**
 * IP whitelist middleware
 */
export const requireIPWhitelist = (allowedIPs: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!allowedIPs.includes(req.ip)) {
      res.status(403).json({
        error: 'Access denied from this IP',
        code: 'IP_NOT_ALLOWED'
      });
      return;
    }

    next();
  };
};

/**
 * Time-based access control
 */
export const requireTimeWindow = (
  startHour: number,
  endHour: number,
  timezone: string = 'UTC'
) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const now = new Date();
    const currentHour = now.getHours(); // Use server time, adjust for timezone as needed

    if (currentHour < startHour || currentHour > endHour) {
      res.status(403).json({
        error: 'Access denied outside allowed time window',
        code: 'TIME_WINDOW_RESTRICTED'
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has verified email
 */
export const requireEmailVerified = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Check email verification status (assuming it's in users table)
  req.db?.query(
    'SELECT email_verified FROM users WHERE id = $1',
    [req.user.id]
  ).then(result => {
    if (!result?.rows[0]?.email_verified) {
      res.status(403).json({
        error: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED'
      });
      return;
    }
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Failed to verify email status' });
  });
};

export { AuthRequest, JwtPayload };