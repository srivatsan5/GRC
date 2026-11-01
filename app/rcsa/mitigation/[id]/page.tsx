import { redirect } from 'next/navigation'

/** The canonical risk page is /risks/[id]; keep old mitigation links working. */
export default async function MitigationDetailsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/risks/${encodeURIComponent(id)}`)
}
