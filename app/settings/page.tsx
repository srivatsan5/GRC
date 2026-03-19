'use client'

import { AppLayout } from '@/components/app-layout'
import { SettingsPage } from '@/components/pages/settings'

export default function SettingsRoute() {
  return (
    <AppLayout>
      <SettingsPage />
    </AppLayout>
  )
}
