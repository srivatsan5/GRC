import { Suspense } from 'react'
import { PericopeLayout } from '@/components/pericope-layout'
import { LoadingState } from '@/components/data-state'
import { MonitoringactionplanPage } from '@/components/pages/monitoring-action-plan'

export default function Page() {
  return (
    <PericopeLayout>
      <Suspense fallback={<LoadingState />}>
        <MonitoringactionplanPage />
      </Suspense>
    </PericopeLayout>
  )
}
