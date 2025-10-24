# Enhanced Authentication System Integration Guide

## Overview

The enhanced authentication system provides enterprise-grade security with multiple layers of protection including 2FA, secure token management, session monitoring, and real-time threat detection.

## Architecture

### Core Components

1. **TwoFactorService** (`/services/auth/TwoFactorService.ts`)
   - TOTP-based 2FA using otplib
   - QR code generation for easy setup
   - Backup and recovery codes
   - SMS verification support

2. **TokenService** (`/services/auth/TokenService.ts`)
   - JWT access and refresh tokens
   - Automatic token rotation
   - Device fingerprinting
   - Session management

3. **SecurityService** (`/services/auth/SecurityService.ts`)
   - Password complexity validation
   - Brute force protection
   - Account lockout mechanisms
   - Security audit logging

4. **SecurityMonitorService** (`/services/SecurityMonitorService.ts`)
   - Real-time threat monitoring
   - Automated incident response
   - Daily security reports
   - IP blocking and suspicious activity detection

5. **Enhanced Validation** (`/middleware/enhancedValidation.ts`)
   - Advanced input validation
   - SQL injection prevention
   - XSS protection
   - File upload security

## Integration Examples

### 1. Complete Login Flow with 2FA

```typescript
// LoginController.ts
import { TwoFactorService } from '../services/auth/TwoFactorService';
import { TokenService } from '../services/auth/TokenService';
import { SecurityService } from '../services/auth/SecurityService';
import securityMonitor from '../services/SecurityMonitorService';

export class AuthController {
  private twoFactorService = new TwoFactorService();
  private tokenService = new TokenService();
  private securityService = new SecurityService();

  async login(req: Request, res: Response) {
    const { email, password, twoFactorToken, deviceInfo } = req.body;
    const ip = req.ip;

    try {
      // Check rate limits
      const rateLimit = await this.securityService.checkLoginRateLimit(email);
      if (!rateLimit.allowed) {
        await securityMonitor.triggerAlert({
          type: 'brute_force',
          severity: 'high',
          message: `Rate limit exceeded for ${email}`,
          data: { email, ip }
        });
        return res.status(429).json({ error: 'Too many attempts' });
      }

      // Verify credentials
      const user = await this.verifyCredentials(email, password);
      if (!user) {
        await this.securityService.recordLoginAttempt(email, false, ip);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if account is locked
      const lockStatus = await this.securityService.isAccountLocked(user.id);
      if (lockStatus.locked) {
        return res.status(423).json({
          error: 'Account locked',
          lockedUntil: lockStatus.lockedUntil
        });
      }

      // Check 2FA requirement
      const twoFactorStatus = await this.twoFactorService.getTwoFactorStatus(user.id);
      if (twoFactorStatus.enabled && !twoFactorToken) {
        return res.status(202).json({
          requiresTwoFactor: true,
          method: twoFactorStatus.method
        });
      }

      // Verify 2FA token if provided
      if (twoFactorStatus.enabled && twoFactorToken) {
        const isValid2FA = await this.twoFactorService.verifyTwoFactorToken(
          user.id,
          twoFactorToken
        );
        if (!isValid2FA) {
          await securityMonitor.triggerAlert({
            type: 'multiple_failed_2fa',
            severity: 'high',
            message: 'Failed 2FA attempt',
            data: { userId: user.id, ip }
          });
          return res.status(401).json({ error: 'Invalid 2FA token' });
        }
      }

      // Generate token pair
      const tokenPair = await this.tokenService.generateTokenPair(
        user.id,
        deviceInfo?.deviceId || crypto.randomUUID(),
        deviceInfo
      );

      // Record successful login
      await this.securityService.recordLoginAttempt(email, true, ip);
      await securityMonitor.logSecurityEvent({
        userId: user.id,
        action: 'login_success',
        result: 'success',
        ipAddress: ip,
        userAgent: req.get('User-Agent'),
        sessionId: tokenPair.sessionId
      });

      res.json({
        user: { id: user.id, email: user.email },
        tokens: tokenPair,
        requiresTwoFactor: false
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async refreshToken(req: Request, res: Response) {
    const { refreshToken, sessionId } = req.body;
    const ip = req.ip;

    try {
      // Validate refresh token
      const tokenValidation = await this.tokenService.validateRefreshToken(
        refreshToken,
        sessionId
      );

      if (!tokenValidation.valid) {
        return res.status(401).json({
          error: 'Invalid refresh token',
          reason: tokenValidation.reason
        });
      }

      // Check session
      const session = await this.tokenService.getSession(sessionId);
      if (!session || !session.isActive) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      // Check if session requires re-authentication
      if (this.tokenService.shouldRotateSession(session)) {
        await securityMonitor.triggerAlert({
          type: 'suspicious_session',
          severity: 'medium',
          message: 'Session rotation required',
          data: { sessionId, userId: session.userId }
        });
        return res.status(401).json({
          error: 'Session expired',
          requiresReauth: true
        });
      }

      // Generate new token pair
      const tokenPair = await this.tokenService.rotateTokens(
        session.userId,
        sessionId
      );

      res.json({ tokens: tokenPair });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

### 2. Setting Up 2FA

```typescript
// TwoFactorController.ts
export class TwoFactorController {
  private twoFactorService = new TwoFactorService();

