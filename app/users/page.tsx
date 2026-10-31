'use client'

import { PericopeLayout } from '@/components/pericope-layout'
import { UserManagementPage } from '@/components/pages/user-management'

export default function Page() {
  return (
    <PericopeLayout>
      <UserManagementPage />
    </PericopeLayout>
  )
}
