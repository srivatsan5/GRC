'use client'

import { Suspense } from 'react'
import { PericopeLayout } from '@/components/pericope-layout'
import { LoadingState } from '@/components/data-state'
import { KriIntelligencePage } from '@/components/pages/kri-intelligence'

export default function Page() {
  return (
    <PericopeLayout>
      <Suspense fallback={<LoadingState />}>
        <KriIntelligencePage />
      </Suspense>
    </PericopeLayout>
  )
}