  async initiateSetup(req: Request, res: Response) {
    const userId = req.user.id;
    const email = req.user.email;

    try {
      // Check if 2FA already enabled
      const status = await this.twoFactorService.getTwoFactorStatus(userId);
      if (status.enabled) {
        return res.status(400).json({ error: '2FA already enabled' });
      }

      // Generate setup QR code
      const setup = await this.twoFactorService.generateSetupQR(userId, email);

      res.json({
        qrCode: setup.qrCode,
        secret: setup.secret, // Show once for manual entry
        backupCodes: setup.backupCodes,
        instructions: {
          scanQR: 'Scan the QR code with your authenticator app',
          enterCode: 'Or enter the secret manually',
          saveBackup: 'Save your backup codes securely'
        }
      });

    } catch (error) {
      console.error('2FA setup error:', error);
      res.status(500).json({ error: 'Failed to setup 2FA' });
    }
  }

  async verifyAndEnable(req: Request, res: Response) {
    const { token } = req.body;
    const userId = req.user.id;

    try {
      const isValid = await this.twoFactorService.verifyTwoFactorToken(userId, token);

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid token' });
      }

      // Enable 2FA
      await this.twoFactorService.enableTwoFactor(userId);

      res.json({
        message: '2FA enabled successfully',
        nextSteps: [
          'Use your authenticator app for future logins',
          'Keep your backup codes safe',
          'Consider enabling SMS backup'
        ]
      });

    } catch (error) {
      console.error('2FA enable error:', error);
      res.status(500).json({ error: 'Failed to enable 2FA' });
    }
  }
}
```

### 3. Password Change with Validation

```typescript
// UserController.ts
import { schemas, sanitize } from '../middleware/enhancedValidation';

export class UserController {
  private securityService = new SecurityService();

  async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    try {
      // Validate passwords match
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
      }

      // Check password complexity
      const complexityCheck = this.securityService.checkPasswordComplexity(newPassword);
      if (!complexityCheck.isValid) {
        return res.status(400).json({
          error: 'Password does not meet requirements',
          details: complexityCheck.errors
        });
      }

      // Check for breach
      const breachCheck = await this.securityService.checkPasswordBreach(newPassword);
      if (breachCheck.isBreached) {
        return res.status(400).json({
          error: 'Password has been exposed in data breaches',
          count: breachCheck.count
        });
      }

      // Verify current password
      const user = await this.getUserById(userId);
      const isValidCurrent = await this.securityService.verifyPassword(
        currentPassword,
        user.passwordHash
      );

