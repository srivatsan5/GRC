/** Key risk indicators: definitions (ERM_MST_KRI_DEFINITION) and readings (ERM_TRN_KRI_READINGS). */

export type KriDirection = 'HIGHER_WORSE' | 'LOWER_WORSE'
export type KriLight = 'GREEN' | 'AMBER' | 'RED'

export interface KriDefinition {
  uuid: number
  code: string
  name: string
  description: string | null
  category: string | null
  owner: string | null
  unit: string | null
  frequency: string | null
  green: number | null
  amber: number | null
  red: number | null
  direction: KriDirection
  active: boolean
  raw: Record<string, unknown>
}

export interface KriReading {
  uuid: number
  kriUuid: number
  date: string
  value: number
  light: KriLight | null
  breach: boolean
  notes: string | null
}

const n = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

export function toKri(row: Record<string, unknown>): KriDefinition {
  return {
    uuid: Number(row.uuid),
    code: String(row.kri_code ?? ''),
    name: String(row.kri_name ?? ''),
    description: (row.kri_description as string) ?? null,
    category: (row.kri_category as string) ?? null,
    owner: (row.owner_name as string) ?? null,
    unit: (row.unit_of_measure as string) ?? null,
    frequency: (row.measurement_frequency as string) ?? null,
    green: n(row.green_threshold),
    amber: n(row.amber_threshold),
    red: n(row.red_threshold),
    direction: row.direction === 'LOWER_WORSE' ? 'LOWER_WORSE' : 'HIGHER_WORSE',
    active: row.is_active !== 'N',
    raw: row,
  }
}

export function toReading(row: Record<string, unknown>): KriReading {
  return {
    uuid: Number(row.uuid),
    kriUuid: Number(row.kri_uuid),
    date: String(row.reading_date ?? row.created_on ?? ''),
    value: Number(row.reading_value),
    light: (['GREEN', 'AMBER', 'RED'].includes(String(row.traffic_light)) ? row.traffic_light : null) as KriLight | null,
    breach: row.is_breach === 'Y',
    notes: (row.breach_notes as string) ?? null,
  }
}

/** Traffic light for a value. Amber/red thresholds are the boundaries where the KRI turns that colour. */
export function kriLight(value: number | null, kri: Pick<KriDefinition, 'amber' | 'red' | 'direction'>): KriLight | null {
  if (value == null || kri.amber == null || kri.red == null) return null
  if (kri.direction === 'HIGHER_WORSE') return value >= kri.red ? 'RED' : value >= kri.amber ? 'AMBER' : 'GREEN'
  return value <= kri.red ? 'RED' : value <= kri.amber ? 'AMBER' : 'GREEN'
}

/** Threshold order must make sense for the direction. Returns a message, or null when valid. */
export function thresholdProblem(green: number, amber: number, red: number, direction: KriDirection): string | null {
  if (direction === 'HIGHER_WORSE' && !(green < amber && amber < red)) return 'For "higher is worse", thresholds must increase: green < amber < red'
  if (direction === 'LOWER_WORSE' && !(green > amber && amber > red)) return 'For "lower is worse", thresholds must decrease: green > amber > red'
  return null
}

export const LIGHT_STYLES: Record<KriLight, { text: string; bg: string; border: string; dot: string; label: string }> = {
  GREEN: { text: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Within appetite' },
  AMBER: { text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Warning' },
  RED: { text: 'text-red-800', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-600', label: 'Breach' },
}
