/**
 * CSV export built from rows already loaded on screen. Every field is quoted, and
 * values that a spreadsheet could treat as a formula (= + - @) are prefixed with '.
 * The export is recorded in the audit trail (the server cannot see client-side exports).
 */
import { recordAudit } from '@/lib/auditLog'

export interface CsvColumn<T> {
  header: string
  value: (row: T) => unknown
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '""'
  let s = v instanceof Date ? v.toISOString() : String(v)
  // Neutralise spreadsheet formulas, but leave plain numbers (e.g. -5) as numbers.
  if (/^[=+\-@]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map(c => cell(c.header)).join(',')]
  for (const r of rows) lines.push(columns.map(c => cell(c.value(r))).join(','))
  return lines.join('\r\n')
}

/** Downloads `rows` as a CSV file and records an EXPORT audit event. */
export function exportCsv<T>(opts: { filename: string; entity: string; description: string; rows: T[]; columns: CsvColumn<T>[] }) {
  const csv = toCsv(opts.rows, opts.columns)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opts.filename.endsWith('.csv') ? opts.filename : `${opts.filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  recordAudit({ action: 'EXPORT', entity: opts.entity, description: `${opts.description} (${opts.rows.length} rows)`, result: 'SUCCESS' })
}

/** Today's date as YYYY-MM-DD, for file names. */
export function fileDate() {
  return new Date().toISOString().slice(0, 10)
}
