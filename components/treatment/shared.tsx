'use client'

/**
 * Small helpers shared by the risk-treatment pages (applied controls, control testing,
 * mitigation, monitoring / action plans, mitigation-plan hierarchy). Charter tokens only.
 */
import React from 'react'
import { Check, CircleCheck, Clock, Minus, OctagonAlert, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysUntil, DASH } from '@/lib/format'
import type { Row } from '@/lib/data'
import type { Risk } from '@/lib/risk'
import { Chip, Meter } from '@/components/charter/primitives'

/** Native select styled like the Charter Input (keeps keyboard + screen-reader behaviour). */
export const selectCls =
  'h-control w-full min-w-0 rounded-md border border-input bg-card px-3 text-body text-foreground outline-none transition-[border-color,box-shadow] duration-(--duration-fast) ease-out focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_var(--selection)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive'
export const labelCls = 'mb-1.5 block text-body-sm font-medium text-foreground'
export const helpCls = 'mt-1.5 text-caption text-muted-foreground'

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
  return r.statement ?? `Risk #${r.uuid} (no statement recorded)`
}

/** Mono reference for a risk: its assessment reference as stored, or #uuid. */
export function riskRefOf(r: Risk | null | undefined, fallbackId?: number | null): string {
  if (r) return r.referenceNumber ?? `#${r.uuid}`
  return fallbackId != null ? `#${fallbackId}` : DASH
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-caption text-status-danger-fg">
      <OctagonAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

/** A form section heading inside dialogs ("CONTROL", "ASSESSMENT" …) with a hairline. */
export function FormSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn('min-w-0 space-y-4 border-t pt-4 first:border-t-0 first:pt-0', className)}>
      <legend className="label-caps float-left mb-3 w-full">{title}</legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  )
}

/** Charter checkbox row (native input, token colours). */
export function CheckboxField({ id, checked, onChange, label, help, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; help?: React.ReactNode; disabled?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-xs accent-primary focus-ring disabled:cursor-not-allowed"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        aria-describedby={help ? `${id}-help` : undefined}
      />
      <div>
        <label htmlFor={id} className="cursor-pointer text-body-sm text-foreground">
          {label}
        </label>
        {help && (
          <p id={`${id}-help`} className="text-caption text-muted-foreground">
            {help}
          </p>
        )}
      </div>
    </div>
  )
}

/** A 0–100 bar with its percentage; a dash when the value is unknown. */
export function ProgressBar({ value, className, label = 'Completion' }: { value: number | null | undefined; className?: string; label?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-body-sm text-muted-foreground">{DASH}</span>
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Meter value={v} label={label} className="w-20" tone={v >= 100 ? 'bg-status-success' : 'bg-primary'} />
      <span className="w-9 text-right text-caption font-medium tabular-nums text-foreground">{Math.round(v)}%</span>
    </div>
  )
}

// ----------------------------------------------------------------- action plans (per_trn_risk_monitoring)

export type ActionStatus = 'Completed' | 'Overdue' | 'In progress' | 'Not started'

