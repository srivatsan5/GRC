'use client'

/**
 * Charter form pieces for the governance screens (approvals, KRIs, appetite, settings):
 * a labelled field with help text and an inline error, a native select on the input tokens,
 * and a small inline error line. Token classes only.
 */
import React from 'react'
import { ChevronDown, OctagonAlert } from 'lucide-react'
import { fieldBase } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Native select styled like Input (h-control, tokens, focus ring, aria-invalid). Use <Select> for the chevron. */
export const selectClass = cn(fieldBase, 'h-control appearance-none pr-9')

export function Select({ className, wrapperClassName, ...props }: React.ComponentProps<'select'> & { wrapperClassName?: string }) {
  return (
    <span className={cn('relative block', wrapperClassName)}>
      <select className={cn(selectClass, className)} {...props} />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </span>
  )
}

export function FieldError({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <p id={id} role="alert" className={cn('mt-1.5 flex items-start gap-1.5 text-caption text-status-danger-fg', className)}>
      <OctagonAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

export function Field({
  id,
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: React.ReactNode
  required?: boolean
  error?: string | null
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 block text-body-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="text-muted-foreground" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint ? <p className="mt-1.5 text-caption text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** aria props wiring an input to its Field error. */
export function invalid(id: string, error: string | null | undefined) {
  return error ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {}
}

/** A labelled checkbox on tokens (accent-primary). */
export function Checkbox({ id, label, checked, onChange }: { id: string; label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="inline-flex h-control cursor-pointer items-center gap-2 text-body-sm text-foreground-secondary select-none hover:text-foreground">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="size-4 rounded-xs accent-primary focus-ring" />
      {label}
    </label>
  )
}

