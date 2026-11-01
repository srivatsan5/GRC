/**
 * Risk records and scoring — the single source of truth for the web app.
 *
 * Rules:
 *  - Nothing is invented. A risk without likelihood/impact ratings is "not rated"
 *    (score = null); it is never given a score derived from its id or its money value.
 *  - Score = likelihood × impact (each 1–5, so 1–25).
 *  - Bands come from organisation settings (Settings → risk bands); DEFAULT_BANDS
 *    is only the fallback.
 */

export type Band = 'Low' | 'Moderate' | 'High' | 'Critical'
export const BANDS: Band[] = ['Low', 'Moderate', 'High', 'Critical']

/** A score at or above a threshold falls in that band. */
export interface RiskBands {
  moderate: number
  high: number
  critical: number
}
export const DEFAULT_BANDS: RiskBands = { moderate: 7, high: 12, critical: 16 }

export const LIKELIHOOD_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'] as const
export const IMPACT_LABELS = ['Insignificant', 'Minor', 'Moderate', 'Major', 'Severe'] as const

export function bandOf(score: number | null | undefined, bands: RiskBands = DEFAULT_BANDS): Band | null {
  if (score == null || !Number.isFinite(score)) return null
  if (score >= bands.critical) return 'Critical'
  if (score >= bands.high) return 'High'
  if (score >= bands.moderate) return 'Moderate'
  return 'Low'
}

/**
 * Tailwind classes per band, built on the --risk-* tokens in globals.css. Never use ad-hoc colours.
 *
 *  - text / bg / border: the soft treatment (coloured text on a wash, with a keyline)
 *  - dot:   the band colour on its own (legend swatches, chart marks)
 *  - solid: filled badge or occupied heatmap cell (band fill + its own AA text colour)
 *  - cell:  heatmap cell with no risks in it (wash + AA text), so the matrix still shows the zones
 *  - level: 1–4, drives the signal-bar glyph so the band never relies on colour alone
 *
 * Every pairing here passes WCAG AA (4.5:1) in light and dark.
 */
export interface BandStyle {
  text: string
  bg: string
  border: string
  dot: string
  solid: string
  cell: string
  level: 1 | 2 | 3 | 4
}

export const BAND_STYLES: Record<Band, BandStyle> = {
  Low: {
    text: 'text-risk-low-text',
    bg: 'bg-risk-low-bg',
    border: 'border-risk-low-border',
    dot: 'bg-risk-low',
    solid: 'bg-risk-low text-risk-low-fg',
    cell: 'bg-risk-low-bg text-risk-low-text',
    level: 1,
  },
  Moderate: {
    text: 'text-risk-moderate-text',
    bg: 'bg-risk-moderate-bg',
    border: 'border-risk-moderate-border',
    dot: 'bg-risk-moderate',
    solid: 'bg-risk-moderate text-risk-moderate-fg',
    cell: 'bg-risk-moderate-bg text-risk-moderate-text',
    level: 2,
  },
  High: {
    text: 'text-risk-high-text',
    bg: 'bg-risk-high-bg',
    border: 'border-risk-high-border',
    dot: 'bg-risk-high',
    solid: 'bg-risk-high text-risk-high-fg',
    cell: 'bg-risk-high-bg text-risk-high-text',
    level: 3,
  },
  Critical: {
    text: 'text-risk-critical-text',
    bg: 'bg-risk-critical-bg',
    border: 'border-risk-critical-border',
    dot: 'bg-risk-critical',
    solid: 'bg-risk-critical text-risk-critical-fg',
    cell: 'bg-risk-critical-bg text-risk-critical-text',
    level: 4,
  },
}

/** "Not rated" is a designed state: hatched, neutral, never a flat grey that looks broken. */
export const UNRATED_STYLE = {
  text: 'text-risk-unrated-text',
  bg: 'bg-risk-unrated-bg',
  border: 'border-risk-unrated-border',
  pattern: 'hatch',
} as const

function rating(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' || s === 'null' || s === 'None' ? null : s
}

export function scoreOf(likelihood: number | null, impact: number | null): number | null {
  return likelihood != null && impact != null ? likelihood * impact : null
}

/** A row of PER_TRN_IDENTIFY_RISK in app-friendly form. */
export interface Risk {
  uuid: number
  statement: string | null
  process: string | null
  subProcess: string | null
  category: string | null
  owner: string | null
  champion: string | null
  inherentLikelihood: number | null
  inherentImpact: number | null
  inherentScore: number | null
  residualLikelihood: number | null
  residualImpact: number | null
  residualScore: number | null
  /** Single loss expectancy (money), as recorded. */
  sle: number | null
  approvalStatus: string | null
  isComplete: boolean
  isActive: boolean
  cycleUuid: number | null
  /** IDENTIFY_RISK_UUID: the parent record this risk belongs to (legacy assessment link). */
  parentUuid: number | null
  referenceNumber: string | null
  registeredDate: string | null
  startDate: string | null
  endDate: string | null
  createdOn: string | null
  raw: Record<string, unknown>
}

export function toRisk(row: Record<string, unknown>): Risk {
  const inherentLikelihood = rating(row.inherent_likelihood)
  const inherentImpact = rating(row.inherent_impact)
  const residualLikelihood = rating(row.residual_likelihood)
  const residualImpact = rating(row.residual_impact)
  return {
    uuid: Number(row.uuid ?? row.id),
    statement: str(row.risk_statement),
    process: str(row.process_name),
    subProcess: str(row.sub_process_name),
    category: str(row.risk_type),
    owner: str(row.risk_owner),
    champion: str(row.risk_champion),
    inherentLikelihood,
    inherentImpact,
    inherentScore: scoreOf(inherentLikelihood, inherentImpact),
    residualLikelihood,
    residualImpact,
    residualScore: scoreOf(residualLikelihood, residualImpact),
    sle: num(row.inherent_sle),
    approvalStatus: str(row.approval_status)?.toUpperCase() ?? null,
    isComplete: row.is_stage_complted === 'Y',
    isActive: row.status !== 'N',
    cycleUuid: num(row.assessment_cycle_uuid),
    parentUuid: num(row.identify_risk_uuid),
    referenceNumber: str(row.assessment_reference_number),
    registeredDate: str(row.assessment_registered_date),
    startDate: str(row.start_date),
    endDate: str(row.end_date),
    createdOn: str(row.created_on),
    raw: row,
  }
}

/** The score to show when one number is needed: residual if assessed, else inherent. */
export function currentScore(r: Risk): number | null {
  return r.residualScore ?? r.inherentScore
}

/** Counts per band (plus not rated) for a set of scores. */
export function bandCounts(scores: (number | null)[], bands: RiskBands = DEFAULT_BANDS) {
  const counts: Record<Band | 'Not rated', number> = { Low: 0, Moderate: 0, High: 0, Critical: 0, 'Not rated': 0 }
  for (const s of scores) counts[bandOf(s, bands) ?? 'Not rated']++
  return counts
}

/** 5×5 matrix of risk counts: cells[likelihood-1][impact-1]. */
export function heatmapCells(risks: Risk[], which: 'inherent' | 'residual'): { cells: Risk[][][]; unrated: number } {
  const cells: Risk[][][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => [] as Risk[]))
  let unrated = 0
  for (const r of risks) {
    const l = which === 'inherent' ? r.inherentLikelihood : r.residualLikelihood
    const i = which === 'inherent' ? r.inherentImpact : r.residualImpact
    if (l == null || i == null) unrated++
    else cells[l - 1]![i - 1]!.push(r)
  }
  return { cells, unrated }
}
