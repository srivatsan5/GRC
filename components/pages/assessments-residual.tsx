'use client'

import { AssessmentAnalytics } from '@/components/analytics/assessment-analytics'

/** /assessments/residual: analytics over residual ratings only (risk remaining after controls). */
export function AssessmentsresidualPage() {
  return (
    <AssessmentAnalytics
      which="residual"
      title="Residual risk analysis"
      description="Risk remaining after controls, from the residual likelihood and impact ratings recorded on each risk"
    />
  )
}
