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

/**
 * Traffic-light classes, built on the --kri-* tokens in globals.css (AA in light and dark).
 *  - text / bg / border: the status pill
 *  - dot:  the light on its own (chart threshold bands, legend)
 *  - band: the shaded threshold band behind a KRI line chart
 *  - icon: the Lucide icon that always travels with the colour, so status is never colour-only
 *    (circle-check → CircleCheck, triangle-alert → TriangleAlert, octagon-alert → OctagonAlert)
 */
export interface LightStyle {
  text: string
  bg: string
  border: string
  dot: string
  band: string
  icon: 'circle-check' | 'triangle-alert' | 'octagon-alert'
  label: string
}

export const LIGHT_STYLES: Record<KriLight, LightStyle> = {
  GREEN: {
    text: 'text-kri-green-fg',
    bg: 'bg-kri-green-bg',
    border: 'border-kri-green/40',
    dot: 'bg-kri-green',
    band: 'fill-kri-green-bg',
    icon: 'circle-check',
    label: 'Within appetite',
  },
  AMBER: {
    text: 'text-kri-amber-fg',
    bg: 'bg-kri-amber-bg',
    border: 'border-kri-amber/50',
    dot: 'bg-kri-amber',
    band: 'fill-kri-amber-bg',
    icon: 'triangle-alert',
    label: 'Warning',
  },
  RED: {
    text: 'text-kri-red-fg',
    bg: 'bg-kri-red-bg',
    border: 'border-kri-red/50',
    dot: 'bg-kri-red',
    band: 'fill-kri-red-bg',
    icon: 'octagon-alert',
    label: 'Breach',
  },
}
