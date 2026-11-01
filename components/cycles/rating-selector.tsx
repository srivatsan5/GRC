'use client'

/**
 * A 1–5 rating as five labelled options (native radios, so arrow keys and screen readers work):
 *   [ 1 Rare ] [ 2 Unlikely ] [ 3 Possible ] [ 4 Likely ] [ 5 Almost certain ]
 */
import React from 'react'
import { cn } from '@/lib/utils'
import { IMPACT_LABELS, LIKELIHOOD_LABELS } from '@/lib/risk'
import { FieldError } from './form'

export function RatingSelector({
  id,
  kind,
  value,
  onChange,
  error,
  required,
}: {
  id: string
  kind: 'likelihood' | 'impact'
  value: string
  onChange: (v: string) => void
  error?: string
  required?: boolean
}) {
  const labels = kind === 'likelihood' ? LIKELIHOOD_LABELS : IMPACT_LABELS
  const title = kind === 'likelihood' ? 'Likelihood' : 'Impact'
  const picked = value ? Number(value) : null
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="text-body-sm font-medium text-foreground">
          {title}
          {required && (
            <span className="text-muted-foreground" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </span>
        <span className="text-caption text-muted-foreground">{picked ? `${picked} – ${labels[picked - 1]}` : 'Not chosen'}</span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-required={required || undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="grid grid-cols-1 gap-1.5 sm:grid-cols-5 sm:gap-2"
      >
        {labels.map((label, idx) => {
          const n = idx + 1
          const on = picked === n
          return (
            <label
              key={label}
              className={cn(
                'relative flex min-w-0 cursor-pointer flex-row items-center gap-3 rounded-md bg-card px-3 py-2 transition-[background-color,box-shadow] duration-(--duration-fast) ease-out sm:flex-col sm:items-stretch sm:gap-1.5 sm:py-2.5',
                'shadow-[inset_0_0_0_1px_var(--border-strong)] hover:bg-surface-sunken',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                on && 'bg-accent shadow-[inset_0_0_0_2px_var(--primary)] hover:bg-accent',
                error && !on && 'shadow-[inset_0_0_0_1px_var(--destructive)]',
              )}
            >
              <input type="radio" name={id} value={String(n)} checked={on} onChange={() => onChange(String(n))} className="sr-only" />
              <span className="flex w-8 shrink-0 items-center justify-between gap-1 sm:w-auto">
                <span className={cn('figure text-figure-sm leading-none', on ? 'text-primary' : 'text-foreground')}>{n}</span>
                <span aria-hidden="true" className="hidden items-end gap-[2px] sm:inline-flex">
                  {[1, 2, 3, 4, 5].map(k => (
                    <span key={k} className={cn('w-[3px] rounded-[1px]', k <= n ? (on ? 'bg-primary' : 'bg-foreground-secondary') : 'bg-border-strong')} style={{ height: 3 + k * 1.5 }} />
                  ))}
                </span>
              </span>
              <span className={cn('line-clamp-2 text-caption leading-tight', on ? 'font-medium text-foreground' : 'text-foreground-secondary')}>{label}</span>
            </label>
          )
        })}
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}
