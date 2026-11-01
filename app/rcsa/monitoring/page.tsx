import { Suspense } from 'react'
import { PericopeLayout } from '@/components/pericope-layout'
import { LoadingState } from '@/components/data-state'
import { RiskMonitoringPage } from '@/components/pages/risk-monitoring'

export default function MonitoringRoute() {
  return (
    <PericopeLayout>
      <Suspense fallback={<LoadingState />}>
        <RiskMonitoringPage />
      </Suspense>
    </PericopeLayout>
  )
}
