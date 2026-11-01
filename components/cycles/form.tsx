'use client'

/** Charter form pieces for the cycle and inherent-assessment screens (label + hint + inline error). */
import React from 'react'
import { ChevronDown, OctagonAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fieldBase } from '@/components/ui/input'

export function FormField({
  id,
  label,
  required,
  error,
  hint,
  children,
  className,
  aside,
}: {
  id: string
  label: React.ReactNode
  required?: boolean
  error?: string
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Small text on the right of the label row (e.g. a live preview) */
  aside?: React.ReactNode
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-body-sm font-medium text-foreground">
          {label}
          {required && (
            <span className="text-muted-foreground" aria-hidden="true">
              {' '}
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {aside && <span className="text-caption text-muted-foreground">{aside}</span>}
      </div>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-caption text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-caption font-medium text-status-danger-fg">
      <OctagonAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

/** Native select on the Charter field style, with a chevron. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <span className="relative block">
      <select {...props} className={cn(fieldBase, 'h-control cursor-pointer appearance-none pr-9', className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </span>
  )
}

/** Describe an input by its hint or its error, whichever is showing. */
export function describedBy(id: string, error?: string, hint?: boolean): string | undefined {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined
}
