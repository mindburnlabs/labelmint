import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../lib/utils';

export interface LanguageSelectorProps {
  className?: string;
  variant?: 'dropdown' | 'modal' | 'inline';
  showFlag?: boolean;
  showNativeName?: boolean;
}

export function LanguageSelector({
  className,
  variant = 'dropdown',
  showFlag = true,
  showNativeName = true,
}: LanguageSelectorProps) {
  const { currentLocale, setLocale, supportedLocales, currentLocaleInfo } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = async (localeCode: string) => {
    await setLocale(localeCode);
    setIsOpen(false);
  };

  const getFlagEmoji = (localeCode: string): string => {
    const flags: Record<string, string> = {
      en: '🇺🇸',
      es: '🇪🇸',
      fr: '🇫🇷',
      de: '🇩🇪',
      it: '🇮🇹',
      pt: '🇵🇹',
      ru: '🇷🇺',
      zh: '🇨🇳',
      ja: '🇯🇵',
      ko: '🇰🇷',
      ar: '🇸🇦',
      hi: '🇮🇳',
    };
    return flags[localeCode] || '🌐';
  };

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {supportedLocales.map((locale) => (
          <Button
            key={locale.code}
            variant={currentLocale === locale.code ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleLanguageChange(locale.code)}
            className="flex items-center gap-2"
          >
            {showFlag && <span>{getFlagEmoji(locale.code)}</span>}
            <span>{locale.name}</span>
          </Button>
        ))}
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <>
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className={cn('flex items-center gap-2', className)}
        >
          {showFlag && <span>{getFlagEmoji(currentLocale)}</span>}
          <span>{currentLocaleInfo?.name || 'Language'}</span>
          <svg
            className="w-4 h-4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </Button>

        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <Card className="relative z-10 w-full max-w-md mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Select Language</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                {supportedLocales.map((locale) => (
                  <button
                    key={locale.code}
                    onClick={() => handleLanguageChange(locale.code)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                      currentLocale === locale.code
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    )}
                  >
                    {showFlag && (
                      <span className="text-2xl">{getFlagEmoji(locale.code)}</span>
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{locale.name}</div>
                      {showNativeName && locale.nativeName !== locale.name && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {locale.nativeName}
                        </div>
                      )}
                    </div>
                    {currentLocale === locale.code && (
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}
      </>
    );
  }

  // Dropdown variant (default)
  return (
    <div className={cn('relative', className)}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="flex items-center gap-2"
      >
        {showFlag && <span>{getFlagEmoji(currentLocale)}</span>}
        <span>{currentLocaleInfo?.name || 'Language'}</span>
        <svg
          className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-64 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            <div className="py-2">
              {supportedLocales.map((locale) => (
                <button
                  key={locale.code}
                  onClick={() => handleLanguageChange(locale.code)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                    currentLocale === locale.code && 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  )}
                >
                  {showFlag && (
                    <span className="text-xl">{getFlagEmoji(locale.code)}</span>
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{locale.name}</div>
                    {showNativeName && locale.nativeName !== locale.name && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {locale.nativeName}
                      </div>
                    )}
                  </div>
                  {currentLocale === locale.code && (
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LanguageSelector;
