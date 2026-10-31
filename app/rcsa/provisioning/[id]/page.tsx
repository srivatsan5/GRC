import { ProvisioningAssessmentDetailsPage } from '@/components/pages/provisioning-assessment-details'
import { PericopeLayout } from '@/components/pericope-layout'

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PericopeLayout>
      <ProvisioningAssessmentDetailsPage assessmentId={id} />
    </PericopeLayout>
  )
}
