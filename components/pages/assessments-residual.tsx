'use client'

import { RatingAnalytics } from '@/components/reports/rating-analytics'

/** /assessments/residual: analytics over residual ratings (risk remaining after controls), with the movement view. */
export function AssessmentsresidualPage() {
  return (
    <RatingAnalytics
      which="residual"
      title="Residual analysis"
      description="Risk remaining after controls, from the residual likelihood and impact recorded on each risk, and how far controls moved it."
    />
  )
}
