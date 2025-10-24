import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  role: 'CLIENT' | 'WORKER' | 'ADMIN';
  email?: string;
  isVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

class AuthClient {
  private token: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Load tokens from localStorage on init
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
      this.refreshToken = localStorage.getItem('refresh_token');
    }
  }

  // Get current token
  getToken(): string | null {
    return this.token;
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    if (!this.token) {
      return null;
    }

    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      return response.data.user;
    } catch (error: any) {
      if (error.response?.status === 401) {
        await this.logout();
      }
      return null;
    }
  }

  // Login with Telegram
  async loginWithTelegram(telegramUser: any): Promise<User> {
    const response = await axios.post<AuthResponse>(`${API_URL}/api/auth/telegram/login`, {
      telegramUser,
    });

    this.setTokens(response.data.token, response.data.refreshToken);

    return response.data.user;
  }

  // Register with Telegram
  async registerWithTelegram(telegramUser: any, role: 'client' | 'worker'): Promise<User> {
    const response = await axios.post<AuthResponse>(`${API_URL}/api/auth/telegram/register`, {
      telegramUser,
      role,
    });

    this.setTokens(response.data.token, response.data.refreshToken);

    return response.data.user;
  }

  // Refresh token
  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) {
      return null;
    }

    try {
      const response = await axios.post<{ token: string }>(`${API_URL}/api/auth/refresh`, {
        refreshToken: this.refreshToken,
      });

      this.token = response.data.token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', this.token);
      }

      return this.token;
    } catch (error) {
      await this.logout();
      return null;
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      if (this.token) {
        await axios.post(`${API_URL}/api/auth/logout`, null, {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });
      }
    } catch (error) {
      // Ignore logout errors
    } finally {
      this.clearTokens();
    }
  }

  // Set tokens
  private setTokens(token: string, refreshToken: string): void {
    this.token = token;
    this.refreshToken = refreshToken;

    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('refresh_token', refreshToken);
    }
  }

  // Clear tokens
  private clearTokens(): void {
    this.token = null;
    this.refreshToken = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
    }
  }

  // Check if authenticated
  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export const authClient = new AuthClient();

// Axios interceptor for automatic token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const newToken = await authClient.refreshAccessToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);