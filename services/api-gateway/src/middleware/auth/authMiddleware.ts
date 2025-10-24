import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthConfig } from '@types/index';
import config from '@config/index';
import { createError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

// Mock API keys database (in production, use a proper database)
const API_KEYS = new Map([
  ['prod_key_123', { id: '1', name: 'Production Key', permissions: ['read', 'write'], rateLimit: { max: 1000, windowMs: 60000 } }],
  ['dev_key_456', { id: '2', name: 'Development Key', permissions: ['read'], rateLimit: { max: 100, windowMs: 60000 } }],
  ['test_key_789', { id: '3', name: 'Test Key', permissions: ['read', 'write'], rateLimit: { max: 50, windowMs: 60000 } }]
]);

// Mock user database (in production, use a proper database)
const USERS = new Map([
  ['user123', { id: 'user123', email: 'user@example.com', role: 'user', permissions: ['read:own', 'write:own'] }],
  ['admin456', { id: 'admin456', email: 'admin@example.com', role: 'admin', permissions: ['read:all', 'write:all', 'admin'] }],
  ['moderator789', { id: 'moderator789', email: 'mod@example.com', role: 'moderator', permissions: ['read:all', 'moderate'] }]
]);

interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
  aud: string;
  iss: string;
}

class AuthMiddleware {
  private config: AuthConfig;

  constructor() {
    this.config = config.auth;
  }

  middleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const correlationId = (req as any).correlationId;

    try {
      // Check for API key first
      const apiKey = this.extractApiKey(req);
      if (apiKey) {
        const keyData = API_KEYS.get(apiKey);
        if (!keyData) {
          throw createError('Invalid API key', 401, 'INVALID_API_KEY');
        }

        req.apiKey = keyData;
        logger.debug('API key authenticated', { apiKeyId: keyData.id, correlationId });
        return next();
      }

      // Check for JWT token
      const token = this.extractToken(req);
      if (!token) {
        throw createError('Authentication required', 401, 'AUTH_REQUIRED');
      }

      // Verify JWT token
      const payload = this.verifyToken(token);
      const userData = USERS.get(payload.sub);

      if (!userData) {
        throw createError('User not found', 401, 'USER_NOT_FOUND');
      }

      req.user = userData;
      logger.debug('JWT authenticated', { userId: userData.id, role: userData.role, correlationId });

      next();

    } catch (error: any) {
      logger.warn('Authentication failed', {
        error: error.message,
        correlationId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      if (error.name === 'JsonWebTokenError') {
        next(createError('Invalid token', 401, 'INVALID_TOKEN'));
      } else if (error.name === 'TokenExpiredError') {
        next(createError('Token expired', 401, 'TOKEN_EXPIRED'));
      } else {
        next(error);
      }
    }
  };

  private extractToken(req: Request): string | null {
    const authHeader = req.get('Authorization');
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  private extractApiKey(req: Request): string | null {
    // Check header first
    const headerKey = req.get(this.config.apiKeys.headerName);
    if (headerKey) return headerKey;

    // Check query parameter
    const queryKey = req.query[this.config.apiKeys.queryParam] as string;
    if (queryKey) return queryKey;

    return null;
  }

  private verifyToken(token: string): JWTPayload {
    return jwt.verify(token, this.config.jwt.secret, {
      algorithms: this.config.jwt.algorithms as jwt.Algorithm[],
      audience: this.config.jwt.audience,
      issuer: this.config.jwt.issuer
    }) as JWTPayload;
  }

  // Role-based access control
  requireRole = (roles: string | string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user && !req.apiKey) {
        return next(createError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      const userRole = req.user?.role;
      const apiKeyPermissions = req.apiKey?.permissions;

      if (userRole && requiredRoles.includes(userRole)) {
        return next();
      }

      if (apiKeyPermissions && apiKeyPermissions.some(p => requiredRoles.includes(p))) {
        return next();
      }

      next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    };
  };

  // Permission-based access control
  requirePermission = (permissions: string | string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user && !req.apiKey) {
        return next(createError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
      const userPermissions = req.user?.permissions || [];
      const apiKeyPermissions = req.apiKey?.permissions || [];

      const hasPermission = requiredPermissions.some(permission => {
        // Check user permissions
        if (userPermissions.some(p => this.matchesPermission(p, permission))) {
          return true;
        }

        // Check API key permissions
        if (apiKeyPermissions.some(p => this.matchesPermission(p, permission))) {
          return true;
        }

        return false;
      });

      if (!hasPermission) {
        return next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
      }

      next();
    };
  };

  private matchesPermission(userPermission: string, requiredPermission: string): boolean {
    // Exact match
    if (userPermission === requiredPermission) {
      return true;
    }

    // Wildcard permissions
    if (userPermission.endsWith(':*')) {
      const prefix = userPermission.slice(0, -2);
      return requiredPermission.startsWith(prefix + ':');
    }

    // Admin has all permissions
    if (userPermission === 'admin') {
      return true;
    }

    return false;
  }

  // Optional authentication (doesn't fail if no auth provided)
  optional = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = this.extractToken(req);
    const apiKey = this.extractApiKey(req);

    if (!token && !apiKey) {
      return next();
    }

    this.middleware(req, res, next);
  };
}

export const authMiddleware = new AuthMiddleware().middleware;
export const requireRole = (new AuthMiddleware()).requireRole;
export const requirePermission = (new AuthMiddleware()).requirePermission;
export const optionalAuth = (new AuthMiddleware()).optional;