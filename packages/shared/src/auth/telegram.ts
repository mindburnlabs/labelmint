// ============================================================================
// TELEGRAM AUTH UTILITIES
// ============================================================================

import { TelegramWebAppData } from '../types/auth';

/**
 * Verify Telegram Web App data
 */
export function verifyTelegramData(data: string, botToken: string): boolean {
  // Placeholder implementation
  // In real implementation, this would verify the HMAC-SHA256 signature
  try {
    const parsed = parseTelegramData(data);
    return !!parsed.user;
  } catch {
    return false;
  }
}

/**
 * Parse Telegram Web App data
 */
export function parseTelegramData(data: string): TelegramWebAppData {
  const params = new URLSearchParams(data);
  const result: TelegramWebAppData = {
    auth_date: params.get('auth_date') || '',
    hash: params.get('hash') || ''
  };

  const queryId = params.get('query_id');
  if (queryId) {
    result.query_id = queryId;
  }

  const userStr = params.get('user');
  if (userStr) {
    try {
      result.user = JSON.parse(decodeURIComponent(userStr));
    } catch {
      // Invalid user data
    }
  }

  return result;
}

/**
 * Create Telegram user from Web App data
 */
export function createTelegramUser(webAppData: TelegramWebAppData): any {
  if (!webAppData.user) {
    throw new Error('No user data in Telegram Web App data');
  }

  return {
    telegramId: BigInt(webAppData.user.id),
    firstName: webAppData.user.first_name,
    lastName: webAppData.user.last_name,
    username: webAppData.user.username,
    languageCode: webAppData.user.language_code,
    isPremium: webAppData.user.is_premium || false,
    authDate: new Date(parseInt(webAppData.auth_date) * 1000)
  };
}

/**
 * Generate Telegram login widget URL
 */
export function generateTelegramLoginUrl(
  botUsername: string,
  redirectUrl: string,
  options: {
    writeAccess?: boolean;
    requestAccess?: 'write' | 'photo_url';
    forceWrite?: boolean;
  } = {}
): string {
  const params = new URLSearchParams({
    bot_url: `https://t.me/${botUsername}`,
    redirect_url: redirectUrl
  });

  if (options.writeAccess) params.append('write_access', 'true');
  if (options.requestAccess) params.append('request_access', options.requestAccess);
  if (options.forceWrite) params.append('force_write', 'true');

  return `https://telegram.org/js/telegram-widget.js?${params.toString()}`;
}