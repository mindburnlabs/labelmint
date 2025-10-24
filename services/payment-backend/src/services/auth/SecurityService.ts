import { postgresDb } from '../database';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import config from '../../config';

export interface SecurityEvent {
  userId?: number;
  action: string;
  resource?: string;
  result: 'success' | 'failure' | 'blocked';
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  details?: any;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  maxConsecutiveChars: number;
  disallowedPatterns: string[];
}

export class SecurityService {
  private loginRateLimiter: RateLimiterMemory;
  private passwordResetRateLimiter: RateLimiterMemory;
  private twoFactorRateLimiter: RateLimiterMemory;
  private ipRateLimiter: Map<string, RateLimiterMemory> = new Map();

  constructor() {
    // Initialize rate limiters
    this.loginRateLimiter = new RateLimiterMemory({
      keyPrefix: 'login',
      points: 5, // Number of attempts
      duration: 900, // Per 15 minutes
      blockDuration: 900, // Block for 15 minutes
    });

    this.passwordResetRateLimiter = new RateLimiterMemory({
      keyPrefix: 'password_reset',
      points: 3, // Number of attempts
      duration: 3600, // Per hour
      blockDuration: 3600, // Block for 1 hour
    });

    this.twoFactorRateLimiter = new RateLimiterMemory({
      keyPrefix: '2fa',
      points: 5, // Number of attempts
      duration: 300, // Per 5 minutes
      blockDuration: 300, // Block for 5 minutes
    });
  }

  /**
   * Check password complexity
   */
  checkPasswordComplexity(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const policy: PasswordPolicy = {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true,
      maxConsecutiveChars: 3,
      disallowedPatterns: ['password', '123456', 'qwerty', 'admin']
    };

    // Check minimum length
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    // Check for uppercase letters
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase letters
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for numbers
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for special characters
    if (policy.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for consecutive characters
    for (let i = 0; i <= password.length - policy.maxConsecutiveChars; i++) {
      const substring = password.substring(i, i + policy.maxConsecutiveChars);
      if (/(.)\1{2,}/.test(substring)) {
        errors.push(`Password cannot contain ${policy.maxConsecutiveChars} or more consecutive identical characters`);
        break;
      }
    }

    // Check for common patterns
    const lowerPassword = password.toLowerCase();
    for (const pattern of policy.disallowedPatterns) {
      if (lowerPassword.includes(pattern)) {
        errors.push(`Password cannot contain common patterns like "${pattern}"`);
        break;
      }
    }

    // Check password strength score
    const strength = this.calculatePasswordStrength(password);
    if (strength < 3) {
      errors.push('Password is too weak. Please use a stronger password.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate password strength (0-5)
   */
  private calculatePasswordStrength(password: string): number {
    let strength = 0;

    // Length contribution
    if (password.length >= 12) strength += 1;
    if (password.length >= 16) strength += 1;

    // Character variety
    if (/[a-z]/.test(password)) strength += 0.5;
    if (/[A-Z]/.test(password)) strength += 0.5;
    if (/\d/.test(password)) strength += 0.5;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 1;

    // Complexity
    if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) strength += 0.5;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 0.5;

    return Math.min(Math.round(strength * 2) / 2, 5); // Round to nearest 0.5, max 5
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Check login rate limit
   */
  async checkLoginRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const result = await this.loginRateLimiter.consume(identifier);
      return { allowed: true, remaining: result.remainingPoints };
    } catch (rejRes) {
      return { allowed: false, remaining: 0 };
    }
  }

  /**
   * Check password reset rate limit
   */
  async checkPasswordResetRateLimit(email: string): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const result = await this.passwordResetRateLimiter.consume(email);
      return { allowed: true, remaining: result.remainingPoints };
    } catch (rejRes) {
      return { allowed: false, remaining: 0 };
    }
  }

