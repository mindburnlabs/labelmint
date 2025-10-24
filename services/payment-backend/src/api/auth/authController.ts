import { Request, Response } from 'express';
import { TokenService } from '../../services/auth/TokenService';
import { TwoFactorService } from '../../services/auth/TwoFactorService';
import { SessionService } from '../../services/auth/SessionService';
import { SecurityService } from '../../services/auth/SecurityService';
import { validate } from '../../middleware/validation';
import { postgresDb } from '../../services/database';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Initialize services
const tokenService = new TokenService();
const twoFactorService = new TwoFactorService();
const sessionService = new SessionService();
const securityService = new SecurityService();

// Initialize email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * User registration
 */
export const register = [
  validate({
    body: {
      email: {
        isEmail: true,
        normalizeEmail: true,
        isEmpty: { negated: true, errorMessage: 'Email is required' }
      },
      password: {
        isStrongPassword: {
          errorMessage: 'Password does not meet complexity requirements'
        },
        isLength: {
          options: { min: 12 },
          errorMessage: 'Password must be at least 12 characters long'
        },
        isEmpty: { negated: true, errorMessage: 'Password is required' }
      },
      firstName: {
        isEmpty: { negated: true, errorMessage: 'First name is required' }
      },
      lastName: {
        isEmpty: { negated: true, errorMessage: 'Last name is required' }
      }
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await postgresDb.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: 'User already exists',
          code: 'USER_EXISTS'
        });
      }

      // Check password complexity
      const passwordCheck = securityService.checkPasswordComplexity(password);
      if (!passwordCheck.isValid) {
        return res.status(400).json({
          error: 'Password does not meet requirements',
          code: 'WEAK_PASSWORD',
          details: passwordCheck.errors
        });
      }

      // Check if password has been breached
      const breachCheck = await securityService.checkPasswordBreach(password);
      if (breachCheck.isBreached) {
        return res.status(400).json({
          error: 'Password has been found in data breaches',
          code: 'BREACHED_PASSWORD'
        });
      }

      // Hash password
      const passwordHash = await securityService.hashPassword(password);

      // Create user
      const result = await postgresDb.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, email_verified)
        VALUES ($1, $2, $3, $4, false)
        RETURNING id, email, first_name, last_name, email_verified, created_at
      `, [email.toLowerCase(), passwordHash, firstName, lastName]);

      const user = result.rows[0];

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await postgresDb.query(`
        INSERT INTO email_verification_tokens (user_id, token, email, expires_at)
        VALUES ($1, $2, $3, $4)
      `, [user.id, verificationToken, email, expiresAt]);

      // Send verification email
      try {
        await emailTransporter.sendMail({
          from: process.env.FROM_EMAIL,
          to: email,
          subject: 'Verify your email address',
          html: `
            <h2>Welcome to Deligate.it!</h2>
            <p>Hi ${firstName},</p>
            <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
            <a href="${process.env.BASE_URL}/verify-email?token=${verificationToken}">
              Verify Email
            </a>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, please ignore this email.</p>
          `
        });
      } catch (error) {
        console.error('Failed to send verification email:', error);
      }

      // Log security event
      await securityService.logSecurityEvent({
        userId: user.id,
        action: 'user_registration',
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          emailVerified: user.email_verified
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  }
];

/**
 * Email verification
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        error: 'Verification token is required',
        code: 'TOKEN_MISSING'
      });
    }

    const result = await postgresDb.query(`
      UPDATE email_verification_tokens
      SET is_used = true, used_at = NOW()
      WHERE token = $1
      AND is_used = false
      AND expires_at > NOW()
      RETURNING user_id
    `, [token]);

    if (!result.rows.length) {
      return res.status(400).json({
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN'
      });
    }

    const userId = result.rows[0].user_id;

    // Mark email as verified
    await postgresDb.query(
      'UPDATE users SET email_verified = true WHERE id = $1',
      [userId]
    );

    // Log security event
    await securityService.logSecurityEvent({
      userId,
      action: 'email_verified',
      result: 'success',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Email verification failed',
      code: 'VERIFICATION_ERROR'
    });
  }
};

/**
 * User login
 */
export const login = [
  validate({
    body: {
      email: {
        isEmail: true,
        normalizeEmail: true,
        isEmpty: { negated: true, errorMessage: 'Email is required' }
      },
      password: {
        isEmpty: { negated: true, errorMessage: 'Password is required' }
      }
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { email, password, rememberMe = false } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check rate limit
      const rateLimitResult = await securityService.checkLoginRateLimit(email);
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Too many login attempts. Please try again later.',
          code: 'RATE_LIMITED'
        });
      }

      // Get user
      const userResult = await postgresDb.query(
        'SELECT * FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (!userResult.rows.length) {
        await securityService.recordLoginAttempt(
          email,
          false,
          ipAddress,
          userAgent,
          'invalid_credentials'
        );
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const user = userResult.rows[0];

      // Check if account is locked
      const accountLock = await securityService.isAccountLocked(user.id);
      if (accountLock.locked) {
        return res.status(423).json({
          error: 'Account is locked',
          code: 'ACCOUNT_LOCKED',
          reason: accountLock.reason,
          lockedUntil: accountLock.lockedUntil
        });
      }

      // Verify password
      const isValidPassword = await securityService.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        await securityService.recordLoginAttempt(
          email,
          false,
          ipAddress,
          userAgent,
          'invalid_password'
        );
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Generate device fingerprint
      const deviceFingerprint = sessionService.generateDeviceFingerprint(req);
      const deviceName = `${user.first_name}'s ${req.get('Sec-CH-UA-Platform') || 'Device'}`;

      // Create session
      const session = await sessionService.createSession(
        user.id,
        deviceFingerprint,
        ipAddress,
        userAgent,
        deviceName
      );

      // Generate tokens
      const tokens = await tokenService.generateTokenPair(
        user.id,
        deviceFingerprint,
        {
          ipAddress,
          userAgent,
          rememberMe
        }
      );

      // Record successful login
      await securityService.recordLoginAttempt(
        email,
        true,
        ipAddress,
        userAgent
      );

      // Check for suspicious activity
      await sessionService.detectSuspiciousActivity(user.id);

      // Log security event
      await securityService.logSecurityEvent({
        userId: user.id,
        action: 'login',
        result: 'success',
        ipAddress,
        userAgent,
        sessionId: session.id,
        details: {
          deviceFingerprint,
          rememberMe
        }
      });

      // Determine if 2FA is required
      const requires2FA = user.two_factor_enabled && !session.isTrusted;

      res.json({
        success: true,
        requiresTwoFactor: requires2FA,
        sessionId: session.id,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          twoFactorEnabled: user.two_factor_enabled
        },
        ...(requires2FA ? {} : tokens)
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }
];

