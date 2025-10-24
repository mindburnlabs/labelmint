import { useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramInitData {
  query_id: string;
  user: TelegramUser;
  auth_date: number;
  hash: string;
}

export function useTelegramAuth() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Telegram WebApp
    if (typeof window !== 'undefined' && WebApp) {
      WebApp.ready();
      WebApp.expand();
      WebApp.enableClosingConfirmation();

      // Set theme
      const themeParams = WebApp.themeParams;
      if (themeParams.bg_color) {
        document.documentElement.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
      }
      if (themeParams.text_color) {
        document.documentElement.style.setProperty('--tg-theme-text-color', themeParams.text_color);
      }
      if (themeParams.hint_color) {
        document.documentElement.style.setProperty('--tg-theme-hint-color', themeParams.hint_color);
      }
      if (themeParams.button_color) {
        document.documentElement.style.setProperty('--tg-theme-button-color', themeParams.button_color);
      }
      if (themeParams.button_text_color) {
        document.documentElement.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color);
      }

      // Parse init data
      try {
        const initData = WebApp.initDataUnsafe as TelegramInitData;

        if (initData.user) {
          setUser(initData.user);

          // Send init data to backend for authentication
          authenticateWithBackend(initData);
        } else {
          setError('User data not available');
        }
      } catch (err) {
        setError('Failed to parse Telegram data');
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const authenticateWithBackend = async (initData: TelegramInitData) => {
    try {
      const response = await fetch('/api/auth/telegram/webapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData: WebApp.initData,
          user: initData.user,
        }),
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();

      // Store auth token
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Authentication failed');
    }
  };

  const hapticFeedback = (type: 'impact' | 'notification' | 'selection') => {
    if (WebApp?.HapticFeedback) {
      switch (type) {
        case 'impact':
          WebApp.HapticFeedback.impactOccurred('medium');
          break;
        case 'notification':
          WebApp.HapticFeedback.notificationOccurred('success');
          break;
        case 'selection':
          WebApp.HapticFeedback.selectionChanged();
          break;
      }
    }
  };

  const showConfirmDialog = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (WebApp?.showConfirm) {
        WebApp.showConfirm(message, (confirmed) => {
          resolve(confirmed);
        });
      } else {
        resolve(window.confirm(message));
      }
    });
  };

  const showAlert = (message: string): Promise<void> => {
    return new Promise((resolve) => {
      if (WebApp?.showAlert) {
        WebApp.showAlert(message, () => {
          resolve();
        });
      } else {
        window.alert(message);
        resolve();
      }
    });
  };

  const setMainButton = (text: string, onClick: () => void, visible = true, progress = false) => {
    if (WebApp?.MainButton) {
      WebApp.MainButton.text = text;
      WebApp.MainButton.onClick(onClick);

      if (visible) {
        WebApp.MainButton.show();
      } else {
        WebApp.MainButton.hide();
      }

      if (progress) {
        WebApp.MainButton.showProgress();
      } else {
        WebApp.MainButton.hideProgress();
      }
    }
  };

  const setBackButton = (onClick: () => void, visible = true) => {
    if (WebApp?.BackButton) {
      WebApp.BackButton.onClick(onClick);

      if (visible) {
        WebApp.BackButton.show();
      } else {
        WebApp.BackButton.hide();
      }
    }
  };

  return {
    user,
    isLoading,
    error,
    telegram: WebApp,
    hapticFeedback,
    showConfirmDialog,
    showAlert,
    setMainButton,
    setBackButton,
  };
}