  /**
   * Check 2FA rate limit
   */
  async checkTwoFactorRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const result = await this.twoFactorRateLimiter.consume(userId);
      return { allowed: true, remaining: result.remainingPoints };
    } catch (rejRes) {
      return { allowed: false, remaining: 0 };
    }
  }

  /**
   * Check IP rate limit
   */
  async checkIPRateLimit(ip: string, endpoint: string, maxRequests = 100, windowMs = 60000): Promise<boolean> {
    if (!this.ipRateLimiter.has(ip)) {
      this.ipRateLimiter.set(ip, new RateLimiterMemory({
        keyPrefix: `ip_${endpoint}`,
        points: maxRequests,
        duration: windowMs / 1000,
      }));
    }

    const limiter = this.ipRateLimiter.get(ip)!;

    try {
      await limiter.consume(ip);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Record login attempt
   */
  async recordLoginAttempt(
    email: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    failureReason?: string
  ): Promise<void> {
    await postgresDb.query(`
      INSERT INTO login_attempts (
        email, ip_address, user_agent, success, failure_reason
      )
      VALUES ($1, $2, $3, $4, $5)
    `, [email, ipAddress, userAgent, failureReason]);

    // Log security event
    await this.logSecurityEvent({
      action: 'login_attempt',
      result: success ? 'success' : 'failure',
      ipAddress,
      userAgent,
      details: {
        email,
        failureReason
      }
    });

    // Check for brute force
    if (!success) {
      await this.checkBruteForce(email, ipAddress);
    }
  }

  /**
   * Check for brute force attack
   */
  private async checkBruteForce(email: string, ipAddress?: string): Promise<void> {
    const recentAttempts = await postgresDb.query(`
      SELECT COUNT(*) as attempts
      FROM login_attempts
      WHERE email = $1
      AND success = false
      AND attempted_at > NOW() - INTERVAL '15 minutes'
    `, [email]);

    const attempts = parseInt(recentAttempts.rows[0].attempts);
    const maxAttempts = 5; // From system settings

    if (attempts >= maxAttempts) {
      await this.lockUserAccount(email, 'brute_force', 'Too many failed login attempts');
    }

    // Also check IP-based attempts
    if (ipAddress) {
      const ipAttempts = await postgresDb.query(`
        SELECT COUNT(*) as attempts
        FROM login_attempts
        WHERE ip_address = $1
        AND success = false
        AND attempted_at > NOW() - INTERVAL '15 minutes'
      `, [ipAddress]);

      const ipAttemptCount = parseInt(ipAttempts.rows[0].attempts);
      if (ipAttemptCount >= maxAttempts * 2) { // Higher threshold for IP
        // Log IP for potential blocking at firewall level
        await this.logSecurityEvent({
          action: 'suspicious_ip_activity',
          result: 'blocked',
          ipAddress,
          details: {
            email,
            attempts: ipAttemptCount
          }
        });
      }
    }
  }

  /**
   * Lock user account
   */
  async lockUserAccount(
    email: string,
    lockType: 'brute_force' | 'suspicious_activity' | 'admin_action',
    reason: string,
    lockDurationMinutes: number = 15,
    lockedBy?: number
  ): Promise<void> {
    // Get user ID
    const userResult = await postgresDb.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (!userResult.rows[0]) {
      return;
    }

    const userId = userResult.rows[0].id;
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + lockDurationMinutes);

    // Check if already locked
    const existingLock = await postgresDb.query(`
      SELECT id FROM account_lockouts
      WHERE user_id = $1
      AND is_active = true
      AND locked_until > NOW()
    `, [userId]);

    if (existingLock.rows.length > 0) {
      // Extend existing lock
      await postgresDb.query(`
        UPDATE account_lockouts
        SET locked_until = $1, reason = $2, updated_at = NOW()
        WHERE id = $3
      `, [lockedUntil, reason, existingLock.rows[0].id]);
    } else {
      // Create new lock
      await postgresDb.query(`
        INSERT INTO account_lockouts (
          user_id, lock_type, reason, locked_until, created_by
        )
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, lockType, reason, lockedUntil, lockedBy]);
    }

    // Log security event
    await this.logSecurityEvent({
      userId,
      action: 'account_locked',
      result: 'blocked',
      details: {
        lockType,
        reason,
        lockedUntil
      }
    });

    // Send notification to user
    await this.sendSecurityNotification(userId, 'account_locked', {
      reason,
      lockedUntil
    });
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(userId: number): Promise<{ locked: boolean; reason?: string; lockedUntil?: Date }> {
    const result = await postgresDb.query(`
      SELECT * FROM account_lockouts
      WHERE user_id = $1
      AND is_active = true
      AND locked_until > NOW()
    `, [userId]);

    if (result.rows.length > 0) {
      const lock = result.rows[0];
      return {
        locked: true,
        reason: lock.reason,
        lockedUntil: lock.locked_until
      };
    }

    return { locked: false };
  }

  /**
   * Unlock user account
   */
  async unlockUserAccount(userId: number, unlockedBy?: number): Promise<void> {
    await postgresDb.query(`
      UPDATE account_lockouts
      SET is_active = false
      WHERE user_id = $1
      AND is_active = true
    `, [userId]);

    // Log security event
    await this.logSecurityEvent({
      userId,
      action: 'account_unlocked',
      result: 'success',
      details: {
        unlockedBy
      }
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    await postgresDb.query(`
      INSERT INTO security_audit_log (
        user_id, action, resource, result, ip_address,
        user_agent, session_id, details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      event.userId,
      event.action,
      event.resource,
      event.result,
      event.ipAddress,
      event.userAgent,
      event.sessionId,
      event.details ? JSON.stringify(event.details) : null
    ]);
  }

  /**
   * Get recent security events for user
   */
  async getUserSecurityEvents(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    const result = await postgresDb.query(`
      SELECT * FROM security_audit_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    return result.rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null
    }));
  }

  /**
   * Get suspicious activity report
   */
  async getSuspiciousActivityReport(hours: number = 24): Promise<any> {
    const result = await postgresDb.query(`
      SELECT
        COUNT(*) FILTER (WHERE action = 'login_attempt' AND result = 'failure') as failed_logins,
        COUNT(*) FILTER (WHERE action = 'account_locked') as account_locks,
        COUNT(*) FILTER (WHERE action = 'suspicious_ip_activity') as suspicious_ips,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM security_audit_log
      WHERE created_at > NOW() - INTERVAL '${hours} hours'
    `);

    // Get top suspicious IPs
    const topIpsResult = await postgresDb.query(`
      SELECT
        ip_address,
        COUNT(*) as events,
        COUNT(*) FILTER (WHERE result = 'failure') as failures
      FROM security_audit_log
      WHERE created_at > NOW() - INTERVAL '${hours} hours'
      AND ip_address IS NOT NULL
      GROUP BY ip_address
      HAVING COUNT(*) FILTER (WHERE result = 'failure') > 5
      ORDER BY failures DESC
      LIMIT 10
    `);

    return {
      summary: result.rows[0],
      suspiciousIPs: topIpsResult.rows
    };
  }

  /**
   * Check password against breach database
   */
  async checkPasswordBreach(password: string): Promise<{ isBreached: boolean; count: number }> {
    // In production, integrate with HaveIBeenPwned API
    // For demo, check against common breached passwords list
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', 'dragon', 'master'
    ];

    const isBreached = commonPasswords.includes(password.toLowerCase());

    return {
      isBreached,
      count: isBreached ? 1 : 0
    };
  }

  /**
   * Send security notification to user
   */
  private async sendSecurityNotification(
    userId: number,
    type: string,
    data: any
  ): Promise<void> {
    // Implementation depends on notification service
    console.log(`Security notification sent to user ${userId}: ${type}`, data);

    // Could integrate with email, SMS, or push notifications
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(sessionId: string): string {
    const timestamp = Date.now();
    const data = `${sessionId}:${timestamp}`;
    const signature = crypto
      .createHmac('sha256', config.jwt.secret)
      .update(data)
      .digest('hex');

    return `${data}:${signature}`;
  }

  /**
   * Verify CSRF token
   */
  verifyCSRFToken(token: string, sessionId: string): boolean {
    const [storedSessionId, timestamp, signature] = token.split(':');

    if (storedSessionId !== sessionId) {
      return false;
    }

    // Check token age (should be less than 1 hour)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 3600000) {
      return false;
    }

    // Verify signature
    const data = `${storedSessionId}:${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.jwt.secret)
      .update(data)
      .digest('hex');

    return signature === expectedSignature;
  }
}