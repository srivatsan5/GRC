'use client'

import React from 'react'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'

type Action = Parameters<ReturnType<typeof useAuth>['hasPermission']>[0]

/** Renders children only when the signed-in user has the permission. The API enforces the same rule. */
export function RequirePermission({ action, children }: { action: Action; children: React.ReactNode }) {
  const { hasPermission } = useAuth()
  if (hasPermission(action)) return <>{children}</>
  return (
    <div className="max-w-md mx-auto mt-16 text-center bg-white border border-slate-200 rounded-lg p-8" role="alert">
      <ShieldAlert className="w-8 h-8 mx-auto text-slate-400" aria-hidden="true" />
      <h1 className="mt-3 text-base font-semibold text-slate-900">You don’t have access to this page</h1>
      <p className="mt-1 text-sm text-slate-500">Ask an administrator if you need it.</p>
      <Link href="/dashboard" className="mt-4 inline-block text-sm text-blue-700 hover:underline">Back to dashboard</Link>
    </div>
  )
}