      if (!isValidCurrent) {
        await securityMonitor.triggerAlert({
          type: 'suspicious_password_change',
          severity: 'medium',
          message: 'Invalid current password during change',
          data: { userId, ip: req.ip }
        });
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Update password
      const newHash = await this.securityService.hashPassword(newPassword);
      await this.updateUserPassword(userId, newHash);

      // Revoke all other sessions (except current)
      await this.tokenService.revokeAllUserSessions(userId, req.sessionId);

      res.json({ message: 'Password updated successfully' });

    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
}
```

### 4. Security Monitoring Integration

```typescript
// SecurityController.ts
export class SecurityController {
  async getSecurityDashboard(req: Request, res: Response) {
    const userId = req.user.id;
    const { days = 7 } = req.query;

    try {
      // Get security dashboard data
      const dashboard = await securityMonitor.getSecurityDashboard(Number(days));

      // Get user's security events
      const userEvents = await this.securityService.getUserSecurityEvents(
        userId,
        100,
        0
      );

      // Get active sessions
      const sessions = await this.tokenService.getUserSessions(userId);

      // Get 2FA status
      const twoFactorStatus = await this.twoFactorService.getTwoFactorStatus(userId);

      res.json({
        dashboard,
        userEvents,
        activeSessions: sessions.filter(s => s.isActive),
        securityScore: this.calculateSecurityScore(twoFactorStatus, sessions),
        recommendations: this.getSecurityRecommendations(twoFactorStatus, sessions)
      });

    } catch (error) {
      console.error('Security dashboard error:', error);
      res.status(500).json({ error: 'Failed to load security data' });
    }
  }

  async blockIP(req: Request, res: Response) {
    const { ipAddress, reason, hours = 24 } = req.body;
    const blockedBy = req.user.id;

    try {
      await securityMonitor.blockIP(ipAddress, reason, hours, blockedBy);

      res.json({
        message: `IP ${ipAddress} blocked for ${hours} hours`,
        reason
      });

    } catch (error) {
      console.error('IP block error:', error);
      res.status(500).json({ error: 'Failed to block IP' });
    }
  }

  private calculateSecurityScore(twoFactorStatus: any, sessions: any[]): number {
    let score = 50; // Base score

    // 2FA enabled
    if (twoFactorStatus.enabled) score += 30;

    // No suspicious sessions
    const suspiciousSessions = sessions.filter(s => s.deviceFingerprint !== s.lastFingerprint);
    if (suspiciousSessions.length === 0) score += 20;

    // Recent password change
    const daysSincePasswordChange = this.getDaysSincePasswordChange();
    if (daysSincePasswordChange < 90) score += 10;

    return Math.min(score, 100);
  }
}
```

### 5. Middleware for Route Protection

```typescript
// middleware/auth.ts
import { TokenService } from '../services/auth/TokenService';
import { SecurityService } from '../services/auth/SecurityService';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Validate token
    const validation = await tokenService.validateAccessToken(token);

    if (!validation.valid) {
      return res.status(401).json({
        error: 'Invalid token',
        reason: validation.reason
      });
    }

