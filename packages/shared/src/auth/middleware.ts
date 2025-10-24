// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

import { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware interface
 */
export interface AuthenticatedRequest extends Request {
  user?: any;
  session?: any;
}

/**
 * Authentication middleware
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Extract token from header
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    // Verify token and extract user
    const user = { id: 'user_id', role: 'user' }; // Placeholder
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Authorization middleware
 */
export function authorize(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    try {
      const user = { id: 'user_id', role: 'user' }; // Placeholder
      req.user = user;
    } catch (error) {
      // Token invalid but we continue without authentication
    }
  }

  next();
}