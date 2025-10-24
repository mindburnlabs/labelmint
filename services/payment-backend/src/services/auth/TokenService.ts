import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { postgresDb } from '../database';
import config from '../../config';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface RefreshTokenPayload {
  userId: number;
  tokenId: string;
  deviceId: string;
  type: 'refresh';
}

export interface AccessTokenPayload {
  userId: number;
  sessionId: string;
  deviceId: string;
  type: 'access';
}

export class TokenService {
  private readonly accessTokenExpiry = 15 * 60; // 15 minutes
  private readonly refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days

  /**
   * Generate a new token pair
   */
  async generateTokenPair(
    userId: number,
    deviceId: string,
    deviceInfo?: any
  ): Promise<TokenPair> {
    const sessionId = crypto.randomUUID();
    const tokenId = crypto.randomUUID();

    // Generate access token
    const accessTokenPayload: AccessTokenPayload = {
      userId,
      sessionId,
      deviceId,
      type: 'access'
    };

    const accessToken = jwt.sign(
      accessTokenPayload,
      config.jwt.secret,
      {
        expiresIn: this.accessTokenExpiry,
        issuer: config.jwt.issuer || 'labelmint.it',
        audience: config.jwt.audience || 'labelmint-users'
      }
    );

    // Generate refresh token
    const refreshTokenPayload: RefreshTokenPayload = {
      userId,
      tokenId,
      deviceId,
      type: 'refresh'
    };

    const refreshToken = jwt.sign(
      refreshTokenPayload,
      config.jwt.refreshSecret || config.jwt.secret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: config.jwt.issuer || 'labelmint.it',
        audience: config.jwt.audience || 'labelmint-users'
      }
    );

    // Store refresh token in database
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await postgresDb.query(`
      INSERT INTO refresh_tokens (
        user_id, token_hash, device_id, expires_at
      )
      VALUES ($1, $2, $3, $4)
    `, [userId, tokenHash, deviceId, expiresAt]);

    // Create or update session
    await postgresDb.query(`
      INSERT INTO user_sessions (
        user_id, session_token, refresh_token, device_info,
        ip_address, user_agent, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, device_id)
      DO UPDATE SET
        session_token = EXCLUDED.session_token,
        refresh_token = EXCLUDED.refresh_token,
        last_accessed_at = NOW(),
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `, [
      userId,
      sessionId,
      tokenHash,
      JSON.stringify(deviceInfo),
      deviceInfo?.ipAddress,
      deviceInfo?.userAgent,
      expiresAt
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiry,
      tokenType: 'Bearer'
    };
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as AccessTokenPayload;

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Check if session is still active
      const sessionResult = await postgresDb.query(`
        SELECT * FROM user_sessions
        WHERE session_token = $1
        AND is_active = true
        AND expires_at > NOW()
      `, [decoded.sessionId]);

      if (!sessionResult.rows[0]) {
        throw new Error('Session not found or expired');
      }

      // Update last accessed time
      await postgresDb.query(`
        UPDATE user_sessions
        SET last_accessed_at = NOW()
        WHERE session_token = $1
      `, [decoded.sessionId]);

      return decoded;
    } catch (error) {
      throw new Error(`Invalid access token: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    deviceInfo?: any
  ): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        config.jwt.refreshSecret || config.jwt.secret
      ) as RefreshTokenPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists and is not revoked
      const tokenHash = this.hashToken(refreshToken);
      const tokenResult = await postgresDb.query(`
        SELECT * FROM refresh_tokens
        WHERE token_hash = $1
        AND user_id = $2
        AND is_revoked = false
        AND expires_at > NOW()
      `, [tokenHash, decoded.userId]);

      if (!tokenResult.rows[0]) {
        throw new Error('Refresh token not found or expired');
      }

      // Revoke old refresh token
      await this.revokeRefreshToken(decoded.tokenId);

      // Generate new token pair
      const newTokenPair = await this.generateTokenPair(
        decoded.userId,
        decoded.deviceId,
        deviceInfo
      );

      // Link new refresh token to old one for tracking rotation
      await postgresDb.query(`
        UPDATE refresh_tokens
        SET replaced_by_token_id = (
          SELECT id FROM refresh_tokens
          WHERE token_hash = $1
          ORDER BY created_at DESC
          LIMIT 1
        )
        WHERE id = $2
      `, [this.hashToken(newTokenPair.refreshToken), tokenResult.rows[0].id]);

      return newTokenPair;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(tokenId: string): Promise<void> {
    await postgresDb.query(`
      UPDATE refresh_tokens
      SET is_revoked = true, revoked_at = NOW()
      WHERE token_id = $1
    `, [tokenId]);
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    await postgresDb.query(`
      UPDATE refresh_tokens
      SET is_revoked = true, revoked_at = NOW()
      WHERE user_id = $1
      AND is_revoked = false
    `, [userId]);

    // Deactivate all sessions
    await postgresDb.query(`
      UPDATE user_sessions
      SET is_active = false
      WHERE user_id = $1
    `, [userId]);
  }

  /**
   * Revoke all refresh tokens for a device
   */
  async revokeDeviceTokens(userId: number, deviceId: string): Promise<void> {
    await postgresDb.query(`
      UPDATE refresh_tokens
      SET is_revoked = true, revoked_at = NOW()
      WHERE user_id = $1
      AND device_id = $2
      AND is_revoked = false
    `, [userId, deviceId]);

    // Deactivate session for device
    await postgresDb.query(`
      UPDATE user_sessions
      SET is_active = false
      WHERE user_id = $1
      AND device_id = $2
    `, [userId, deviceId]);
  }

  /**
   * Get active sessions for user
   */
  async getUserSessions(userId: number): Promise<any[]> {
    const result = await postgresDb.query(`
      SELECT
        session_token,
        device_info,
        ip_address,
        user_agent,
        created_at,
        last_accessed_at,
        expires_at
      FROM user_sessions
      WHERE user_id = $1
      AND is_active = true
      ORDER BY last_accessed_at DESC
    `, [userId]);

    return result.rows.map(session => ({
      ...session,
      deviceInfo: session.device_info ? JSON.parse(session.device_info) : null,
      isActive: new Date(session.expires_at) > new Date()
    }));
  }

  /**
   * Clean up expired tokens and sessions
   */
  async cleanupExpiredTokens(): Promise<void> {
    // Delete expired refresh tokens
    await postgresDb.query(`
      DELETE FROM refresh_tokens
      WHERE expires_at < NOW()
      OR (is_revoked = true AND revoked_at < NOW() - INTERVAL '7 days')
    `);

    // Delete expired sessions
    await postgresDb.query(`
      DELETE FROM user_sessions
      WHERE expires_at < NOW()
    `);
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(req: any): string {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const ip = req.ip || req.connection.remoteAddress || '';

    const fingerprint = crypto
      .createHash('sha256')
      .update(`${userAgent}|${acceptLanguage}|${acceptEncoding}|${ip}`)
      .digest('hex');

    return fingerprint;
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const result = await postgresDb.query(
      'SELECT id FROM token_blacklist WHERE jti = $1',
      [jti]
    );

    return result.rows.length > 0;
  }

  /**
   * Blacklist a token
   */
  async blacklistToken(jti: string, expiresAt?: Date): Promise<void> {
    await postgresDb.query(`
      INSERT INTO token_blacklist (jti, expires_at)
      VALUES ($1, $2)
      ON CONFLICT (jti) DO NOTHING
    `, [jti, expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]); // Default 7 days
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Get token expiration date
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded.exp ? new Date(decoded.exp * 1000) : null;
    } catch {
      return null;
    }
  }
}