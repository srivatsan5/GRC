'use client'

import { AppLayout } from '@/components/app-layout'
import { AssetLibraryPage } from '@/components/pages/asset-library'

export default function AssetLibraryRoute() {
  return (
    <AppLayout>
      <AssetLibraryPage />
    </AppLayout>
  )
}