/**
 * Complete 2FA verification
 */
export const verifyTwoFactor = [
  validate({
    body: {
      sessionId: {
        isEmpty: { negated: true, errorMessage: 'Session ID is required' }
      },
      token: {
        isEmpty: { negated: true, errorMessage: '2FA token is required' }
      },
      backupCode: {
        optional: true
      }
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, token, backupCode } = req.body;

      // Get session
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return res.status(401).json({
          error: 'Invalid session',
          code: 'INVALID_SESSION'
        });
      }

      // Get user
      const userResult = await postgresDb.query(
        'SELECT * FROM users WHERE id = $1',
        [session.userId]
      );

      if (!userResult.rows.length) {
        return res.status(401).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const user = userResult.rows[0];

      // Verify 2FA token
      let isValid = false;

      if (backupCode) {
        // Verify backup code
        isValid = await twoFactorService.verifyBackupCode(user.id, backupCode);
      } else {
        // Verify TOTP token
        isValid = twoFactorService.verifyToken(user.two_factor_secret, token);
      }

      if (!isValid) {
        // Check rate limit
        const rateLimitResult = await securityService.checkTwoFactorRateLimit(user.id.toString());
        if (!rateLimitResult.allowed) {
          return res.status(429).json({
            error: 'Too many 2FA attempts',
            code: 'RATE_LIMITED'
          });
        }

        return res.status(401).json({
          error: 'Invalid 2FA token',
          code: 'INVALID_2FA'
        });
      }

      // Generate tokens
      const tokens = await tokenService.generateTokenPair(
        user.id,
        session.deviceFingerprint,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );

      // Log security event
      await securityService.logSecurityEvent({
        userId: user.id,
        action: '2fa_verified',
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId
      });

      res.json({
        success: true,
        message: '2FA verification successful',
        ...tokens
      });
    } catch (error) {
      console.error('2FA verification error:', error);
      res.status(500).json({
        error: '2FA verification failed',
        code: 'TWO_FACTOR_ERROR'
      });
    }
  }
];

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token is required',
        code: 'TOKEN_MISSING'
      });
    }

    const tokens = await tokenService.refreshAccessToken(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      ...tokens
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed',
      code: 'REFRESH_FAILED'
    });
  }
};

