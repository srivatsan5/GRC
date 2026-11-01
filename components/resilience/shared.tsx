'use client'

/** Small building blocks shared by the resilience pages (vendors, incidents, BCP, scenarios). */
import React from 'react'
import { Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { daysUntil } from '@/lib/format'
import { recordAudit } from '@/lib/auditLog'
import type { Row } from '@/lib/data'

/** A finite number from a DB value, or null. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** A trimmed string from a DB value, or null. */
export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

/** Today as YYYY-MM-DD in local time. */
export function todayInput(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Empty string → null (so cleared form fields clear the column). */
export const orNull = (v: string) => (v.trim() === '' ? null : v.trim())

/** Parse a numeric form field: '' → null, otherwise a number (NaN when invalid). */
export const parseNum = (v: string): number | null => (v.trim() === '' ? null : Number(v))

export type DueState = 'overdue' | 'due-soon' | 'scheduled' | 'none'

/** Derive due state from a date: overdue (< today), due soon (within `soonDays`), scheduled, or no date. */
export function dueState(date: string | null | undefined, soonDays = 30): { state: DueState; days: number | null } {
  const days = daysUntil(date)
  if (days === null) return { state: 'none', days }
  if (days < 0) return { state: 'overdue', days }
  if (days <= soonDays) return { state: 'due-soon', days }
  return { state: 'scheduled', days }
}

export function DueChip({ date, soonDays = 30, overdueLabel = 'Overdue', none = 'Not scheduled' }: { date: string | null | undefined; soonDays?: number; overdueLabel?: string; none?: string }) {
  const { state, days } = dueState(date, soonDays)
  if (state === 'none') return <span className="text-[11px] text-slate-400">{none}</span>
  if (state === 'overdue')
    return (
      <span className="inline-flex items-center rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
        {overdueLabel} · {Math.abs(days!)}d
      </span>
    )
  if (state === 'due-soon')
    return (
      <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
        Due {days === 0 ? 'today' : `in ${days}d`}
      </span>
    )
  return <span className="text-[11px] text-slate-500">In {days}d</span>
}

export function Kpi({ label, value, hint, tone = 'default' }: { label: string; value: React.ReactNode; hint?: string; tone?: 'default' | 'danger' | 'warning' | 'success' }) {
  const labelTone = { default: 'text-slate-500', danger: 'text-rose-600', warning: 'text-amber-600', success: 'text-emerald-600' }[tone]
  const valueTone = { default: 'text-slate-900', danger: 'text-rose-700', warning: 'text-amber-700', success: 'text-emerald-700' }[tone]
  return (
    <div className="p-3 bg-white rounded border border-slate-200">
      <div className={cn('text-xs', labelTone)}>{label}</div>
      <div className={cn('text-xl font-semibold mt-0.5 tabular-nums', valueTone)}>{value}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  )
}

export function SearchBox({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
      <Input id={id} type="search" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="pl-8 h-8 text-xs bg-white" />
    </div>
  )
}

/** A segmented "All | A | B" filter made of real buttons. */
export function FilterTabs<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T | 'All'; onChange: (v: T | 'All') => void }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
      {(['All', ...options] as (T | 'All')[]).map(t => (
        <button
          key={t}
          type="button"
          aria-pressed={value === t}
          onClick={() => onChange(t)}
          className={cn('px-2.5 py-1 rounded text-xs transition-colors', value === t ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900')}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

/** Label + control + inline error. */
export function Field({ id, label, required, error, hint, children, className }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs text-slate-700 font-medium mb-1">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export const selectClass = 'w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white'
export const textareaClass = 'w-full min-h-[64px] px-2 py-1.5 border border-slate-200 rounded text-xs bg-white'

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/** Download rows as CSV (every field quoted, formula-like values neutralised) and record the export. */
export function exportCsv(filename: string, columns: { key: string; label: string }[], rows: Row[], entity: string) {
  const lines = [columns.map(c => csvCell(c.label)).join(','), ...rows.map(r => columns.map(c => csvCell(r[c.key])).join(','))]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  recordAudit({ action: 'EXPORT', entity, description: `Exported ${rows.length} ${entity.toLowerCase()} record(s) to CSV`, result: 'SUCCESS' })
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
      Export CSV
    </Button>
  )
}

/** The value, updated only after it stops changing for `ms` (for search boxes that hit the server). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Plain-language list of what failed validation, for the toast when a form can't be submitted. */
export const hasErrors = (errors: Record<string, string | undefined>) => Object.values(errors).some(Boolean)
