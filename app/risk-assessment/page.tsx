'use client'

import { AppLayout } from '@/components/app-layout'
import { RiskAssessmentPage } from '@/components/pages/risk-assessment'

export default function RiskAssessmentRoute() {
  return (
    <AppLayout>
      <RiskAssessmentPage />
    </AppLayout>
  )
}
