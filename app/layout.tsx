import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Newsreader } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { QueryProvider } from '@/components/providers/query-provider'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog'
import { SettingsBoundary } from '@/lib/settings'
import { DensityBoundary } from '@/lib/preferences'

// Self-hosted at build time (no runtime requests to Google). The CSS variables feed the
// font stacks in app/globals.css: Inter for UI, Newsreader for figures and titles, JetBrains Mono for codes.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const newsreader = Newsreader({ subsets: ['latin'], axes: ['opsz'], style: ['normal', 'italic'], variable: '--font-newsreader', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Pericope ERM', template: '%s · Pericope ERM' },
  description: 'Enterprise risk management: risk register, controls, KRIs, approvals and audit trail.',
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${newsreader.variable} ${mono.variable}`}>
      <body>
        <QueryProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
            <AuthProvider>
              <DensityBoundary />
              <SettingsBoundary>
                <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
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
