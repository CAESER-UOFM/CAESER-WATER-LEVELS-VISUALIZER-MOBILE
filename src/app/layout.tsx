import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import AuthWrapper from '@/components/AuthWrapper'

export const metadata: Metadata = {
  title: 'Water Level Visualizer',
  description: 'Mobile water level monitoring data visualization',
  keywords: ['water level', 'monitoring', 'groundwater', 'visualization'],
  authors: [{ name: 'Water Level Monitoring Team' }],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: '#3b82f6',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Water Level Visualizer',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preconnect" href="https://sql.js.org" />
      </head>
      <body className="min-h-screen bg-gray-50">
        <AuthProvider>
          <AuthWrapper>
            <div className="flex flex-col min-h-screen">
              <main className="flex-1">
                {children}
              </main>
              <footer className="bg-white border-t border-gray-200 py-4 px-4 text-center text-sm text-gray-500">
                <p>Water Level Monitoring System</p>
                <p className="text-xs mt-1">Mobile Visualizer v1.0</p>
              </footer>
            </div>
          </AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  )
}