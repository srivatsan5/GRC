'use client'

import dynamic from 'next/dynamic'
import { PericopeLayout } from '@/components/pericope-layout'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy-load the heavy Dashboard component
const Dashboard = dynamic(
  () => import('@/components/pages/dashboard').then(mod => mod.Dashboard),
  { 
    ssr: false,
    loading: () => (
      <div className="space-y-8 animate-pulse">
        <div className="flex justify-between items-end">
          <div className="space-y-3">
             <Skeleton className="h-4 w-24" />
             <Skeleton className="h-10 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-12 gap-8">
          <Skeleton className="col-span-8 h-[400px] rounded-[2.5rem]" />
          <div className="col-span-4 flex flex-col gap-8">
            <Skeleton className="h-[200px] rounded-[2.5rem]" />
            <Skeleton className="h-[200px] rounded-[2.5rem]" />
          </div>
        </div>
      </div>
    )
  }
)

export default function DashboardPage() {
  return (
    <PericopeLayout>
      <Dashboard />
    </PericopeLayout>
  )
}
