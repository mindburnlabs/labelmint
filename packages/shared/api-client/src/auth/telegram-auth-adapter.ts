/**
 * Telegram Authentication Adapter
 * Handles Telegram Web App authentication using init data
 */

import { AuthAdapter } from './auth-adapter';
import { RequestConfig } from '../types';
import { ApiError } from '../error-handler';
import { AuthConfig, AuthResult, TelegramService } from './types';

export class TelegramAuthAdapter extends AuthAdapter {
  private telegramService: TelegramService;

  constructor(config: AuthConfig) {
    super(config);

    if (!config.telegramService) {
      throw new Error('TelegramService is required for Telegram authentication');
    }

    this.telegramService = config.telegramService;
  }

  async authenticate(config: RequestConfig): Promise<RequestConfig> {
    const initData = this.telegramService.getInitData();

    if (initData && this.telegramService.isValid()) {
      // Convert init data to URL-encoded string and hash it
      const initDataString = new URLSearchParams(initData).toString();

      config.headers = {
        ...config.headers,
        'X-Telegram-Init-Data': initDataString
      };
    }

    return config;
  }

  async refreshAuth(): Promise<AuthResult> {
    // Telegram authentication doesn't support refresh
    // The app needs to be reloaded to get fresh init data
    return {
      success: false,
      error: 'Telegram authentication cannot be refreshed. Please reload the app.'
    };
  }

  async handleAuthError(error: ApiError): Promise<boolean> {
    if (this.isAuthError(error)) {
      // Show user-friendly message for Telegram auth errors
      this.telegramService.showAlert(
        'Authentication required. Please refresh the app to continue.'
      );
      return false;
    }

    return true; // Retry for non-auth errors
  }
}