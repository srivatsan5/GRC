'use client'

/** Small building blocks shared by the resilience pages (vendors, incidents, BCP, scenarios). */
import React from 'react'
import { DueChip as CharterDueChip } from '@/components/charter/primitives'
import { HatchChip, nativeSelectClass, nativeTextareaClass } from '@/components/controls/charter-bits'
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

/**
 * Review / test date as a Charter chip: "12 days overdue" (danger), "Due in 9 days" (warning),
 * "Due 15 Oct 2026" (neutral) or a hatched "Not scheduled".
 */
export function DueChip({ date, soonDays = 30, none = 'Not scheduled' }: { date: string | null | undefined; soonDays?: number; overdueLabel?: string; none?: string }) {
  if (daysUntil(date) === null) return <HatchChip>{none}</HatchChip>
  return <CharterDueChip date={date} soonDays={soonDays} />
}

export { FormField as Field } from '@/components/controls/charter-bits'
export const selectClass = nativeSelectClass
export const textareaClass = nativeTextareaClass

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  // Neutralise spreadsheet formulas, but leave plain numbers (e.g. -5) as numbers.
  if (/^[=+\-@]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`
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

export { ExportCsvButton as ExportButton } from '@/components/controls/charter-bits'

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
