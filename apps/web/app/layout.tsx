import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import '../styles/globals.css'
import { Providers } from './providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'LabelMint - Telegram Data Labeling Platform',
    template: '%s | LabelMint'
  },
  description: 'Professional data labeling marketplace powered by Telegram workers and TON/USDT micropayments. High-quality training data with transparent compensation.',
  keywords: [
    'data labeling',
    'telegram',
    'ton blockchain',
    'usdt payments',
    'machine learning',
    'data annotation',
    'ai training',
    'micropayments',
    'distributed workforce'
  ],
  authors: [{ name: 'LabelMint Team', url: 'https://labelmint.com' }],
  creator: 'MindBurn Labs',
  publisher: 'LabelMint',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://labelmint.com',
    siteName: 'LabelMint',
    title: 'LabelMint - Professional Data Labeling Platform',
    description: 'High-quality data labeling with TON/USDT micropayments and Telegram workers',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LabelMint - Telegram Data Labeling Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LabelMint - Telegram Data Labeling Platform',
    description: 'Professional data labeling with TON/USDT micropayments',
    images: ['/og-image.png'],
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  manifest: '/manifest.json',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' }
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} font-sans`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#000000" />
        <meta name="msapplication-TileColor" content="#000000" />

        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

        {/* Critical CSS for above-the-fold content */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Critical CSS for immediate rendering */
            body { margin: 0; min-height: 100vh; }
            .loading { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          `
        }} />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="relative flex min-h-screen flex-col">
              {children}
            </div>
            <Toaster
              position="top-right"
              richColors
              closeButton
              expand={false}
              duration={4000}
            />
          </ThemeProvider>
        </Providers>

        {/* Performance monitoring script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                // Performance monitoring
                window.addEventListener('load', () => {
                  const perfData = window.performance.timing;
                  const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
                  console.log('Page load time:', pageLoadTime + 'ms');
                });
              }
            `
          }}
        />
      </body>
    </html>
  )
}
