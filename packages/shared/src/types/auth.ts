// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

import { BaseEntity } from './common';
import { User } from './user';

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  scope?: string;
}

export interface TelegramWebAppData {
  query_id?: string;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
  };
  auth_date: string;
  hash: string;
}

export interface TelegramAuthResult {
  success: boolean;
  user?: User;
  tokens?: AuthToken;
  error?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
  sessionId: string;
}

export interface AccessTokenPayload {
  userId: string;
  role: string;
  permissions: string[];
  type: 'access';
  sessionId: string;
}

export interface AuthSession extends BaseEntity {
  user_id: string;
  telegram_id: bigint;
  refresh_token: string;
  access_token?: string;
  expires_at: Date;
  last_activity: Date;
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
  metadata?: Record<string, any>;
}

export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
    audience: string;
  };
  telegram: {
    botToken: string;
    allowedOrigins: string[];
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  session: {
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
}

export interface AuthMiddlewareOptions {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
  validateSession?: boolean;
}

export interface AuthContext {
  user: User;
  session: AuthSession;
  permissions: string[];
  isAuthenticated: boolean;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  granted_at: Date;
  granted_by: string;
}

export interface UserPermission {
  user_id: string;
  permission_id: string;
  granted_at: Date;
  granted_by: string;
  expires_at?: Date;
}

export interface PasswordResetRequest extends BaseEntity {
  user_id: string;
  token: string;
  expires_at: Date;
  used_at?: Date;
  ip_address?: string;
  user_agent?: string;
}

export interface EmailVerification extends BaseEntity {
  user_id: string;
  token: string;
  email: string;
  expires_at: Date;
  verified_at?: Date;
  ip_address?: string;
  user_agent?: string;
}

export interface TwoFactorAuth extends BaseEntity {
  user_id: string;
  secret: string;
  backup_codes: string[];
  is_enabled: boolean;
  verified_at?: Date;
  last_used_at?: Date;
}

export interface ApiKey extends BaseEntity {
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: string[];
  expires_at?: Date;
  last_used_at?: Date;
  is_active: boolean;
  metadata?: Record<string, any>;
}

export interface AuthEvent {
  type: 'login' | 'logout' | 'token_refresh' | 'password_reset' | 'email_verified' | '2fa_enabled' | '2fa_disabled';
  user_id: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface AuthStats {
  total_sessions: number;
  active_sessions: number;
  logins_today: number;
  logins_this_week: number;
  logins_this_month: number;
  failed_login_attempts: number;
  password_resets_today: number;
  email_verifications_pending: number;
  users_with_2fa: number;
}

// Authentication errors
export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_INACTIVE: 'USER_INACTIVE',
  USER_SUSPENDED: 'USER_SUSPENDED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_TELEGRAM_AUTH: 'INVALID_TELEGRAM_AUTH',
  TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',
  INVALID_TWO_FACTOR: 'INVALID_TWO_FACTOR',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  PASSWORD_RESET_EXPIRED: 'PASSWORD_RESET_EXPIRED'
} as const;