/** @deprecated kept for compatibility; use <ActionStatusBadge>. Token classes only. */
export const ACTION_STATUS_STYLES: Record<ActionStatus, string> = {
  Completed: 'bg-status-success-bg text-status-success-fg',
  Overdue: 'bg-status-danger-bg text-status-danger-fg',
  'In progress': 'bg-status-info-bg text-status-info-fg',
  'Not started': 'bg-muted text-foreground-secondary',
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

export function ActionStatusChip({ status }: { status: ActionStatus }) {
  if (status === 'Completed') return <Chip tone="success" icon={Check}>Completed</Chip>
  if (status === 'Overdue') return <Chip tone="danger" icon={Clock}>Overdue</Chip>
  if (status === 'In progress') return <Chip tone="info" icon={Clock}>In progress</Chip>
  return <Chip tone="neutral" icon={Minus}>Not started</Chip>
}

export function ActionStatusBadge({ row }: { row: Row }) {
  return <ActionStatusChip status={actionStatus(row)} />
}

// ----------------------------------------------------------------- controls (per_trn_control_implementation)

export const EFFECTIVENESS_OPTIONS = ['Effective', 'Partially Effective', 'Ineffective'] as const
export const OPERATING_OPTIONS = ['Effective', 'Partially Effective', 'Ineffective', 'Not tested'] as const
export const FREQUENCY_OPTIONS = ['Continuous', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Event-driven'] as const
export const CONTROL_TYPE_OPTIONS = ['Preventive', 'Detective', 'Corrective', 'Compensating'] as const

type EffTone = 'success' | 'warning' | 'danger' | 'neutral'
export function effectivenessLevel(v: unknown): { tone: EffTone; icon: React.ComponentType<{ className?: string }>; short: string } | null {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return null
  if (s === 'effective') return { tone: 'success', icon: CircleCheck, short: 'effective' }
  if (s.startsWith('partially')) return { tone: 'warning', icon: TriangleAlert, short: 'partially effective' }
  if (s === 'ineffective') return { tone: 'danger', icon: OctagonAlert, short: 'ineffective' }
  if (s === 'not tested') return { tone: 'neutral', icon: Clock, short: 'not tested' }
  return { tone: 'neutral', icon: Clock, short: String(v).trim() }
}

/** Token text/background classes for an effectiveness value (kept for compatibility). */
export function effectivenessTone(v: unknown): string {
  const l = effectivenessLevel(v)
  if (!l) return 'bg-muted text-foreground-secondary'
  return { success: 'bg-status-success-bg text-status-success-fg', warning: 'bg-status-warning-bg text-status-warning-fg', danger: 'bg-status-danger-bg text-status-danger-fg', neutral: 'bg-muted text-foreground-secondary' }[l.tone]
}

/**
 * Effectiveness chip with icon. With `kind` it reads as a sentence ("Design effective",
 * "Operating partially effective"); without, it shows the stored value. Unknown → "Not assessed".
 */
export function EffectivenessChip({ value, kind, className }: { value: unknown; kind?: 'Design' | 'Operating'; className?: string }) {
  const t = text(value)
  const l = effectivenessLevel(t)
  if (!t || !l) {
    return (
      <Chip tone="neutral" icon={Minus} className={className}>
        {kind ? `${kind} not assessed` : 'Not assessed'}
      </Chip>
    )
  }
  return (
    <Chip tone={l.tone} icon={l.icon} className={className}>
      {kind ? `${kind} ${l.short}` : t}
    </Chip>
  )
}

/** @deprecated use <EffectivenessChip>. Shows a dash when empty. */
export function ValueChip({ value }: { value: unknown; tone?: string }) {
  if (!text(value)) return <span className="text-body-sm text-muted-foreground">{DASH}</span>
  return <EffectivenessChip value={value} />
}

/** "Test status" of an applied control, derived from its operating result and completion flag. */
export function testStatus(r: Row): { label: string; tone: EffTone | 'info' } {
  const op = text(r.control_effectiveness_rating)
  if (!op || op.toLowerCase() === 'not tested') return { label: 'Never tested', tone: 'neutral' }
  return r.is_stage_complted === 'Y' ? { label: 'Test complete', tone: 'success' } : { label: 'Test in progress', tone: 'info' }
}

/** Library control name for a control_id, from a uuid→row map. */
export function controlName(controlId: unknown, library: Map<number, Row>): { code: string | null; name: string } {
  const id = numOrNull(controlId)
  if (id == null) return { code: null, name: 'No library control linked' }
  const c = library.get(id)
  if (!c) return { code: null, name: `Library control #${id} (not found)` }
  return { code: text(c.control_code), name: text(c.control_name) ?? `Control #${id}` }
}

// ----------------------------------------------------------------- choice group (radio buttons in a row)

/**
 * A row of radio buttons styled like the Segmented control, for short enumerations
 * (effectiveness, status). Each option may carry an icon so colour is never alone.
 */
export function ChoiceGroup({
  legend,
  value,
  onChange,
  options,
  name,
  help,
  disabled,
}: {
  legend: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; icon?: React.ComponentType<{ className?: string }>; iconClass?: string }[]
  name: string
  help?: string
  disabled?: boolean
}) {
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className={labelCls}>{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-1 rounded-[9px] bg-surface-sunken p-[3px] shadow-[inset_0_0_0_1px_var(--border)]">
        {options.map(o => {
          const on = value === o.value
          const Icon = o.icon
          return (
            <label
              key={o.value || '__empty'}
              className={'text-caption ' + cn(
                'relative inline-flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[6px] px-2.5 font-medium whitespace-nowrap transition-[background-color,box-shadow,color] duration-(--duration-fast) ease-out has-[:focus-visible]:shadow-[0_0_0_2px_var(--ring)]',
                on ? 'bg-card text-foreground shadow-panel' : 'text-foreground-secondary hover:text-foreground',
              )}
            >
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {Icon && <Icon className={cn('size-3.5 shrink-0', on ? o.iconClass : 'text-muted-foreground')} aria-hidden="true" />}
              {o.label}
            </label>
          )
        })}
      </div>
      {help && <p className={helpCls}>{help}</p>}
    </fieldset>
  )
}

export const EFFECTIVENESS_CHOICES = [
  { value: '', label: 'Not assessed', icon: Minus },
  { value: 'Effective', label: 'Effective', icon: CircleCheck, iconClass: 'text-status-success-fg' },
  { value: 'Partially Effective', label: 'Partial', icon: TriangleAlert, iconClass: 'text-status-warning-fg' },
  { value: 'Ineffective', label: 'Ineffective', icon: OctagonAlert, iconClass: 'text-status-danger-fg' },
]
export const OPERATING_CHOICES = [...EFFECTIVENESS_CHOICES, { value: 'Not tested', label: 'Not tested', icon: Clock, iconClass: 'text-foreground-secondary' }]

// ----------------------------------------------------------------- headline figures

/** One surface-panel split into cells by hairlines (2×2 on mobile). */
export function FigureStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'surface-panel grid grid-cols-2 overflow-hidden lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none',
        '[&>*]:px-6 [&>*]:py-5 [&>*]:border-border max-lg:[&>*:nth-child(even)]:border-l max-lg:[&>*:nth-child(n+3)]:border-t max-lg:[&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*+*]:border-l',
        className,
      )}
    >
      {children}
    </section>
  )
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
