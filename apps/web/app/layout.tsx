import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Deligate.it - Label Data 10x Cheaper than Scale AI',
  description: 'High-quality data labeling at 10x lower cost. Get started in 5 minutes with our Telegram-based labeling platform. Perfect for ML teams needing affordable data annotation.',
  keywords: ['data labeling', 'machine learning', 'data annotation', 'Scale AI alternative', 'affordable data labeling'],
  openGraph: {
    title: 'Deligate.it - Label Data 10x Cheaper than Scale AI',
    description: 'High-quality data labeling at 10x lower cost. Get started in 5 minutes.',
    url: 'https://labelmint.it',
    siteName: 'Deligate.it',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}