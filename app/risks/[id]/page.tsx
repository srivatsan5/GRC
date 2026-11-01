import { PericopeLayout } from '@/components/pericope-layout'
import { RiskDetailPage } from '@/components/risk/risk-detail-page'

/** /risks/[id] — the canonical page for one risk (every "Open risk" link points here). */
export default async function RiskRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PericopeLayout>
      <RiskDetailPage id={id} />
    </PericopeLayout>
  )
}
