'use client'

/**
 * Standard loading / error / empty / "not set up yet" states. Use around any data:
 *
 *   <DataState query={rowsQuery} empty={rows.length === 0} emptyTitle="No vendors yet" emptyAction={...}>
 *     ...table...
 *   </DataState>
 */
import React from 'react'
import { AlertTriangle, Database, Inbox } from 'lucide-react'
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
    <div role="status" aria-live="polite" aria-label={label} className={compact ? 'space-y-2 py-3' : 'space-y-3 py-6'}>
      {Array.from({ length: compact ? 3 : 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <span className="skeleton h-4 flex-[3]" />
          <span className="skeleton h-4 flex-1" />
          <span className="skeleton h-4 w-20" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry, compact = false }: { error: unknown; onRetry?: () => unknown; compact?: boolean }) {
  if (apiErrorCode(error) === 'NOT_PROVISIONED') {
    return (
      <div role="status" className={`mx-auto max-w-lg text-center ${compact ? 'py-6' : 'py-14'}`}>
        <span className="mx-auto inline-flex size-11 items-center justify-center rounded-lg bg-status-info-bg text-status-info-fg"><Database className="size-5" aria-hidden="true" /></span>
        <p className="mt-4 font-display text-section text-foreground">This module isn’t set up in the database yet</p>
        <p className="mt-1.5 text-body-sm text-muted-foreground">{apiErrorMessage(error)} An administrator can run them (see db/README.md).</p>
      </div>
    )
  }
  return (
    <div role="alert" className={`mx-auto max-w-lg text-center ${compact ? 'py-6' : 'py-14'}`}>
      <span className="mx-auto inline-flex size-11 items-center justify-center rounded-lg bg-status-danger-bg text-status-danger-fg"><AlertTriangle className="size-5" aria-hidden="true" /></span>
      <p className="mt-4 font-display text-section text-foreground">Couldn’t load this data</p>
      <p className="mt-1.5 text-body-sm text-muted-foreground">{apiErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={() => onRetry()}>
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
      <span className="mx-auto inline-flex size-11 items-center justify-center rounded-lg bg-surface-sunken text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]"><Icon className="size-5" aria-hidden="true" /></span>
      <p className="mt-4 font-display text-section text-foreground">{title}</p>
      {description && <p className="mt-1.5 text-body-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
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
