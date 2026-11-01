'use client'

import { RatingAnalytics } from '@/components/reports/rating-analytics'

/** /assessments/access: analytics over the inherent ratings recorded on the risk register. */
export function AssessmentsaccessPage() {
  return (
    <RatingAnalytics
      which="inherent"
      title="Assessment analytics"
      description="Risk before controls across active risks, from the likelihood and impact recorded on each risk."
    />
  )
}
