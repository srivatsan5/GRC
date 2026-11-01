'use client'

import { Suspense } from 'react'
import { PericopeLayout } from '@/components/pericope-layout'
import { LoadingState } from '@/components/data-state'
import { WorkflowPage } from '@/components/pages/workflow'

export default function Page() {
  return (
    <PericopeLayout>
      <Suspense fallback={<LoadingState />}>
        <WorkflowPage />
      </Suspense>
    </PericopeLayout>
  )
}
