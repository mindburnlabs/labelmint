/**
 * Base Authentication Adapter
 * Defines the interface for all authentication strategies
 */

import { RequestConfig } from '../types';
import { ApiError } from '../error-handler';
import { AuthConfig, AuthResult } from './types';

export abstract class AuthAdapter {
  protected config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Authenticate the request by adding necessary headers or tokens
   */
  abstract authenticate(config: RequestConfig): Promise<RequestConfig>;

  /**
   * Refresh authentication if possible
   */
  abstract refreshAuth(): Promise<AuthResult>;

  /**
   * Handle authentication errors
   */
  abstract handleAuthError(error: ApiError): Promise<boolean>;

  /**
   * Check if the adapter can handle the given error
   */
  protected isAuthError(error: ApiError): boolean {
    return error.statusCode === 401 ||
           error.code === 'UNAUTHORIZED' ||
           error.code === 'TOKEN_EXPIRED' ||
           error.code === 'INVALID_TOKEN';
  }

  /**
   * Check if the adapter can handle the given error for refresh
   */
  protected isRefreshableError(error: ApiError): boolean {
    return error.statusCode === 401 &&
           (error.code === 'TOKEN_EXPIRED' || error.code === 'INVALID_REFRESH_TOKEN');
  }
}