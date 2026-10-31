import { MitigationRiskDetailsPage } from '@/components/pages/mitigation-risk-details'
import { PericopeLayout } from '@/components/pericope-layout'

export default async function MitigationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PericopeLayout>
      <MitigationRiskDetailsPage riskId={id} />
    </PericopeLayout>
  )
}
