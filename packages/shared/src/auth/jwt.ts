// ============================================================================
// JWT UTILITIES
// ============================================================================

import { AccessTokenPayload, RefreshTokenPayload } from '../types/auth';

/**
 * JWT token interface
 */
export interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
  [key: string]: any;
}

/**
 * JWT utilities
 */
export class JWTUtils {
  private static readonly DEFAULT_ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly DEFAULT_REFRESH_TOKEN_EXPIRY = '7d';

  /**
   * Sign access token
   */
  static signAccessToken(payload: AccessTokenPayload, secret: string): string {
    // Placeholder implementation
    return `access_token_${JSON.stringify(payload)}`;
  }

  /**
   * Sign refresh token
   */
  static signRefreshToken(payload: RefreshTokenPayload, secret: string): string {
    // Placeholder implementation
    return `refresh_token_${JSON.stringify(payload)}`;
  }

  /**
   * Verify token
   */
  static verifyToken(token: string, secret: string): JWTPayload | null {
    // Placeholder implementation
    try {
      if (token.startsWith('access_token_')) {
        return JSON.parse(token.replace('access_token_', ''));
      }
      if (token.startsWith('refresh_token_')) {
        return JSON.parse(token.replace('refresh_token_', ''));
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Decode token without verification
   */
  static decodeToken(token: string): JWTPayload | null {
    // Placeholder implementation
    try {
      if (token.startsWith('access_token_')) {
        return JSON.parse(token.replace('access_token_', ''));
      }
      if (token.startsWith('refresh_token_')) {
        return JSON.parse(token.replace('refresh_token_', ''));
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return true;
    return Date.now() >= payload.exp * 1000;
  }

  /**
   * Get token expiration time
   */
  static getExpiration(token: string): Date | null {
    const payload = this.decodeToken(token);
    if (!payload) return null;
    return new Date(payload.exp * 1000);
  }
}