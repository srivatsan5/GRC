'use client'

/**
 * Standard loading / error / empty / "not set up yet" states. Use around any data:
 *
 *   <DataState query={rowsQuery} empty={rows.length === 0} emptyTitle="No vendors yet" emptyAction={...}>
 *     ...table...
 *   </DataState>
 */
import React from 'react'
import { AlertTriangle, Database, Inbox, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiErrorCode, apiErrorMessage } from '@/lib/apiClient'

interface QueryLike {
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
}

export function LoadingState({ label = 'Loading…', compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-2 text-sm text-slate-500 ${compact ? 'py-6' : 'py-16'}`}>
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry, compact = false }: { error: unknown; onRetry?: () => unknown; compact?: boolean }) {
  if (apiErrorCode(error) === 'NOT_PROVISIONED') {
    return (
      <div role="status" className={`mx-auto max-w-lg text-center ${compact ? 'py-6' : 'py-14'}`}>
        <Database className="w-7 h-7 mx-auto text-slate-400" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900">This module isn’t set up in the database yet</p>
        <p className="mt-1 text-xs text-slate-500">{apiErrorMessage(error)} An administrator can run them (see db/README.md).</p>
      </div>
    )
  }
  return (
    <div role="alert" className={`mx-auto max-w-lg text-center ${compact ? 'py-6' : 'py-14'}`}>
      <AlertTriangle className="w-7 h-7 mx-auto text-red-500" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-slate-900">Couldn’t load this data</p>
      <p className="mt-1 text-xs text-slate-500">{apiErrorMessage(error)}</p>
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-4" onClick={() => onRetry()}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  compact = false,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  compact?: boolean
}) {
  return (
    <div className={`mx-auto max-w-md text-center ${compact ? 'py-6' : 'py-14'}`}>
      <Icon className="w-7 h-7 mx-auto text-slate-300" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function DataState({
  query,
  empty,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  compact,
  children,
}: {
  query: QueryLike | QueryLike[]
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  compact?: boolean
  children: React.ReactNode
}) {
  const queries = Array.isArray(query) ? query : [query]
  const failed = queries.find(q => q.isError)
  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach(q => q.isError && q.refetch())} compact={compact} />
  if (queries.some(q => q.isLoading)) return <LoadingState compact={compact} />
  if (empty) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} compact={compact} />
  return <>{children}</>
}
