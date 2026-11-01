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
    <div className="surface-panel mx-auto mt-16 max-w-md px-8 py-10 text-center" role="alert">
      <span className="mx-auto inline-flex size-11 items-center justify-center rounded-lg bg-status-warning-bg text-status-warning-fg">
        <ShieldAlert className="size-5" aria-hidden="true" />
      </span>
      <h1 className="mt-4 font-display text-section text-foreground">You don’t have access to this page</h1>
      <p className="mt-1.5 text-body-sm text-muted-foreground">Your role can’t open it. Ask an administrator if you need access.</p>
      <Link href="/dashboard" className="mt-5 inline-block text-body-sm font-medium text-primary hover:underline focus-ring rounded-xs">
        Back to dashboard
      </Link>
    </div>
  )
}
