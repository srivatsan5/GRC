'use client'

/** Small shared pieces for the control / policy / KRI pages: labelled fields, native selects and CSV export. */
import React from 'react'
import { cn } from '@/lib/utils'
import { recordAudit } from '@/lib/auditLog'

export const selectClass = 'w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600'

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
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs text-slate-700 font-medium mb-1">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'green' | 'amber' | 'red' | 'blue' }) {
  return (
    <div className="p-3 bg-white rounded border border-slate-200">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={cn(
          'text-xl font-semibold mt-0.5 tabular-nums',
          tone === 'green' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : tone === 'blue' ? 'text-blue-700' : 'text-slate-900',
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