/**
 * Setup 2FA
 */
export const setupTwoFactor = async (req: Request, res: Response) => {
  try {
    // This should be called after login
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(401).json({
        error: 'Session ID required',
        code: 'SESSION_MISSING'
      });
    }

    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(401).json({
        error: 'Invalid session',
        code: 'INVALID_SESSION'
      });
    }

    const userResult = await postgresDb.query(
      'SELECT email FROM users WHERE id = $1',
      [session.userId]
    );

    const setup = await twoFactorService.generateSetupQR(
      session.userId,
      userResult.rows[0].email
    );

    res.json({
      success: true,
      setup
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      error: 'Failed to setup 2FA',
      code: 'TWO_FACTOR_SETUP_ERROR'
    });
  }
};

/**
 * Enable 2FA
 */
export const enableTwoFactor = [
  validate({
    body: {
      sessionId: {
        isEmpty: { negated: true, errorMessage: 'Session ID is required' }
      },
      token: {
        isEmpty: { negated: true, errorMessage: 'Verification token is required' }
      }
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, token } = req.body;

      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return res.status(401).json({
          error: 'Invalid session',
          code: 'INVALID_SESSION'
        });
      }

      await twoFactorService.enableTwoFactor(session.userId, token);

      // Log security event
      await securityService.logSecurityEvent({
        userId: session.userId,
        action: '2fa_enabled',
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: '2FA enabled successfully'
      });
    } catch (error) {
      console.error('Enable 2FA error:', error);
      res.status(400).json({
        error: error.message || 'Failed to enable 2FA',
        code: 'TWO_FACTOR_ENABLE_ERROR'
      });
    }
  }
];

/**
 * Disable 2FA
 */
export const disableTwoFactor = [
  validate({
    body: {
      password: {
        isEmpty: { negated: true, errorMessage: 'Password is required' }
      }
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      const sessionId = req.headers['x-session-id'];

      if (!sessionId) {
        return res.status(401).json({
          error: 'Session ID required',
          code: 'SESSION_MISSING'
        });
      }

      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return res.status(401).json({
          error: 'Invalid session',
          code: 'INVALID_SESSION'
        });
      }

      // Verify password
      const userResult = await postgresDb.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [session.userId]
      );

      const isValidPassword = await securityService.verifyPassword(
        password,
        userResult.rows[0].password_hash
      );

      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid password',
          code: 'INVALID_PASSWORD'
        });
      }

      await twoFactorService.disableTwoFactor(session.userId, password);

      // Log security event
      await securityService.logSecurityEvent({
        userId: session.userId,
        action: '2fa_disabled',
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: '2FA disabled successfully'
      });
    } catch (error) {
      console.error('Disable 2FA error:', error);
      res.status(400).json({
        error: error.message || 'Failed to disable 2FA',
        code: 'TWO_FACTOR_DISABLE_ERROR'
      });
    }
  }
];

