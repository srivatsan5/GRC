'use client'

/**
 * Charter chart pieces for the executive dashboard and analytics pages.
 * Token classes only; every colour travels with a number, a word or an icon.
 *
 *  - BandSplitBar     100% stacked bar per band, counts inside, hatched "Not rated"
 *  - BandSwatchLegend swatches for the band split bars
 *  - AppetiteBullets  bullet chart per appetite category on a 0–25 track
 *  - MonthColumns     12 monthly columns with value labels and zero ticks
 *  - KriBreachTile    the loud KRI breach tile with a threshold strip
 */
import Link from 'next/link'
import React from 'react'
import { ArrowDown, ArrowUp, OctagonAlert, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BANDS, BAND_STYLES, type Band, type RiskBands } from '@/lib/risk'
import type { KriDefinition, KriReading } from '@/lib/kri'
import { formatDate } from '@/lib/format'
import { BandBadge } from '@/components/band-badge'

export type BandCounts = Record<Band | 'Not rated', number>

const STACK_ORDER: (Band | 'Not rated')[] = ['Critical', 'High', 'Moderate', 'Low', 'Not rated']
const UNRATED_SEGMENT = 'hatch bg-surface-sunken text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border)]'

// ── Band split bars ──────────────────────────────────────────────────────────

/** A 100% stacked bar: Critical → Low, then a hatched Not rated segment. Counts sit inside each segment. */
export function BandSplitBar({ counts, label, className }: { counts: BandCounts; label: string; className?: string }) {
  const parts = STACK_ORDER.map(k => ({ k, n: counts[k] })).filter(p => p.n > 0)
  const total = parts.reduce((s, p) => s + p.n, 0)
  const aria = `${label}: ${parts.map(p => `${p.n} ${p.k}`).join(', ') || 'no risks'}`
  if (!total) return <div role="img" aria-label={aria} className={cn('h-[30px] rounded-[5px] bg-surface-sunken shadow-[inset_0_0_0_1px_var(--border)]', className)} />
  return (
    <div role="img" aria-label={aria} className={cn('flex h-[30px] gap-[3px] text-caption font-semibold tabular-nums', className)}>
      {parts.map((p, idx) => (
        <span
          key={p.k}
          title={`${p.n} ${p.k}`}
          style={{ flexGrow: p.n, flexBasis: 0 }}
          className={cn(
            'flex min-w-7 items-center rounded-[2px] pl-2.5',
            idx === 0 && 'rounded-l-[5px]',
            idx === parts.length - 1 && 'rounded-r-[5px]',
            p.k === 'Not rated' ? UNRATED_SEGMENT : BAND_STYLES[p.k].solid,
          )}
        >
          {p.n}
        </span>
      ))}
    </div>
  )
}

export function BandSwatchLegend({ className, showUnrated = true }: { className?: string; showUnrated?: boolean }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-3.5 gap-y-1 text-caption text-foreground-secondary', className)}>
      {[...BANDS].reverse().map(b => (
        <li key={b} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', BAND_STYLES[b].dot)} />
          {b}
        </li>
      ))}
      {showUnrated && (
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="hatch size-2.5 rounded-[3px] bg-surface-sunken shadow-[inset_0_0_0_1px_var(--border-strong)]" />
          Not rated
        </li>
      )}
    </ul>
  )
}

// ── Exposure against appetite (bullet charts) ────────────────────────────────

export interface AppetiteRow {
  key: string | number
  category: string
  posture: string | null
  tolerance: number | null
  /** Highest current score among rated active risks in the category; null = none */
  current: number | null
  ratedCount: number
}

const ZONE_BG: Record<Band, string> = {
  Low: 'bg-risk-low-bg',
  Moderate: 'bg-risk-moderate-bg',
  High: 'bg-risk-high-bg',
  Critical: 'bg-risk-critical-bg',
}

function zones(b: RiskBands) {
  const w = (from: number, to: number) => (Math.max(0, to - from + 1) / 25) * 100
  return [
    { band: 'Low' as Band, w: w(1, b.moderate - 1) },
    { band: 'Moderate' as Band, w: w(b.moderate, b.high - 1) },
    { band: 'High' as Band, w: w(b.high, b.critical - 1) },
    { band: 'Critical' as Band, w: w(b.critical, 25) },
  ]
}

const pos = (score: number) => `${(Math.max(0, Math.min(25, score)) / 25) * 100}%`

const BULLET_GRID = 'grid grid-cols-[minmax(96px,128px)_minmax(120px,1fr)_minmax(0,124px)_52px] items-center gap-4'

