import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const ACCESS_TOKEN_KEY = 'admin_access_token';
const REFRESH_TOKEN_KEY = 'admin_refresh_token';

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  async function verifyToken(token: string) {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    router.push('/dashboard');
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    clearTokens();
    setUser(null);
    router.push('/auth/login');
  }

  async function refreshToken() {
    const refresh = getRefreshToken();
    if (!refresh) {
      logout();
      return;
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refresh }),
      });

      if (!response.ok) {
        logout();
        return;
      }

      const data = await response.json();
      setTokens(data.accessToken, data.refreshToken);
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  }

  return {
    user,
    loading,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!user,
  };
}

export function getAccessToken() {
  return Cookies.get(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return Cookies.get(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  Cookies.set(ACCESS_TOKEN_KEY, accessToken, {
    expires: 1, // 1 day
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  Cookies.set(REFRESH_TOKEN_KEY, refreshToken, {
    expires: 7, // 7 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}

export function clearTokens() {
  Cookies.remove(ACCESS_TOKEN_KEY);
  Cookies.remove(REFRESH_TOKEN_KEY);
}

// Role-based access control
export function hasPermission(user: AdminUser | null, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permission) || user.permissions.includes('*');
}

export function canAccess(user: AdminUser | null, resource: string): boolean {
  if (!user) return false;

  const permissions = {
    dashboard: ['read:dashboard'],
    users: ['read:users'],
    projects: ['read:projects'],
    finance: ['read:finance', 'write:finance'],
    disputes: ['read:disputes', 'write:disputes'],
    analytics: ['read:analytics'],
    settings: ['read:settings', 'write:settings'],
  };

  const requiredPermissions = permissions[resource as keyof typeof permissions];
  if (!requiredPermissions) return false;

  return requiredPermissions.some(permission => hasPermission(user, permission));
}