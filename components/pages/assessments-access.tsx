'use client'

import { AssessmentAnalytics } from '@/components/analytics/assessment-analytics'

/** /assessments/access: analytics over the inherent ratings recorded on the risk register. */
export function AssessmentsaccessPage() {
  return (
    <AssessmentAnalytics
      which="inherent"
      title="Assessment analytics"
      description="Inherent risk (before controls) across active risks, from the likelihood and impact ratings recorded on each risk"
    />
  )
}
