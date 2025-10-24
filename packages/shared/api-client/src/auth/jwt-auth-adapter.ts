/**
 * JWT Authentication Adapter
 * Handles JWT token authentication with automatic refresh
 */

import { AuthAdapter } from './auth-adapter';
import { RequestConfig } from '../types';
import { ApiError } from '../error-handler';
import { AuthConfig, AuthResult, TokenStorage } from './types';

export class JWTAuthAdapter extends AuthAdapter {
  private tokenStorage: TokenStorage;
  private refreshEndpoint: string;

  constructor(config: AuthConfig) {
    super(config);

    if (!config.tokenStorage) {
      throw new Error('TokenStorage is required for JWT authentication');
    }

    if (!config.refreshEndpoint) {
      throw new Error('Refresh endpoint is required for JWT authentication');
    }

    this.tokenStorage = config.tokenStorage;
    this.refreshEndpoint = config.refreshEndpoint;
  }

  async authenticate(config: RequestConfig): Promise<RequestConfig> {
    const token = await this.tokenStorage.getToken();

    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      };
    }

    return config;
  }

  async refreshAuth(): Promise<AuthResult> {
    try {
      const refreshToken = await this.tokenStorage.getRefreshToken();

      if (!refreshToken) {
        return { success: false, error: 'No refresh token available' };
      }

      // Use fetch directly to avoid circular dependency
      const response = await fetch(this.refreshEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        await this.tokenStorage.setTokens(
          data.data.accessToken,
          data.data.refreshToken
        );

        return {
          success: true,
          tokens: {
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
            expiresIn: data.data.expiresIn
          }
        };
      }

      return { success: false, error: data.message || 'Refresh failed' };
    } catch (error) {
      // Clear tokens on refresh failure
      await this.tokenStorage.clearTokens();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refresh failed'
      };
    }
  }

  async handleAuthError(error: ApiError): Promise<boolean> {
    // If it's a token expiration error, try to refresh
    if (this.isRefreshableError(error)) {
      const refreshResult = await this.refreshAuth();

      if (refreshResult.success) {
        return true; // Retry the request with new token
      }
    }

    // For other auth errors, clear tokens and fail
    if (this.isAuthError(error)) {
      await this.tokenStorage.clearTokens();
    }

    return false; // Don't retry
  }
}