/** One row per appetite category: band washes on a 0–25 track, tolerance as an ink tick, current exposure as a bar. */
export function AppetiteBullets({ rows, bands }: { rows: AppetiteRow[]; bands: RiskBands }) {
  const z = zones(bands)
  const short: Record<Band, string> = { Low: 'Low', Moderate: 'Mod.', High: 'High', Critical: 'Critical' }
  return (
    <div className="min-w-[520px]">
      <div className={cn(BULLET_GRID, 'pb-1')} aria-hidden="true">
        <span />
        <div className="flex text-[11px] text-muted-foreground">
          {z.map(s => (
            <span key={s.band} style={{ width: `${s.w}%` }} className="truncate">
              {short[s.band]}
            </span>
          ))}
        </div>
        <span className="label-caps text-[11px]">Tolerance</span>
        <span className="label-caps text-right text-[11px]">Current</span>
      </div>
      <ul>
        {rows.map(r => {
          const above = r.current != null && r.tolerance != null && r.current > r.tolerance
          const aria = `${r.category}: tolerance ${r.tolerance ?? 'not set'}, current ${r.current ?? 'not measured'}${above ? ', above tolerance' : ''}`
          return (
            <li key={r.key} className={cn(BULLET_GRID, 'border-t py-2.5')}>
              <span className="flex min-w-0 flex-col leading-[17px]">
                <span className="truncate text-body font-medium text-foreground" title={r.category}>
                  {r.category}
                </span>
                <span className="text-caption text-muted-foreground">{r.posture ?? '—'}</span>
              </span>
              <div role="img" aria-label={aria} className="relative flex h-3">
                {z.map((s, i) => (
                  <span
                    key={s.band}
                    style={{ width: `${s.w}%` }}
                    className={cn(ZONE_BG[s.band], 'shadow-[inset_0_0_0_1px_var(--border)]', i === 0 && 'rounded-l-full', i === z.length - 1 && 'rounded-r-full')}
                  />
                ))}
                {r.current != null && (
                  <span
                    className={cn('absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full', above ? 'bg-risk-critical' : 'bg-foreground-secondary')}
                    style={{ width: pos(r.current) }}
                  />
                )}
                {r.tolerance != null && (
                  <span className="absolute -top-1 h-5 w-[3px] -translate-x-1/2 rounded-[2px] bg-foreground shadow-[0_0_0_2px_var(--card)]" style={{ left: pos(r.tolerance) }} />
                )}
              </div>
              <span className="min-w-0">{r.tolerance != null ? <BandBadge score={r.tolerance} variant="soft" kind="Tolerance" /> : <span className="text-caption text-muted-foreground">Not set</span>}</span>
              <span className="text-right">
                {r.current == null ? (
                  <span className="text-body-sm text-muted-foreground" aria-label="Not measured">
                    —
                  </span>
                ) : (
                  <span
                    className={cn('inline-flex items-center justify-end gap-1 figure text-figure-sm', above ? 'text-risk-critical-text' : 'text-foreground')}
                    title={`Highest of ${r.ratedCount} rated risk${r.ratedCount === 1 ? '' : 's'}${above ? ', above tolerance' : ''}`}
                  >
                    {above && <TriangleAlert className="size-3.5" strokeWidth={2} aria-hidden="true" />}
                    {r.current}
                    {above && <span className="sr-only"> (above tolerance)</span>}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── New risks per month ──────────────────────────────────────────────────────

export interface MonthDatum {
  key: string
  short: string
  long: string
  count: number
}

export function MonthColumns({ data, className }: { data: MonthDatum[]; className?: string }) {
  const max = Math.max(1, ...data.map(d => d.count))
  const nonZero = data.filter(d => d.count > 0)
  const aria = nonZero.length ? `${nonZero.map(d => `${d.count} in ${d.long}`).join(', ')}; none in other months` : 'No new risks in these months'
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div role="img" aria-label={aria} className="grid h-[120px] gap-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map(d => (
          <div key={d.key} className="flex h-full flex-col items-center justify-end gap-1" title={`${d.long}: ${d.count}`}>
            {d.count > 0 && <span className="figure text-body-lg leading-none text-foreground">{d.count}</span>}
            {d.count > 0 ? (
              <span className="w-full max-w-[26px] rounded-t-[4px] bg-primary" style={{ height: `${Math.max(4, (d.count / max) * 92)}px` }} />
            ) : (
              <span className="h-px w-full max-w-[26px] bg-border-strong" />
            )}
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="grid gap-1.5 text-center text-[11px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map(d => (
          <span key={d.key}>{d.short}</span>
        ))}
      </div>
    </div>
  )
}

// ── KRI breach tile ──────────────────────────────────────────────────────────

export function fmtValue(v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/** Green / amber / red zones from the KRI's own thresholds and direction, with a marker at the reading. */
export function ThresholdStrip({ kri, value, className }: { kri: Pick<KriDefinition, 'amber' | 'red' | 'direction'>; value: number; className?: string }) {
  const { amber, red, direction } = kri
  if (amber == null || red == null) return null
  const higher = direction === 'HIGHER_WORSE'
  const span = Math.abs(red - amber) || Math.abs(red) || 1
  const lo = Math.min(0, value, amber, red)
  const hi = higher ? Math.max(red + span, value + span * 0.25) : Math.max(amber + span, value + span * 0.25)
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100
  const segs = higher
    ? [
        { tone: 'bg-kri-green', w: pct(amber) },
        { tone: 'bg-kri-amber', w: pct(red) - pct(amber) },
        { tone: 'bg-kri-red', w: 100 - pct(red) },
      ]
    : [
        { tone: 'bg-kri-red', w: pct(red) },
        { tone: 'bg-kri-amber', w: pct(amber) - pct(red) },
        { tone: 'bg-kri-green', w: 100 - pct(amber) },
      ]
  const labels = higher
    ? [`Within appetite < ${fmtValue(amber)}`, `Warning ≥ ${fmtValue(amber)}`, `Breach ≥ ${fmtValue(red)}`]
    : [`Breach ≤ ${fmtValue(red)}`, `Warning ≤ ${fmtValue(amber)}`, `Within appetite > ${fmtValue(amber)}`]
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        role="img"
        aria-label={`Reading ${fmtValue(value)} against warning at ${fmtValue(amber)} and breach at ${fmtValue(red)} (${higher ? 'higher is worse' : 'lower is worse'})`}
        className="relative flex h-1.5 gap-0.5"
      >
        {segs.map((s, i) => (
          <span key={i} style={{ width: `${Math.max(0, s.w)}%` }} className={cn(s.tone, i === 0 && 'rounded-l-full', i === segs.length - 1 && 'rounded-r-full')} />
        ))}
        <span
          className="absolute -top-[5px] h-4 w-[3px] -translate-x-1/2 rounded-[2px] bg-foreground shadow-[0_0_0_2px_var(--risk-critical-bg)]"
          style={{ left: `${Math.max(0, Math.min(100, pct(value)))}%` }}
        />
      </div>
      <div aria-hidden="true" className="flex justify-between gap-2 text-[11px] text-foreground-secondary tabular-nums">
        {labels.map(l => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  )
}

export function KriBreachTile({ kri, latest, previous, href = '/kri' }: { kri: KriDefinition; latest: KriReading; previous: KriReading | null; href?: string }) {
  const delta = previous ? latest.value - previous.value : null
  const worse = delta != null && delta !== 0 && (kri.direction === 'HIGHER_WORSE' ? delta > 0 : delta < 0)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 rounded-[10px] bg-risk-critical-bg px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--risk-critical-text)]">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="inline-flex h-5 items-center gap-1.5 self-start rounded-sm bg-risk-critical px-2 text-caption font-medium text-risk-critical-fg">
          <OctagonAlert className="size-3" strokeWidth={2} aria-hidden="true" />
          Breach
        </span>
        <Link href={href} className="truncate rounded-xs font-display text-[17px] leading-[22px] text-foreground hover:underline focus-ring" title={kri.name || kri.code}>
          {kri.name || kri.code}
        </Link>
        <span className="truncate text-caption text-muted-foreground tabular-nums">
          {kri.code && <span className="font-mono">{kri.code}</span>}
          {kri.owner && <> · {kri.owner}</>} · read {formatDate(latest.date)}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="figure text-[30px] leading-[30px] text-risk-critical-text">
          {fmtValue(latest.value)}
          {kri.unit && <span className="ml-1 font-sans text-caption text-muted-foreground">{kri.unit}</span>}
        </span>
        {delta != null && previous && (
          <span className={cn('inline-flex items-center gap-0.5 text-caption font-medium tabular-nums', worse ? 'text-risk-critical-text' : 'text-status-success-fg')}>
            {delta > 0 ? <ArrowUp className="size-3" strokeWidth={2.25} aria-hidden="true" /> : delta < 0 ? <ArrowDown className="size-3" strokeWidth={2.25} aria-hidden="true" /> : null}
            {delta > 0 ? '+' : ''}
            {fmtValue(delta)} vs {formatDate(previous.date, { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      <ThresholdStrip kri={kri} value={latest.value} className="col-span-2 mt-1.5" />
    </div>
  )
}

