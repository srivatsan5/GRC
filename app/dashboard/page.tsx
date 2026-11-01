'use client'

import dynamic from 'next/dynamic'
import { PericopeLayout } from '@/components/pericope-layout'

// Lazy-load the dashboard; the placeholder mirrors its Charter layout (header, headline panel, hero row).
const Dashboard = dynamic(() => import('@/components/pages/dashboard').then(mod => mod.Dashboard), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-3">
        <span className="skeleton block h-4 w-64" />
        <span className="skeleton block h-11 w-96 max-w-full" />
      </div>
      <div className="surface-panel h-44" />
      <span className="skeleton block h-5 w-2/3" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="surface-panel h-[560px]" />
        <div className="surface-panel h-[560px]" />
      </div>
    </div>
  ),
})

export default function DashboardPage() {
  return (
    <PericopeLayout>
      <Dashboard />
    </PericopeLayout>
  )
}
