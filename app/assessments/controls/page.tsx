import { Suspense } from 'react'
import { PericopeLayout } from '@/components/pericope-layout'
import { LoadingState } from '@/components/data-state'
import { AssessmentscontrolsPage } from '@/components/pages/assessments-controls'

export default function Page() {
  return (
    <PericopeLayout>
      <Suspense fallback={<LoadingState />}>
        <AssessmentscontrolsPage />
      </Suspense>
    </PericopeLayout>
  )
}
