/** Display helpers. Missing values always render as an em dash, never as 0 or a made-up default. */

export const DASH = '—'

export function formatMoney(value: number | null | undefined, currency = 'USD', opts: { compact?: boolean } = {}): string {
  if (value == null || !Number.isFinite(value)) return DASH
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : 0,
  }).format(value)
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return DASH
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)
}

export function formatPct(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return DASH
  return `${value.toFixed(digits)}%`
}

/** Share of `part` in `whole` as a percentage, or null when there is nothing to divide by. */
export function pctOf(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  if (!value) return DASH
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? DASH : d.toLocaleDateString(undefined, opts)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return DASH
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? DASH : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** YYYY-MM-DD for <input type="date">, or '' when empty. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/** Whole days from today until a date (negative = overdue), or null. */
export function daysUntil(value: string | null | undefined, now = new Date()): number | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86_400_000)
}
