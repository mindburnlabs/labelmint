'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider } from './theme-provider';
import { getApiService, initializeApiService } from '@labelmint/ui';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production' ? 'https://api.labelmint.it/api' : 'http://localhost:3000/api');

const ensureApiService = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    getApiService();
  } catch {
    initializeApiService({
      baseURL: API_BASE_URL,
      timeout: 30000,
      getAuthToken: () => {
        if (typeof window === 'undefined') {
          return null;
        }

        return (
          window.localStorage?.getItem('authToken') ??
          window.localStorage?.getItem('auth_token') ??
          window.localStorage?.getItem('token') ??
          window.sessionStorage?.getItem('authToken') ??
          null
        );
      },
      onUnauthorized: () => {
        if (typeof window === 'undefined') {
          return;
        }

        const keys = ['authToken', 'auth_token', 'token'];
        keys.forEach((key) => {
          try {
            window.localStorage?.removeItem(key);
            window.sessionStorage?.removeItem(key);
          } catch {
            // ignore storage errors
          }
        });
      },
    });
  }
};

if (typeof window !== 'undefined') {
  ensureApiService();
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster
          position="top-right"
          expand={false}
          richColors
          closeButton
        />
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