/**
 * Logout
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const sessionId = req.headers['x-session-id'];

    // Revoke refresh token if provided
    if (refreshToken) {
      try {
        const decoded = tokenService.decodeToken(refreshToken);
        if (decoded?.tokenId) {
          await tokenService.revokeRefreshToken(decoded.tokenId);
        }
      } catch (error) {
        // Ignore token errors during logout
      }
    }

    // Invalidate session
    if (sessionId) {
      await sessionService.invalidateSession(sessionId);
    }

    // Log security event
    if (req.user) {
      await securityService.logSecurityEvent({
        userId: req.user.id,
        action: 'logout',
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
};

/**
 * Get user sessions
 */
export const getSessions = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessions = await sessionService.getUserSessions(req.user.id);
    const trustedDevices = await sessionService.getTrustedDevices(req.user.id);

    res.json({
      success: true,
      sessions,
      trustedDevices
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to fetch sessions',
      code: 'SESSIONS_ERROR'
    });
  }
};

/**
 * Revoke session
 */
export const revokeSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify session belongs to user
    const session = await sessionService.getSession(sessionId);
    if (!session || session.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    await sessionService.invalidateSession(sessionId);

    // Log security event
    await securityService.logSecurityEvent({
      userId: req.user.id,
      action: 'session_revoked',
      result: 'success',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      error: 'Failed to revoke session',
      code: 'REVOKE_ERROR'
    });
  }
};

/**
 * Trust device
 */
export const trustDevice = [
  validate({
    body: {
      deviceName: {
        optional: true
      },
      expiresDays: {
        optional: true,
        isInt: { options: { min: 1, max: 365 } }
      }
    }
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.session) {
        return res.status(401).json({ error: 'No active session' });
      }

      const { deviceName, expiresDays = 30 } = req.body;

      await sessionService.trustDevice(
        req.user!.id,
        req.session.deviceFingerprint,
        deviceName,
        expiresDays
      );

      res.json({
        success: true,
        message: 'Device trusted successfully'
      });
    } catch (error) {
      console.error('Trust device error:', error);
      res.status(500).json({
        error: 'Failed to trust device',
        code: 'TRUST_DEVICE_ERROR'
      });
    }
  }
];

/**
 * Change password
 */
export const changePassword = [
  validate({
    body: {
      currentPassword: {
        isEmpty: { negated: true, errorMessage: 'Current password is required' }
      },
      newPassword: {
        isStrongPassword: {
          errorMessage: 'New password does not meet complexity requirements'
        },
        isEmpty: { negated: true, errorMessage: 'New password is required' }
      }
    }
  }),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { currentPassword, newPassword } = req.body;

      // Get current password hash
      const userResult = await postgresDb.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );

      if (!userResult.rows[0]) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValidPassword = await securityService.verifyPassword(
        currentPassword,
        userResult.rows[0].password_hash
      );

      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD'
        });
      }

      // Check new password complexity
      const passwordCheck = securityService.checkPasswordComplexity(newPassword);
      if (!passwordCheck.isValid) {
        return res.status(400).json({
          error: 'New password does not meet requirements',
          code: 'WEAK_PASSWORD',
          details: passwordCheck.errors
        });
      }

      // Check if new password is same as current
      const isSamePassword = await securityService.verifyPassword(
        newPassword,
        userResult.rows[0].password_hash
      );

      if (isSamePassword) {
        return res.status(400).json({
          error: 'New password must be different from current password',
          code: 'SAME_PASSWORD'
        });
      }

      // Hash new password
      const newPasswordHash = await securityService.hashPassword(newPassword);

      // Update password
      await postgresDb.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [newPasswordHash, req.user.id]
      );

      // Revoke all other sessions
      await tokenService.revokeAllUserTokens(req.user.id);

      // Log security event
      await securityService.logSecurityEvent({
        userId: req.user.id,
        action: 'password_changed',
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Password changed successfully. Please login again.'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        error: 'Failed to change password',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  }
];

/**
 * Request password reset
 */
export const requestPasswordReset = [
  validate({
    body: {
      email: {
        isEmail: true,
        normalizeEmail: true,
        isEmpty: { negated: true, errorMessage: 'Email is required' }
      }
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      // Check rate limit
      const rateLimitResult = await securityService.checkPasswordResetRateLimit(email);
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Too many password reset requests',
          code: 'RATE_LIMITED'
        });
      }

      // Get user
      const userResult = await postgresDb.query(
        'SELECT id, first_name FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (!userResult.rows.length) {
        // Don't reveal if user exists
        return res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link will be sent.'
        });
      }

      const user = userResult.rows[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

      await postgresDb.query(`
        INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          token = EXCLUDED.token,
          expires_at = EXCLUDED.expires_at,
          is_used = false,
          created_at = NOW()
      `, [user.id, resetToken, expiresAt, req.ip]);

      // Send reset email
      try {
        await emailTransporter.sendMail({
          from: process.env.FROM_EMAIL,
          to: email,
          subject: 'Reset your password',
          html: `
            <h2>Password Reset Request</h2>
            <p>Hi ${user.first_name},</p>
            <p>Click the link below to reset your password:</p>
            <a href="${process.env.BASE_URL}/reset-password?token=${resetToken}">
              Reset Password
            </a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
          `
        });
      } catch (error) {
        console.error('Failed to send reset email:', error);
      }

      // Log security event
      await securityService.logSecurityEvent({
        userId: user.id,
        action: 'password_reset_requested',
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link will be sent.'
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({
        error: 'Failed to process password reset request',
        code: 'RESET_REQUEST_ERROR'
      });
    }
  }
];

