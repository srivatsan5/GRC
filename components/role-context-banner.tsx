'use client'

import React from 'react'
import { Eye, Shield } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'

export function RoleContextBanner() {
  const { user } = useAuth()
  if (!user) return null

  const role = user.role

  if (role === 'Auditor') {
    return (
      <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50 text-amber-900 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>
            <strong>Auditor mode (read-only):</strong> You have view access to all records, control workpapers, and the audit log.
          </span>
        </div>
      </div>
    )
  }

  if (role === 'Viewer') {
    return (
      <div className="mb-4 p-3 rounded border border-slate-200 bg-slate-100 text-slate-700 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span>
            <strong>Viewer mode:</strong> You have read-only access to dashboards, heatmaps, and reports.
          </span>
        </div>
      </div>
    )
  }

  return null
}
