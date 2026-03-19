'use client'

import { AppLayout } from '@/components/app-layout'
import { Dashboard } from '@/components/pages/dashboard'

export default function Home() {
  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  )
}
