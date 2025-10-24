/**
 * Token Storage Implementations
 * Provides different storage strategies for authentication tokens
 */

import { TokenStorage } from './types';

/**
 * Browser-based token storage using localStorage
 */
export class LocalStorageTokenStorage implements TokenStorage {
  private accessTokenKey: string;
  private refreshTokenKey: string;

  constructor(accessTokenKey: string = 'access_token', refreshTokenKey: string = 'refresh_token') {
    this.accessTokenKey = accessTokenKey;
    this.refreshTokenKey = refreshTokenKey;
  }

  async getToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.accessTokenKey);
  }

  async getRefreshToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.refreshTokenKey);
  }

  async setTokens(accessToken: string, refreshToken?: string): Promise<void> {
    if (typeof window === 'undefined') return;

    localStorage.setItem(this.accessTokenKey, accessToken);
    if (refreshToken) {
      localStorage.setItem(this.refreshTokenKey, refreshToken);
    }
  }

  async clearTokens(): Promise<void> {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }
}

/**
 * Browser-based token storage using sessionStorage
 */
export class SessionStorageTokenStorage implements TokenStorage {
  private accessTokenKey: string;
  private refreshTokenKey: string;

  constructor(accessTokenKey: string = 'access_token', refreshTokenKey: string = 'refresh_token') {
    this.accessTokenKey = accessTokenKey;
    this.refreshTokenKey = refreshTokenKey;
  }

  async getToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(this.accessTokenKey);
  }

  async getRefreshToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(this.refreshTokenKey);
  }

  async setTokens(accessToken: string, refreshToken?: string): Promise<void> {
    if (typeof window === 'undefined') return;

    sessionStorage.setItem(this.accessTokenKey, accessToken);
    if (refreshToken) {
      sessionStorage.setItem(this.refreshTokenKey, refreshToken);
    }
  }

  async clearTokens(): Promise<void> {
    if (typeof window === 'undefined') return;

    sessionStorage.removeItem(this.accessTokenKey);
    sessionStorage.removeItem(this.refreshTokenKey);
  }
}

/**
 * Memory-based token storage for server-side or temporary usage
 */
export class MemoryTokenStorage implements TokenStorage {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  async getToken(): Promise<string | null> {
    return this.accessToken;
  }

  async getRefreshToken(): Promise<string | null> {
    return this.refreshToken;
  }

  async setTokens(accessToken: string, refreshToken?: string): Promise<void> {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken || null;
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

/**
 * Cookie-based token storage
 */
export class CookieTokenStorage implements TokenStorage {
  private accessTokenKey: string;
  private refreshTokenKey: string;
  private cookieOptions: {
    domain?: string;
    path?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    days?: number;
  };

  constructor(
    accessTokenKey: string = 'access_token',
    refreshTokenKey: string = 'refresh_token',
    cookieOptions: CookieTokenStorage['cookieOptions'] = {}
  ) {
    this.accessTokenKey = accessTokenKey;
    this.refreshTokenKey = refreshTokenKey;
    this.cookieOptions = {
      path: '/',
      sameSite: 'lax',
      days: 7,
      ...cookieOptions
    };
  }

  async getToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return this.getCookie(this.accessTokenKey);
  }

  async getRefreshToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return this.getCookie(this.refreshTokenKey);
  }

  async setTokens(accessToken: string, refreshToken?: string): Promise<void> {
    if (typeof window === 'undefined') return;

    this.setCookie(this.accessTokenKey, accessToken);
    if (refreshToken) {
      this.setCookie(this.refreshTokenKey, refreshToken);
    }
  }

  async clearTokens(): Promise<void> {
    if (typeof window === 'undefined') return;

    this.deleteCookie(this.accessTokenKey);
    this.deleteCookie(this.refreshTokenKey);
  }

  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }

  private setCookie(name: string, value: string): void {
    const { domain, path, secure, sameSite, days } = this.cookieOptions;
    let cookieString = `${name}=${value}`;

    if (path) cookieString += `; path=${path}`;
    if (domain) cookieString += `; domain=${domain}`;
    if (secure) cookieString += `; secure`;
    if (sameSite) cookieString += `; samesite=${sameSite}`;
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      cookieString += `; expires=${date.toUTCString()}`;
    }

    document.cookie = cookieString;
  }

  private deleteCookie(name: string): void {
    this.setCookie(name, '');
    if (this.cookieOptions.days) {
      const date = new Date();
      date.setTime(date.getTime() - (24 * 60 * 60 * 1000));
      document.cookie = `${name}=; expires=${date.toUTCString()}; path=${this.cookieOptions.path || '/'}`;
    }
  }
}