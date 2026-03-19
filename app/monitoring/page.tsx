'use client'

import { AppLayout } from '@/components/app-layout'
import { MonitoringPage } from '@/components/pages/monitoring'

export default function MonitoringRoute() {
  return (
    <AppLayout>
      <MonitoringPage />
    </AppLayout>
  )
}
