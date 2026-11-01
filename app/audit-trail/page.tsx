'use client'

import { PericopeLayout } from '@/components/pericope-layout'
import { RequirePermission } from '@/components/require-permission'
import { AuditTrailPage } from '@/components/pages/audit-trail'

export default function AuditTrailRoute() {
  return (
    <PericopeLayout>
      <RequirePermission action="audit">
        <AuditTrailPage />
      </RequirePermission>
    </PericopeLayout>
  )
}
