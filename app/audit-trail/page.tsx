'use client'

import { AppLayout } from '@/components/app-layout'
import { AuditTrailPage } from '@/components/pages/audit-trail'

export default function AuditTrailRoute() {
  return (
    <AppLayout>
      <AuditTrailPage />
    </AppLayout>
  )
}
