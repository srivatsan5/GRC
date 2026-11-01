'use client'

/** Small shared pieces for the control / policy / KRI pages: labelled fields, native selects and CSV export. */
import React from 'react'
import { cn } from '@/lib/utils'
import { recordAudit } from '@/lib/auditLog'
import { nativeSelectClass } from '@/components/controls/charter-bits'

export { FormField as Field } from '@/components/controls/charter-bits'
export const selectClass = nativeSelectClass

/** Small figure tile (kept for the KRI pages); token-only. */
export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'green' | 'amber' | 'red' | 'blue' }) {
  return (
    <div className="surface-panel px-4 py-3">
      <div className="label-caps">{label}</div>
      <div
        className={cn(
          'figure mt-1 text-figure-sm',
          tone === 'green' ? 'text-status-success-fg' : tone === 'amber' ? 'text-status-warning-fg' : tone === 'red' ? 'text-status-danger-fg' : 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  )
}

/** Empty string → null, otherwise trimmed text. */
export const textOrNull = (v: string) => (v.trim() === '' ? null : v.trim())

/** '' → null, else a finite number (or NaN to let validation catch it). */
export const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v)
  // Neutralise spreadsheet formulas, but leave plain numbers (e.g. -5) as numbers.
  if (/^[=+\-@]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/** Download rows as CSV (every field quoted, formula-like values neutralised) and audit the export. */
export function exportCsv(filename: string, headers: string[], rows: unknown[][], entity: string) {
  const csv = [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  recordAudit({ action: 'EXPORT', entity, description: `Exported ${rows.length} ${entity} rows to CSV`, result: 'SUCCESS' })
}
