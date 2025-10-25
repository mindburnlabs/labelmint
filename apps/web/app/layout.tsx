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
    default: 'LabelMint - Enterprise AI Data Labeling Platform',
    template: '%s | LabelMint'
  },
  description: 'Enterprise-grade data labeling platform with 500K+ expert annotators. Get 99.5% accuracy with sub-hour turnaround at 90% less cost than Scale AI. SOC 2 Type II certified.',
  keywords: [
    'data labeling',
    'AI training data',
    'machine learning',
    'data annotation',
    'enterprise AI',
    'computer vision',
    'NLP annotation',
    'data annotation services',
    'AI data preparation',
    'outsourced labeling',
    'data labeling platform',
    'training data',
    'annotation services'
  ],
  authors: [{ name: 'LabelMint Team', url: 'https://labelmint.com' }],
  creator: 'LabelMint',
  publisher: 'LabelMint',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://labelmint.com',
    siteName: 'LabelMint',
    title: 'LabelMint - Enterprise AI Data Labeling Platform',
    description: 'Enterprise-grade data labeling with 99.5% accuracy, sub-hour turnaround, and 90% cost savings vs Scale AI',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LabelMint - Enterprise AI Data Labeling Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LabelMint - Enterprise AI Data Labeling Platform',
    description: '99.5% accuracy, sub-hour turnaround, 90% less cost than Scale AI. Enterprise-grade data labeling.',
    images: ['/og-image.png'],
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  manifest: '/manifest.json',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0ea5e9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c4a6e' }
  ],
  metadataBase: new URL('https://labelmint.com'),
  alternates: {
    canonical: '/',
  },
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
            defaultTheme="dark"
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