    // Check session
    const session = await tokenService.getSession(validation.sessionId);
    if (!session || !session.isActive) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Update session activity
    await tokenService.updateSessionActivity(validation.sessionId, {
      lastAccessedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Check for suspicious activity
    if (session.ipAddress !== req.ip && session.deviceFingerprint !== req.deviceFingerprint) {
      await securityMonitor.triggerAlert({
        type: 'suspicious_session',
        severity: 'medium',
        message: 'Session accessed from different IP/device',
        data: {
          sessionId: validation.sessionId,
          userId: validation.userId,
          oldIP: session.ipAddress,
          newIP: req.ip
        }
      });
    }

    req.user = { id: validation.userId };
    req.sessionId = validation.sessionId;
    next();

  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const require2FA = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user.id;

  try {
    const twoFactorStatus = await twoFactorService.getTwoFactorStatus(userId);

    if (!twoFactorStatus.enabled) {
      return res.status(403).json({
        error: '2FA required for this action',
        setupUrl: '/api/2fa/setup'
      });
    }

    // Check recent 2FA verification
    const recentVerification = await twoFactorService.getRecentVerification(userId);
    if (!recentVerification) {
      return res.status(403).json({
        error: '2FA verification required',
        verifyUrl: '/api/2fa/verify'
      });
    }

    next();

  } catch (error) {
    console.error('2FA check error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
};
```

## Security Best Practices

### 1. Token Management
- Always use HTTPS for token transmission
- Store tokens securely (httpOnly cookies or secure storage)
- Implement proper token rotation
- Revoke tokens on suspicious activity

### 2. 2FA Implementation
- Encourage users to enable 2FA
- Provide multiple backup methods
- Store backup codes securely
- Rate limit 2FA attempts

### 3. Session Security
- Track device fingerprints
- Monitor IP changes
- Implement session timeouts
- Provide session management UI

### 4. Monitoring and Alerts
- Set up real-time alerts for suspicious activity
- Review security reports daily
- Implement IP blocking for attacks
- Log all security events

### 5. Password Security
- Enforce strong password policies
- Check against breached password lists
- Require periodic changes
- Use secure hashing (bcrypt with 12+ rounds)

## Database Schema Requirements

Ensure you have the following tables (created in previous migrations):

- `users` - Extended with security fields
- `user_sessions` - Session tracking
- `refresh_tokens` - Token storage
- `two_factor_secrets` - 2FA configuration
- `two_factor_backup_codes` - Backup codes
- `login_attempts` - Login tracking
- `account_lockouts` - Lockout management
- `security_audit_log` - Security events
- `security_alerts` - Alert management
- `blocked_ips` - IP blocking

## Configuration

Add these environment variables to your `.env`:

```env
# 2FA Configuration
TWO_FACTOR_ISSUER=Deligate.it
TWO_FACTOR_WINDOW=1 # Allow 1 time step variance

# Token Configuration
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
JWT_ROTATION_THRESHOLD=0.8 # Rotate after 80% of lifetime

# Security Configuration
MAX_LOGIN_ATTEMPTS=5
LOGIN_ATTEMPT_WINDOW=15m
ACCOUNT_LOCKOUT_DURATION=15m
PASSWORD_MIN_LENGTH=12
SESSION_TIMEOUT=24h

# Monitoring
SECURITY_ALERT_EMAIL=security@deligate.it
DAILY_SECURITY_REPORT=true
```

## Testing

Run these tests to verify your security implementation:

```bash
# Test basic authentication
npm test -- --grep "Authentication"

# Test 2FA flows
npm test -- --grep "TwoFactor"

# Test security monitoring
npm test -- --grep "SecurityMonitor"

# Test rate limiting
npm test -- --grep "RateLimit"

# Test session management
npm test -- --grep "Session"
```

## Monitoring and Alerts

Set up monitoring for:

1. Failed login spikes
2. Unusual IP access patterns
3. Multiple 2FA failures
4. Session anomalies
5. Password change requests from new devices

## Troubleshooting

### Common Issues

1. **Token validation failures**
   - Check JWT secret consistency
   - Verify token expiration
   - Validate session status

2. **2FA verification failures**
   - Check time synchronization
   - Verify TOTP secret storage
   - Confirm backup code integrity

3. **Account lockouts**
   - Review lockout policies
   - Check attempt counting
   - Verify lockout expiration

4. **Session invalidation**
   - Check fingerprint consistency
   - Verify IP tracking
   - Review session timeout

## Performance Considerations

1. **Database Indexing**
   - Index session columns (user_id, is_active, expires_at)
   - Index security audit log timestamps
   - Index login attempt timestamps

2. **Caching**
   - Cache rate limit counters
   - Cache blocked IP lists
   - Cache user security settings

3. **Background Jobs**
   - Process security alerts asynchronously
   - Batch cleanup of expired sessions
   - Schedule daily security reports

## Compliance Notes

This implementation helps with:
- GDPR (right to be forgotten - token revocation)
- SOC 2 (access monitoring, multi-factor auth)
- PCI DSS (strong authentication, audit logging)
- ISO 27001 (information security management)

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Review the security audit log for context
3. Verify configuration settings
4. Check database connectivity

Remember: Security is an ongoing process. Regularly review and update your security measures!