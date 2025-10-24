import { useEffect, useState } from 'react';
import telegramService from '../services/telegram';
import type { TelegramUser } from '../services/telegram';

export const useTelegram = () => {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Initialize Telegram Web App
    telegramService.init();

    const telegramUser = telegramService.getUser();
    const authenticated = telegramService.isAuthenticated();

    setUser(telegramUser);
    setIsAuthenticated(authenticated);
    setIsLoading(false);

    // Notify Telegram that the app is ready
    telegramService.ready();
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    webApp: telegramService,
  };
};