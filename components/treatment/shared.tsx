'use client'

/**
 * Small helpers shared by the risk-treatment pages (applied controls, control testing,
 * mitigation, monitoring / action plans, mitigation-plan hierarchy).
 */
import React from 'react'
import { cn } from '@/lib/utils'
import { daysUntil, DASH } from '@/lib/format'
import type { Row } from '@/lib/data'
import type { Risk } from '@/lib/risk'

export const selectCls =
  'w-full h-9 px-2 border border-slate-200 rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 disabled:opacity-60'
export const labelCls = 'block text-xs font-medium text-slate-700 mb-1'

/** Primary key of a row. */
export function rowId(r: Row | null | undefined): number | null {
  if (!r) return null
  const n = Number(r.uuid ?? r.id)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function text(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' || s === 'null' ? null : s
}

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function riskLabel(r: Risk | null | undefined, fallbackId?: number | string | null): string {
  if (!r) return fallbackId != null && fallbackId !== '' ? `Risk #${fallbackId} (not found)` : DASH
  return r.statement ?? `Risk #${r.uuid} (no statement)`
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1 text-[11px] text-red-600">
      {message}
    </p>
  )
}

/** A 0–100 bar; shows a dash when the value is unknown. */
export function ProgressBar({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-xs text-slate-400">{DASH}</span>
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn('h-full rounded-full', v >= 100 ? 'bg-emerald-500' : 'bg-blue-600')} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-600">{Math.round(v)}%</span>
    </div>
  )
}

// ----------------------------------------------------------------- action plans (per_trn_risk_monitoring)

export type ActionStatus = 'Completed' | 'Overdue' | 'In progress' | 'Not started'

export const ACTION_STATUS_STYLES: Record<ActionStatus, string> = {
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Overdue: 'border-red-200 bg-red-50 text-red-700',
  'In progress': 'border-blue-200 bg-blue-50 text-blue-700',
  'Not started': 'border-slate-200 bg-slate-50 text-slate-600',
}

export function isActionComplete(r: Row): boolean {
  return r.is_stage_complted === 'Y' || (numOrNull(r.completion_pct) ?? 0) >= 100 || !!text(r.actual_end_date)
}

/** Status derived from the record's dates and progress (never from a stored "overdue" flag). */
export function actionStatus(r: Row, now = new Date()): ActionStatus {
  if (isActionComplete(r)) return 'Completed'
  const due = daysUntil(text(r.estimated_end_date), now)
  if (due != null && due < 0) return 'Overdue'
  const pct = numOrNull(r.completion_pct) ?? 0
  if (pct > 0 || text(r.actual_start_date)) return 'In progress'
  return 'Not started'
}

export function ActionStatusBadge({ row }: { row: Row }) {
  const s = actionStatus(row)
  return <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium', ACTION_STATUS_STYLES[s])}>{s}</span>
}

// ----------------------------------------------------------------- controls (per_trn_control_implementation)

export const EFFECTIVENESS_OPTIONS = ['Effective', 'Partially Effective', 'Ineffective'] as const
export const OPERATING_OPTIONS = ['Effective', 'Partially Effective', 'Ineffective', 'Not tested'] as const
export const FREQUENCY_OPTIONS = ['Continuous', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Event-driven'] as const
export const CONTROL_TYPE_OPTIONS = ['Preventive', 'Detective', 'Corrective', 'Compensating'] as const

export function effectivenessTone(v: unknown): string {
  const s = String(v ?? '').toLowerCase()
  if (s === 'effective') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (s.startsWith('partially')) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (s === 'ineffective') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

export function ValueChip({ value, tone }: { value: unknown; tone?: string }) {
  const t = text(value)
  if (!t) return <span className="text-xs text-slate-400">{DASH}</span>
  return <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium', tone ?? effectivenessTone(t))}>{t}</span>
}

/** Library control name for a control_id, from a uuid→row map. */
export function controlName(controlId: unknown, library: Map<number, Row>): { code: string | null; name: string } {
  const id = numOrNull(controlId)
  if (id == null) return { code: null, name: 'No library control linked' }
  const c = library.get(id)
  if (!c) return { code: null, name: `Library control #${id} (not found)` }
  return { code: text(c.control_code), name: text(c.control_name) ?? `Control #${id}` }
}

// ----------------------------------------------------------------- CSV

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  // Neutralise spreadsheet formulas, but leave plain numbers (e.g. -5) as numbers.
  if (/^[=+\-@]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))]
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Client-side paging helper for lists built from useRows. */
export function pageSlice<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize)
}