/**
 * Reset password
 */
export const resetPassword = [
  validate({
    body: {
      token: {
        isEmpty: { negated: true, errorMessage: 'Reset token is required' }
      },
      newPassword: {
        isStrongPassword: {
          errorMessage: 'Password does not meet complexity requirements'
        },
        isEmpty: { negated: true, errorMessage: 'New password is required' }
      }
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;

      // Get token from database
      const tokenResult = await postgresDb.query(`
        UPDATE password_reset_tokens
        SET is_used = true, used_at = NOW()
        WHERE token = $1
        AND is_used = false
        AND expires_at > NOW()
        RETURNING user_id
      `, [token]);

      if (!tokenResult.rows.length) {
        return res.status(400).json({
          error: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        });
      }

      const userId = tokenResult.rows[0].user_id;

      // Check password complexity
      const passwordCheck = securityService.checkPasswordComplexity(newPassword);
      if (!passwordCheck.isValid) {
        return res.status(400).json({
          error: 'Password does not meet requirements',
          code: 'WEAK_PASSWORD',
          details: passwordCheck.errors
        });
      }

      // Hash new password
      const passwordHash = await securityService.hashPassword(newPassword);

      // Update password
      await postgresDb.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [passwordHash, userId]
      );

      // Revoke all tokens for user
      await tokenService.revokeAllUserTokens(userId);

      // Log security event
      await securityService.logSecurityEvent({
        userId,
        action: 'password_reset_completed',
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.'
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({
        error: 'Failed to reset password',
        code: 'RESET_ERROR'
      });
    }
  }
];

/**
 * Get security events for user
 */
export const getSecurityEvents = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const events = await securityService.getUserSecurityEvents(req.user.id, limit, (page - 1) * limit);

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Get security events error:', error);
    res.status(500).json({
      error: 'Failed to fetch security events',
      code: 'SECURITY_EVENTS_ERROR'
    });
  }
};

/**
 * Generate CSRF token
 */
export const getCSRFToken = async (req: Request, res: Response) => {
  try {
    if (!req.sessionId) {
      return res.status(401).json({ error: 'No active session' });
    }

    const csrfToken = securityService.generateCSRFToken(req.sessionId);

    res.json({
      success: true,
      csrfToken
    });
  } catch (error) {
    console.error('Generate CSRF token error:', error);
    res.status(500).json({
      error: 'Failed to generate CSRF token',
      code: 'CSRF_ERROR'
    });
  }
};