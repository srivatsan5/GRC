import { ProvisioningAppliedControlsPage } from '@/components/pages/provisioning-applied-controls'
import { PericopeLayout } from '@/components/pericope-layout'

export default async function AppliedControlsPage({ params }: { params: Promise<{ id: string; riskId: string }> }) {
  const { id, riskId } = await params;
  return (
    <PericopeLayout>
      <ProvisioningAppliedControlsPage assessmentId={id} riskId={riskId} />
    </PericopeLayout>
  )
}
