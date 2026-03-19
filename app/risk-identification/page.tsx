'use client'

import { AppLayout } from '@/components/app-layout'
import { RiskIdentificationPage } from '@/components/pages/risk-identification'

export default function RiskIdentificationRoute() {
  return (
    <AppLayout>
      <RiskIdentificationPage />
    </AppLayout>
  )
}
