'use client'

import { useEffect } from 'react'
import { seedIfEmpty } from '@/lib/auditLog'

/**
 * Mounts once on the client, seeds the audit log with realistic user-attributed
 * entries the first time the app loads. Subsequent loads are no-ops.
 */
export function AuditSeeder() {
  useEffect(() => {
    seedIfEmpty()
  }, [])
  return null
}
