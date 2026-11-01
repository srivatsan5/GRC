import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Pericope ERM - Enterprise Risk Management',
  description: 'Comprehensive risk management platform for identifying, assessing, and monitoring enterprise risks',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
}

import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { QueryProvider } from '@/components/providers/query-provider'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { SettingsBoundary } from '@/lib/settings'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased bg-background text-foreground transition-colors duration-300`}>
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            forcedTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <AuthProvider>
              <SettingsBoundary>
                <ConfirmDialogProvider>
                  {children}
                </ConfirmDialogProvider>
              </SettingsBoundary>
            </AuthProvider>
            <Toaster />
            <SonnerToaster position="bottom-right" />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
