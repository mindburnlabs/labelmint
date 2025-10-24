import { postgresDb } from '../database';
import crypto from 'crypto';
import { SecurityService } from './SecurityService';

export interface SessionData {
  id: string;
  userId: number;
  deviceFingerprint: string;
  deviceName?: string;
  ipAddress: string;
  userAgent: string;
  isTrusted: boolean;
  lastAccessedAt: Date;
  expiresAt: Date;
  metadata?: any;
}

export interface TrustedDevice {
  id: string;
  userId: number;
  fingerprint: string;
  name: string;
  trustedAt: Date;
  lastUsedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export class SessionService {
  private securityService: SecurityService;

  constructor() {
    this.securityService = new SecurityService();
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: number,
    deviceFingerprint: string,
    ipAddress: string,
    userAgent: string,
    deviceName?: string,
    isTrusted: boolean = false
  ): Promise<SessionData> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour default

    // Check if device is already trusted
    if (!isTrusted) {
      const trustedDevice = await this.getTrustedDevice(userId, deviceFingerprint);
      isTrusted = !!trustedDevice && trustedDevice.isActive;
    }

    await postgresDb.query(`
      INSERT INTO user_sessions (
        session_token, user_id, device_fingerprint, device_name,
        ip_address, user_agent, is_trusted, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, device_fingerprint)
      DO UPDATE SET
        session_token = EXCLUDED.session_token,
        last_accessed_at = NOW(),
        expires_at = EXCLUDED.expires_at,
        is_trusted = EXCLUDED.is_trusted,
        updated_at = NOW()
      RETURNING *
    `, [
      sessionId,
      userId,
      deviceFingerprint,
      deviceName,
      ipAddress,
      userAgent,
      isTrusted,
      expiresAt
    ]);

    return {
      id: sessionId,
      userId,
      deviceFingerprint,
      deviceName,
      ipAddress,
      userAgent,
      isTrusted,
      lastAccessedAt: new Date(),
      expiresAt
    };
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const result = await postgresDb.query(`
      SELECT * FROM user_sessions
      WHERE session_token = $1
      AND is_active = true
      AND expires_at > NOW()
    `, [sessionId]);

    if (!result.rows[0]) {
      return null;
    }

    const session = result.rows[0];

    // Update last accessed time
    await this.updateLastAccessed(sessionId);

    return {
      id: session.session_token,
      userId: session.user_id,
      deviceFingerprint: session.device_fingerprint,
      deviceName: session.device_name,
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      isTrusted: session.is_trusted,
      lastAccessedAt: session.last_accessed_at,
      expiresAt: session.expires_at,
      metadata: session.metadata ? JSON.parse(session.metadata) : null
    };
  }

  /**
   * Update session last accessed time
   */
  async updateLastAccessed(sessionId: string): Promise<void> {
    await postgresDb.query(`
      UPDATE user_sessions
      SET last_accessed_at = NOW()
      WHERE session_token = $1
    `, [sessionId]);
  }

  /**
   * Extend session expiration
   */
  async extendSession(sessionId: string, hours: number = 24): Promise<void> {
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + hours);

    await postgresDb.query(`
      UPDATE user_sessions
      SET expires_at = $1, updated_at = NOW()
      WHERE session_token = $2
    `, [newExpiresAt, sessionId]);
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await postgresDb.query(`
      UPDATE user_sessions
      SET is_active = false
      WHERE session_token = $1
    `, [sessionId]);

