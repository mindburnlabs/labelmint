/**
 * Bot Authentication Adapter
 * Handles bot-to-service authentication using bot tokens
 */

import { AuthAdapter } from './auth-adapter';
import { RequestConfig } from '../types';
import { ApiError } from '../error-handler';
import { AuthConfig, AuthResult } from './types';

export class BotAuthAdapter extends AuthAdapter {
  private botToken: string;

  constructor(config: AuthConfig) {
    super(config);

    if (!config.botToken) {
      throw new Error('Bot token is required for bot authentication');
    }

    this.botToken = config.botToken;
  }

  async authenticate(config: RequestConfig): Promise<RequestConfig> {
    config.headers = {
      ...config.headers,
      'Authorization': `Bot ${this.botToken}`,
      'X-Bot-Auth': 'true'
    };

    // Add any custom headers from config
    if (this.config.customHeaders) {
      config.headers = {
        ...config.headers,
        ...this.config.customHeaders
      };
    }

    return config;
  }

  async refreshAuth(): Promise<AuthResult> {
    // Bot tokens don't expire or need refresh
    return { success: true };
  }

  async handleAuthError(error: ApiError): Promise<boolean> {
    if (this.isAuthError(error)) {
      // Bot auth errors usually indicate configuration issues
      console.error('Bot authentication failed:', error);
      return false; // Don't retry bot auth errors
    }

    return true; // Retry for non-auth errors
  }
}