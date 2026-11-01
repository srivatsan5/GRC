/** Derivations over action plans, KRIs and incidents shared by the dashboard and reports. */
import type { Row } from '@/lib/data'
import { daysUntil } from '@/lib/format'
import { kriLight, toKri, toReading, type KriDefinition, type KriLight, type KriReading } from '@/lib/kri'

const num = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

/** An action plan is complete when it is at 100% or its stage is marked complete. */
export function planComplete(row: Row): boolean {
  const pct = num(row.completion_pct)
  return (pct != null && pct >= 100) || row.is_stage_complted === 'Y'
}

/** Overdue = not complete and its estimated end date is before today. */
export function planOverdue(row: Row): boolean {
  if (planComplete(row)) return false
  const d = daysUntil(row.estimated_end_date)
  return d != null && d < 0
}

export interface KriStatus {
  kri: KriDefinition
  latest: KriReading | null
  light: KriLight | null
}

function readingTime(r: KriReading) {
  const t = new Date(r.date).getTime()
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

/** Each active KRI with its latest reading and the light computed from its thresholds. */
export function kriStatuses(defRows: Row[], readingRows: Row[]): KriStatus[] {
  const latest = new Map<number, KriReading>()
  for (const row of readingRows) {
    const r = toReading(row)
    if (!Number.isFinite(r.value)) continue
    const prev = latest.get(r.kriUuid)
    if (!prev || readingTime(r) > readingTime(prev)) latest.set(r.kriUuid, r)
  }
  return defRows
    .map(toKri)
    .filter(k => k.active)
    .map(kri => {
      const r = latest.get(kri.uuid) ?? null
      return { kri, latest: r, light: r ? kriLight(r.value, kri) ?? r.light : null }
    })
}

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const
export const OPEN_INCIDENT_STATUSES = ['Open', 'Investigating']

/** Open = not Mitigated or Closed. A missing status counts as open. */
export function incidentOpen(row: Row): boolean {
  const s = String(row.status ?? '').trim().toLowerCase()
  return s !== 'closed' && s !== 'mitigated'
}

export function numOrNull(v: unknown): number | null {
  return num(v)
}
