'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PropsWithChildren, useState, useEffect } from 'react'
import { initializeApiService, getApiService } from '@/lib/apiService'
import { WebSocketProvider } from '@/hooks/useWebSocket'
import { Toaster } from 'sonner'
import { ConnectionStatusToast } from '@/components/ui/advanced-toast'

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  // Initialize API service
  useEffect(() => {
    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3000';

    initializeApiService({
      baseURL: `${API_BASE_URL}/api`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        {children}

        {/* Global Toast Container */}
        <Toaster
          position="top-right"
          richColors
          closeButton
          expand={false}
          duration={4000}
          className="backdrop-blur-sm"
        />

        {/* Connection Status Indicator */}
        <ConnectionStatusToastWrapper />

        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </WebSocketProvider>
    </QueryClientProvider>
  )
}

// Wrapper component for connection status with WebSocket hook
function ConnectionStatusToastWrapper() {
  // This component will be rendered inside the WebSocketProvider
  return null // The actual connection status is handled inside the WebSocket hook
}