    // Log security event
    await this.securityService.logSecurityEvent({
      action: 'session_invalidated',
      result: 'success',
      sessionId
    });
  }

  /**
   * Invalidate all sessions for user
   */
  async invalidateAllUserSessions(userId: number, exceptSessionId?: string): Promise<void> {
    let query = `
      UPDATE user_sessions
      SET is_active = false
      WHERE user_id = $1
    `;
    const params = [userId];

    if (exceptSessionId) {
      query += ' AND session_token != $2';
      params.push(exceptSessionId);
    }

    await postgresDb.query(query, params);

    // Log security event
    await this.securityService.logSecurityEvent({
      userId,
      action: 'all_sessions_invalidated',
      result: 'success',
      details: {
        exceptSessionId
      }
    });
  }

  /**
   * Get all active sessions for user
   */
  async getUserSessions(userId: number): Promise<SessionData[]> {
    const result = await postgresDb.query(`
      SELECT * FROM user_sessions
      WHERE user_id = $1
      AND is_active = true
      ORDER BY last_accessed_at DESC
    `, [userId]);

    return result.rows.map(session => ({
      id: session.session_token,
      userId: session.user_id,
      deviceFingerprint: session.device_fingerprint,
      deviceName: session.device_name,
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      isTrusted: session.is_trusted,
      lastAccessedAt: session.last_accessed_at,
      expiresAt: session.expires_at,
      metadata: session.metadata ? JSON.parse(session.metadata) : null
    }));
  }

  /**
   * Trust a device
   */
  async trustDevice(
    userId: number,
    deviceFingerprint: string,
    deviceName?: string,
    expiresDays: number = 30
  ): Promise<TrustedDevice> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresDays);

    const result = await postgresDb.query(`
      INSERT INTO trusted_devices (
        user_id, device_fingerprint, device_name, expires_at
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, device_fingerprint)
      DO UPDATE SET
        device_name = EXCLUDED.device_name,
        trusted_at = NOW(),
        last_used_at = NOW(),
        expires_at = EXCLUDED.expires_at,
        is_active = true
      RETURNING *
    `, [userId, deviceFingerprint, deviceName || 'Unknown Device', expiresAt]);

    // Update existing sessions to mark as trusted
    await postgresDb.query(`
      UPDATE user_sessions
      SET is_trusted = true
      WHERE user_id = $1
      AND device_fingerprint = $2
      AND is_active = true
    `, [userId, deviceFingerprint]);

    return {
      id: result.rows[0].id.toString(),
      userId: result.rows[0].user_id,
      fingerprint: result.rows[0].device_fingerprint,
      name: result.rows[0].device_name,
      trustedAt: result.rows[0].trusted_at,
      lastUsedAt: result.rows[0].last_used_at,
      expiresAt: result.rows[0].expires_at,
      isActive: result.rows[0].is_active
    };
  }

  /**
   * Get trusted device
   */
  async getTrustedDevice(
    userId: number,
    deviceFingerprint: string
  ): Promise<TrustedDevice | null> {
    const result = await postgresDb.query(`
      SELECT * FROM trusted_devices
      WHERE user_id = $1
      AND device_fingerprint = $2
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    `, [userId, deviceFingerprint]);

    if (!result.rows[0]) {
      return null;
    }

    const device = result.rows[0];

    return {
      id: device.id.toString(),
      userId: device.user_id,
      fingerprint: device.device_fingerprint,
      name: device.device_name,
      trustedAt: device.trusted_at,
      lastUsedAt: device.last_used_at,
      expiresAt: device.expires_at,
      isActive: device.is_active
    };
  }

  /**
   * Get all trusted devices for user
   */
  async getTrustedDevices(userId: number): Promise<TrustedDevice[]> {
    const result = await postgresDb.query(`
      SELECT * FROM trusted_devices
      WHERE user_id = $1
      ORDER BY last_used_at DESC
    `, [userId]);

    return result.rows.map(device => ({
      id: device.id.toString(),
      userId: device.user_id,
      fingerprint: device.device_fingerprint,
      name: device.device_name,
      trustedAt: device.trusted_at,
      lastUsedAt: device.last_used_at,
      expiresAt: device.expires_at,
      isActive: device.is_active
    }));
  }

  /**
   * Remove trusted device
   */
  async removeTrustedDevice(userId: number, deviceFingerprint: string): Promise<void> {
    // Deactivate trusted device
    await postgresDb.query(`
      UPDATE trusted_devices
      SET is_active = false
      WHERE user_id = $1
      AND device_fingerprint = $2
    `, [userId, deviceFingerprint]);

    // Update sessions to untrust
    await postgresDb.query(`
      UPDATE user_sessions
      SET is_trusted = false
      WHERE user_id = $1
      AND device_fingerprint = $2
      AND is_active = true
    `, [userId, deviceFingerprint]);

    // Log security event
    await this.securityService.logSecurityEvent({
      userId,
      action: 'trusted_device_removed',
      result: 'success',
      details: { deviceFingerprint }
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    await postgresDb.query(`
      DELETE FROM user_sessions
      WHERE expires_at < NOW
      OR (is_active = false AND updated_at < NOW() - INTERVAL '7 days')
    `);
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(userId: number): Promise<any> {
    const result = await postgresDb.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true) as active_sessions,
        COUNT(*) FILTER (WHERE is_trusted = true AND is_active = true) as trusted_devices,
        MAX(last_accessed_at) as last_access,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM user_sessions
      WHERE user_id = $1
    `, [userId]);

    return result.rows[0];
  }

  /**
   * Detect suspicious session activity
   */
  async detectSuspiciousActivity(userId: number): Promise<any> {
    const recentSessions = await postgresDb.query(`
      SELECT * FROM user_sessions
      WHERE user_id = $1
      AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
    `, [userId]);

    const suspicious = {
      multipleLocations: false,
      rapidLogins: false,
      unknownDevices: false,
      details: []
    };

    // Check for multiple locations
    const uniqueIPs = new Set(recentSessions.rows.map(s => s.ip_address));
    if (uniqueIPs.size > 2) {
      suspicious.multipleLocations = true;
      suspicious.details.push(`Login from ${uniqueIPs.size} different IPs in last hour`);
    }

    // Check for rapid logins
    if (recentSessions.rows.length > 5) {
      suspicious.rapidLogins = true;
      suspicious.details.push(`${recentSessions.rows.length} login attempts in last hour`);
    }

    // Check for unknown devices
    const untrustedCount = recentSessions.rows.filter(s => !s.is_trusted).length;
    if (untrustedCount > 2) {
      suspicious.unknownDevices = true;
      suspicious.details.push(`${untrustedCount} untrusted devices in last hour`);
    }

    // Log if suspicious activity detected
    if (Object.values(suspicious).some(v => v === true)) {
      await this.securityService.logSecurityEvent({
        userId,
        action: 'suspicious_session_activity',
        result: 'detected',
        details: suspicious
      });
    }

    return suspicious;
  }

  /**
   * Generate device fingerprint from request
   */
  generateDeviceFingerprint(req: any): string {
    const fingerprint = {
      userAgent: req.get('User-Agent') || '',
      acceptLanguage: req.get('Accept-Language') || '',
      acceptEncoding: req.get('Accept-Encoding') || '',
      accept: req.get('Accept') || '',
      platform: req.get('Sec-CH-UA-Platform') || '',
      mobile: req.get('Sec-CH-UA-Mobile') || ''
    };

    const fingerprintString = Object.values(fingerprint).join('|');
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  /**
   * Update session metadata
   */
  async updateSessionMetadata(sessionId: string, metadata: any): Promise<void> {
    await postgresDb.query(`
      UPDATE user_sessions
      SET metadata = $1, updated_at = NOW()
      WHERE session_token = $2
    `, [JSON.stringify(metadata), sessionId]);
  }

  /**
   * Check session security
   */
  async checkSessionSecurity(sessionId: string, currentIP: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Check if IP has changed significantly
    if (session.ipAddress !== currentIP) {
      // Log IP change
      await this.securityService.logSecurityEvent({
        userId: session.userId,
        action: 'session_ip_changed',
        result: 'warning',
        details: {
          oldIP: session.ipAddress,
          newIP: currentIP
        }
      });

      // Require re-authentication for untrusted devices
      if (!session.isTrusted) {
        return false;
      }
    }

    return true;
  }
}