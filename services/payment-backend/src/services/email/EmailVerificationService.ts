import { Logger } from '../../utils/logger';
import { postgresDb } from '../../database';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { EmailService } from './EmailService';

const logger = new Logger('EmailVerification');

export class EmailVerificationService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(email: string): Promise<void> {
    try {
      // Generate verification token
      const token = this.generateVerificationToken(email);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store verification record
      await postgresDb.query(
        `INSERT INTO email_verifications
         (email, token, type, expires_at, created_at)
         VALUES ($1, $2, 'email_verification', $3, NOW())
         ON CONFLICT (email) DO UPDATE SET
         token = EXCLUDED.token,
         expires_at = EXCLUDED.expires_at,
         attempts = email_verifications.attempts + 1,
         created_at = NOW()`,
        [email, token, expiresAt]
      );

      // Send verification email
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

      await this.emailService.sendEmail({
        to: email,
        subject: 'Verify Your Email Address',
        template: 'email-verification',
        data: {
          verificationUrl,
          email
        }
      });

      logger.info(`Email verification sent to: ${email}`);

    } catch (error) {
      logger.error('Send email verification error:', error);
      throw error;
    }
  }

  /**
   * Verify email token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string; userId?: string }> {
    try {
      // Get verification record
      const result = await postgresDb.query(
        `SELECT * FROM email_verifications
         WHERE token = $1 AND type = 'email_verification'
         AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [token]
      );

      if (!result.rows.length) {
        return {
          success: false,
          message: 'Invalid or expired verification token'
        };
      }

      const verification = result.rows[0];

      // Check if already verified
      const userResult = await postgresDb.query(
        'SELECT id, email_verified FROM users WHERE email = $1',
        [verification.email]
      );

      if (!userResult.rows.length) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const user = userResult.rows[0];

      if (user.email_verified) {
        return {
          success: false,
          message: 'Email already verified'
        };
      }

      // Mark email as verified
      await postgresDb.query('BEGIN');

      try {
        // Update user
        await postgresDb.query(
          `UPDATE users
           SET email_verified = true, email_verified_at = NOW()
           WHERE id = $1`,
          [user.id]
        );

        // Delete verification record
        await postgresDb.query(
          'DELETE FROM email_verifications WHERE id = $1',
          [verification.id]
        );

        // Log verification
        await postgresDb.query(
          `INSERT INTO audit_log
           (user_id, action, details, ip_address, user_agent, created_at)
           VALUES ($1, 'email_verified', $2, $3, $4, NOW())`,
          [
            user.id,
            'Email verified successfully',
            JSON.stringify({ token, timestamp: new Date().toISOString() }),
            'N/A', // Would come from request
            'N/A' // Would come from request
          ]
        );

        await postgresDb.query('COMMIT');

        logger.info(`Email verified for user: ${user.id}`);

        return {
          success: true,
          message: 'Email verified successfully',
          userId: user.id
        };

      } catch (error) {
        await postgresDb.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      logger.error('Verify email error:', error);
      return {
        success: false,
        message: 'Failed to verify email'
      };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      // Check if user exists
      const userResult = await postgresDb.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (!userResult.rows.length) {
        // Still return success to prevent email enumeration
        logger.info(`Password reset requested for non-existent email: ${email}`);
        return;
      }

      // Generate reset token
      const token = this.generateResetToken(email);
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

      // Store reset record
      await postgresDb.query(
        `INSERT INTO email_verifications
         (email, token, type, expires_at, created_at)
         VALUES ($1, $2, 'password_reset', $3, NOW())
         ON CONFLICT (email, type) DO UPDATE SET
         token = EXCLUDED.token,
         expires_at = EXCLUDED.expires_at,
         attempts = email_verifications.attempts + 1,
         created_at = NOW()`,
        [email, token, expiresAt]
      );

      // Send reset email
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

      await this.emailService.sendEmail({
        to: email,
        subject: 'Reset Your Password',
        template: 'password-reset',
        data: {
          resetUrl,
          email
        }
      });

      logger.info(`Password reset email sent to: ${email}`);

    } catch (error) {
      logger.error('Send password reset error:', error);
      throw error;
    }
  }

  /**
   * Verify password reset token
   */
  async verifyPasswordReset(token: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      const result = await postgresDb.query(
        `SELECT * FROM email_verifications
         WHERE token = $1 AND type = 'password_reset'
         AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [token]
      );

      if (!result.rows.length) {
        return {
          success: false,
          message: 'Invalid or expired reset token'
        };
      }

      const verification = result.rows[0];

      return {
        success: true,
        message: 'Reset token is valid',
        email: verification.email
      };

    } catch (error) {
      logger.error('Verify password reset error:', error);
      return {
        success: false,
        message: 'Failed to verify reset token'
      };
    }
  }

  /**
   * Resend verification email
   */
  async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check rate limit
      const result = await postgresDb.query(
        `SELECT COUNT(*) as attempts
         FROM email_verifications
         WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [email]
      );

      if (parseInt(result.rows[0].attempts) >= 5) {
        return {
          success: false,
          message: 'Too many verification attempts. Please try again later.'
        };
      }

      await this.sendEmailVerification(email);

      return {
        success: true,
        message: 'Verification email sent successfully'
      };

    } catch (error) {
      logger.error('Resend verification error:', error);
      return {
        success: false,
        message: 'Failed to resend verification email'
      };
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await postgresDb.query(
        'DELETE FROM email_verifications WHERE expires_at < NOW()'
      );

      logger.info(`Cleaned up ${result.rowCount} expired verification tokens`);

    } catch (error) {
      logger.error('Cleanup expired tokens error:', error);
    }
  }

  /**
   * Generate verification token
   */
  private generateVerificationToken(email: string): string {
    const payload = {
      email,
      type: 'email_verification',
      timestamp: Date.now()
    };

    return jwt.sign(payload, process.env.EMAIL_VERIFICATION_SECRET!, {
      expiresIn: '24h'
    });
  }

  /**
   * Generate password reset token
   */
  private generateResetToken(email: string): string {
    const payload = {
      email,
      type: 'password_reset',
      timestamp: Date.now()
    };

    return jwt.sign(payload, process.env.PASSWORD_RESET_SECRET!, {
      expiresIn: '1h'
    });
  }

  /**
   * Verify JWT token
   */
  private verifyToken(token: string, secret: string): any {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate secure random string
   */
  private generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}