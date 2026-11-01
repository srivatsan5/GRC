'use client'

/** Small shared pieces for the RCSA pages (cycles, risk register, inherent assessment). */
import React, { useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useRows, type Row } from '@/lib/data'
import { IMPACT_LABELS, LIKELIHOOD_LABELS } from '@/lib/risk'

// ── Lifecycle stepper ─────────────────────────────────────────────────────────

export const RCSA_STEPS = [
  { key: 'setup', label: 'Assessment cycles', href: '/rcsa/provisioning' },
  { key: 'identify', label: 'Risk register', href: '/rcsa/identification' },
  { key: 'inherent', label: 'Inherent assessment', href: '/assessments/inherent' },
  { key: 'mitigate', label: 'Controls & mitigation', href: '/rcsa/mitigation' },
  { key: 'monitor', label: 'Monitoring', href: '/rcsa/monitoring' },
] as const

export type RcsaStep = (typeof RCSA_STEPS)[number]['key']

export function RcsaStepper({ active, right }: { active: RcsaStep; right?: React.ReactNode }) {
  return (
    <nav aria-label="RCSA lifecycle" className="bg-white border border-slate-200 rounded p-3 text-xs flex flex-wrap items-center justify-between gap-2">
      <ol className="flex flex-wrap items-center gap-2">
        {RCSA_STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-300" aria-hidden="true">&rarr;</span>}
            {s.key === active ? (
              <span aria-current="step" className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {String(i + 1).padStart(2, '0')} {s.label}
              </span>
            ) : (
              <Link href={s.href} className="text-slate-600 hover:text-slate-900 hover:underline">
                {String(i + 1).padStart(2, '0')} {s.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {right}
    </nav>
  )
}

// ── Form helpers ──────────────────────────────────────────────────────────────

export const selectClass = 'w-full h-8 px-2 border border-slate-300 rounded text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600'
export const textareaClass = 'w-full p-2 border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600'

export function Field({ id, label, required, error, hint, children, className }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs text-slate-700 font-medium mb-1">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-0.5 text-[11px] text-red-600">
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

const APPROVAL_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
  SUBMITTED: 'bg-blue-50 text-blue-800 border-blue-200',
  IN_REVIEW: 'bg-blue-50 text-blue-800 border-blue-200',
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-800 border-red-200',
}

export function approvalLabel(s: string | null | undefined): string {
  if (!s) return 'Draft'
  const t = s.replace(/_/g, ' ').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function ApprovalBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? 'DRAFT').toUpperCase()
  return <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium', APPROVAL_STYLE[s] ?? APPROVAL_STYLE.DRAFT)}>{approvalLabel(s)}</span>
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

export function SortHeader({ label, column, state, onSort, className }: { label: string; column: string; state: SortState; onSort: (s: SortState) => void; className?: string }) {
  const active = state.sort === column
  return (
    <th className={className} aria-sort={active ? (state.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="inline-flex items-center gap-1 font-semibold hover:text-slate-900" onClick={() => onSort({ sort: column, order: active && state.order === 'asc' ? 'desc' : 'asc' })}>
        {label}
        <span aria-hidden="true" className={active ? 'text-slate-700' : 'text-slate-300'}>
          {active ? (state.order === 'asc' ? '▲' : '▼') : '↕'}
        </span>
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
