'use client'

/** Small shared pieces for the RCSA pages (cycles, risk register, inherent assessment). */
import React, { useMemo } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRows, type Row } from '@/lib/data'
import { IMPACT_LABELS, LIKELIHOOD_LABELS } from '@/lib/risk'
import { LifecycleStepper, type LifecycleStage } from '@/components/charter/lifecycle-stepper'
import { ApprovalBadge as CharterApprovalBadge } from '@/components/charter/primitives'

// ── Lifecycle stepper ─────────────────────────────────────────────────────────

export const RCSA_STEPS = [
  { key: 'setup', label: 'Assessment cycles', href: '/rcsa/provisioning' },
  { key: 'identify', label: 'Risk register', href: '/rcsa/identification' },
  { key: 'inherent', label: 'Inherent assessment', href: '/assessments/inherent' },
  { key: 'mitigate', label: 'Controls & mitigation', href: '/rcsa/mitigation' },
  { key: 'monitor', label: 'Monitoring', href: '/rcsa/monitoring' },
] as const

export type RcsaStep = (typeof RCSA_STEPS)[number]['key']

const STAGE_FOR: Record<RcsaStep, LifecycleStage> = { setup: 'cycles', identify: 'register', inherent: 'inherent', mitigate: 'controls', monitor: 'monitoring' }

/** Legacy API kept for older callers: renders the Charter LifecycleStepper (plus any `right` actions under it). */
export function RcsaStepper({ active, right }: { active: RcsaStep; right?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <LifecycleStepper current={STAGE_FOR[active]} />
      {right && <div className="flex flex-wrap items-center justify-end gap-2">{right}</div>}
    </div>
  )
}

// ── Form helpers ──────────────────────────────────────────────────────────────

export const selectClass =
  'h-control w-full rounded-md border border-input bg-card px-3 text-body text-foreground outline-none transition-[border-color,box-shadow] duration-(--duration-fast) ease-out focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_var(--selection)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive'
export const textareaClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-body leading-relaxed text-foreground placeholder:text-muted-foreground outline-none transition-[border-color,box-shadow] duration-(--duration-fast) ease-out focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_var(--selection)] aria-invalid:border-destructive'

export function Field({ id, label, required, error, hint, children, className }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-body-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="text-status-danger-fg" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-caption text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-caption text-status-danger-fg">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

/** <select> for a 1–5 rating with its label, plus an explicit "Not rated" option. */
export function RatingSelect({ id, kind, value, onChange, invalid }: { id: string; kind: 'likelihood' | 'impact'; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const labels = kind === 'likelihood' ? LIKELIHOOD_LABELS : IMPACT_LABELS
  return (
    <select id={id} value={value} onChange={e => onChange(e.target.value)} className={selectClass} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}>
      <option value="">Not rated</option>
      {labels.map((l, i) => (
        <option key={l} value={String(i + 1)}>
          {i + 1} – {l}
        </option>
      ))}
    </select>
  )
}

export function ratingLabel(kind: 'likelihood' | 'impact', v: number | null): string {
  if (v == null) return '—'
  const labels = kind === 'likelihood' ? LIKELIHOOD_LABELS : IMPACT_LABELS
  return `${v} – ${labels[v - 1]}`
}

// ── Reference data (column names undocumented: use defensively) ─────────────

function nameOf(row: Row): string | null {
  const keys = Object.keys(row)
  const preferred = keys.find(k => /(^|_)name$/.test(k) && !/uuid|_by$/.test(k)) ?? keys.find(k => /name|title|description|desc/.test(k) && !/uuid|_by$/.test(k))
  const v = preferred ? row[preferred] : null
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * Suggestions for a free-text field: names from a reference table (if it exists and has a
 * name-like column) merged with values already used. Failures just mean fewer suggestions.
 */
export function useNameOptions(refTable: string | null, used: (string | null | undefined)[] = []): string[] {
  const ref = useRows(refTable ?? '__none__', { enabled: !!refTable })
  return useMemo(() => {
    const set = new Set<string>()
    if (!ref.isError) for (const r of ref.data ?? []) {
      const n = nameOf(r)
      if (n) set.add(n)
    }
    for (const u of used) if (u && u.trim()) set.add(u.trim())
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [ref.data, ref.isError, used])
}

// ── Approval status ──────────────────────────────────────────────────────────

export const APPROVAL_STATUSES = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PENDING', 'APPROVED', 'REJECTED'] as const

export function approvalLabel(s: string | null | undefined): string {
  if (!s) return 'Draft'
  const t = s.replace(/_/g, ' ').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Approval status of a register row (a missing status reads as Draft), always icon + word. */
export function ApprovalBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  return <CharterApprovalBadge status={(status ?? 'DRAFT').toUpperCase()} className={className} />
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** Quote every field; neutralise spreadsheet formulas (= + - @). */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v)
  // Neutralise spreadsheet formulas, but leave plain numbers (e.g. -5) as numbers.
  if (/^[=+\-@]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const text = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** RFC 4180-style parser: quoted fields, escaped quotes ("") and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter(r => r.some(f => f.trim() !== ''))
}

// ── Sortable header (server-side sort) ───────────────────────────────────────

export interface SortState {
  sort: string
  order: 'asc' | 'desc'
}

export function SortHeader({ label, column, state, onSort, className, numeric }: { label: string; column: string; state: SortState; onSort: (s: SortState) => void; className?: string; numeric?: boolean }) {
  const active = state.sort === column
  const Icon = active ? (state.order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <th className={className} data-numeric={numeric || undefined} aria-sort={active ? (state.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={cn('-mx-1 inline-flex items-center gap-1 rounded-xs px-1 uppercase transition-colors hover:text-foreground focus-ring', active && 'text-foreground')}
        onClick={() => onSort({ sort: column, order: active && state.order === 'asc' ? 'desc' : 'asc' })}
      >
        {label}
        <Icon className={cn('size-3', !active && 'opacity-40')} aria-hidden="true" />
      </button>
    </th>
  )
}

/** Debounce a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
