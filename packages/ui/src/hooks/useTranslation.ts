import { useState, useEffect } from 'react';
import { getI18n, I18n } from '../lib/i18n';

export interface UseTranslationReturn {
  t: (key: string, params?: Record<string, any>) => string;
  tPlural: (key: string, count: number, params?: Record<string, any>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (date: Date) => string;
  currentLocale: string;
  setLocale: (locale: string) => Promise<void>;
  supportedLocales: any[];
  currentLocaleInfo: any;
}

export function useTranslation(): UseTranslationReturn {
  const [i18n, setI18n] = useState<I18n | null>(null);
  const [currentLocale, setCurrentLocale] = useState<string>('en');

  useEffect(() => {
    try {
      const i18nInstance = getI18n();
      setI18n(i18nInstance);
      setCurrentLocale(i18nInstance.getCurrentLocale());

      // Subscribe to locale changes
      const unsubscribe = i18nInstance.subscribe(() => {
        setCurrentLocale(i18nInstance.getCurrentLocale());
      });

      return unsubscribe;
    } catch (error) {
      console.error('Failed to get I18n instance:', error);
    }
  }, []);

  if (!i18n) {
    // Return fallback functions
    return {
      t: (key: string) => key,
      tPlural: (key: string) => key,
      formatNumber: (value: number) => value.toString(),
      formatCurrency: (value: number) => `$${value}`,
      formatDate: (date: Date) => date.toLocaleDateString(),
      formatRelativeTime: (date: Date) => 'now',
      currentLocale: 'en',
      setLocale: async () => {},
      supportedLocales: [],
      currentLocaleInfo: null,
    };
  }

  return {
    t: i18n.t.bind(i18n),
    tPlural: i18n.tPlural.bind(i18n),
    formatNumber: i18n.formatNumber.bind(i18n),
    formatCurrency: i18n.formatCurrency.bind(i18n),
    formatDate: i18n.formatDate.bind(i18n),
    formatRelativeTime: i18n.formatRelativeTime.bind(i18n),
    currentLocale,
    setLocale: i18n.setLocale.bind(i18n),
    supportedLocales: i18n.getSupportedLocales(),
    currentLocaleInfo: i18n.getCurrentLocaleInfo(),
  };
}

export default useTranslation;
