import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';
import { auditService } from '../services/audit/AuditService';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JWTPayload {
  userId: string;
  sessionId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    sessionId: string;
  };
  session?: {
    id: string;
    userId: string;
    isActive: boolean;
    lastActivity: Date;
  };
}

export class SecureAuthService {
  private prisma: PrismaClient;
  private logger: Logger;
  private static instance: SecureAuthService;

  constructor() {
    this.prisma = new PrismaClient();
    this.logger = new Logger('SecureAuthService');
  }

  static getInstance(): SecureAuthService {
    if (!SecureAuthService.instance) {
      SecureAuthService.instance = new SecureAuthService();
    }
    return SecureAuthService.instance;
  }

  /**
   * Generate secure token pair with httpOnly cookie support
   */
  async generateTokenPair(userId: string, sessionId?: string): Promise<TokenPair> {
    const sessionIdToUse = sessionId || crypto.randomUUID();

    const accessTokenPayload: JWTPayload = {
      userId,
      sessionId: sessionIdToUse,
      type: 'access'
    };

    const refreshTokenPayload: JWTPayload = {
      userId,
      sessionId: sessionIdToUse,
      type: 'refresh'
    };

    const accessToken = jwt.sign(
      accessTokenPayload,
      process.env.JWT_ACCESS_SECRET!,
      {
        expiresIn: '15m',
        issuer: 'labelmint-api',
        audience: 'labelmint-client',
        algorithm: 'HS256'
      }
    );

    const refreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.JWT_REFRESH_SECRET!,
      {
        expiresIn: '7d',
        issuer: 'labelmint-api',
        audience: 'labelmint-client',
        algorithm: 'HS256'
      }
    );

    // Store session in database
    await this.prisma.userSession.upsert({
      where: { id: sessionIdToUse },
      update: {
        isActive: true,
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      },
      create: {
        id: sessionIdToUse,
        userId,
        isActive: true,
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: '',
        ipAddress: ''
      }
    });

    await auditService.logAuthEvent({
      userId,
      action: 'TOKEN_REFRESH',
      success: true,
      mfaUsed: false
    });

    return { accessToken, refreshToken };
  }

  /**
   * Set secure httpOnly cookies
   */
  setSecureCookies(res: Response, tokens: TokenPair): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token cookie (httpOnly, secure, sameSite)
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    });

    // Refresh token cookie (httpOnly, secure, sameSite)
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    });

    // CSRF token cookie (not httpOnly, needed for frontend)
    const csrfToken = crypto.randomUUID();
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    });

    // Store CSRF token in session for validation
    // This would be stored in Redis or database in production
  }

  /**
   * Clear authentication cookies
   */
  clearAuthCookies(res: Response): void {
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    });

    res.clearCookie('csrf_token', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    });
  }

  /**
   * Authenticate user with secure password handling
   */
  async authenticateUser(
    identifier: string, // username or email
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: any; tokens: TokenPair } | null> {
    try {
      // Find user by email or username
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: identifier },
            { username: identifier }
          ]
        },
        select: {
          id: true,
          username: true,
          email: true,
          passwordHash: true,
          role: true,
          isActive: true,
          failedLoginAttempts: true,
          lockedUntil: true
        }
      });

      if (!user) {
        await auditService.logAuthEvent({
          action: 'LOGIN',
          success: false,
          failureReason: 'USER_NOT_FOUND',
          ipAddress,
          userAgent
        });
        return null;
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await auditService.logAuthEvent({
          userId: user.id,
          action: 'LOGIN',
          success: false,
          failureReason: 'ACCOUNT_LOCKED',
          ipAddress,
          userAgent
        });
        return null;
      }

      // Check if account is active
      if (!user.isActive) {
        await auditService.logAuthEvent({
          userId: user.id,
          action: 'LOGIN',
          success: false,
          failureReason: 'ACCOUNT_INACTIVE',
          ipAddress,
          userAgent
        });
        return null;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        // Increment failed login attempts
        const newAttempts = user.failedLoginAttempts + 1;
        const maxAttempts = 5;

        let updateData: any = {
          failedLoginAttempts: newAttempts
        };

        // Lock account after max attempts
        if (newAttempts >= maxAttempts) {
          updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        }

        await this.prisma.user.update({
          where: { id: user.id },
          data: updateData
        });

        await auditService.logAuthEvent({
          userId: user.id,
          action: 'LOGIN',
          success: false,
          failureReason: 'INVALID_PASSWORD',
          ipAddress,
          userAgent
        });

        return null;
      }

      // Reset failed login attempts on successful login
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date()
        }
      });

      // Generate tokens
      const tokens = await this.generateTokenPair(user.id);

      await auditService.logAuthEvent({
        userId: user.id,
        action: 'LOGIN',
        success: true,
        ipAddress,
        userAgent
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        tokens
      };

    } catch (error) {
      this.logger.error('Authentication error', error);
      return null;
    }
  }

  /**
   * Verify access token from cookie
   */
  async verifyAccessToken(token: string): Promise<JWTPayload | null> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JWTPayload;

      if (decoded.type !== 'access') {
        return null;
      }

      // Check if session is still active
      const session = await this.prisma.userSession.findUnique({
        where: { id: decoded.sessionId }
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JWTPayload;

      if (decoded.type !== 'refresh') {
        return null;
      }

      // Check if session is still active
      const session = await this.prisma.userSession.findUnique({
        where: { id: decoded.sessionId }
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        // Invalidate session if expired
        if (session) {
          await this.prisma.userSession.update({
            where: { id: session.id },
            data: { isActive: false }
          });
        }
        return null;
      }

      // Generate new token pair
      return await this.generateTokenPair(decoded.userId, decoded.sessionId);

    } catch (error) {
      return null;
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(sessionId: string, userId: string): Promise<void> {
    try {
      // Invalidate session
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          invalidatedAt: new Date()
        }
      });

      await auditService.logAuthEvent({
        userId,
        action: 'LOGOUT',
        success: true
      });
    } catch (error) {
      this.logger.error('Logout error', error);
    }
  }

  /**
   * Logout all sessions for a user
   */
  async logoutAllSessions(userId: string): Promise<void> {
    try {
      await this.prisma.userSession.updateMany({
        where: { userId },
        data: {
          isActive: false,
          invalidatedAt: new Date()
        }
      });

      await auditService.logAuthEvent({
        userId,
        action: 'LOGOUT_ALL',
        success: true
      });
    } catch (error) {
      this.logger.error('Logout all sessions error', error);
    }
  }
}

// Middleware functions

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies.access_token;

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const authService = SecureAuthService.getInstance();
    const decoded = await authService.verifyAccessToken(token);

    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    // Get session details
    const session = await prisma.userSession.findUnique({
      where: { id: decoded.sessionId }
    });

    req.user = {
      ...user,
      sessionId: decoded.sessionId
    };
    req.session = session || undefined;

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
  }
};

export const requireRole = (roles: string[]) => {
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
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] as string;
  const cookieToken = req.cookies.csrf_token;

  if (!csrfToken || csrfToken !== cookieToken) {
    res.status(403).json({ error: 'CSRF token validation failed' });
    return;
  }

  next();
};

export const secureAuthService = SecureAuthService.getInstance();