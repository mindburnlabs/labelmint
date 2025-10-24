/**
 * Authentication types and interfaces
 */

export enum AuthType {
  JWT = 'jwt',
  TELEGRAM = 'telegram',
  BOT_TOKEN = 'bot-token',
  API_KEY = 'api-key',
  NONE = 'none'
}

export interface AuthConfig {
  type: AuthType;
  tokenStorage?: TokenStorage;
  refreshEndpoint?: string;
  telegramService?: TelegramService;
  botToken?: string;
  apiKey?: string;
  customHeaders?: Record<string, string>;
}

export interface TokenStorage {
  getToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(accessToken: string, refreshToken?: string): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface TelegramService {
  getInitData(): Record<string, any> | null;
  showAlert(message: string): void;
  isValid(): boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface AuthResult {
  success: boolean;
  tokens?: AuthTokens;
  error?: string;
}