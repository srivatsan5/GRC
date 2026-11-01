'use client'

import { PericopeLayout } from '@/components/pericope-layout'
import { RequirePermission } from '@/components/require-permission'
import { SettingsPage } from '@/components/pages/settings'

export default function SettingsRoute() {
  return (
    <PericopeLayout>
      <RequirePermission action="admin">
        <SettingsPage />
      </RequirePermission>
    </PericopeLayout>
  )
}
