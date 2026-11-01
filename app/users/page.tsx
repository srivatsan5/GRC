'use client'

import { PericopeLayout } from '@/components/pericope-layout'
import { RequirePermission } from '@/components/require-permission'
import { UserManagementPage } from '@/components/pages/user-management'

export default function Page() {
  return (
    <PericopeLayout>
      <RequirePermission action="admin">
        <UserManagementPage />
      </RequirePermission>
    </PericopeLayout>
  )
}
